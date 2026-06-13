import type { AthenaConfig } from "../../shared/config.js";
import type {
  WorkflowQueueStatusItem,
  WorkflowQueueStatusQuery,
  WorkflowQueueStatusResult,
  WorkflowQueueStatusWorker
} from "../../shared/contracts.js";
import type {
  AppStateDatabase,
  RunRecord,
  TaskRecord,
  WorkflowDagRunSnapshot,
  WorkflowDagStepRecord,
  WorkerHeartbeatRecord
} from "../app-state/index.js";
import { openAppStateDatabase } from "../app-state/index.js";

interface LocalWorkflowQueueStatusServiceOptions {
  appState?: AppStateDatabase;
  defaultStaleAfterMs?: number;
}

type RetryFailurePhase = "runtime-start" | "execution" | "provider" | "verification" | "artifact-export" | "connector-rate-limit";

interface WorkflowTaskRetryPolicy {
  maxAttempts: number;
  retryableFailurePhases: RetryFailurePhase[];
  idempotency: "read-only" | "idempotent" | "non-idempotent";
  externalWriteRetry: "forbid" | "require-approval" | "allow";
}

export class LocalWorkflowQueueStatusService {
  constructor(
    private readonly config: AthenaConfig,
    private readonly options: LocalWorkflowQueueStatusServiceOptions = {}
  ) {}

  getStatus(query: WorkflowQueueStatusQuery = {}): WorkflowQueueStatusResult {
    return this.withAppState((appState) => {
      const at = query.at ? new Date(query.at) : new Date();
      const staleAfterMs = normalizePositiveInteger(query.staleAfterMs, this.options.defaultStaleAfterMs ?? 60_000);
      const limit = normalizePositiveInteger(query.limit, 500);
      const staleWorkerCutoffAt = new Date(at.getTime() - staleAfterMs);
      const workers = appState.workerHeartbeats.list({ limit: 1000 });
      const workersByRunId = new Map(workers.filter((worker) => worker.activeRunId).map((worker) => [worker.activeRunId!, worker]));
      const workerEntries = workers.map((worker) => mapWorker(worker, at));
      const items: WorkflowQueueStatusItem[] = [];

      for (const run of appState.workflowDagRuns.list({ limit })) {
        if (items.length >= limit) {
          break;
        }
        const snapshot = appState.workflowDagRuns.requireSnapshot(run.id);
        for (const stepId of snapshot.run.stepOrder) {
          if (items.length >= limit) {
            break;
          }
          const step = snapshot.steps.find((candidate) => candidate.stepId === stepId);
          if (!step) {
            continue;
          }
          const item = classifyStep(appState, snapshot, step, workersByRunId, at, staleWorkerCutoffAt);
          if (item) {
            items.push(item);
          }
        }
      }

      return {
        generatedAt: at.toISOString(),
        staleWorkerCutoffAt: staleWorkerCutoffAt.toISOString(),
        summary: {
          pending: items.filter((item) => item.state === "pending").length,
          running: items.filter((item) => item.state === "running").length,
          retryable: items.filter((item) => item.state === "retryable").length,
          stuck: items.filter((item) => item.state === "stuck").length,
          workersActive: workerEntries.filter((worker) => worker.status === "active").length,
          workersExpired: workerEntries.filter((worker) => worker.status === "expired").length
        },
        items,
        workers: workerEntries
      };
    });
  }

  private withAppState<T>(read: (appState: AppStateDatabase) => T): T {
    if (this.options.appState) {
      return read(this.options.appState);
    }
    const appState = openAppStateDatabase(this.config);
    try {
      return read(appState);
    } finally {
      appState.close();
    }
  }
}

function classifyStep(
  appState: AppStateDatabase,
  snapshot: WorkflowDagRunSnapshot,
  step: WorkflowDagStepRecord,
  workersByRunId: Map<string, WorkerHeartbeatRecord>,
  at: Date,
  staleWorkerCutoffAt: Date
): WorkflowQueueStatusItem | undefined {
  const task = appState.tasks.findByWorkflowDagStep(snapshot.run.id, step.stepId);
  if (step.status === "pending" && step.ready) {
    return baseItem(snapshot, step, task, "pending");
  }
  if (step.status === "running") {
    const taskRun = task ? latestTaskRun(appState, task, "running") : undefined;
    const worker = taskRun ? workersByRunId.get(taskRun.id) : undefined;
    if (!taskRun) {
      return baseItem(snapshot, step, task, "stuck", { reason: "missing-running-task-run" });
    }
    if (!worker) {
      return baseItem(snapshot, step, task, "stuck", {
        taskRun,
        reason: "missing-worker-heartbeat"
      });
    }
    if (new Date(worker.expiresAt).getTime() < at.getTime() || new Date(worker.lastHeartbeatAt).getTime() < staleWorkerCutoffAt.getTime()) {
      return baseItem(snapshot, step, task, "stuck", {
        taskRun,
        worker,
        reason: "stale-worker-heartbeat"
      });
    }
    return baseItem(snapshot, step, task, "running", { taskRun, worker });
  }
  if (step.status === "failed" && task && isRetryableStep(task, step)) {
    const failedRun = latestTaskRun(appState, task, "failed") ?? latestTaskRun(appState, task, "stopped-by-limit");
    return baseItem(snapshot, step, task, "retryable", {
      taskRun: failedRun,
      reason: "retry-policy-allows-next-attempt",
      maxAttempts: retryPolicyFromTask(task)?.maxAttempts
    });
  }
  return undefined;
}

function baseItem(
  snapshot: WorkflowDagRunSnapshot,
  step: WorkflowDagStepRecord,
  task: TaskRecord | undefined,
  state: WorkflowQueueStatusItem["state"],
  options: {
    taskRun?: RunRecord;
    worker?: WorkerHeartbeatRecord;
    reason?: string;
    maxAttempts?: number;
  } = {}
): WorkflowQueueStatusItem {
  return {
    id: `${snapshot.run.id}:${step.stepId}`,
    state,
    workflowRunId: snapshot.run.id,
    workflowTemplateId: snapshot.run.workflowTemplateId,
    stepId: step.stepId,
    ...(task ? { taskId: task.id } : {}),
    ...(options.taskRun ? { taskRunId: options.taskRun.id } : {}),
    ...(options.worker ? { workerId: options.worker.workerId } : {}),
    ...(options.reason ? { reason: options.reason } : {}),
    attempt: step.attempt,
    ...(options.maxAttempts !== undefined ? { maxAttempts: options.maxAttempts } : {}),
    ready: step.ready,
    timestamps: {
      updatedAt: step.updatedAt,
      ...(step.startedAt ? { startedAt: step.startedAt } : {}),
      ...(step.finishedAt ? { finishedAt: step.finishedAt } : {})
    }
  };
}

function latestTaskRun(appState: AppStateDatabase, task: TaskRecord, status: RunRecord["status"]): RunRecord | undefined {
  return appState.runs.list({ targetType: "task", targetId: task.id, status, limit: 1 })[0];
}

function isRetryableStep(task: TaskRecord, step: WorkflowDagStepRecord): boolean {
  const policy = retryPolicyFromTask(task);
  if (!policy || step.attempt >= policy.maxAttempts) {
    return false;
  }
  const phase = classifyRetryFailurePhase(step.failure);
  if (!policy.retryableFailurePhases.includes(phase)) {
    return false;
  }
  return policy.idempotency !== "non-idempotent" || policy.externalWriteRetry === "allow";
}

function retryPolicyFromTask(task: TaskRecord): WorkflowTaskRetryPolicy | undefined {
  if (!isRecord(task.provenance) || !isRecord(task.provenance.retryPolicy)) {
    return undefined;
  }
  const policy = task.provenance.retryPolicy;
  if (
    typeof policy.maxAttempts !== "number" ||
    !Array.isArray(policy.retryableFailurePhases) ||
    !isRetryIdempotency(policy.idempotency) ||
    !isExternalWriteRetry(policy.externalWriteRetry)
  ) {
    return undefined;
  }
  const retryableFailurePhases = policy.retryableFailurePhases.filter(isRetryFailurePhase);
  return {
    maxAttempts: policy.maxAttempts,
    retryableFailurePhases,
    idempotency: policy.idempotency,
    externalWriteRetry: policy.externalWriteRetry
  };
}

function classifyRetryFailurePhase(failure: unknown): RetryFailurePhase {
  const detail = isRecord(failure) && isRecord(failure.failure) ? failure.failure : failure;
  if (isRecord(detail)) {
    if (detail.status === 429) {
      return "connector-rate-limit";
    }
    if (isRetryFailurePhase(detail.phase)) {
      return detail.phase;
    }
    if (detail.phase === "start") {
      return "runtime-start";
    }
    if (detail.phase === "artifact") {
      return "artifact-export";
    }
  }
  return "execution";
}

function mapWorker(worker: WorkerHeartbeatRecord, at: Date): WorkflowQueueStatusWorker {
  return {
    workerId: worker.workerId,
    status: new Date(worker.expiresAt).getTime() >= at.getTime() ? "active" : "expired",
    ...(worker.activeRunId ? { activeRunId: worker.activeRunId } : {}),
    ...(worker.activeSessionId ? { activeSessionId: worker.activeSessionId } : {}),
    capacity: worker.capacity,
    version: worker.version,
    lastHeartbeatAt: worker.lastHeartbeatAt,
    expiresAt: worker.expiresAt
  };
}

function normalizePositiveInteger(value: number | undefined, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? Math.trunc(value) : fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function isRetryFailurePhase(value: unknown): value is RetryFailurePhase {
  return (
    value === "runtime-start" ||
    value === "execution" ||
    value === "provider" ||
    value === "verification" ||
    value === "artifact-export" ||
    value === "connector-rate-limit"
  );
}

function isRetryIdempotency(value: unknown): value is WorkflowTaskRetryPolicy["idempotency"] {
  return value === "read-only" || value === "idempotent" || value === "non-idempotent";
}

function isExternalWriteRetry(value: unknown): value is WorkflowTaskRetryPolicy["externalWriteRetry"] {
  return value === "forbid" || value === "require-approval" || value === "allow";
}
