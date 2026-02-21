import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { AthenaError } from "../../runtime/errors.js";
import { acquireSessionLock } from "../../runtime/session-lock.js";
import type {
  CapabilitySet,
  FleetCostSummary,
  FleetSummary,
  ProviderCostSettings,
  ProviderTokenPricing
} from "../../shared/contracts.js";
import type { AthenaConfig } from "../../shared/config.js";
import type { ExecutionBackend, SandboxExecutionBackend } from "../backends.js";
import { computeFleetHealthMetrics, type IFleetMetricsProvider } from "../backends/fleet-metrics-provider.js";
import type { CapabilityService, EventService, FleetService, RunService } from "../interfaces.js";
import type { StateStore } from "../state-store.js";

const FLEET_SUMMARY_CACHE_TTL_MS = 5_000;
const RECENT_FAILURE_WINDOW_MS = 24 * 60 * 60 * 1_000;
const FLEET_COST_EVENT_TYPES = ["run.completed", "specialist.run.completed", "persona.run.completed"] as const;
const RECENT_FAILURE_EVENT_TYPES = [
  "authz.denied",
  "policy.concurrency.rejected",
  "specialist.run.failed",
  "persona.run.failed",
  "sandbox.egress-policy",
  "sandbox.quota-exceeded"
] as const;
const PROVIDER_COST_SETTINGS_SCHEMA_VERSION = 1;
const DEFAULT_COST_SETTINGS_FILE = "provider-cost-settings.json";
const DEFAULT_COST_SETTINGS_LOCK_FILE = "provider-cost-settings.lock";

export interface FleetExternalCostProvider {
  provider: string;
  getMonthlyCostUsd(request: { month: string; windowStart: string; windowEnd: string }): Promise<number | undefined>;
}

export class LocalFleetMetricsProvider implements IFleetMetricsProvider {
  readonly source = "local" as const;

  constructor(
    private readonly stateStore: StateStore,
    private readonly runtimeActiveDir: string,
    private readonly runtimeCancelDir: string
  ) {}

  async getCapabilities(): Promise<{ supportsPodStatus: boolean; supportsCpuMemMetrics: boolean }> {
    return {
      supportsPodStatus: false,
      supportsCpuMemMetrics: false
    };
  }

  async getMetrics(): Promise<Omit<FleetSummary, "capabilities">> {
    const sessions = await this.stateStore.listSessions();
    let pending = 0;
    for (const session of sessions) {
      const queue = await this.stateStore.getWorkQueue(session.id);
      if (queue.items.length > 0) {
        pending += 1;
      }
    }
    const running = await countJsonStateFiles(this.runtimeActiveDir);
    const failed = await countJsonStateFiles(this.runtimeCancelDir);
    const total = Math.max(sessions.length, running + pending + failed);
    const succeeded = Math.max(total - running - pending - failed, 0);
    const health = computeFleetHealthMetrics({ total, failed });

    return {
      total,
      running,
      pending,
      succeeded,
      failed,
      ...health
    };
  }
}

export class LocalFleetService implements FleetService {
  private readonly providerCostSettingsDir: string;
  private readonly providerCostSettingsPath: string;
  private readonly providerCostSettingsLockPath: string;
  private cachedSummary: FleetSummary | undefined;
  private cacheExpiresAtMs = 0;
  private inFlightSummary: Promise<FleetSummary> | undefined;

  constructor(
    private readonly config: AthenaConfig,
    private readonly metricsProvider: IFleetMetricsProvider,
    private readonly runService: RunService,
    private readonly eventService: EventService,
    private readonly externalCostProvider?: FleetExternalCostProvider
  ) {
    this.providerCostSettingsDir = resolve(config.workspaceRoot, config.stateDir, "fleet");
    this.providerCostSettingsPath = resolve(this.providerCostSettingsDir, DEFAULT_COST_SETTINGS_FILE);
    this.providerCostSettingsLockPath = resolve(this.providerCostSettingsDir, DEFAULT_COST_SETTINGS_LOCK_FILE);
  }

  async getSummary(): Promise<FleetSummary> {
    const now = Date.now();
    if (this.cachedSummary && now < this.cacheExpiresAtMs) {
      return cloneFleetSummary(this.cachedSummary);
    }
    if (this.inFlightSummary) {
      return this.inFlightSummary;
    }
    this.inFlightSummary = this.buildSummary()
      .then((summary) => {
        this.cachedSummary = cloneFleetSummary(summary);
        this.cacheExpiresAtMs = Date.now() + FLEET_SUMMARY_CACHE_TTL_MS;
        return cloneFleetSummary(summary);
      })
      .finally(() => {
        this.inFlightSummary = undefined;
      });
    return this.inFlightSummary;
  }

  async getProviderCostSettings(): Promise<ProviderCostSettings> {
    return this.withProviderCostSettingsLock(async () => {
      const settings = await this.readProviderCostSettings();
      return cloneProviderCostSettings(settings);
    });
  }

  async updateProviderCostSettings(request: {
    providers: Array<{
      provider: string;
      inputCostPer1kTokensUsd: number;
      outputCostPer1kTokensUsd: number;
    }>;
  }): Promise<ProviderCostSettings> {
    return this.withProviderCostSettingsLock(async () => {
      const nowIso = new Date().toISOString();
      const deduped = new Map<string, ProviderTokenPricing>();
      for (const row of request.providers) {
        const provider = row.provider.trim();
        if (!provider) {
          throw new AthenaError("CONFIG_ERROR", "fleet.cost.settings.providers[].provider must be non-empty.");
        }
        if (!Number.isFinite(row.inputCostPer1kTokensUsd) || row.inputCostPer1kTokensUsd < 0) {
          throw new AthenaError(
            "CONFIG_ERROR",
            `fleet.cost.settings.providers.${provider}.inputCostPer1kTokensUsd must be >= 0.`
          );
        }
        if (!Number.isFinite(row.outputCostPer1kTokensUsd) || row.outputCostPer1kTokensUsd < 0) {
          throw new AthenaError(
            "CONFIG_ERROR",
            `fleet.cost.settings.providers.${provider}.outputCostPer1kTokensUsd must be >= 0.`
          );
        }
        deduped.set(provider, {
          provider,
          inputCostPer1kTokensUsd: roundTo6(row.inputCostPer1kTokensUsd),
          outputCostPer1kTokensUsd: roundTo6(row.outputCostPer1kTokensUsd),
          updatedAt: nowIso
        });
      }
      const next: ProviderCostSettings = {
        schemaVersion: PROVIDER_COST_SETTINGS_SCHEMA_VERSION,
        updatedAt: nowIso,
        providers: [...deduped.values()].sort((left, right) => left.provider.localeCompare(right.provider))
      };
      await this.writeProviderCostSettings(next);
      this.cacheExpiresAtMs = 0;
      return cloneProviderCostSettings(next);
    });
  }

  async exportMonthlyCostCsv(request: { month?: string } = {}): Promise<string> {
    const month = request.month ? normalizeYearMonth(request.month) : toUtcYearMonth(new Date());
    const summary = await this.computeCostSummary(month);
    return formatCostSummaryCsv(summary);
  }

  private async buildSummary(): Promise<FleetSummary> {
    const [metrics, capabilities, costSummary] = await Promise.all([
      this.metricsProvider.getMetrics(),
      this.metricsProvider.getCapabilities(),
      this.computeCostSummary(toUtcYearMonth(new Date()))
    ]);
    const [activeRunStats, recentFailureRejectionCount] = await Promise.all([
      this.getActiveRunStats(),
      this.getRecentFailureRejectionCount()
    ]);
    return {
      ...metrics,
      capabilities: {
        supportsPodStatus: capabilities.supportsPodStatus,
        supportsCpuMemMetrics: capabilities.supportsCpuMemMetrics
      },
      operationalSummary: {
        totalActiveRuns: activeRunStats.totalRuns,
        totalActiveSessions: activeRunStats.totalSessions,
        aggregateResourceUsage: {
          cpuUsage: metrics.cpuUsage ?? 0,
          memoryUsage: metrics.memoryUsage ?? 0
        },
        recentFailureRejectionCount
      },
      costSummary
    };
  }

  private async getActiveRunStats(): Promise<{ totalRuns: number; totalSessions: number }> {
    let cursor: string | undefined;
    let totalRuns = 0;
    const sessionIds = new Set<string>();
    do {
      const page = await this.runService.listActiveRuns({
        ...(cursor ? { cursor } : {}),
        limit: 500
      });
      totalRuns += page.items.length;
      for (const run of page.items) {
        sessionIds.add(run.sessionId);
      }
      cursor = page.nextCursor;
    } while (cursor);
    return {
      totalRuns,
      totalSessions: sessionIds.size
    };
  }

  private async getRecentFailureRejectionCount(): Promise<number> {
    const recentStart = new Date(Date.now() - RECENT_FAILURE_WINDOW_MS).toISOString();
    const events = await this.eventService.list({
      limit: 500,
      createdAfter: recentStart,
      types: [...RECENT_FAILURE_EVENT_TYPES]
    });
    let count = 0;
    for (const event of events.events) {
      if (event.type === "sandbox.egress-policy") {
        const decision = event.payload.decision;
        if (decision !== "blocked" && decision !== "error") {
          continue;
        }
      }
      count += 1;
    }
    return count;
  }

  private async computeCostSummary(month: string): Promise<FleetCostSummary> {
    const window = resolveMonthWindow(month);
    const settings = await this.getProviderCostSettings();
    const pricingByProvider = new Map(settings.providers.map((row) => [row.provider, row]));

    const personaTotals = new Map<string, { spend: number; input: number; output: number; total: number }>();
    const providerTotals = new Map<string, { spend: number; input: number; output: number; total: number }>();
    let cursor: string | undefined;
    do {
      const page = await this.eventService.list({
        ...(cursor ? { cursor } : {}),
        limit: 500,
        createdAfter: window.windowStart,
        createdBefore: window.windowEnd,
        types: [...FLEET_COST_EVENT_TYPES]
      });
      for (const event of page.events) {
        const payload = toObject(event.payload);
        const provider = readString(payload.provider) ?? "unknown";
        const personaName = readString(payload.specialistName) ?? readString(payload.personaName) ?? "unattributed";
        const usage = normalizeUsage(toObject(payload.usage));
        if (usage.totalTokens <= 0) {
          continue;
        }
        const pricing = pricingByProvider.get(provider);
        const spend = estimateUsageSpendUsd(usage.inputTokens, usage.outputTokens, pricing);
        accumulateCost(personaTotals, personaName, usage, spend);
        accumulateCost(providerTotals, provider, usage, spend);
      }
      cursor = page.nextCursor;
    } while (cursor);

    const tokenMix = deriveTokenMix([...personaTotals.values()]);
    const localProviderBreakdown = [...providerTotals.entries()]
      .map(([provider, totals]) => ({
        provider,
        estimatedSpendUsd: roundTo6(totals.spend),
        inputTokens: totals.input,
        outputTokens: totals.output,
        totalTokens: totals.total
      }))
      .sort((left, right) => right.estimatedSpendUsd - left.estimatedSpendUsd);
    const localTotalEstimatedSpendUsd = roundTo6(
      localProviderBreakdown.reduce((acc, row) => acc + row.estimatedSpendUsd, 0)
    );

    let externalTotalEstimatedSpendUsd: number | undefined;
    if (this.externalCostProvider) {
      try {
        const external = await this.externalCostProvider.getMonthlyCostUsd({
          month,
          windowStart: window.windowStart,
          windowEnd: window.windowEnd
        });
        if (external !== undefined && Number.isFinite(external) && external >= 0) {
          externalTotalEstimatedSpendUsd = roundTo6(external);
        }
      } catch {
        // Billing API failures should not break fleet summary reads.
      }
    }

    const providerBreakdown =
      externalTotalEstimatedSpendUsd === undefined
        ? localProviderBreakdown
        : [
            {
              provider: this.externalCostProvider?.provider ?? "external",
              estimatedSpendUsd: externalTotalEstimatedSpendUsd,
              inputTokens: 0,
              outputTokens: 0,
              totalTokens: 0
            }
          ];
    return {
      month,
      windowStart: window.windowStart,
      windowEnd: window.windowEnd,
      totalEstimatedSpendUsd: externalTotalEstimatedSpendUsd ?? localTotalEstimatedSpendUsd,
      personaBreakdown: [...personaTotals.entries()]
        .map(([personaName, totals]) => ({
          personaName,
          estimatedSpendUsd: roundTo6(totals.spend),
          inputTokens: totals.input,
          outputTokens: totals.output,
          totalTokens: totals.total
        }))
        .sort((left, right) => right.estimatedSpendUsd - left.estimatedSpendUsd),
      providerBreakdown,
      tokenMix
    };
  }

  private async withProviderCostSettingsLock<T>(operation: () => Promise<T>): Promise<T> {
    await mkdir(this.providerCostSettingsDir, { recursive: true });
    const lock = await acquireSessionLock(this.providerCostSettingsLockPath, {
      timeoutMs: 5_000,
      retryDelayMs: 20
    });
    try {
      return await operation();
    } finally {
      await lock.release();
    }
  }

  private async readProviderCostSettings(): Promise<ProviderCostSettings> {
    if (!existsSync(this.providerCostSettingsPath)) {
      return {
        schemaVersion: PROVIDER_COST_SETTINGS_SCHEMA_VERSION,
        updatedAt: new Date(0).toISOString(),
        providers: []
      };
    }
    try {
      const raw = await readFile(this.providerCostSettingsPath, "utf8");
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      const providersRaw = Array.isArray(parsed.providers) ? parsed.providers : [];
      const providers: ProviderTokenPricing[] = [];
      for (const row of providersRaw) {
        const record = toObject(row);
        const provider = readString(record.provider);
        const inputCost = readNumber(record.inputCostPer1kTokensUsd);
        const outputCost = readNumber(record.outputCostPer1kTokensUsd);
        const updatedAt = readString(record.updatedAt);
        if (!provider || inputCost === undefined || outputCost === undefined || !updatedAt) {
          continue;
        }
        providers.push({
          provider,
          inputCostPer1kTokensUsd: Math.max(0, inputCost),
          outputCostPer1kTokensUsd: Math.max(0, outputCost),
          updatedAt
        });
      }
      return {
        schemaVersion: PROVIDER_COST_SETTINGS_SCHEMA_VERSION,
        updatedAt: readString(parsed.updatedAt) ?? new Date(0).toISOString(),
        providers: providers.sort((left, right) => left.provider.localeCompare(right.provider))
      };
    } catch {
      // Keep fleet summary reads available even if settings file is malformed.
      return {
        schemaVersion: PROVIDER_COST_SETTINGS_SCHEMA_VERSION,
        updatedAt: new Date(0).toISOString(),
        providers: []
      };
    }
  }

  private async writeProviderCostSettings(settings: ProviderCostSettings): Promise<void> {
    await mkdir(this.providerCostSettingsDir, { recursive: true });
    const tmpPath = `${this.providerCostSettingsPath}.${process.pid}.tmp`;
    await writeFile(tmpPath, `${JSON.stringify(settings, null, 2)}\n`, "utf8");
    await rename(tmpPath, this.providerCostSettingsPath);
    await rm(tmpPath, { force: true });
  }
}

export class LocalCapabilityService implements CapabilityService {
  constructor(
    private readonly backend: ExecutionBackend,
    private readonly metricsProvider: IFleetMetricsProvider,
    private readonly sandboxExecutionBackend: SandboxExecutionBackend
  ) {}

  async getCapabilities(): Promise<CapabilitySet> {
    const [metricsCapabilities, sandboxEnabled] = await Promise.all([
      this.metricsProvider.getCapabilities(),
      this.sandboxExecutionBackend.isAvailable()
    ]);
    return {
      executionBackend: this.backend.kind,
      stateStore: "file" as const,
      supportsPods: metricsCapabilities.supportsPodStatus,
      supportsCpuMemMetrics: metricsCapabilities.supportsCpuMemMetrics,
      supportsSandbox: sandboxEnabled,
      supportsA2ABus: true
    };
  }
}

async function countJsonStateFiles(dirPath: string): Promise<number> {
  if (!existsSync(dirPath)) {
    return 0;
  }
  const names = await readdir(dirPath);
  return names.filter((name) => name.endsWith(".json")).length;
}

function cloneFleetSummary(summary: FleetSummary): FleetSummary {
  return {
    ...summary,
    capabilities: {
      ...summary.capabilities
    },
    ...(summary.operationalSummary
      ? {
          operationalSummary: {
            ...summary.operationalSummary,
            aggregateResourceUsage: {
              ...summary.operationalSummary.aggregateResourceUsage
            }
          }
        }
      : {}),
    ...(summary.costSummary
      ? {
          costSummary: {
            ...summary.costSummary,
            personaBreakdown: summary.costSummary.personaBreakdown.map((row) => ({ ...row })),
            providerBreakdown: summary.costSummary.providerBreakdown.map((row) => ({ ...row })),
            tokenMix: {
              ...summary.costSummary.tokenMix
            }
          }
        }
      : {})
  };
}

function cloneProviderCostSettings(settings: ProviderCostSettings): ProviderCostSettings {
  return {
    schemaVersion: settings.schemaVersion,
    updatedAt: settings.updatedAt,
    providers: settings.providers.map((row) => ({ ...row }))
  };
}

function toUtcYearMonth(value: Date): string {
  const year = value.getUTCFullYear();
  const month = String(value.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function normalizeYearMonth(value: string): string {
  const trimmed = value.trim();
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(trimmed)) {
    throw new AthenaError("CONFIG_ERROR", "fleet.cost.month must match YYYY-MM.");
  }
  return trimmed;
}

function resolveMonthWindow(month: string): { windowStart: string; windowEnd: string } {
  const normalized = normalizeYearMonth(month);
  const [yearRaw, monthRaw] = normalized.split("-");
  const year = Number.parseInt(yearRaw ?? "", 10);
  const monthIndex = Number.parseInt(monthRaw ?? "", 10) - 1;
  const start = new Date(Date.UTC(year, monthIndex, 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(year, monthIndex + 1, 1, 0, 0, 0, 0));
  return {
    windowStart: start.toISOString(),
    windowEnd: end.toISOString()
  };
}

function toObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function readString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function readNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return undefined;
}

function normalizeUsage(value: Record<string, unknown>): { inputTokens: number; outputTokens: number; totalTokens: number } {
  const inputRaw = readNumber(value.inputTokens);
  const outputRaw = readNumber(value.outputTokens);
  const totalRaw = readNumber(value.totalTokens);
  const inputTokens = Math.max(0, Math.floor(inputRaw ?? 0));
  const outputTokens = Math.max(0, Math.floor(outputRaw ?? 0));
  const resolvedTotal = Math.max(0, Math.floor(totalRaw ?? inputTokens + outputTokens));

  if (inputTokens === 0 && outputTokens === 0 && resolvedTotal > 0) {
    const estimatedInput = Math.floor(resolvedTotal / 2);
    const estimatedOutput = Math.max(0, resolvedTotal - estimatedInput);
    return {
      inputTokens: estimatedInput,
      outputTokens: estimatedOutput,
      totalTokens: resolvedTotal
    };
  }

  return {
    inputTokens,
    outputTokens,
    totalTokens: Math.max(resolvedTotal, inputTokens + outputTokens)
  };
}

function estimateUsageSpendUsd(
  inputTokens: number,
  outputTokens: number,
  pricing: ProviderTokenPricing | undefined
): number {
  if (!pricing) {
    return 0;
  }
  const inputSpend = (inputTokens / 1_000) * pricing.inputCostPer1kTokensUsd;
  const outputSpend = (outputTokens / 1_000) * pricing.outputCostPer1kTokensUsd;
  return inputSpend + outputSpend;
}

function accumulateCost(
  target: Map<string, { spend: number; input: number; output: number; total: number }>,
  key: string,
  usage: { inputTokens: number; outputTokens: number; totalTokens: number },
  spend: number
): void {
  const current = target.get(key) ?? {
    spend: 0,
    input: 0,
    output: 0,
    total: 0
  };
  current.spend += spend;
  current.input += usage.inputTokens;
  current.output += usage.outputTokens;
  current.total += usage.totalTokens;
  target.set(key, current);
}

function deriveTokenMix(rows: Array<{ input: number; output: number; total: number }>): FleetCostSummary["tokenMix"] {
  const inputTokens = rows.reduce((acc, row) => acc + row.input, 0);
  const outputTokens = rows.reduce((acc, row) => acc + row.output, 0);
  const totalTokens = rows.reduce((acc, row) => acc + row.total, 0);
  if (totalTokens <= 0) {
    return {
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      inputRatio: 0,
      outputRatio: 0
    };
  }
  return {
    inputTokens,
    outputTokens,
    totalTokens,
    inputRatio: roundTo6(inputTokens / totalTokens),
    outputRatio: roundTo6(outputTokens / totalTokens)
  };
}

function roundTo6(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function formatCostSummaryCsv(summary: FleetCostSummary): string {
  const rows: string[][] = [];
  rows.push(["month", summary.month]);
  rows.push(["windowStart", summary.windowStart]);
  rows.push(["windowEnd", summary.windowEnd]);
  rows.push(["totalEstimatedSpendUsd", summary.totalEstimatedSpendUsd.toFixed(6)]);
  rows.push([]);

  rows.push(["personaName", "estimatedSpendUsd", "inputTokens", "outputTokens", "totalTokens"]);
  for (const row of summary.personaBreakdown) {
    rows.push([
      row.personaName,
      row.estimatedSpendUsd.toFixed(6),
      String(row.inputTokens),
      String(row.outputTokens),
      String(row.totalTokens)
    ]);
  }
  rows.push([]);

  rows.push(["provider", "estimatedSpendUsd", "inputTokens", "outputTokens", "totalTokens"]);
  for (const row of summary.providerBreakdown) {
    rows.push([
      row.provider,
      row.estimatedSpendUsd.toFixed(6),
      String(row.inputTokens),
      String(row.outputTokens),
      String(row.totalTokens)
    ]);
  }
  rows.push([]);
  rows.push(["tokenMix", "inputTokens", "outputTokens", "totalTokens", "inputRatio", "outputRatio"]);
  rows.push([
    "totals",
    String(summary.tokenMix.inputTokens),
    String(summary.tokenMix.outputTokens),
    String(summary.tokenMix.totalTokens),
    String(summary.tokenMix.inputRatio),
    String(summary.tokenMix.outputRatio)
  ]);

  return rows.map((row) => row.map(escapeCsv).join(",")).join("\n");
}

function escapeCsv(value: string): string {
  if (!value.includes(",") && !value.includes('"') && !value.includes("\n")) {
    return value;
  }
  return `"${value.replace(/"/g, '""')}"`;
}
