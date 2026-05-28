import { apiClient } from "../../services";
import type {
  WorkflowRunGraphEventLevel,
  WorkflowRunGraphRunStatus,
  WorkflowRunGraphStatus,
  WorkflowRunGraphStepStatus,
  WorkflowRunStatusEdge,
  WorkflowRunStatusEvent,
  WorkflowRunStatusNode,
  WorkflowRunStatusProgress,
  WorkflowRunStatusSummary,
} from "./types";

type RecordValue = Record<string, unknown>;

function isRecord(value: unknown): value is RecordValue {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function runStatus(value: unknown): WorkflowRunGraphRunStatus {
  return value === "running" || value === "completed" || value === "failed" || value === "resumable" ? value : "pending";
}

function stepStatus(value: unknown): WorkflowRunGraphStepStatus {
  return value === "running" || value === "completed" || value === "failed" || value === "skipped" ? value : "pending";
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
    ...(value.failure !== undefined ? { failure: value.failure } : {}),
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

function parseNode(value: unknown): WorkflowRunStatusNode {
  if (!isRecord(value) || typeof value.id !== "string") {
    throw new Error("Workflow run node payload is invalid.");
  }
  const readiness = isRecord(value.readiness) ? value.readiness : {};
  const timestamps = isRecord(value.timestamps) ? value.timestamps : {};
  const recovery = isRecord(value.recovery) ? value.recovery : undefined;
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
    ...(value.failure !== undefined ? { failure: value.failure } : {}),
    ...(recovery
      ? {
          recovery: {
            resumable: Boolean(recovery.resumable),
            ...(recovery.reason === "failed" || recovery.reason === "stale-running-step" ? { reason: recovery.reason } : {}),
          },
        }
      : {}),
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
