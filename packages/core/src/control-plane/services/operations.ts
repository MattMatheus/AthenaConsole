import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { AthenaError } from "../../runtime/errors.js";
import { acquireSessionLock } from "../../runtime/session-lock.js";
import type {
  CapabilitySet,
  OperationsCostSummary,
  OperationsSummary,
  ProviderCostSettings,
  ProviderTokenPricing
} from "../../shared/contracts.js";
import type { AthenaConfig } from "../../shared/config.js";
import type { ExecutionBackend, SandboxExecutionBackend } from "../backends.js";
import { computeOperationsHealthMetrics, type IOperationsMetricsProvider } from "../backends/operations-metrics-provider.js";
import { openAppStateDatabase } from "../app-state/index.js";
import type { AppStateDatabase, UsageLedgerRecord } from "../app-state/index.js";
import type { CapabilityService, EventService, OperationsService, RunService } from "../interfaces.js";
import type { StateStore } from "../state-store.js";

const OPERATIONS_SUMMARY_CACHE_TTL_MS = 5_000;
const RECENT_FAILURE_WINDOW_MS = 24 * 60 * 60 * 1_000;
const OPERATIONS_COST_EVENT_TYPES = ["run.completed", "agent.run.completed", "agent.run.completed"] as const;
const RECENT_FAILURE_EVENT_TYPES = [
  "authz.denied",
  "policy.concurrency.rejected",
  "agent.run.failed",
  "agent.run.failed",
  "sandbox.egress-policy",
  "sandbox.quota-exceeded"
] as const;
const PROVIDER_COST_SETTINGS_SCHEMA_VERSION = 1;
const DEFAULT_COST_SETTINGS_FILE = "provider-cost-settings.json";
const DEFAULT_COST_SETTINGS_LOCK_FILE = "provider-cost-settings.lock";

type CostTotals = { spend: number; input: number; output: number; total: number };

export interface OperationsExternalCostProvider {
  provider: string;
  getMonthlyCostUsd(request: { month: string; windowStart: string; windowEnd: string }): Promise<number | undefined>;
}

export class LocalOperationsMetricsProvider implements IOperationsMetricsProvider {
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

  async getMetrics(): Promise<Omit<OperationsSummary, "capabilities">> {
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
    const health = computeOperationsHealthMetrics({ total, failed });

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

export class LocalOperationsService implements OperationsService {
  private readonly providerCostSettingsDir: string;
  private readonly providerCostSettingsPath: string;
  private readonly providerCostSettingsLockPath: string;
  private cachedSummary: OperationsSummary | undefined;
  private cacheExpiresAtMs = 0;
  private inFlightSummary: Promise<OperationsSummary> | undefined;

  constructor(
    private readonly config: AthenaConfig,
    private readonly metricsProvider: IOperationsMetricsProvider,
    private readonly runService: RunService,
    private readonly eventService: EventService,
    private readonly externalCostProvider?: OperationsExternalCostProvider
  ) {
    this.providerCostSettingsDir = resolve(config.workspaceRoot, config.stateDir, "operations");
    this.providerCostSettingsPath = resolve(this.providerCostSettingsDir, DEFAULT_COST_SETTINGS_FILE);
    this.providerCostSettingsLockPath = resolve(this.providerCostSettingsDir, DEFAULT_COST_SETTINGS_LOCK_FILE);
  }

  async getSummary(): Promise<OperationsSummary> {
    const now = Date.now();
    if (this.cachedSummary && now < this.cacheExpiresAtMs) {
      return cloneOperationsSummary(this.cachedSummary);
    }
    if (this.inFlightSummary) {
      return this.inFlightSummary;
    }
    this.inFlightSummary = this.buildSummary()
      .then((summary) => {
        this.cachedSummary = cloneOperationsSummary(summary);
        this.cacheExpiresAtMs = Date.now() + OPERATIONS_SUMMARY_CACHE_TTL_MS;
        return cloneOperationsSummary(summary);
      })
      .finally(() => {
        this.inFlightSummary = undefined;
      });
    return this.inFlightSummary;
  }

  async getOperationsProviderCostSettings(): Promise<ProviderCostSettings> {
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
          throw new AthenaError("CONFIG_ERROR", "operations.cost.settings.providers[].provider must be non-empty.");
        }
        if (!Number.isFinite(row.inputCostPer1kTokensUsd) || row.inputCostPer1kTokensUsd < 0) {
          throw new AthenaError(
            "CONFIG_ERROR",
            `operations.cost.settings.providers.${provider}.inputCostPer1kTokensUsd must be >= 0.`
          );
        }
        if (!Number.isFinite(row.outputCostPer1kTokensUsd) || row.outputCostPer1kTokensUsd < 0) {
          throw new AthenaError(
            "CONFIG_ERROR",
            `operations.cost.settings.providers.${provider}.outputCostPer1kTokensUsd must be >= 0.`
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

  private async buildSummary(): Promise<OperationsSummary> {
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

  private async computeCostSummary(month: string): Promise<OperationsCostSummary> {
    const window = resolveMonthWindow(month);
    const settings = await this.getOperationsProviderCostSettings();
    const pricingByProvider = new Map(settings.providers.map((row) => [row.provider, row]));

    const agentTotals = new Map<string, CostTotals>();
    const providerTotals = new Map<string, CostTotals>();
    const modelTotals = new Map<string, CostTotals>();
    const userTotals = new Map<string, CostTotals>();
    const workspaceTotals = new Map<string, CostTotals>();
    const dailyTotals = new Map<string, CostTotals>();
    const ledgerRows = this.listUsageLedgerRows(window);
    if (ledgerRows.length > 0) {
      for (const row of ledgerRows) {
        const provider = row.provider ?? "unknown";
        const usage = {
          inputTokens: row.inputTokens,
          outputTokens: row.outputTokens,
          totalTokens: row.totalTokens
        };
        if (usage.totalTokens <= 0) {
          continue;
        }
        const spend = row.costUsd ?? estimateUsageSpendUsd(row.inputTokens, row.outputTokens, pricingByProvider.get(provider));
        accumulateCost(agentTotals, row.agentId ?? "unattributed", usage, spend);
        accumulateCost(providerTotals, provider, usage, spend);
        accumulateCost(modelTotals, `${provider}\u0000${row.model ?? "unknown"}`, usage, spend);
        accumulateCost(userTotals, row.userId ?? "unknown", usage, spend);
        accumulateCost(workspaceTotals, row.workspaceId ?? "default", usage, spend);
        accumulateCost(dailyTotals, row.recordedAt.slice(0, 10), usage, spend);
      }
    } else {
      let cursor: string | undefined;
      do {
        const page = await this.eventService.list({
          ...(cursor ? { cursor } : {}),
          limit: 500,
          createdAfter: window.windowStart,
          createdBefore: window.windowEnd,
          types: [...OPERATIONS_COST_EVENT_TYPES]
        });
        for (const event of page.events) {
          const payload = toObject(event.payload);
          const provider = readString(payload.provider) ?? "unknown";
          const agentName = readString(payload.agentName) ?? readString(payload.agentId) ?? "unattributed";
          const model = readString(payload.model) ?? "unknown";
          const usage = normalizeUsage(toObject(payload.usage));
          if (usage.totalTokens <= 0) {
            continue;
          }
          const pricing = pricingByProvider.get(provider);
          const spend = readNumber(payload.costUsd) ?? estimateUsageSpendUsd(usage.inputTokens, usage.outputTokens, pricing);
          accumulateCost(agentTotals, agentName, usage, spend);
          accumulateCost(providerTotals, provider, usage, spend);
          accumulateCost(modelTotals, `${provider}\u0000${model}`, usage, spend);
          accumulateCost(userTotals, readString(payload.userId) ?? "unknown", usage, spend);
          accumulateCost(workspaceTotals, readString(payload.workspaceId) ?? "default", usage, spend);
          accumulateCost(dailyTotals, event.createdAt.slice(0, 10), usage, spend);
        }
        cursor = page.nextCursor;
      } while (cursor);
    }

    const tokenMix = deriveTokenMix([...agentTotals.values()]);
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
        // Billing API failures should not break operations summary reads.
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
      agentBreakdown: [...agentTotals.entries()]
        .map(([agentName, totals]) => ({
          agentName,
          estimatedSpendUsd: roundTo6(totals.spend),
          inputTokens: totals.input,
          outputTokens: totals.output,
          totalTokens: totals.total
        }))
        .sort((left, right) => right.estimatedSpendUsd - left.estimatedSpendUsd),
      providerBreakdown,
      modelBreakdown: [...modelTotals.entries()]
        .map(([key, totals]) => {
          const [provider = "unknown", model = "unknown"] = key.split("\u0000");
          return {
            provider,
            model,
            estimatedSpendUsd: roundTo6(totals.spend),
            inputTokens: totals.input,
            outputTokens: totals.output,
            totalTokens: totals.total
          };
        })
        .sort((left, right) => right.estimatedSpendUsd - left.estimatedSpendUsd),
      userBreakdown: [...userTotals.entries()]
        .map(([userId, totals]) => ({
          userId,
          estimatedSpendUsd: roundTo6(totals.spend),
          inputTokens: totals.input,
          outputTokens: totals.output,
          totalTokens: totals.total
        }))
        .sort((left, right) => right.estimatedSpendUsd - left.estimatedSpendUsd),
      workspaceBreakdown: [...workspaceTotals.entries()]
        .map(([workspaceId, totals]) => ({
          workspaceId,
          estimatedSpendUsd: roundTo6(totals.spend),
          inputTokens: totals.input,
          outputTokens: totals.output,
          totalTokens: totals.total
        }))
        .sort((left, right) => right.estimatedSpendUsd - left.estimatedSpendUsd),
      dailyTrend: [...dailyTotals.entries()]
        .map(([date, totals]) => ({
          date,
          estimatedSpendUsd: roundTo6(totals.spend),
          inputTokens: totals.input,
          outputTokens: totals.output,
          totalTokens: totals.total
        }))
        .sort((left, right) => left.date.localeCompare(right.date)),
      tokenMix
    };
  }

  private listUsageLedgerRows(window: { windowStart: string; windowEnd: string }): UsageLedgerRecord[] {
    let appState: AppStateDatabase | undefined;
    try {
      appState = openAppStateDatabase(this.config);
      return appState.usageLedger.list({
        windowStart: window.windowStart,
        windowEnd: window.windowEnd,
        limit: 1000
      });
    } catch {
      return [];
    } finally {
      appState?.close();
    }
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
      // Keep operations summary reads available even if settings file is malformed.
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
    private readonly metricsProvider: IOperationsMetricsProvider,
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

function cloneOperationsSummary(summary: OperationsSummary): OperationsSummary {
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
            agentBreakdown: summary.costSummary.agentBreakdown.map((row) => ({ ...row })),
            providerBreakdown: summary.costSummary.providerBreakdown.map((row) => ({ ...row })),
            modelBreakdown: summary.costSummary.modelBreakdown.map((row) => ({ ...row })),
            userBreakdown: summary.costSummary.userBreakdown.map((row) => ({ ...row })),
            workspaceBreakdown: summary.costSummary.workspaceBreakdown.map((row) => ({ ...row })),
            dailyTrend: summary.costSummary.dailyTrend.map((row) => ({ ...row })),
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
    throw new AthenaError("CONFIG_ERROR", "operations.cost.month must match YYYY-MM.");
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

function deriveTokenMix(rows: Array<{ input: number; output: number; total: number }>): OperationsCostSummary["tokenMix"] {
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

function formatCostSummaryCsv(summary: OperationsCostSummary): string {
  const rows: string[][] = [];
  rows.push(["month", summary.month]);
  rows.push(["windowStart", summary.windowStart]);
  rows.push(["windowEnd", summary.windowEnd]);
  rows.push(["totalEstimatedSpendUsd", summary.totalEstimatedSpendUsd.toFixed(6)]);
  rows.push([]);

  rows.push(["agentName", "estimatedSpendUsd", "inputTokens", "outputTokens", "totalTokens"]);
  for (const row of summary.agentBreakdown) {
    rows.push([
      row.agentName,
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

  rows.push(["provider", "model", "estimatedSpendUsd", "inputTokens", "outputTokens", "totalTokens"]);
  for (const row of summary.modelBreakdown) {
    rows.push([
      row.provider,
      row.model,
      row.estimatedSpendUsd.toFixed(6),
      String(row.inputTokens),
      String(row.outputTokens),
      String(row.totalTokens)
    ]);
  }
  rows.push([]);

  rows.push(["userId", "estimatedSpendUsd", "inputTokens", "outputTokens", "totalTokens"]);
  for (const row of summary.userBreakdown) {
    rows.push([
      row.userId,
      row.estimatedSpendUsd.toFixed(6),
      String(row.inputTokens),
      String(row.outputTokens),
      String(row.totalTokens)
    ]);
  }
  rows.push([]);

  rows.push(["workspaceId", "estimatedSpendUsd", "inputTokens", "outputTokens", "totalTokens"]);
  for (const row of summary.workspaceBreakdown) {
    rows.push([
      row.workspaceId,
      row.estimatedSpendUsd.toFixed(6),
      String(row.inputTokens),
      String(row.outputTokens),
      String(row.totalTokens)
    ]);
  }
  rows.push([]);

  rows.push(["date", "estimatedSpendUsd", "inputTokens", "outputTokens", "totalTokens"]);
  for (const row of summary.dailyTrend) {
    rows.push([
      row.date,
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
