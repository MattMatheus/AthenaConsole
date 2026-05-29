import { apiClient } from "../../services";
import type {
  TaskWorkbenchMetadata,
  TaskWorkbenchArtifactMetadata,
  TaskWorkbenchRunEvent,
  TaskWorkbenchRunReadiness,
  TaskWorkbenchRunReadinessCheck,
  TaskWorkbenchRunReadinessCheckCategory,
  TaskWorkbenchRunReadinessCheckStatus,
  TaskWorkbenchRunReadinessStatus,
  TaskWorkbenchRunStatus,
  TaskWorkbenchTask,
  TaskWorkbenchTaskCreateRequest,
  TaskWorkbenchTaskListQuery,
  TaskWorkbenchTaskListResult,
  TaskWorkbenchTaskRun,
  TaskWorkbenchTaskRunDetail,
  TaskWorkbenchTaskStatus,
  TaskWorkbenchVerificationFailure,
  TaskWorkbenchVerificationStatus,
} from "./types";

type RecordValue = Record<string, unknown>;

function isRecord(value: unknown): value is RecordValue {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.length > 0)
    : [];
}

function parseStatus(value: unknown): TaskWorkbenchTaskStatus {
  return typeof value === "string" ? (value as TaskWorkbenchTaskStatus) : "draft";
}

function parseReadinessStatus(value: unknown): TaskWorkbenchRunReadinessStatus {
  return value === "ready" || value === "ready-with-warnings" || value === "blocked" ? value : "blocked";
}

function parseReadinessCheckStatus(value: unknown): TaskWorkbenchRunReadinessCheckStatus {
  return value === "ok" || value === "warning" || value === "blocked" ? value : "blocked";
}

function parseReadinessCheckCategory(value: unknown): TaskWorkbenchRunReadinessCheckCategory {
  return value === "repo" || value === "provider" || value === "agent" || value === "runtime" || value === "permissions"
    ? value
    : "runtime";
}

function parseRunStatus(value: unknown): TaskWorkbenchRunStatus {
  return typeof value === "string" ? (value as TaskWorkbenchRunStatus) : "queued";
}

function parseVerificationStatus(value: unknown): TaskWorkbenchVerificationStatus | undefined {
  return value === "passed" || value === "verification-failed" ? value : undefined;
}

function parseStringRecord(value: unknown): Record<string, string> | undefined {
  if (!isRecord(value)) {
    return undefined;
  }
  const entries = Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === "string");
  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
}

function parseVerificationFailure(value: unknown): TaskWorkbenchVerificationFailure | undefined {
  if (
    !isRecord(value) ||
    typeof value.policyId !== "string" ||
    value.kind !== "require-evidence" ||
    typeof value.message !== "string"
  ) {
    return undefined;
  }
  const details = parseStringRecord(value.details);
  return {
    policyId: value.policyId,
    kind: value.kind,
    message: value.message,
    ...(details ? { details } : {}),
  };
}

function parseTask(value: unknown): TaskWorkbenchTask {
  if (!isRecord(value) || typeof value.id !== "string" || typeof value.title !== "string") {
    throw new Error("Task payload is invalid.");
  }
  return {
    id: value.id,
    title: value.title,
    description: typeof value.description === "string" ? value.description : "",
    status: parseStatus(value.status),
    capabilityRequirements: toStringArray(value.capabilityRequirements),
    ...(typeof value.assignedAgentId === "string" ? { assignedAgentId: value.assignedAgentId } : {}),
    ...(typeof value.assignedAgentVersion === "string" ? { assignedAgentVersion: value.assignedAgentVersion } : {}),
    inputs: value.inputs ?? {},
    dependsOn: toStringArray(value.dependsOn),
    ...(typeof value.missionId === "string" ? { missionId: value.missionId } : {}),
    ...(typeof value.sourceRunId === "string" ? { sourceRunId: value.sourceRunId } : {}),
    ...(value.provenance !== undefined ? { provenance: value.provenance } : {}),
    ...(typeof value.createdBy === "string" ? { createdBy: value.createdBy } : {}),
    createdAt: typeof value.createdAt === "string" ? value.createdAt : new Date(0).toISOString(),
    updatedAt: typeof value.updatedAt === "string" ? value.updatedAt : new Date(0).toISOString(),
    ...(typeof value.archivedAt === "string" ? { archivedAt: value.archivedAt } : {}),
    ...(isRecord(value.runReadiness) ? { runReadiness: parseRunReadiness(value.runReadiness) } : {}),
  };
}

export function parseRunReadinessCheck(value: unknown): TaskWorkbenchRunReadinessCheck | undefined {
  if (!isRecord(value) || typeof value.id !== "string" || typeof value.label !== "string") {
    return undefined;
  }
  return {
    id: value.id,
    category: parseReadinessCheckCategory(value.category),
    status: parseReadinessCheckStatus(value.status),
    label: value.label,
    message: typeof value.message === "string" ? value.message : "",
    nextStep: typeof value.nextStep === "string" ? value.nextStep : "",
  };
}

export function parseRunReadiness(value: unknown): TaskWorkbenchRunReadiness {
  const record = isRecord(value) ? value : {};
  return {
    status: parseReadinessStatus(record.status),
    ready: Boolean(record.ready),
    summary: typeof record.summary === "string" ? record.summary : "Run readiness unavailable.",
    checks: Array.isArray(record.checks)
      ? record.checks.map(parseRunReadinessCheck).filter((check): check is TaskWorkbenchRunReadinessCheck => check !== undefined)
      : [],
  };
}

function parseRun(value: unknown): TaskWorkbenchTaskRun {
  if (!isRecord(value) || typeof value.id !== "string" || typeof value.targetId !== "string") {
    throw new Error("Task run payload is invalid.");
  }
  const verificationStatus = parseVerificationStatus(value.verificationStatus);
  return {
    id: value.id,
    targetType: "task",
    targetId: value.targetId,
    status: parseRunStatus(value.status),
    ...(typeof value.backend === "string" ? { backend: value.backend } : {}),
    ...(typeof value.agentId === "string" ? { agentId: value.agentId } : {}),
    ...(typeof value.agentVersion === "string" ? { agentVersion: value.agentVersion } : {}),
    ...(typeof value.startedAt === "string" ? { startedAt: value.startedAt } : {}),
    ...(typeof value.endedAt === "string" ? { endedAt: value.endedAt } : {}),
    ...(value.output !== undefined ? { output: value.output } : {}),
    ...(value.failure !== undefined ? { failure: value.failure } : {}),
    ...(value.safetyStop !== undefined ? { safetyStop: value.safetyStop } : {}),
    ...(verificationStatus ? { verificationStatus } : {}),
    ...(Array.isArray(value.verificationFailures)
      ? {
          verificationFailures: value.verificationFailures
            .map(parseVerificationFailure)
            .filter((failure): failure is TaskWorkbenchVerificationFailure => failure !== undefined),
        }
      : {}),
    createdAt: typeof value.createdAt === "string" ? value.createdAt : new Date(0).toISOString(),
    updatedAt: typeof value.updatedAt === "string" ? value.updatedAt : new Date(0).toISOString(),
  };
}

function parseRunEvent(value: unknown): TaskWorkbenchRunEvent | undefined {
  if (!isRecord(value) || typeof value.id !== "string" || typeof value.runId !== "string" || typeof value.type !== "string") {
    return undefined;
  }
  return {
    id: value.id,
    runId: value.runId,
    ...(typeof value.taskId === "string" ? { taskId: value.taskId } : {}),
    ...(typeof value.missionId === "string" ? { missionId: value.missionId } : {}),
    ...(typeof value.agentId === "string" ? { agentId: value.agentId } : {}),
    type: value.type,
    level: value.level === "debug" || value.level === "warning" || value.level === "error" ? value.level : "info",
    timestamp: typeof value.timestamp === "string" ? value.timestamp : new Date(0).toISOString(),
    message: typeof value.message === "string" ? value.message : "",
    payload: value.payload ?? {},
    ...(typeof value.parentEventId === "string" ? { parentEventId: value.parentEventId } : {}),
    ...(typeof value.traceId === "string" ? { traceId: value.traceId } : {}),
  };
}

function parseArtifact(value: unknown): TaskWorkbenchArtifactMetadata | undefined {
  if (!isRecord(value) || typeof value.id !== "string" || typeof value.runId !== "string" || typeof value.storageUri !== "string") {
    return undefined;
  }
  return {
    id: value.id,
    runId: value.runId,
    ...(typeof value.taskId === "string" ? { taskId: value.taskId } : {}),
    ...(typeof value.agentId === "string" ? { agentId: value.agentId } : {}),
    label: typeof value.label === "string" ? value.label : value.id,
    kind: typeof value.kind === "string" ? value.kind : "supporting",
    format: typeof value.format === "string" ? value.format : "text",
    storageUri: value.storageUri,
    ...(typeof value.sizeBytes === "number" ? { sizeBytes: value.sizeBytes } : {}),
    ...(typeof value.hash === "string" ? { hash: value.hash } : {}),
    metadata: value.metadata ?? {},
    ...(value.schemaValidation !== undefined ? { schemaValidation: value.schemaValidation } : {}),
    createdAt: typeof value.createdAt === "string" ? value.createdAt : new Date(0).toISOString(),
  };
}

function parseRunDetail(value: unknown): TaskWorkbenchTaskRunDetail {
  if (!isRecord(value) || !isRecord(value.run)) {
    throw new Error("Task run detail payload is invalid.");
  }
  return {
    run: parseRun(value.run),
    ...(isRecord(value.task) ? { task: parseTask(value.task) } : {}),
    events: Array.isArray(value.events)
      ? value.events.map(parseRunEvent).filter((event): event is TaskWorkbenchRunEvent => event !== undefined)
      : [],
    artifacts: Array.isArray(value.artifacts)
      ? value.artifacts.map(parseArtifact).filter((artifact): artifact is TaskWorkbenchArtifactMetadata => artifact !== undefined)
      : [],
  };
}

function parseMetadata(value: unknown): TaskWorkbenchMetadata {
  if (!isRecord(value)) {
    throw new Error("Task metadata payload is invalid.");
  }
  return {
    statuses: toStringArray(value.statuses) as TaskWorkbenchTaskStatus[],
    defaultStatus: parseStatus(value.defaultStatus),
    readyRequiresAssignedAgent: Boolean(value.readyRequiresAssignedAgent),
  };
}

export async function fetchTaskWorkbenchMetadata(): Promise<TaskWorkbenchMetadata> {
  return parseMetadata(await apiClient.get<unknown>("/v1/tasks/metadata"));
}

export async function fetchTasks(query: TaskWorkbenchTaskListQuery = {}): Promise<TaskWorkbenchTaskListResult> {
  const params = new URLSearchParams();
  if (query.status) {
    params.set("status", query.status);
  }
  if (query.missionId) {
    params.set("missionId", query.missionId);
  }
  if (query.includeArchived !== undefined) {
    params.set("includeArchived", String(query.includeArchived));
  }
  const suffix = params.size > 0 ? `?${params.toString()}` : "";
  const value = await apiClient.get<unknown>(`/v1/tasks${suffix}`);
  if (!isRecord(value) || !Array.isArray(value.tasks)) {
    throw new Error("Task list payload is invalid.");
  }
  return {
    tasks: value.tasks.map(parseTask),
    total: typeof value.total === "number" ? value.total : value.tasks.length,
    filters: isRecord(value.filters) ? (value.filters as TaskWorkbenchTaskListQuery) : {},
  };
}

export async function createTask(request: TaskWorkbenchTaskCreateRequest): Promise<TaskWorkbenchTask> {
  return parseTask(await apiClient.post<unknown>("/v1/tasks", request));
}

export async function fetchTaskRunDetail(runId: string): Promise<TaskWorkbenchTaskRunDetail> {
  return parseRunDetail(await apiClient.get<unknown>(`/v1/task-runs/${encodeURIComponent(runId)}`));
}
