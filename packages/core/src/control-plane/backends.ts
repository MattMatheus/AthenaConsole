import { RuntimeCancellationStore } from "../runtime/cancellation.js";
import {
  createRuntime,
  type Runtime,
  type RuntimeEvidenceAttachment,
  type RuntimeRunOptions
} from "../runtime/index.js";
import type { AthenaConfig } from "../shared/config.js";
import type {
  ActiveRunQueryResult,
  CancelRunByRunIdRequest,
  CancelRunByRunIdResult,
  CancelRunRequest,
  CancelRunResult,
  CancellationRequestQueryResult,
  RunControlQuery,
  RunRequest,
  RunResult
} from "../shared/contracts.js";
export {
  DockerSandboxExecutionBackend,
  type DockerCommandRunner,
  type DockerSandboxExecutionBackendOptions
} from "./backends/docker-sandbox-execution-backend.js";
export {
  K8sSandboxExecutionBackend,
  type K8sPodApiClient,
  type K8sPodLogClient,
  type K8sSandboxExecutionBackendOptions
} from "./backends/k8s-sandbox-execution-backend.js";

export interface SandboxClaimRequest {
  runId: string;
  sessionId: string;
  templateRef: string;
  warmPoolRef?: string;
  runtimeClassName?: string;
  workspaceHostPath?: string;
  workspaceMountPath?: string;
  workspaceReadOnly?: boolean;
  workspaceSyncRepo?: string;
  workspaceSyncRef?: string;
  workspaceSyncSubPath?: string;
  workspaceSyncStrategy?: "init-git-clone" | "git-sync";
  workspaceIgnore?: string[];
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
  egressPolicy?: SandboxEgressPolicy;
  timeoutMs?: number;
}

export interface SandboxEgressAllowRule {
  host: string;
  port?: number;
}

export interface SandboxEgressPolicy {
  schemaVersion: 1;
  defaultAction: "deny";
  allow: SandboxEgressAllowRule[];
}

export interface SandboxClaimResult {
  status: "claimed" | "unsupported";
  sandboxId?: string;
  claimName?: string;
  namespace?: string;
  runtimeClassName?: string;
  claimedAt?: string;
  reason?: string;
}

export interface SandboxWaitReadyRequest {
  runId: string;
  sandboxId: string;
  timeoutMs: number;
}

export interface SandboxWaitReadyResult {
  status: "ready" | "timeout" | "unsupported";
  observedAt: string;
  endpoint?: string;
  reason?: string;
}

export interface SandboxTerminateRequest {
  runId: string;
  sandboxId: string;
  reason: "cancelled" | "timeout" | "failed" | "cleanup";
}

export interface SandboxTerminateResult {
  status: "terminated" | "unsupported";
  observedAt: string;
  reason?: string;
}

export interface SandboxCleanupRequest {
  runId: string;
  sandboxId: string;
  ttlSeconds?: number;
}

export interface SandboxCleanupResult {
  status: "cleaned" | "unsupported";
  observedAt: string;
  reason?: string;
}

export interface SandboxResourceUsageRequest {
  runId: string;
  sandboxId: string;
  namespace?: string;
}

export interface SandboxResourceUsageResult {
  status: "ok" | "unsupported";
  observedAt: string;
  cpuCores?: number;
  memoryBytes?: number;
  diskBytes?: number;
  reason?: string;
}

export interface SandboxExecutionBackend {
  readonly kind: "local-placeholder" | "agent-sandbox";
  isAvailable(): Promise<boolean>;
  claim(request: SandboxClaimRequest): Promise<SandboxClaimResult>;
  waitReady(request: SandboxWaitReadyRequest): Promise<SandboxWaitReadyResult>;
  terminate(request: SandboxTerminateRequest): Promise<SandboxTerminateResult>;
  cleanup(request: SandboxCleanupRequest): Promise<SandboxCleanupResult>;
  getResourceUsage?(request: SandboxResourceUsageRequest): Promise<SandboxResourceUsageResult>;
}

export interface BackendOperationsMetricsSnapshot {
  supportsPods: boolean;
  supportsCpuMemMetrics: boolean;
  runs: {
    active: number;
    cancellationRequested: number;
  };
}

export interface ExecutionBackend {
  kind: "local" | "k8s";
  run(request: RunRequest, options?: RuntimeRunOptions): Promise<RunResult>;
  cancel(request: CancelRunRequest): Promise<CancelRunResult>;
  cancelByRunId?(request: CancelRunByRunIdRequest): Promise<CancelRunByRunIdResult>;
  listActiveRuns?(query?: RunControlQuery): Promise<ActiveRunQueryResult>;
  listCancellationRequests?(query?: RunControlQuery): Promise<CancellationRequestQueryResult>;
  getOperationsMetrics?(): Promise<BackendOperationsMetricsSnapshot>;
}

export type { RuntimeEvidenceAttachment };

export interface LocalExecutionBackendOptions {
  config: AthenaConfig;
  runtime?: Runtime;
  cancellationStore?: RuntimeCancellationStore;
}

export class LocalSandboxExecutionBackend implements SandboxExecutionBackend {
  readonly kind = "local-placeholder" as const;

  async isAvailable(): Promise<boolean> {
    return false;
  }

  async claim(_request: SandboxClaimRequest): Promise<SandboxClaimResult> {
    return {
      status: "unsupported",
      reason: "sandbox execution backend is not configured"
    };
  }

  async waitReady(_request: SandboxWaitReadyRequest): Promise<SandboxWaitReadyResult> {
    return {
      status: "unsupported",
      observedAt: new Date().toISOString(),
      reason: "sandbox execution backend is not configured"
    };
  }

  async terminate(_request: SandboxTerminateRequest): Promise<SandboxTerminateResult> {
    return {
      status: "unsupported",
      observedAt: new Date().toISOString(),
      reason: "sandbox execution backend is not configured"
    };
  }

  async cleanup(_request: SandboxCleanupRequest): Promise<SandboxCleanupResult> {
    return {
      status: "unsupported",
      observedAt: new Date().toISOString(),
      reason: "sandbox execution backend is not configured"
    };
  }
}

export class LocalExecutionBackend implements ExecutionBackend {
  readonly kind = "local" as const;
  private readonly runtime: Runtime;
  private readonly cancellationStore: RuntimeCancellationStore;

  constructor(private readonly options: LocalExecutionBackendOptions) {
    this.runtime = options.runtime ?? createRuntime({ config: options.config });
    this.cancellationStore = options.cancellationStore ?? new RuntimeCancellationStore(options.config);
  }

  run(request: RunRequest, options?: RuntimeRunOptions): Promise<RunResult> {
    return this.runtime.run(request, options);
  }

  async cancel(request: CancelRunRequest): Promise<CancelRunResult> {
    const response = await this.cancellationStore.requestCancellation(request.sessionId, request.reason);
    return {
      sessionId: request.sessionId,
      status: response.status
    };
  }

  async cancelByRunId(request: CancelRunByRunIdRequest): Promise<CancelRunByRunIdResult> {
    const response = await this.cancellationStore.requestCancellationByRunId(request.runId, request.reason);
    return {
      runId: request.runId,
      status: response.status,
      ...(response.sessionId ? { sessionId: response.sessionId } : {})
    };
  }

  listActiveRuns(query?: RunControlQuery): Promise<ActiveRunQueryResult> {
    return this.cancellationStore.listActiveRuns(query);
  }

  listCancellationRequests(query?: RunControlQuery): Promise<CancellationRequestQueryResult> {
    return this.cancellationStore.listCancellationRequests(query);
  }
}
