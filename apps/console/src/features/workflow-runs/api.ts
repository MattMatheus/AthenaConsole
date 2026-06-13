import { apiClient } from "../../services";
import type {
  WorkflowRunExecuteResult,
  WorkflowRunGraphEventLevel,
  WorkflowRunGraphRunStatus,
  WorkflowRunGraphStatus,
  WorkflowRunGraphStepStatus,
  WorkflowQueueStatus,
  WorkflowQueueStatusItem,
  WorkflowQueueStatusWorker,
  WorkflowRunStatusEdge,
  WorkflowRunStatusEvent,
  WorkflowRunStatusNode,
  WorkflowRunStatusProgress,
  WorkflowRunStatusSummary,
  WorkflowRunStatusTaskRunEvidence,
} from "./types";

type RecordValue = Record<string, unknown>;

function isRecord(value: unknown): value is RecordValue {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function runStatus(value: unknown): WorkflowRunGraphRunStatus {
  return value === "running" || value === "completed" || value === "failed" || value === "resumable" || value === "cancelled"
    ? value
    : "pending";
}

function stepStatus(value: unknown): WorkflowRunGraphStepStatus {
  return value === "running" || value === "completed" || value === "failed" || value === "skipped" || value === "cancelled" ? value : "pending";
}

function eventLevel(value: unknown): WorkflowRunGraphEventLevel {
  return value === "warning" || value === "error" ? value : "info";
}

function numberValue(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function parseRun(value: unknown): WorkflowRunStatusSummary {
  if (!isRecord(value) || typeof value.id !== "string") {
    throw new Error("Workflow run payload is invalid.");
  }
  const workflowTemplate = isRecord(value.workflowTemplate) ? value.workflowTemplate : {};
  return {
    id: value.id,
    status: runStatus(value.status),
    workflowTemplate: {
      id: typeof workflowTemplate.id === "string" ? workflowTemplate.id : "unknown",
      ...(typeof workflowTemplate.version === "string" ? { version: workflowTemplate.version } : {}),
      ...(typeof workflowTemplate.pluginId === "string" ? { pluginId: workflowTemplate.pluginId } : {}),
      ...(typeof workflowTemplate.pluginVersion === "string" ? { pluginVersion: workflowTemplate.pluginVersion } : {}),
    },
    createdAt: typeof value.createdAt === "string" ? value.createdAt : new Date(0).toISOString(),
    updatedAt: typeof value.updatedAt === "string" ? value.updatedAt : new Date(0).toISOString(),
    ...(typeof value.startedAt === "string" ? { startedAt: value.startedAt } : {}),
    ...(typeof value.finishedAt === "string" ? { finishedAt: value.finishedAt } : {}),
    ...(value.failure !== undefined && value.failure !== null ? { failure: value.failure } : {}),
  };
}

function parseProgress(value: unknown): WorkflowRunStatusProgress {
  const record = isRecord(value) ? value : {};
  return {
    totalSteps: numberValue(record.totalSteps),
    completedSteps: numberValue(record.completedSteps),
    runningSteps: numberValue(record.runningSteps),
    failedSteps: numberValue(record.failedSteps),
    pendingSteps: numberValue(record.pendingSteps),
    readySteps: numberValue(record.readySteps),
    blockedSteps: numberValue(record.blockedSteps),
    percentComplete: numberValue(record.percentComplete),
  };
}

function parseTaskRunEvidence(value: unknown): WorkflowRunStatusTaskRunEvidence | undefined {
  if (!isRecord(value) || typeof value.id !== "string") {
    return undefined;
  }
  return {
    id: value.id,
    status: typeof value.status === "string" ? value.status : "unknown",
    ...(typeof value.outputSummary === "string" ? { outputSummary: value.outputSummary } : {}),
    artifactCount: numberValue(value.artifactCount),
    artifacts: Array.isArray(value.artifacts)
      ? value.artifacts
          .filter((artifact): artifact is RecordValue => isRecord(artifact) && typeof artifact.id === "string")
          .map((artifact) => ({
            id: artifact.id as string,
            label: typeof artifact.label === "string" ? artifact.label : String(artifact.id),
            kind: typeof artifact.kind === "string" ? artifact.kind : "artifact",
            format: typeof artifact.format === "string" ? artifact.format : "unknown",
          }))
      : [],
  };
}

function parseNode(value: unknown): WorkflowRunStatusNode {
  if (!isRecord(value) || typeof value.id !== "string") {
    throw new Error("Workflow run node payload is invalid.");
  }
  const readiness = isRecord(value.readiness) ? value.readiness : {};
  const timestamps = isRecord(value.timestamps) ? value.timestamps : {};
  const recovery = isRecord(value.recovery) ? value.recovery : undefined;
  const taskRunEvidence = parseTaskRunEvidence(value.taskRunEvidence);
  return {
    id: value.id,
    status: stepStatus(value.status),
    ready: Boolean(value.ready),
    attempt: numberValue(value.attempt),
    dependencies: stringArray(value.dependencies),
    dependents: stringArray(value.dependents),
    blockingStepIds: stringArray(value.blockingStepIds),
    readiness: {
      totalDependencies: numberValue(readiness.totalDependencies),
      readyDependencies: numberValue(readiness.readyDependencies),
      blocked: Boolean(readiness.blocked),
    },
    timestamps: {
      updatedAt: typeof timestamps.updatedAt === "string" ? timestamps.updatedAt : new Date(0).toISOString(),
      ...(typeof timestamps.startedAt === "string" ? { startedAt: timestamps.startedAt } : {}),
      ...(typeof timestamps.finishedAt === "string" ? { finishedAt: timestamps.finishedAt } : {}),
    },
    ...(value.failure !== undefined && value.failure !== null ? { failure: value.failure } : {}),
    ...(recovery
      ? {
          recovery: {
            resumable: Boolean(recovery.resumable),
            ...(recovery.reason === "failed" || recovery.reason === "stale-running-step" ? { reason: recovery.reason } : {}),
          },
        }
      : {}),
    ...(taskRunEvidence ? { taskRunEvidence } : {}),
    ...(value.output !== undefined ? { output: value.output } : {}),
  };
}

function parseEdge(value: unknown): WorkflowRunStatusEdge | undefined {
  if (!isRecord(value) || typeof value.from !== "string" || typeof value.to !== "string") {
    return undefined;
  }
  return { from: value.from, to: value.to };
}

function parseEvent(value: unknown): WorkflowRunStatusEvent {
  if (!isRecord(value) || typeof value.id !== "string" || typeof value.type !== "string") {
    throw new Error("Workflow run event payload is invalid.");
  }
  return {
    id: value.id,
    ...(typeof value.stepId === "string" ? { stepId: value.stepId } : {}),
    type: value.type,
    level: eventLevel(value.level),
    message: typeof value.message === "string" ? value.message : "",
    timestamp: typeof value.timestamp === "string" ? value.timestamp : new Date(0).toISOString(),
    ...(value.payload !== undefined ? { payload: value.payload } : {}),
  };
}

export function parseWorkflowRunStatus(payload: unknown): WorkflowRunGraphStatus {
  if (!isRecord(payload)) {
    throw new Error("Workflow run status payload is invalid.");
  }
  const recovery = isRecord(payload.recovery) ? payload.recovery : {};
  const polling = isRecord(payload.polling) ? payload.polling : {};
  return {
    run: parseRun(payload.run),
    progress: parseProgress(payload.progress),
    nodes: Array.isArray(payload.nodes) ? payload.nodes.map(parseNode) : [],
    edges: Array.isArray(payload.edges) ? payload.edges.map(parseEdge).filter((edge): edge is WorkflowRunStatusEdge => edge !== undefined) : [],
    events: Array.isArray(payload.events) ? payload.events.map(parseEvent) : [],
    recovery: {
      resumable: Boolean(recovery.resumable),
      failedStepIds: stringArray(recovery.failedStepIds),
      staleRecoveredStepIds: stringArray(recovery.staleRecoveredStepIds),
    },
    polling: {
      recommendedIntervalMs: Math.max(numberValue(polling.recommendedIntervalMs, 5_000), 1_000),
      etag: typeof polling.etag === "string" ? polling.etag : "",
    },
  };
}

export async function fetchWorkflowRunStatus(runId: string): Promise<WorkflowRunGraphStatus> {
  return parseWorkflowRunStatus(await apiClient.get<unknown>(`/v1/workflow-runs/${encodeURIComponent(runId)}/status`));
}

export function parseWorkflowRunExecuteResult(payload: unknown): WorkflowRunExecuteResult {
  if (!isRecord(payload) || typeof payload.runId !== "string") {
    throw new Error("Workflow run execution payload is invalid.");
  }
  const status = payload.status === "cancelled" ? "cancelled" : runStatus(payload.status);
  return {
    runId: payload.runId,
    status,
    executedStepIds: stringArray(payload.executedStepIds),
    snapshot: isRecord(payload.snapshot) ? payload.snapshot : {},
  };
}

export async function executeWorkflowRun(runId: string): Promise<WorkflowRunExecuteResult> {
  return parseWorkflowRunExecuteResult(await apiClient.post<unknown>(`/v1/workflow-runs/${encodeURIComponent(runId)}/execute`));
}

function queueState(value: unknown): WorkflowQueueStatusItem["state"] {
  return value === "running" || value === "retryable" || value === "stuck" ? value : "pending";
}

function parseQueueWorker(value: unknown): WorkflowQueueStatusWorker | undefined {
  if (!isRecord(value) || typeof value.workerId !== "string") {
    return undefined;
  }
  return {
    workerId: value.workerId,
    status: value.status === "expired" ? "expired" : "active",
    ...(typeof value.activeRunId === "string" ? { activeRunId: value.activeRunId } : {}),
    ...(typeof value.activeSessionId === "string" ? { activeSessionId: value.activeSessionId } : {}),
    capacity: numberValue(value.capacity, 1),
    version: typeof value.version === "string" ? value.version : "unknown",
    lastHeartbeatAt: typeof value.lastHeartbeatAt === "string" ? value.lastHeartbeatAt : new Date(0).toISOString(),
    expiresAt: typeof value.expiresAt === "string" ? value.expiresAt : new Date(0).toISOString(),
  };
}

function parseQueueItem(value: unknown): WorkflowQueueStatusItem | undefined {
  if (!isRecord(value) || typeof value.id !== "string" || typeof value.workflowRunId !== "string" || typeof value.stepId !== "string") {
    return undefined;
  }
  const timestamps = isRecord(value.timestamps) ? value.timestamps : {};
  return {
    id: value.id,
    state: queueState(value.state),
    workflowRunId: value.workflowRunId,
    workflowTemplateId: typeof value.workflowTemplateId === "string" ? value.workflowTemplateId : "unknown",
    stepId: value.stepId,
    ...(typeof value.taskId === "string" ? { taskId: value.taskId } : {}),
    ...(typeof value.taskRunId === "string" ? { taskRunId: value.taskRunId } : {}),
    ...(typeof value.workerId === "string" ? { workerId: value.workerId } : {}),
    ...(typeof value.reason === "string" ? { reason: value.reason } : {}),
    attempt: numberValue(value.attempt),
    ...(typeof value.maxAttempts === "number" ? { maxAttempts: value.maxAttempts } : {}),
    ready: Boolean(value.ready),
    timestamps: {
      updatedAt: typeof timestamps.updatedAt === "string" ? timestamps.updatedAt : new Date(0).toISOString(),
      ...(typeof timestamps.startedAt === "string" ? { startedAt: timestamps.startedAt } : {}),
      ...(typeof timestamps.finishedAt === "string" ? { finishedAt: timestamps.finishedAt } : {}),
    },
  };
}

export function parseWorkflowQueueStatus(payload: unknown): WorkflowQueueStatus {
  const record = isRecord(payload) ? payload : {};
  const summary = isRecord(record.summary) ? record.summary : {};
  return {
    generatedAt: typeof record.generatedAt === "string" ? record.generatedAt : new Date(0).toISOString(),
    staleWorkerCutoffAt: typeof record.staleWorkerCutoffAt === "string" ? record.staleWorkerCutoffAt : new Date(0).toISOString(),
    summary: {
      pending: numberValue(summary.pending),
      running: numberValue(summary.running),
      retryable: numberValue(summary.retryable),
      stuck: numberValue(summary.stuck),
      workersActive: numberValue(summary.workersActive),
      workersExpired: numberValue(summary.workersExpired),
    },
    items: Array.isArray(record.items) ? record.items.map(parseQueueItem).filter((item): item is WorkflowQueueStatusItem => Boolean(item)) : [],
    workers: Array.isArray(record.workers) ? record.workers.map(parseQueueWorker).filter((worker): worker is WorkflowQueueStatusWorker => Boolean(worker)) : [],
  };
}

export async function fetchWorkflowQueueStatus(): Promise<WorkflowQueueStatus> {
  return parseWorkflowQueueStatus(await apiClient.get<unknown>("/v1/workflow-queue/status"));
}
