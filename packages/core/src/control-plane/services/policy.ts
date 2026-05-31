import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { appendFile, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { AthenaError } from "../../runtime/errors.js";
import { acquireSessionLock } from "../../runtime/session-lock.js";
import type { AthenaConfig } from "../../shared/config.js";
import {
  ATHENA_POLICY_ANNOTATION_KEYS,
  ATHENA_POLICY_LABEL_KEYS
} from "../../shared/contracts.js";
import type {
  PolicyDocument,
  PolicyConcurrencyRejectionQuery,
  PolicyConcurrencyRejectionQueryResult,
  PolicyConcurrencyRejectionRecord,
  PolicyOriginDetails,
  PolicyWorkloadMetadata,
  RunRejectionEvent,
  RunRejectionReason,
  SandboxLifecycleEventMetadata
} from "../../shared/contracts.js";
import type { BackendOperationsMetricsSnapshot, ExecutionBackend, SandboxExecutionBackend } from "../backends.js";
import type { DistributedLockAcquireResult, IDistributedLock } from "../distributed-lock.js";
import { assertValidSessionId } from "../../runtime/session-store.js";
import { InMemoryRejectionEventStore, type RejectionEventStore } from "../rejection-event-store.js";
import type { EventService, PolicyService } from "../interfaces.js";

const POLICY_STATE_SCHEMA_VERSION = 1;
const POLICY_DOCUMENT_SCHEMA_VERSION = 1;
const POLICY_CONCURRENCY_REJECTION_LIMIT_DEFAULT = 200;
const POLICY_CONCURRENCY_REJECTION_LIMIT_MAX = 500;
const POLICY_CONCURRENCY_REJECTION_RETENTION_MAX = 500;
const POLICY_CONCURRENCY_LOCK_LEASE_MS = 10 * 60 * 1_000;

interface PolicyConcurrencyLeaseHandle {
  release(): Promise<void>;
}

interface PolicyConcurrencyReservationResult {
  lease: PolicyConcurrencyLeaseHandle;
  activeRuns: number;
}

interface RuntimeIsolationSelection {
  isolationProfile: "standard" | "high-security";
  startMode: "warm" | "cold";
  runtimeClassName?: string;
  requireSandbox: boolean;
}
export class LocalPolicyService implements PolicyService {
  private readonly policyDir: string;
  private readonly statePath: string;
  private readonly lockPath: string;
  private readonly rejectionDir: string;
  private readonly rejectionPath: string;
  private readonly rejectionLockPath: string;
  private readonly rejectionStore: RejectionEventStore;
  private readonly rejectionRetentionMaxRecords: number;

  constructor(
    config: AthenaConfig,
    options: {
      rejectionEventStore?: RejectionEventStore;
      rejectionRetentionMaxRecords?: number;
    } = {}
  ) {
    this.policyDir = resolve(config.workspaceRoot, config.stateDir, "policy");
    this.statePath = resolve(this.policyDir, "policy.json");
    this.lockPath = resolve(this.policyDir, "policy.lock");
    this.rejectionDir = resolve(this.policyDir, "rejections");
    this.rejectionPath = resolve(this.rejectionDir, "events.jsonl");
    this.rejectionLockPath = resolve(this.rejectionDir, "events.lock");
    this.rejectionRetentionMaxRecords = clampLimit(
      options.rejectionRetentionMaxRecords ?? POLICY_CONCURRENCY_REJECTION_RETENTION_MAX,
      1,
      POLICY_CONCURRENCY_REJECTION_LIMIT_MAX
    );
    this.rejectionStore =
      options.rejectionEventStore ??
      new InMemoryRejectionEventStore({
        maxRecords: this.rejectionRetentionMaxRecords,
        defaultLimit: POLICY_CONCURRENCY_REJECTION_LIMIT_DEFAULT,
        maxLimit: POLICY_CONCURRENCY_REJECTION_LIMIT_MAX
      });
  }

  async get(): Promise<PolicyDocument | undefined> {
    return this.withLock(async () => {
      const { state, migrated } = await this.loadState();
      if (migrated) {
        await this.saveState(state);
      }
      return state.policy ?? undefined;
    });
  }

  async put(policy: PolicyDocument): Promise<PolicyDocument> {
    return this.withLock(async () => {
      const { state, migrated } = await this.loadState();
      const normalized = normalizePolicyDocument(policy, {
        serverAuthoredUpdatedAt: new Date().toISOString()
      });
      const next: PolicyStateFile = {
        schemaVersion: POLICY_STATE_SCHEMA_VERSION,
        policy: normalized
      };
      if (migrated || JSON.stringify(state) !== JSON.stringify(next)) {
        await this.saveState(next);
      }
      return normalized;
    });
  }

  async listConcurrencyRejections(
    query: PolicyConcurrencyRejectionQuery = {}
  ): Promise<PolicyConcurrencyRejectionQueryResult> {
    await mkdir(this.rejectionDir, { recursive: true });
    const lock = await acquireSessionLock(this.rejectionLockPath, {
      timeoutMs: 5_000,
      retryDelayMs: 20
    });
    try {
      await this.syncRejectionStoreFromDiskLocked();
      return this.rejectionStore.list(query);
    } finally {
      await lock.release();
    }
  }

  async recordConcurrencyRejection(record: {
    sessionId: string;
    activeRuns: number;
    maxConcurrentRuns: number;
    reason?: RunRejectionReason;
    policy?: PolicyOriginDetails;
  }): Promise<PolicyConcurrencyRejectionRecord> {
    assertValidSessionId(record.sessionId);
    await mkdir(this.rejectionDir, { recursive: true });
    const lock = await acquireSessionLock(this.rejectionLockPath, {
      timeoutMs: 5_000,
      retryDelayMs: 20
    });
    try {
      const createdAt = new Date().toISOString();
      const runRejectionEvent: RunRejectionEvent = {
        schemaVersion: 1,
        timestamp: createdAt,
        policyType: "CONCURRENCY",
        limit: record.maxConcurrentRuns,
        rejectedRunDetails: {
          sessionId: record.sessionId
        },
        reason: record.reason ?? "max-concurrent-runs-exceeded",
        activeRuns: record.activeRuns,
        ...(record.policy ? { policy: record.policy } : {})
      };
      const event: PolicyConcurrencyRejectionRecord = {
        id: randomUUID(),
        createdAt,
        sessionId: record.sessionId,
        activeRuns: record.activeRuns,
        maxConcurrentRuns: record.maxConcurrentRuns,
        reason: record.reason ?? "max-concurrent-runs-exceeded",
        ...(record.policy ? { policy: record.policy } : {}),
        event: runRejectionEvent
      };
      await appendFile(this.rejectionPath, `${JSON.stringify(event)}\n`, "utf8");
      await this.pruneConcurrencyRejectionsLocked();
      await this.syncRejectionStoreFromDiskLocked();
      return event;
    } finally {
      await lock.release();
    }
  }

  private async withLock<T>(operation: () => Promise<T>): Promise<T> {
    await mkdir(this.policyDir, { recursive: true });
    const lock = await acquireSessionLock(this.lockPath, {
      timeoutMs: 5_000,
      retryDelayMs: 20
    });
    try {
      return await operation();
    } finally {
      await lock.release();
    }
  }

  private async loadState(): Promise<{ state: PolicyStateFile; migrated: boolean }> {
    await mkdir(this.policyDir, { recursive: true });
    if (!existsSync(this.statePath)) {
      return {
        state: {
          schemaVersion: POLICY_STATE_SCHEMA_VERSION,
          policy: null
        },
        migrated: false
      };
    }

    const raw = await readFile(this.statePath, "utf8");
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw) as unknown;
    } catch {
      throw new AthenaError("SESSION_IO_ERROR", "Policy state file is not valid JSON.");
    }

    return migratePolicyState(parsed);
  }

  private async saveState(state: PolicyStateFile): Promise<void> {
    await mkdir(this.policyDir, { recursive: true });
    const tmpPath = `${this.statePath}.${process.pid}.tmp`;
    await writeFile(tmpPath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
    await rename(tmpPath, this.statePath);
    await rm(tmpPath, { force: true });
  }

  private async readConcurrencyRejections(): Promise<PolicyConcurrencyRejectionRecord[]> {
    if (!existsSync(this.rejectionPath)) {
      return [];
    }
    const raw = await readFile(this.rejectionPath, "utf8");
    const rows: PolicyConcurrencyRejectionRecord[] = [];
    for (const line of raw
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)) {
      try {
        const parsed = JSON.parse(line) as Record<string, unknown>;
        const id = typeof parsed.id === "string" ? parsed.id : undefined;
        const createdAt = typeof parsed.createdAt === "string" ? parsed.createdAt : undefined;
        const sessionId = typeof parsed.sessionId === "string" ? parsed.sessionId : undefined;
        const activeRuns = parsed.activeRuns;
        const maxConcurrentRuns = parsed.maxConcurrentRuns;
        const reason =
          parsed.reason === "max-concurrent-runs-exceeded" || parsed.reason === "lock-acquisition-failed"
            ? parsed.reason
            : "max-concurrent-runs-exceeded";
        const policy = this.normalizePolicyOriginDetails(parsed.policy);
        if (
          !id ||
          !createdAt ||
          !sessionId ||
          typeof activeRuns !== "number" ||
          !Number.isInteger(activeRuns) ||
          activeRuns < 0 ||
          typeof maxConcurrentRuns !== "number" ||
          !Number.isInteger(maxConcurrentRuns) ||
          maxConcurrentRuns <= 0
        ) {
          continue;
        }
        const runRejectionEvent = this.normalizeRunRejectionEvent(parsed.event, {
          createdAt,
          sessionId,
          activeRuns,
          maxConcurrentRuns,
          reason,
          ...(policy ? { policy } : {})
        });
        rows.push({
          id,
          createdAt,
          sessionId,
          activeRuns,
          maxConcurrentRuns,
          reason,
          ...(policy ? { policy } : {}),
          event: runRejectionEvent
        });
      } catch {
        // Ignore malformed rows to preserve read availability.
      }
    }
    return rows;
  }

  private async pruneConcurrencyRejectionsLocked(): Promise<void> {
    const rows = await this.readConcurrencyRejections();
    if (rows.length <= this.rejectionRetentionMaxRecords) {
      return;
    }
    const retained = rows.slice(-this.rejectionRetentionMaxRecords);
    const tmpPath = `${this.rejectionPath}.${process.pid}.tmp`;
    const content = retained.map((row) => JSON.stringify(row)).join("\n");
    await writeFile(tmpPath, content.length > 0 ? `${content}\n` : "", "utf8");
    await rename(tmpPath, this.rejectionPath);
    await rm(tmpPath, { force: true });
  }

  private async syncRejectionStoreFromDiskLocked(): Promise<void> {
    const rows = await this.readConcurrencyRejections();
    this.rejectionStore.replace(rows);
  }

  private normalizeRunRejectionEvent(
    input: unknown,
    fallback: {
      createdAt: string;
      sessionId: string;
      activeRuns: number;
      maxConcurrentRuns: number;
      reason: RunRejectionReason;
      policy?: PolicyOriginDetails;
    }
  ): RunRejectionEvent {
    if (!input || typeof input !== "object" || Array.isArray(input)) {
      return this.createFallbackRunRejectionEvent(fallback);
    }
    const row = input as Record<string, unknown>;
    const schemaVersion = row.schemaVersion === 1 ? 1 : undefined;
    const timestamp = typeof row.timestamp === "string" ? row.timestamp : undefined;
    const policyType = row.policyType === "CONCURRENCY" ? "CONCURRENCY" : undefined;
    const limit =
      typeof row.limit === "number" && Number.isInteger(row.limit) && row.limit > 0 ? row.limit : undefined;
    const rejectedRunDetails =
      row.rejectedRunDetails && typeof row.rejectedRunDetails === "object" && !Array.isArray(row.rejectedRunDetails)
        ? (row.rejectedRunDetails as Record<string, unknown>)
        : undefined;
    const detailSessionId =
      rejectedRunDetails && typeof rejectedRunDetails.sessionId === "string" ? rejectedRunDetails.sessionId : undefined;
    const agentName =
      rejectedRunDetails && typeof rejectedRunDetails.agentName === "string" ? rejectedRunDetails.agentName : undefined;
    const reason =
      row.reason === "max-concurrent-runs-exceeded" || row.reason === "lock-acquisition-failed"
        ? row.reason
        : undefined;
    const activeRuns =
      typeof row.activeRuns === "number" && Number.isInteger(row.activeRuns) && row.activeRuns >= 0
        ? row.activeRuns
        : undefined;
    const policy = this.normalizePolicyOriginDetails(row.policy) ?? fallback.policy;

    if (!schemaVersion || !timestamp || !policyType || !limit || !detailSessionId || !reason || activeRuns === undefined) {
      return this.createFallbackRunRejectionEvent(fallback);
    }

    return {
      schemaVersion,
      timestamp,
      policyType,
      limit,
      rejectedRunDetails: {
        sessionId: detailSessionId,
        ...(agentName ? { agentName } : {})
      },
      reason,
      activeRuns,
      ...(policy ? { policy } : {})
    };
  }

  private createFallbackRunRejectionEvent(fallback: {
    createdAt: string;
    sessionId: string;
    activeRuns: number;
    maxConcurrentRuns: number;
    reason: RunRejectionReason;
    policy?: PolicyOriginDetails;
  }): RunRejectionEvent {
    return {
      schemaVersion: 1,
      timestamp: fallback.createdAt,
      policyType: "CONCURRENCY",
      limit: fallback.maxConcurrentRuns,
      rejectedRunDetails: {
        sessionId: fallback.sessionId
      },
      reason: fallback.reason,
      activeRuns: fallback.activeRuns,
      ...(fallback.policy ? { policy: fallback.policy } : {})
    };
  }

  private normalizePolicyOriginDetails(input: unknown): PolicyOriginDetails | undefined {
    if (!input || typeof input !== "object" || Array.isArray(input)) {
      return undefined;
    }
    const row = input as Record<string, unknown>;
    const schemaVersion = row.schemaVersion === 1 ? 1 : undefined;
    const engine = row.engine === "athena" || row.engine === "kyverno" ? row.engine : undefined;
    const ruleType =
      row.ruleType === "concurrency" ||
      row.ruleType === "validate" ||
      row.ruleType === "mutate" ||
      row.ruleType === "generate"
        ? row.ruleType
        : undefined;
    if (!schemaVersion || !engine || !ruleType) {
      return undefined;
    }

    const failureAction = row.failureAction === "audit" || row.failureAction === "enforce" ? row.failureAction : undefined;
    const resourceRef =
      row.resourceRef && typeof row.resourceRef === "object" && !Array.isArray(row.resourceRef)
        ? this.normalizePolicyResourceRef(row.resourceRef as Record<string, unknown>)
        : undefined;
    return {
      schemaVersion,
      engine,
      ruleType,
      ...(typeof row.policyName === "string" ? { policyName: row.policyName } : {}),
      ...(typeof row.ruleName === "string" ? { ruleName: row.ruleName } : {}),
      ...(failureAction ? { failureAction } : {}),
      ...(resourceRef ? { resourceRef } : {}),
      ...(typeof row.message === "string" ? { message: row.message } : {})
    };
  }

  private normalizePolicyResourceRef(input: Record<string, unknown>): PolicyOriginDetails["resourceRef"] {
    const kind = typeof input.kind === "string" ? input.kind : undefined;
    const name = typeof input.name === "string" ? input.name : undefined;
    if (!kind || !name) {
      return undefined;
    }
    return {
      kind,
      name,
      ...(typeof input.namespace === "string" ? { namespace: input.namespace } : {}),
      ...(typeof input.apiVersion === "string" ? { apiVersion: input.apiVersion } : {})
    };
  }
}

class PolicyConcurrencyLeaseManager {
  constructor(private readonly distributedLock: IDistributedLock) {}

  async reserve(sessionId: string, maxConcurrentRuns: number): Promise<PolicyConcurrencyReservationResult> {
    assertValidSessionId(sessionId);
    const ownerId = randomUUID();
    let denied = 0;
    for (let slot = 0; slot < maxConcurrentRuns; slot += 1) {
      const lockName = this.slotLockName(slot);
      let acquired: DistributedLockAcquireResult;
      try {
        acquired = await this.distributedLock.tryAcquire({
          lockName,
          ownerId,
          leaseMs: POLICY_CONCURRENCY_LOCK_LEASE_MS
        });
      } catch (error) {
        throw markLockAcquisitionFailure(error, denied);
      }
      if (acquired.acquired) {
        return {
          activeRuns: denied,
          lease: {
            release: async () => {
              await this.distributedLock.release({
                lockName,
                ownerId,
                token: acquired.token
              });
            }
          }
        };
      }
      denied += 1;
    }
    throw new AthenaError(
      "POLICY_CONCURRENCY_LIMIT_EXCEEDED",
      `policy.maxConcurrentRuns exceeded: ${denied} active run(s) >= configured limit ${maxConcurrentRuns}.`
    );
  }

  private slotLockName(slot: number): string {
    return `policy.concurrency.slot.${slot + 1}`;
  }
}

export class PolicyAwareExecutionBackend implements ExecutionBackend {
  readonly kind: ExecutionBackend["kind"];
  private readonly concurrencyLeases: PolicyConcurrencyLeaseManager;

  constructor(
    private readonly backend: ExecutionBackend,
    private readonly sandboxExecutionBackend: SandboxExecutionBackend,
    private readonly config: AthenaConfig,
    private readonly policyService: PolicyService,
    private readonly eventService: EventService,
    distributedLock: IDistributedLock
  ) {
    this.kind = backend.kind;
    this.concurrencyLeases = new PolicyConcurrencyLeaseManager(distributedLock);
  }

  async run(request: Parameters<ExecutionBackend["run"]>[0], options?: Parameters<ExecutionBackend["run"]>[1]) {
    const policy = await this.policyService.get();
    const runOptions = this.resolveRunOptions(policy, options);
    const runtimeIsolation = this.resolveRuntimeIsolationSelection(request);
    const sandboxRouting = await this.resolveSandboxRouting(request, runtimeIsolation);
    const runId = request.metadata?.runId ?? `sandbox-${randomUUID()}`;
    if (sandboxRouting.required && !sandboxRouting.available) {
      await this.emitSandboxLifecycleEvent({
        runId,
        sessionId: request.sessionId,
        phase: "required-unavailable",
        isolationProfile: runtimeIsolation.isolationProfile,
        startMode: runtimeIsolation.startMode,
        ...(runtimeIsolation.runtimeClassName ? { runtimeClassName: runtimeIsolation.runtimeClassName } : {}),
        templateRef: request.metadata?.sandboxTemplateRef,
        warmPoolRef: request.metadata?.sandboxWarmPoolRef,
        reason: "sandbox backend unavailable in required context"
      });
      throw new AthenaError(
        "CONFIG_ERROR",
        "Sandbox execution is required for this run context but sandbox backend is unavailable."
      );
    }
    if (sandboxRouting.enabled && !sandboxRouting.available) {
      await this.emitSandboxLifecycleEvent({
        runId,
        sessionId: request.sessionId,
        phase: "fallback",
        isolationProfile: runtimeIsolation.isolationProfile,
        startMode: runtimeIsolation.startMode,
        ...(runtimeIsolation.runtimeClassName ? { runtimeClassName: runtimeIsolation.runtimeClassName } : {}),
        templateRef: request.metadata?.sandboxTemplateRef,
        warmPoolRef: request.metadata?.sandboxWarmPoolRef,
        reason: "sandbox backend unavailable; using direct execution path"
      });
    }
    let lease: PolicyConcurrencyLeaseHandle | undefined;
    if (policy?.maxConcurrentRuns) {
      try {
        const reservation = await this.concurrencyLeases.reserve(request.sessionId, policy.maxConcurrentRuns);
        lease = reservation.lease;
      } catch (error) {
        const reason = this.resolveRejectionReason(error);
        if (reason) {
          await this.emitConcurrencyRejection({
            request,
            runId,
            activeRuns: this.resolveActiveRunsForRejection(error, reason, policy.maxConcurrentRuns),
            maxConcurrentRuns: policy.maxConcurrentRuns,
            reason
          });
        }
        throw error;
      }
    }
    try {
      if (!sandboxRouting.routeThroughSandbox) {
        return await this.backend.run(request, runOptions);
      }
      return await this.runWithSandboxLifecycle(request, runOptions, sandboxRouting.required, runId, runtimeIsolation);
    } finally {
      await lease?.release();
    }
  }

  cancel(request: Parameters<ExecutionBackend["cancel"]>[0]) {
    return this.backend.cancel(request);
  }

  async cancelByRunId(request: { runId: string; reason?: string }) {
    if (this.backend.cancelByRunId) {
      return this.backend.cancelByRunId(request);
    }
    if (!this.backend.listActiveRuns) {
      return {
        runId: request.runId,
        status: "not-running" as const
      };
    }
    const active = await this.backend.listActiveRuns({
      runId: request.runId,
      limit: 1
    });
    const match = active.items[0];
    if (!match) {
      return {
        runId: request.runId,
        status: "not-running" as const
      };
    }
    const cancelled = await this.backend.cancel({
      sessionId: match.sessionId,
      ...(request.reason ? { reason: request.reason } : {})
    });
    return {
      runId: request.runId,
      status: cancelled.status,
      sessionId: cancelled.sessionId
    };
  }

  listActiveRuns(query?: Parameters<NonNullable<ExecutionBackend["listActiveRuns"]>>[0]) {
    if (!this.backend.listActiveRuns) {
      return Promise.resolve({ items: [] });
    }
    return this.backend.listActiveRuns(query);
  }

  listCancellationRequests(query?: Parameters<NonNullable<ExecutionBackend["listCancellationRequests"]>>[0]) {
    if (!this.backend.listCancellationRequests) {
      return Promise.resolve({ items: [] });
    }
    return this.backend.listCancellationRequests(query);
  }

  async getOperationsMetrics(): Promise<BackendOperationsMetricsSnapshot> {
    const backendMetrics = await this.backend.getOperationsMetrics?.();
    if (backendMetrics) {
      return backendMetrics;
    }
    return {
      supportsPods: false,
      supportsCpuMemMetrics: false,
      runs: {
        active: 0,
        cancellationRequested: 0
      }
    };
  }

  private async emitConcurrencyRejection(args: {
    request: Parameters<ExecutionBackend["run"]>[0];
    runId: string;
    activeRuns: number;
    maxConcurrentRuns: number;
    reason: RunRejectionReason;
  }): Promise<void> {
    try {
      const directiveHarnessContext = this.resolveDirectiveHarnessContext(args.request.metadata);
      const policyOrigin: PolicyOriginDetails = {
        schemaVersion: 1,
        engine: "athena",
        ruleType: "concurrency",
        policyName: "policy.maxConcurrentRuns",
        failureAction: "enforce"
      };
      const workload = this.resolvePolicyWorkloadMetadata(args.request, args.runId);
      const record = await this.policyService.recordConcurrencyRejection({
        sessionId: args.request.sessionId,
        activeRuns: args.activeRuns,
        maxConcurrentRuns: args.maxConcurrentRuns,
        reason: args.reason,
        policy: policyOrigin
      });
      await this.eventService.emit({
        type: "policy.concurrency.rejected",
        sessionId: args.request.sessionId,
        runId: args.runId,
        policy: {
          schemaVersion: 1,
          decision: "rejected",
          workload,
          origin: policyOrigin
        },
        payload: {
          rejection: record.event,
          activeRuns: record.activeRuns,
          maxConcurrentRuns: record.maxConcurrentRuns,
          reason: record.reason,
          ...directiveHarnessContext
        }
      });
      await this.eventService.emit({
        type: "policy.rejected",
        sessionId: args.request.sessionId,
        runId: args.runId,
        policy: {
          schemaVersion: 1,
          decision: "rejected",
          workload,
          origin: policyOrigin
        },
        payload: {
          rejection: record.event,
          ...directiveHarnessContext
        }
      });
    } catch {
      // Policy rejection observability should not block run failure semantics.
    }
  }

  private resolvePolicyWorkloadMetadata(
    request: Parameters<ExecutionBackend["run"]>[0],
    runId: string
  ): PolicyWorkloadMetadata {
    const metadata = request.metadata ?? {};
    const agentRole =
      metadata.agentRole ?? metadata[ATHENA_POLICY_LABEL_KEYS.agentRole] ?? metadata.role ?? "unspecified";
    const labels: PolicyWorkloadMetadata["labels"] = {
      [ATHENA_POLICY_LABEL_KEYS.agentRole]: agentRole,
      [ATHENA_POLICY_LABEL_KEYS.runId]: runId,
      [ATHENA_POLICY_LABEL_KEYS.sessionId]: request.sessionId,
      [ATHENA_POLICY_LABEL_KEYS.controlPlane]: "v1"
    };
    const policyProfile = metadata.policyProfile ?? metadata[ATHENA_POLICY_ANNOTATION_KEYS.profile];
    const cleanupTtlSeconds = metadata.cleanupTtlSeconds ?? metadata[ATHENA_POLICY_ANNOTATION_KEYS.cleanupTtlSeconds];
    const annotations: PolicyWorkloadMetadata["annotations"] = {
      ...(policyProfile ? { [ATHENA_POLICY_ANNOTATION_KEYS.profile]: policyProfile } : {}),
      ...(cleanupTtlSeconds ? { [ATHENA_POLICY_ANNOTATION_KEYS.cleanupTtlSeconds]: cleanupTtlSeconds } : {})
    };
    return {
      schemaVersion: 1,
      labels,
      ...(Object.keys(annotations).length > 0 ? { annotations } : {})
    };
  }

  private resolveDirectiveHarnessContext(
    metadata: Parameters<ExecutionBackend["run"]>[0]["metadata"]
  ): { directiveId?: string; harnessProfileId?: string; agentName?: string } {
    const directiveId = metadata?.directiveId;
    const harnessProfileId = metadata?.harnessProfileId;
    const agentName = this.resolveAgentName(metadata);
    return {
      ...(directiveId ? { directiveId } : {}),
      ...(harnessProfileId ? { harnessProfileId } : {}),
      ...(agentName ? { agentName } : {})
    };
  }

  private resolveAgentName(metadata: Parameters<ExecutionBackend["run"]>[0]["metadata"]): string | undefined {
    const value = metadata?.agentName ?? metadata?.agent ?? metadata?.agentName ?? metadata?.agent;
    if (!value) {
      return undefined;
    }
    const normalized = value.trim();
    return normalized.length > 0 ? normalized : undefined;
  }

  private extractActiveRunsFromError(message: string): number | undefined {
    const match = message.match(/policy\.maxConcurrentRuns exceeded: (\d+) active run\(s\)/);
    if (!match?.[1]) {
      return undefined;
    }
    const parsed = Number.parseInt(match[1], 10);
    if (!Number.isFinite(parsed) || parsed < 0) {
      return undefined;
    }
    return parsed;
  }

  private resolveRejectionReason(error: unknown): RunRejectionReason | undefined {
    if (error instanceof AthenaError && error.code === "POLICY_CONCURRENCY_LIMIT_EXCEEDED") {
      return "max-concurrent-runs-exceeded";
    }
    if (isLockAcquisitionFailure(error)) {
      return "lock-acquisition-failed";
    }
    return undefined;
  }

  private resolveActiveRunsForRejection(
    error: unknown,
    reason: RunRejectionReason,
    maxConcurrentRuns: number
  ): number {
    if (reason === "max-concurrent-runs-exceeded" && error instanceof AthenaError) {
      return this.extractActiveRunsFromError(error.message) ?? maxConcurrentRuns;
    }
    const observed = getObservedActiveRunsFromLockError(error);
    return observed ?? 0;
  }

  private resolveRunOptions(
    policy: PolicyDocument | undefined,
    options?: Parameters<ExecutionBackend["run"]>[1]
  ): Parameters<ExecutionBackend["run"]>[1] {
    return {
      ...(options?.signal ? { signal: options.signal } : {}),
      ...(options?.onAttachEvidence ? { onAttachEvidence: options.onAttachEvidence } : {}),
      ...(options?.timeoutMs !== undefined
        ? { timeoutMs: options.timeoutMs }
        : policy?.defaultRunTimeoutMs !== undefined
          ? { timeoutMs: policy.defaultRunTimeoutMs }
          : {})
    };
  }

  private async resolveSandboxRouting(
    request: Parameters<ExecutionBackend["run"]>[0],
    runtimeIsolation: RuntimeIsolationSelection
  ): Promise<{
    enabled: boolean;
    required: boolean;
    available: boolean;
    routeThroughSandbox: boolean;
  }> {
    const metadata = request.metadata ?? {};
    const explicitlyRequired = metadata.sandbox === "required";
    const required = explicitlyRequired || runtimeIsolation.requireSandbox;
    const enabled = this.config.sandbox?.enabled ?? false;
    const available = enabled ? await this.sandboxExecutionBackend.isAvailable() : false;
    return {
      enabled,
      required,
      available,
      routeThroughSandbox: enabled && available
    };
  }

  private async runWithSandboxLifecycle(
    request: Parameters<ExecutionBackend["run"]>[0],
    runOptions: Parameters<ExecutionBackend["run"]>[1],
    required: boolean,
    runId: string,
    runtimeIsolation: RuntimeIsolationSelection
  ) {
    const timeoutMs = runOptions?.timeoutMs ?? this.config.runtimeRunTimeoutMs;
    let claim:
      | {
          sandboxId: string;
          claimName?: string;
          namespace?: string;
        }
      | undefined;
    let providerRunAttempted = false;
    const templateRef = request.metadata?.sandboxTemplateRef ?? "default";
    const warmPoolRef = request.metadata?.sandboxWarmPoolRef;
    const workspaceConfig = this.resolveSandboxWorkspaceConfig(request.metadata);
    const quotaConfig = this.resolveSandboxQuotaConfig(request.metadata);
    const egressPolicy = this.resolveSandboxEgressPolicy(request.metadata);
    const declaredEgressDestinations = this.resolveDeclaredSandboxEgressDestinations(request.metadata, workspaceConfig);
    const agentName = this.resolveAgentName(request.metadata);
    let claimedAtMs: number | undefined;
    let runtimeClassName = runtimeIsolation.runtimeClassName;
    let forceFailClosed = false;

    try {
      const egressEvaluation = this.evaluateSandboxEgressPolicy(egressPolicy, declaredEgressDestinations);
      if (!egressEvaluation.allowed) {
        forceFailClosed = true;
        await this.emitSandboxEgressDecisionEvent({
          runId,
          sessionId: request.sessionId,
          decision: egressEvaluation.decision,
          policy: egressPolicy,
          declared: declaredEgressDestinations,
          ...(agentName ? { agentName } : {}),
          reason: egressEvaluation.reason,
          ...(runtimeClassName ? { runtimeClassName } : {}),
          ...(templateRef ? { templateRef } : {}),
          ...(warmPoolRef ? { warmPoolRef } : {})
        });
        throw new AthenaError("CONFIG_ERROR", egressEvaluation.reason);
      }
      await this.emitSandboxEgressDecisionEvent({
        runId,
        sessionId: request.sessionId,
        decision: "allowed",
        policy: egressPolicy,
        declared: declaredEgressDestinations,
        ...(agentName ? { agentName } : {}),
        ...(runtimeClassName ? { runtimeClassName } : {}),
        ...(templateRef ? { templateRef } : {}),
        ...(warmPoolRef ? { warmPoolRef } : {})
      });
      await this.emitSandboxLifecycleEvent({
        runId,
        sessionId: request.sessionId,
        phase: "claiming",
        isolationProfile: runtimeIsolation.isolationProfile,
        startMode: runtimeIsolation.startMode,
        ...(runtimeClassName ? { runtimeClassName } : {}),
        templateRef,
        warmPoolRef
      });
      const claimed = await this.sandboxExecutionBackend.claim({
        runId,
        sessionId: request.sessionId,
        templateRef,
        ...(warmPoolRef ? { warmPoolRef } : {}),
        ...(runtimeClassName ? { runtimeClassName } : {}),
        ...(workspaceConfig.workspaceHostPath ? { workspaceHostPath: workspaceConfig.workspaceHostPath } : {}),
        ...(workspaceConfig.workspaceMountPath ? { workspaceMountPath: workspaceConfig.workspaceMountPath } : {}),
        ...(workspaceConfig.workspaceReadOnly !== undefined
          ? { workspaceReadOnly: workspaceConfig.workspaceReadOnly }
          : {}),
        ...(workspaceConfig.workspaceSyncRepo ? { workspaceSyncRepo: workspaceConfig.workspaceSyncRepo } : {}),
        ...(workspaceConfig.workspaceSyncRef ? { workspaceSyncRef: workspaceConfig.workspaceSyncRef } : {}),
        ...(workspaceConfig.workspaceSyncSubPath ? { workspaceSyncSubPath: workspaceConfig.workspaceSyncSubPath } : {}),
        ...(workspaceConfig.workspaceSyncStrategy
          ? { workspaceSyncStrategy: workspaceConfig.workspaceSyncStrategy }
          : {}),
        ...(workspaceConfig.workspaceIgnore ? { workspaceIgnore: workspaceConfig.workspaceIgnore } : {}),
        egressPolicy: {
          schemaVersion: 1,
          defaultAction: "deny",
          allow: egressPolicy.allow
        },
        ...(timeoutMs > 0 ? { timeoutMs } : {})
      });
      if (claimed.status !== "claimed" || !claimed.sandboxId) {
        const claimReason = claimed.reason ?? "sandbox claim did not return a sandbox identity";
        const isEgressEnforcementFailure = claimReason.toLowerCase().includes("egress policy");
        if (isEgressEnforcementFailure) {
          forceFailClosed = true;
          await this.emitSandboxEgressDecisionEvent({
            runId,
            sessionId: request.sessionId,
            decision: "error",
            policy: egressPolicy,
            declared: declaredEgressDestinations,
            ...(agentName ? { agentName } : {}),
            reason: claimReason,
            ...(runtimeClassName ? { runtimeClassName } : {}),
            ...(templateRef ? { templateRef } : {}),
            ...(warmPoolRef ? { warmPoolRef } : {})
          });
        }
        await this.emitSandboxLifecycleEvent({
          runId,
          sessionId: request.sessionId,
          phase: required || isEgressEnforcementFailure ? "required-unavailable" : "fallback",
          isolationProfile: runtimeIsolation.isolationProfile,
          startMode: runtimeIsolation.startMode,
          ...(runtimeClassName ? { runtimeClassName } : {}),
          templateRef,
          warmPoolRef,
          reason: claimReason
        });
        if (required || isEgressEnforcementFailure) {
          throw new AthenaError(
            "CONFIG_ERROR",
            isEgressEnforcementFailure
              ? `Sandbox egress policy enforcement failed: ${claimReason}`
              : "Sandbox execution is required for this run context but sandbox claim was not granted."
          );
        }
        providerRunAttempted = true;
        return this.backend.run(request, runOptions);
      }
      claim = {
        sandboxId: claimed.sandboxId,
        ...(claimed.claimName ? { claimName: claimed.claimName } : {}),
        ...(claimed.namespace ? { namespace: claimed.namespace } : {})
      };
      runtimeClassName = claimed.runtimeClassName ?? runtimeClassName;
      claimedAtMs = claimed.claimedAt ? Date.parse(claimed.claimedAt) : Date.now();
      await this.emitSandboxLifecycleEvent({
        runId,
        sessionId: request.sessionId,
        phase: "claimed",
        isolationProfile: runtimeIsolation.isolationProfile,
        startMode: runtimeIsolation.startMode,
        ...(runtimeClassName ? { runtimeClassName } : {}),
        templateRef,
        warmPoolRef,
        sandboxId: claim.sandboxId,
        claimName: claim.claimName,
        namespace: claim.namespace
      });

      const readiness = await this.sandboxExecutionBackend.waitReady({
        runId,
        sandboxId: claim.sandboxId,
        timeoutMs
      });
      if (readiness.status !== "ready") {
        await this.emitSandboxLifecycleEvent({
          runId,
          sessionId: request.sessionId,
          phase: "ready-timeout",
          isolationProfile: runtimeIsolation.isolationProfile,
          startMode: runtimeIsolation.startMode,
          ...(runtimeClassName ? { runtimeClassName } : {}),
          templateRef,
          warmPoolRef,
          sandboxId: claim.sandboxId,
          claimName: claim.claimName,
          namespace: claim.namespace,
          reason: readiness.reason ?? "sandbox did not report ready",
          ...(claimedAtMs !== undefined
            ? {
                latencyMsClaimToReady: this.resolveDurationMs(claimedAtMs, Date.parse(readiness.observedAt)),
                latencyMsStartup: this.resolveDurationMs(claimedAtMs, Date.parse(readiness.observedAt))
              }
            : {})
        });
        if (required) {
          throw new AthenaError("RUN_TIMEOUT", "Sandbox was not ready before the configured timeout.");
        }
        await this.emitSandboxLifecycleEvent({
          runId,
          sessionId: request.sessionId,
          phase: "fallback",
          isolationProfile: runtimeIsolation.isolationProfile,
          startMode: runtimeIsolation.startMode,
          ...(runtimeClassName ? { runtimeClassName } : {}),
          templateRef,
          warmPoolRef,
          sandboxId: claim.sandboxId,
          claimName: claim.claimName,
          namespace: claim.namespace,
          reason: "sandbox readiness unavailable for optional context"
        });
        providerRunAttempted = true;
        return this.backend.run(request, runOptions);
      }
      await this.emitSandboxLifecycleEvent({
        runId,
        sessionId: request.sessionId,
        phase: "ready",
        isolationProfile: runtimeIsolation.isolationProfile,
        startMode: runtimeIsolation.startMode,
        ...(runtimeClassName ? { runtimeClassName } : {}),
        templateRef,
        warmPoolRef,
        sandboxId: claim.sandboxId,
        claimName: claim.claimName,
        namespace: claim.namespace,
        ...(claimedAtMs !== undefined
          ? {
              latencyMsClaimToReady: this.resolveDurationMs(claimedAtMs, Date.parse(readiness.observedAt)),
              latencyMsStartup: this.resolveDurationMs(claimedAtMs, Date.parse(readiness.observedAt))
            }
          : {})
      });

      let terminateReason: "cancelled" | "timeout" | "failed" | "cleanup" = "cleanup";
      let terminateDetail: string | undefined;
      try {
        providerRunAttempted = true;
        if (!quotaConfig.enabled) {
          return await this.backend.run(request, runOptions);
        }
        return await this.runWithSandboxQuotaMonitoring({
          request,
          runOptions,
          runId,
          sessionId: request.sessionId,
          sandboxId: claim.sandboxId,
          ...(claim.namespace ? { namespace: claim.namespace } : {}),
          ...(templateRef ? { templateRef } : {}),
          ...(warmPoolRef ? { warmPoolRef } : {}),
          ...(runtimeClassName ? { runtimeClassName } : {}),
          quotaConfig
        });
      } catch (error) {
        if (error instanceof AthenaError) {
          if (error.code === "RUN_CANCELLED") {
            terminateReason = "cancelled";
          } else if (error.code === "RUN_TIMEOUT") {
            terminateReason = "timeout";
            terminateDetail = error.message;
          } else {
            terminateReason = "failed";
          }
        } else {
          terminateReason = "failed";
        }
        throw error;
      } finally {
        await this.finalizeSandboxLifecycle(
          runId,
          request.sessionId,
          claim.sandboxId,
          terminateReason,
          {
            templateRef,
            warmPoolRef,
            claimName: claim.claimName,
            namespace: claim.namespace,
            isolationProfile: runtimeIsolation.isolationProfile,
            startMode: runtimeIsolation.startMode,
            runtimeClassName,
            ...(terminateDetail ? { terminateDetail } : {})
          }
        );
      }
    } catch (error) {
      if (required || providerRunAttempted || forceFailClosed) {
        throw error;
      }
      await this.emitSandboxLifecycleEvent({
        runId,
        sessionId: request.sessionId,
        phase: "fallback",
        isolationProfile: runtimeIsolation.isolationProfile,
        startMode: runtimeIsolation.startMode,
        ...(runtimeClassName ? { runtimeClassName } : {}),
        templateRef,
        warmPoolRef,
        ...(claim?.sandboxId ? { sandboxId: claim.sandboxId } : {}),
        ...(claim?.claimName ? { claimName: claim.claimName } : {}),
        ...(claim?.namespace ? { namespace: claim.namespace } : {}),
        reason: this.stringifyError(error)
      });
      providerRunAttempted = true;
      return this.backend.run(request, runOptions);
    }
  }

  private async finalizeSandboxLifecycle(
    runId: string,
    sessionId: string,
    sandboxId: string,
    terminateReason: "cancelled" | "timeout" | "failed" | "cleanup",
    context: {
      templateRef?: string | undefined;
      warmPoolRef?: string | undefined;
      claimName?: string | undefined;
      namespace?: string | undefined;
      isolationProfile?: "standard" | "high-security" | undefined;
      startMode?: "warm" | "cold" | undefined;
      runtimeClassName?: string | undefined;
      terminateDetail?: string | undefined;
    }
  ): Promise<void> {
    await this.emitSandboxLifecycleEvent({
      runId,
      sessionId,
      phase: "terminating",
      sandboxId,
      reason: context.terminateDetail ?? terminateReason,
      ...(context.templateRef ? { templateRef: context.templateRef } : {}),
      ...(context.warmPoolRef ? { warmPoolRef: context.warmPoolRef } : {}),
      ...(context.claimName ? { claimName: context.claimName } : {}),
      ...(context.namespace ? { namespace: context.namespace } : {}),
      ...(context.isolationProfile ? { isolationProfile: context.isolationProfile } : {}),
      ...(context.startMode ? { startMode: context.startMode } : {}),
      ...(context.runtimeClassName ? { runtimeClassName: context.runtimeClassName } : {})
    });
    try {
      await this.sandboxExecutionBackend.terminate({
        runId,
        sandboxId,
        reason: terminateReason
      });
    } catch {
      await this.emitSandboxLifecycleEvent({
        runId,
        sessionId,
        phase: "cleanup-failed",
        sandboxId,
        reason: "sandbox terminate failed",
        ...(context.templateRef ? { templateRef: context.templateRef } : {}),
        ...(context.warmPoolRef ? { warmPoolRef: context.warmPoolRef } : {}),
        ...(context.claimName ? { claimName: context.claimName } : {}),
        ...(context.namespace ? { namespace: context.namespace } : {}),
        ...(context.isolationProfile ? { isolationProfile: context.isolationProfile } : {}),
        ...(context.startMode ? { startMode: context.startMode } : {}),
        ...(context.runtimeClassName ? { runtimeClassName: context.runtimeClassName } : {})
      });
    }
    try {
      await this.sandboxExecutionBackend.cleanup({
        runId,
        sandboxId
      });
      await this.emitSandboxLifecycleEvent({
        runId,
        sessionId,
        phase: "cleaned",
        sandboxId,
        ...(context.templateRef ? { templateRef: context.templateRef } : {}),
        ...(context.warmPoolRef ? { warmPoolRef: context.warmPoolRef } : {}),
        ...(context.claimName ? { claimName: context.claimName } : {}),
        ...(context.namespace ? { namespace: context.namespace } : {}),
        ...(context.isolationProfile ? { isolationProfile: context.isolationProfile } : {}),
        ...(context.startMode ? { startMode: context.startMode } : {}),
        ...(context.runtimeClassName ? { runtimeClassName: context.runtimeClassName } : {})
      });
    } catch {
      await this.emitSandboxLifecycleEvent({
        runId,
        sessionId,
        phase: "cleanup-failed",
        sandboxId,
        reason: "sandbox cleanup failed",
        ...(context.templateRef ? { templateRef: context.templateRef } : {}),
        ...(context.warmPoolRef ? { warmPoolRef: context.warmPoolRef } : {}),
        ...(context.claimName ? { claimName: context.claimName } : {}),
        ...(context.namespace ? { namespace: context.namespace } : {}),
        ...(context.isolationProfile ? { isolationProfile: context.isolationProfile } : {}),
        ...(context.startMode ? { startMode: context.startMode } : {}),
        ...(context.runtimeClassName ? { runtimeClassName: context.runtimeClassName } : {})
      });
    }
  }

  private async runWithSandboxQuotaMonitoring(args: {
    request: Parameters<ExecutionBackend["run"]>[0];
    runOptions: Parameters<ExecutionBackend["run"]>[1];
    runId: string;
    sessionId: string;
    sandboxId: string;
    namespace?: string;
    templateRef?: string;
    warmPoolRef?: string;
    runtimeClassName?: string;
    quotaConfig: SandboxQuotaConfig;
  }): Promise<Awaited<ReturnType<ExecutionBackend["run"]>>> {
    const merged = createAbortController(args.runOptions?.signal);
    const runOptionsWithSignal: Parameters<ExecutionBackend["run"]>[1] = {
      ...(args.runOptions ?? {}),
      signal: merged.controller.signal
    };
    let monitorStopped = false;
    let quotaError: AthenaError | undefined;
    const monitor = (async () => {
      while (!monitorStopped && !merged.controller.signal.aborted) {
        const usage = await this.sandboxExecutionBackend.getResourceUsage?.({
          runId: args.runId,
          sandboxId: args.sandboxId,
          ...(args.namespace ? { namespace: args.namespace } : {})
        });
        if (!usage || usage.status !== "ok") {
          quotaError = new AthenaError(
            "RUN_TIMEOUT",
            usage?.reason
              ? `Sandbox quota monitor unavailable: ${usage.reason}`
              : "Sandbox quota monitor unavailable for configured quotas."
          );
          merged.controller.abort();
          return;
        }
        const violation = resolveQuotaViolation(args.quotaConfig, usage);
        if (violation) {
          const agentName = this.resolveAgentName(args.request.metadata);
          quotaError = new AthenaError("RUN_TIMEOUT", violation);
          await this.emitSandboxQuotaEvent({
            runId: args.runId,
            sessionId: args.sessionId,
            sandboxId: args.sandboxId,
            quotaConfig: args.quotaConfig,
            usage,
            ...(agentName ? { agentName } : {}),
            reason: violation,
            ...(args.templateRef ? { templateRef: args.templateRef } : {}),
            ...(args.warmPoolRef ? { warmPoolRef: args.warmPoolRef } : {}),
            ...(args.runtimeClassName ? { runtimeClassName: args.runtimeClassName } : {})
          });
          merged.controller.abort();
          return;
        }
        await sleepWithAbort(args.quotaConfig.pollIntervalMs, merged.controller.signal);
      }
    })();

    let runError: unknown;
    let runResult: Awaited<ReturnType<ExecutionBackend["run"]>> | undefined;
    try {
      runResult = await this.backend.run(args.request, runOptionsWithSignal);
    } catch (error) {
      runError = error;
    } finally {
      monitorStopped = true;
      merged.abortExternalListener();
    }

    await monitor.catch((error) => {
      if (!quotaError) {
        quotaError = new AthenaError("RUN_TIMEOUT", this.stringifyError(error));
      }
    });

    if (quotaError) {
      throw quotaError;
    }
    if (runError) {
      throw runError;
    }
    return runResult!;
  }

  private async emitSandboxQuotaEvent(args: {
    runId: string;
    sessionId: string;
    sandboxId: string;
    quotaConfig: SandboxQuotaConfig;
    usage: {
      observedAt: string;
      cpuCores?: number;
      memoryBytes?: number;
      diskBytes?: number;
    };
    reason: string;
    agentName?: string;
    templateRef?: string;
    warmPoolRef?: string;
    runtimeClassName?: string;
  }): Promise<void> {
    try {
      await this.eventService.emit({
        type: "sandbox.quota-exceeded",
        sessionId: args.sessionId,
        runId: args.runId,
        sandbox: {
          schemaVersion: 1,
          backend: "agent-sandbox",
          phase: "terminating",
          ...(args.runtimeClassName ? { runtimeClassName: args.runtimeClassName } : {}),
          ...(args.templateRef ? { templateRef: args.templateRef } : {}),
          ...(args.warmPoolRef ? { warmPoolRef: args.warmPoolRef } : {}),
          sandboxId: args.sandboxId,
          reason: args.reason
        },
        payload: {
          quota: {
            ...(args.quotaConfig.cpuCoresMax !== undefined ? { cpuCoresMax: args.quotaConfig.cpuCoresMax } : {}),
            ...(args.quotaConfig.memoryBytesMax !== undefined ? { memoryBytesMax: args.quotaConfig.memoryBytesMax } : {}),
            ...(args.quotaConfig.diskBytesMax !== undefined ? { diskBytesMax: args.quotaConfig.diskBytesMax } : {})
          },
          usage: {
            observedAt: args.usage.observedAt,
            ...(args.usage.cpuCores !== undefined ? { cpuCores: args.usage.cpuCores } : {}),
            ...(args.usage.memoryBytes !== undefined ? { memoryBytes: args.usage.memoryBytes } : {}),
            ...(args.usage.diskBytes !== undefined ? { diskBytes: args.usage.diskBytes } : {})
          },
          reason: args.reason,
          ...(args.agentName ? { agentName: args.agentName } : {})
        }
      });
    } catch {
      // best-effort observability only
    }
  }

  private async emitSandboxLifecycleEvent(args: {
    runId: string;
    sessionId: string;
    phase: SandboxLifecycleEventMetadata["phase"];
    isolationProfile?: SandboxLifecycleEventMetadata["isolationProfile"];
    startMode?: SandboxLifecycleEventMetadata["startMode"];
    runtimeClassName?: string | undefined;
    templateRef?: string | undefined;
    warmPoolRef?: string | undefined;
    sandboxId?: string | undefined;
    claimName?: string | undefined;
    namespace?: string | undefined;
    latencyMsStartup?: number | undefined;
    latencyMsClaimToReady?: number | undefined;
    reason?: string | undefined;
  }): Promise<void> {
    const sandbox: SandboxLifecycleEventMetadata = {
      schemaVersion: 1,
      backend: "agent-sandbox",
      phase: args.phase,
      ...(args.isolationProfile ? { isolationProfile: args.isolationProfile } : {}),
      ...(args.startMode ? { startMode: args.startMode } : {}),
      ...(args.runtimeClassName ? { runtimeClassName: args.runtimeClassName } : {}),
      ...(args.templateRef ? { templateRef: args.templateRef } : {}),
      ...(args.warmPoolRef ? { warmPoolRef: args.warmPoolRef } : {}),
      ...(args.sandboxId ? { sandboxId: args.sandboxId } : {}),
      ...(args.claimName ? { claimName: args.claimName } : {}),
      ...(args.namespace ? { namespace: args.namespace } : {}),
      ...(args.latencyMsStartup !== undefined ? { latencyMsStartup: args.latencyMsStartup } : {}),
      ...(args.latencyMsClaimToReady !== undefined ? { latencyMsClaimToReady: args.latencyMsClaimToReady } : {}),
      ...(args.reason ? { reason: args.reason } : {})
    };
    try {
      await this.eventService.emit({
        type: "sandbox.lifecycle",
        sessionId: args.sessionId,
        runId: args.runId,
        sandbox,
        payload: {}
      });
    } catch {
      // Sandbox telemetry should be best-effort and never alter run control behavior.
    }
  }

  private resolveDurationMs(startedAtMs: number, endedAtMs: number): number {
    if (!Number.isFinite(startedAtMs) || !Number.isFinite(endedAtMs)) {
      return 0;
    }
    return Math.max(0, Math.floor(endedAtMs - startedAtMs));
  }

  private stringifyError(error: unknown): string {
    if (error instanceof Error && error.message.trim().length > 0) {
      return error.message;
    }
    if (typeof error === "string" && error.trim().length > 0) {
      return error;
    }
    return "sandbox route failed";
  }

  private resolveRuntimeIsolationSelection(request: Parameters<ExecutionBackend["run"]>[0]): RuntimeIsolationSelection {
    const metadata = request.metadata ?? {};
    const configured = this.config.runtimeIsolation;
    const explicitIsolationProfile = normalizeRuntimeIsolationProfile(metadata.isolationProfile);
    const inferredFromSecurityLevel = metadata.securityLevel === "high" ? "high-security" : undefined;
    const isolationProfile = explicitIsolationProfile ?? inferredFromSecurityLevel ?? configured?.defaultProfile ?? "standard";
    const profileConfig = configured?.profiles[isolationProfile];
    const startMode: "warm" | "cold" = metadata.sandboxWarmPoolRef ? "warm" : "cold";
    const shouldFallbackToDefaultRuntimeClass = configured?.fallbackToDefaultRuntimeClass ?? true;
    const defaultRuntimeClass = configured?.profiles.standard.runtimeClassName;
    const runtimeClassName =
      profileConfig?.runtimeClassName ??
      (shouldFallbackToDefaultRuntimeClass && isolationProfile !== "standard" ? defaultRuntimeClass : undefined);
    const requireSandbox =
      (profileConfig?.requireSandbox ?? false) ||
      ((this.config.sandbox?.requireForHighSecurity ?? false) && isolationProfile === "high-security");

    return {
      isolationProfile,
      startMode,
      ...(runtimeClassName ? { runtimeClassName } : {}),
      requireSandbox
    };
  }

  private resolveSandboxWorkspaceConfig(metadata: Parameters<ExecutionBackend["run"]>[0]["metadata"]): {
    workspaceHostPath?: string;
    workspaceMountPath: string;
    workspaceReadOnly?: boolean;
    workspaceSyncRepo?: string;
    workspaceSyncRef?: string;
    workspaceSyncSubPath?: string;
    workspaceSyncStrategy?: "init-git-clone" | "git-sync";
    workspaceIgnore?: string[];
  } {
    const workspaceMountPath = normalizeSandboxWorkspaceMountPath(metadata?.sandboxWorkspaceMountPath) ?? "/workspace";
    const workspaceReadOnly = normalizeSandboxWorkspaceBoolean(metadata?.sandboxWorkspaceReadOnly);
    const workspaceSyncRepo = normalizeSandboxWorkspaceRepo(metadata?.sandboxWorkspaceRepo);
    const workspaceSyncRef = normalizeSandboxWorkspaceRef(metadata?.sandboxWorkspaceRef);
    const workspaceSyncSubPath = normalizeSandboxWorkspaceSubPath(metadata?.sandboxWorkspaceSubPath);
    const workspaceSyncStrategy = normalizeSandboxWorkspaceSyncStrategy(metadata?.sandboxWorkspaceSyncStrategy);
    const workspaceIgnore = normalizeSandboxWorkspaceIgnoreList(metadata?.sandboxWorkspaceIgnore);
    const workspaceHostPath = this.config.sandbox?.workspaceHostPath ?? this.config.workspaceRoot;
    return {
      workspaceHostPath,
      workspaceMountPath,
      ...(workspaceReadOnly !== undefined ? { workspaceReadOnly } : {}),
      ...(workspaceSyncRepo ? { workspaceSyncRepo } : {}),
      ...(workspaceSyncRef ? { workspaceSyncRef } : {}),
      ...(workspaceSyncSubPath ? { workspaceSyncSubPath } : {}),
      ...(workspaceSyncStrategy ? { workspaceSyncStrategy } : {}),
      ...(workspaceIgnore ? { workspaceIgnore } : {})
    };
  }

  private resolveSandboxQuotaConfig(metadata: Parameters<ExecutionBackend["run"]>[0]["metadata"]): SandboxQuotaConfig {
    const cpuCoresMax = normalizeSandboxQuotaFloat(metadata?.sandboxQuotaCpuCores);
    const memoryBytesMax = normalizeSandboxQuotaInt(metadata?.sandboxQuotaMemoryBytes);
    const diskBytesMax = normalizeSandboxQuotaInt(metadata?.sandboxQuotaDiskBytes);
    const pollIntervalMs = normalizeSandboxQuotaInt(metadata?.sandboxQuotaPollMs) ?? 1_000;
    return {
      enabled: cpuCoresMax !== undefined || memoryBytesMax !== undefined || diskBytesMax !== undefined,
      ...(cpuCoresMax !== undefined ? { cpuCoresMax } : {}),
      ...(memoryBytesMax !== undefined ? { memoryBytesMax } : {}),
      ...(diskBytesMax !== undefined ? { diskBytesMax } : {}),
      pollIntervalMs: Math.max(250, pollIntervalMs)
    };
  }

  private resolveSandboxEgressPolicy(
    metadata: Parameters<ExecutionBackend["run"]>[0]["metadata"]
  ): SandboxEgressPolicyConfig {
    const parsed = parseSandboxEgressAllowList(metadata?.sandboxAllowedEgress);
    return {
      defaultAction: "deny",
      allow: parsed
    };
  }

  private resolveDeclaredSandboxEgressDestinations(
    metadata: Parameters<ExecutionBackend["run"]>[0]["metadata"],
    workspace: {
      workspaceSyncRepo?: string;
    }
  ): SandboxEgressDestination[] {
    const declared = parseSandboxEgressDestinations(metadata?.sandboxEgressDestinations);
    const fromWorkspaceRepo = parseWorkspaceRepoDestination(workspace.workspaceSyncRepo);
    if (fromWorkspaceRepo) {
      declared.push({
        ...fromWorkspaceRepo,
        source: "workspaceSyncRepo"
      });
    }
    return dedupeEgressDestinations(declared);
  }

  private evaluateSandboxEgressPolicy(
    policy: SandboxEgressPolicyConfig,
    declared: SandboxEgressDestination[]
  ): { allowed: boolean; decision: "allowed" | "blocked" | "error"; reason: string } {
    if (!Array.isArray(policy.allow)) {
      return {
        allowed: false,
        decision: "error",
        reason: "Sandbox egress policy evaluation failed: allow-list is malformed."
      };
    }
    for (const destination of declared) {
      if (!isValidEgressHost(destination.host)) {
        return {
          allowed: false,
          decision: "error",
          reason: `Sandbox egress policy evaluation failed: destination host '${destination.host}' is invalid.`
        };
      }
      if (!matchesAllowedDestination(policy.allow, destination)) {
        return {
          allowed: false,
          decision: "blocked",
          reason: `Sandbox egress destination '${formatEgressDestination(destination)}' is not allow-listed.`
        };
      }
    }
    return {
      allowed: true,
      decision: "allowed",
      reason: "ok"
    };
  }

  private async emitSandboxEgressDecisionEvent(args: {
    runId: string;
    sessionId: string;
    decision: "allowed" | "blocked" | "error";
    policy: SandboxEgressPolicyConfig;
    declared: SandboxEgressDestination[];
    agentName?: string;
    reason?: string;
    runtimeClassName?: string;
    templateRef?: string;
    warmPoolRef?: string;
  }): Promise<void> {
    try {
      await this.eventService.emit({
        type: "sandbox.egress-policy",
        sessionId: args.sessionId,
        runId: args.runId,
        sandbox: {
          schemaVersion: 1,
          backend: "agent-sandbox",
          phase: "claiming",
          ...(args.runtimeClassName ? { runtimeClassName: args.runtimeClassName } : {}),
          ...(args.templateRef ? { templateRef: args.templateRef } : {}),
          ...(args.warmPoolRef ? { warmPoolRef: args.warmPoolRef } : {}),
          ...(args.reason ? { reason: args.reason } : {})
        },
        payload: {
          decision: args.decision,
          policy: {
            defaultAction: args.policy.defaultAction,
            allow: args.policy.allow.map((rule) => ({
              host: rule.host,
              ...(rule.port !== undefined ? { port: rule.port } : {})
            }))
          },
          declaredDestinations: args.declared.map((destination) => ({
            host: destination.host,
            ...(destination.port !== undefined ? { port: destination.port } : {}),
            source: destination.source
          })),
          ...(args.agentName ? { agentName: args.agentName } : {}),
          ...(args.reason ? { reason: args.reason } : {})
        }
      });
    } catch {
      // best-effort observability only
    }
  }
}

interface SandboxQuotaConfig {
  enabled: boolean;
  cpuCoresMax?: number;
  memoryBytesMax?: number;
  diskBytesMax?: number;
  pollIntervalMs: number;
}

interface SandboxEgressAllowRule {
  host: string;
  port?: number;
}

interface SandboxEgressPolicyConfig {
  defaultAction: "deny";
  allow: SandboxEgressAllowRule[];
}

interface SandboxEgressDestination {
  host: string;
  port?: number;
  source: "metadata" | "workspaceSyncRepo";
}

function normalizeSandboxWorkspaceBoolean(value: string | undefined): boolean | undefined {
  if (!value) {
    return undefined;
  }
  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true;
  }
  if (["0", "false", "no", "off"].includes(normalized)) {
    return false;
  }
  return undefined;
}

function normalizeSandboxWorkspaceMountPath(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }
  const normalized = normalizeSandboxAbsolutePath(value);
  return normalized ?? undefined;
}

function normalizeSandboxWorkspaceSubPath(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }
  const normalized = normalizeSandboxRelativeOrAbsolutePath(value);
  return normalized ? normalized.replace(/^\/+/, "") : undefined;
}

function normalizeSandboxWorkspaceRepo(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }
  const normalized = value.trim();
  if (!/^https?:\/\//.test(normalized) && !/^git@/.test(normalized)) {
    return undefined;
  }
  return normalized;
}

function normalizeSandboxWorkspaceRef(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}

function normalizeSandboxWorkspaceIgnoreList(value: string | undefined): string[] | undefined {
  if (!value) {
    return undefined;
  }
  const rows = value
    .split(",")
    .map((entry) => normalizeSandboxRelativeOrAbsolutePath(entry))
    .filter((entry): entry is string => Boolean(entry));
  return rows.length > 0 ? [...new Set(rows)] : undefined;
}

function normalizeSandboxWorkspaceSyncStrategy(
  value: string | undefined
): "init-git-clone" | "git-sync" | undefined {
  if (!value) {
    return undefined;
  }
  const normalized = value.trim().toLowerCase();
  if (normalized === "init-git-clone" || normalized === "git-sync") {
    return normalized;
  }
  return undefined;
}

function normalizeSandboxAbsolutePath(value: string): string | undefined {
  const trimmed = value.trim();
  if (!trimmed.startsWith("/")) {
    return undefined;
  }
  if (trimmed.includes("..")) {
    return undefined;
  }
  return trimmed.replace(/\/+/g, "/");
}

function normalizeSandboxRelativeOrAbsolutePath(value: string): string | undefined {
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.includes("..")) {
    return undefined;
  }
  return trimmed.startsWith("/") ? trimmed.replace(/\/+/g, "/") : trimmed.replace(/\/+/g, "/");
}

function normalizeSandboxQuotaFloat(value: string | undefined): number | undefined {
  if (!value) {
    return undefined;
  }
  const parsed = Number.parseFloat(value.trim());
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return undefined;
  }
  return parsed;
}

function normalizeSandboxQuotaInt(value: string | undefined): number | undefined {
  if (!value) {
    return undefined;
  }
  const parsed = Number.parseInt(value.trim(), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return undefined;
  }
  return parsed;
}

function resolveQuotaViolation(
  quota: SandboxQuotaConfig,
  usage: {
    cpuCores?: number;
    memoryBytes?: number;
    diskBytes?: number;
  }
): string | undefined {
  if (quota.cpuCoresMax !== undefined) {
    if (usage.cpuCores === undefined) {
      return "Sandbox quota monitor missing cpu usage for configured cpu limit.";
    }
    if (usage.cpuCores > quota.cpuCoresMax) {
      return `Sandbox quota exceeded: cpu ${usage.cpuCores.toFixed(3)} > ${quota.cpuCoresMax.toFixed(3)} cores.`;
    }
  }
  if (quota.memoryBytesMax !== undefined) {
    if (usage.memoryBytes === undefined) {
      return "Sandbox quota monitor missing memory usage for configured memory limit.";
    }
    if (usage.memoryBytes > quota.memoryBytesMax) {
      return `Sandbox quota exceeded: memory ${Math.floor(usage.memoryBytes)} > ${quota.memoryBytesMax} bytes.`;
    }
  }
  if (quota.diskBytesMax !== undefined) {
    if (usage.diskBytes === undefined) {
      return "Sandbox quota monitor missing disk usage for configured disk limit.";
    }
    if (usage.diskBytes > quota.diskBytesMax) {
      return `Sandbox quota exceeded: disk ${Math.floor(usage.diskBytes)} > ${quota.diskBytesMax} bytes.`;
    }
  }
  return undefined;
}

function parseSandboxEgressAllowList(value: string | undefined): SandboxEgressAllowRule[] {
  if (!value) {
    return [];
  }
  const rules: SandboxEgressAllowRule[] = [];
  const seen = new Set<string>();
  for (const token of value.split(",")) {
    const parsed = parseEgressToken(token);
    if (!parsed) {
      continue;
    }
    const dedupe = `${parsed.host}:${parsed.port ?? "*"}`;
    if (seen.has(dedupe)) {
      continue;
    }
    seen.add(dedupe);
    rules.push(parsed);
  }
  return rules;
}

function parseSandboxEgressDestinations(value: string | undefined): SandboxEgressDestination[] {
  if (!value) {
    return [];
  }
  const destinations: SandboxEgressDestination[] = [];
  for (const token of value.split(",")) {
    const parsed = parseEgressToken(token);
    if (!parsed) {
      continue;
    }
    destinations.push({
      ...parsed,
      source: "metadata"
    });
  }
  return destinations;
}

function parseWorkspaceRepoDestination(value: string | undefined): { host: string; port?: number } | undefined {
  if (!value) {
    return undefined;
  }
  try {
    const parsed = new URL(value);
    const host = normalizeEgressHost(parsed.hostname);
    if (!host || !isValidEgressHost(host)) {
      return undefined;
    }
    const explicitPort = parsed.port ? Number.parseInt(parsed.port, 10) : undefined;
    const defaultPort = parsed.protocol === "https:" ? 443 : parsed.protocol === "http:" ? 80 : undefined;
    const port =
      explicitPort !== undefined && Number.isInteger(explicitPort) && explicitPort >= 1 && explicitPort <= 65535
        ? explicitPort
        : defaultPort;
    return {
      host,
      ...(port !== undefined ? { port } : {})
    };
  } catch {
    return undefined;
  }
}

function parseEgressToken(value: string): SandboxEgressAllowRule | undefined {
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) {
    return undefined;
  }
  const separator = trimmed.lastIndexOf(":");
  let host = trimmed;
  let port: number | undefined;
  if (separator > 0 && separator < trimmed.length - 1 && !trimmed.endsWith("]")) {
    const portCandidate = trimmed.slice(separator + 1);
    if (/^\d{1,5}$/.test(portCandidate)) {
      const parsedPort = Number.parseInt(portCandidate, 10);
      if (parsedPort >= 1 && parsedPort <= 65535) {
        host = trimmed.slice(0, separator);
        port = parsedPort;
      }
    }
  }
  host = normalizeEgressHost(host);
  if (!host || !isValidEgressHost(host)) {
    return undefined;
  }
  return {
    host,
    ...(port !== undefined ? { port } : {})
  };
}

function normalizeEgressHost(value: string): string {
  return value.trim().toLowerCase().replace(/\.$/, "");
}

function dedupeEgressDestinations(items: SandboxEgressDestination[]): SandboxEgressDestination[] {
  const seen = new Set<string>();
  const deduped: SandboxEgressDestination[] = [];
  for (const item of items) {
    const key = `${item.host}:${item.port ?? "*"}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    deduped.push(item);
  }
  return deduped;
}

function matchesAllowedDestination(allow: SandboxEgressAllowRule[], destination: SandboxEgressDestination): boolean {
  return allow.some((rule) => {
    if (rule.port !== undefined) {
      if (destination.port === undefined || destination.port !== rule.port) {
        return false;
      }
    }
    return matchesEgressHostRule(rule.host, destination.host);
  });
}

function matchesEgressHostRule(ruleHost: string, destinationHost: string): boolean {
  if (ruleHost === destinationHost) {
    return true;
  }
  if (!ruleHost.startsWith("*.")) {
    return false;
  }
  const suffix = ruleHost.slice(1);
  return destinationHost.endsWith(suffix) && destinationHost.length > suffix.length;
}

function formatEgressDestination(destination: { host: string; port?: number }): string {
  return `${destination.host}${destination.port !== undefined ? `:${destination.port}` : ""}`;
}

function isValidEgressHost(value: string): boolean {
  if (isIpv4Host(value)) {
    return true;
  }
  if (isHostname(value)) {
    return true;
  }
  if (value.startsWith("*.")) {
    return isHostname(value.slice(2));
  }
  return false;
}

function isIpv4Host(value: string): boolean {
  const parts = value.split(".");
  if (parts.length !== 4) {
    return false;
  }
  return parts.every((part) => {
    if (!/^\d{1,3}$/.test(part)) {
      return false;
    }
    const parsed = Number.parseInt(part, 10);
    return parsed >= 0 && parsed <= 255;
  });
}

function isHostname(value: string): boolean {
  if (value.length === 0 || value.length > 253) {
    return false;
  }
  if (!/^[a-z0-9.-]+$/.test(value)) {
    return false;
  }
  const labels = value.split(".");
  if (labels.some((label) => label.length === 0 || label.length > 63)) {
    return false;
  }
  return labels.every((label) => /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(label));
}

function createAbortController(signal: AbortSignal | undefined): {
  controller: AbortController;
  abortExternalListener: () => void;
} {
  const controller = new AbortController();
  if (!signal) {
    return {
      controller,
      abortExternalListener: () => undefined
    };
  }
  if (signal.aborted) {
    controller.abort();
    return {
      controller,
      abortExternalListener: () => undefined
    };
  }
  const listener = () => controller.abort();
  signal.addEventListener("abort", listener, { once: true });
  return {
    controller,
    abortExternalListener: () => signal.removeEventListener("abort", listener)
  };
}

async function sleepWithAbort(ms: number, signal: AbortSignal): Promise<void> {
  if (ms <= 0 || signal.aborted) {
    return;
  }
  await new Promise<void>((resolve) => {
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      signal.removeEventListener("abort", onAbort);
      resolve();
    };
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

function markLockAcquisitionFailure(error: unknown, denied: number): unknown {
  if (error && typeof error === "object") {
    const record = error as Record<string, unknown>;
    record.__athenaLockAcquisitionFailure = true;
    record.__athenaObservedActiveRuns = denied;
  }
  return error;
}

function isLockAcquisitionFailure(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }
  return (error as Record<string, unknown>).__athenaLockAcquisitionFailure === true;
}

function getObservedActiveRunsFromLockError(error: unknown): number | undefined {
  if (!error || typeof error !== "object") {
    return undefined;
  }
  const value = (error as Record<string, unknown>).__athenaObservedActiveRuns;
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    return undefined;
  }
  return value;
}

interface PolicyStateFile {
  schemaVersion: number;
  policy: PolicyDocument | null;
}

function migratePolicyState(raw: unknown): { state: PolicyStateFile; migrated: boolean } {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new AthenaError("SESSION_IO_ERROR", "Policy state file must contain a JSON object.");
  }

  const row = raw as Record<string, unknown>;
  const maybePolicy = row.policy;
  if ("policy" in row) {
    const state: PolicyStateFile = {
      schemaVersion: POLICY_STATE_SCHEMA_VERSION,
      policy: maybePolicy === null || maybePolicy === undefined ? null : normalizePolicyDocument(maybePolicy)
    };
    const schemaVersion = row.schemaVersion;
    const migrated = schemaVersion !== POLICY_STATE_SCHEMA_VERSION;
    return { state, migrated };
  }

  if ("updatedAt" in row) {
    return {
      state: {
        schemaVersion: POLICY_STATE_SCHEMA_VERSION,
        policy: normalizePolicyDocument(row)
      },
      migrated: true
    };
  }

  return {
    state: {
      schemaVersion: POLICY_STATE_SCHEMA_VERSION,
      policy: null
    },
    migrated: true
  };
}

function normalizePolicyDocument(
  input: unknown,
  options?: {
    serverAuthoredUpdatedAt?: string;
  }
): PolicyDocument {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new AthenaError("CONFIG_ERROR", "Policy document must be a JSON object.");
  }
  const row = input as Record<string, unknown>;
  const updatedAt = options?.serverAuthoredUpdatedAt ?? normalizePolicyIsoString(row.updatedAt, "policy.updatedAt");
  const schemaVersion = normalizePolicySchemaVersion(row.schemaVersion);
  const maxConcurrentRuns = readOptionalPositiveInt(row.maxConcurrentRuns, "policy.maxConcurrentRuns");
  const defaultRunTimeoutMs = readOptionalPositiveInt(row.defaultRunTimeoutMs, "policy.defaultRunTimeoutMs");
  const defaultScheduleTimeoutMs = readOptionalPositiveInt(
    row.defaultScheduleTimeoutMs,
    "policy.defaultScheduleTimeoutMs"
  );
  const retryBudgetPerRun = readOptionalNonNegativeInt(row.retryBudgetPerRun, "policy.retryBudgetPerRun");
  const costBudgetDailyUsd = readOptionalNonNegativeNumber(row.costBudgetDailyUsd, "policy.costBudgetDailyUsd");

  return {
    schemaVersion,
    updatedAt,
    ...(maxConcurrentRuns !== undefined ? { maxConcurrentRuns } : {}),
    ...(defaultRunTimeoutMs !== undefined ? { defaultRunTimeoutMs } : {}),
    ...(defaultScheduleTimeoutMs !== undefined ? { defaultScheduleTimeoutMs } : {}),
    ...(retryBudgetPerRun !== undefined ? { retryBudgetPerRun } : {}),
    ...(costBudgetDailyUsd !== undefined ? { costBudgetDailyUsd } : {})
  };
}

function normalizePolicyIsoString(value: unknown, label: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new AthenaError("CONFIG_ERROR", `${label} must be a non-empty ISO datetime string.`);
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new AthenaError("CONFIG_ERROR", `${label} must be a valid ISO datetime string.`);
  }
  return parsed.toISOString();
}

function normalizePolicySchemaVersion(value: unknown): number {
  if (value === undefined || value === null) {
    return POLICY_DOCUMENT_SCHEMA_VERSION;
  }
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
    throw new AthenaError("CONFIG_ERROR", "policy.schemaVersion must be a positive integer.");
  }
  return value;
}

function readOptionalPositiveInt(value: unknown, label: string): number | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
    throw new AthenaError("CONFIG_ERROR", `${label} must be a positive integer.`);
  }
  return value;
}

function readOptionalNonNegativeInt(value: unknown, label: string): number | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    throw new AthenaError("CONFIG_ERROR", `${label} must be a non-negative integer.`);
  }
  return value;
}

function readOptionalNonNegativeNumber(value: unknown, label: string): number | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new AthenaError("CONFIG_ERROR", `${label} must be a non-negative number.`);
  }
  return value;
}

function clampLimit(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.floor(value)));
}

function normalizeRuntimeIsolationProfile(value: string | undefined): "standard" | "high-security" | undefined {
  if (!value) {
    return undefined;
  }
  const normalized = value.trim().toLowerCase();
  if (normalized === "standard") {
    return "standard";
  }
  if (normalized === "high-security" || normalized === "high_security" || normalized === "highsecurity") {
    return "high-security";
  }
  return undefined;
}
