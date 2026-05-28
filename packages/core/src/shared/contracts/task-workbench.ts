import type { VerificationPolicyFailure } from "./harness.js";

export type TaskWorkbenchTaskStatus =
  | "draft"
  | "proposed"
  | "ready"
  | "running"
  | "blocked"
  | "completed"
  | "failed"
  | "cancelled"
  | "archived";

export const TASK_WORKBENCH_STATUSES: TaskWorkbenchTaskStatus[] = [
  "draft",
  "proposed",
  "ready",
  "running",
  "blocked",
  "completed",
  "failed",
  "cancelled",
  "archived"
];

export interface TaskWorkbenchTask {
  id: string;
  title: string;
  description: string;
  status: TaskWorkbenchTaskStatus;
  capabilityRequirements: string[];
  assignedAgentId?: string;
  assignedAgentVersion?: string;
  inputs: unknown;
  dependsOn: string[];
  missionId?: string;
  sourceRunId?: string;
  provenance?: unknown;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
  archivedAt?: string;
}

export interface TaskWorkbenchTaskListQuery {
  status?: TaskWorkbenchTaskStatus;
  missionId?: string;
  includeArchived?: boolean;
}

export interface TaskWorkbenchTaskListResult {
  tasks: TaskWorkbenchTask[];
  total: number;
  filters: TaskWorkbenchTaskListQuery;
}

export interface TaskWorkbenchTaskCreateRequest {
  id?: string;
  title: string;
  description?: string;
  status?: TaskWorkbenchTaskStatus;
  capabilityRequirements?: string[];
  assignedAgentId?: string;
  assignedAgentVersion?: string;
  inputs?: unknown;
  dependsOn?: string[];
  missionId?: string;
  sourceRunId?: string;
  provenance?: unknown;
  createdBy?: string;
}

export interface TaskWorkbenchTaskUpdateRequest {
  title?: string;
  description?: string;
  status?: TaskWorkbenchTaskStatus;
  capabilityRequirements?: string[];
  assignedAgentId?: string;
  assignedAgentVersion?: string;
  inputs?: unknown;
  dependsOn?: string[];
  missionId?: string;
  sourceRunId?: string;
  provenance?: unknown;
  createdBy?: string;
}

export interface TaskWorkbenchMetadata {
  statuses: TaskWorkbenchTaskStatus[];
  defaultStatus: TaskWorkbenchTaskStatus;
  readyRequiresAssignedAgent: boolean;
}

export type TaskWorkbenchRunStatus =
  | "queued"
  | "validating"
  | "running"
  | "waiting-for-approval"
  | "completed"
  | "failed"
  | "cancelled"
  | "stopped-by-limit";
export type TaskWorkbenchVerificationStatus = "passed" | "verification-failed";

export interface TaskWorkbenchTaskRun {
  id: string;
  targetType: "task";
  targetId: string;
  status: TaskWorkbenchRunStatus;
  backend?: string;
  agentId?: string;
  agentVersion?: string;
  startedAt?: string;
  endedAt?: string;
  output?: unknown;
  failure?: unknown;
  safetyStop?: unknown;
  verificationStatus?: TaskWorkbenchVerificationStatus;
  verificationFailures?: VerificationPolicyFailure[];
  createdAt: string;
  updatedAt: string;
}

export interface TaskWorkbenchRunEvent {
  id: string;
  runId: string;
  taskId?: string;
  missionId?: string;
  agentId?: string;
  type: string;
  level: "debug" | "info" | "warning" | "error";
  timestamp: string;
  message: string;
  payload: unknown;
  parentEventId?: string;
  traceId?: string;
}

export interface TaskWorkbenchArtifactMetadata {
  id: string;
  runId: string;
  taskId?: string;
  agentId?: string;
  label: string;
  kind: string;
  format: string;
  storageUri: string;
  sizeBytes?: number;
  hash?: string;
  metadata: unknown;
  schemaValidation?: unknown;
  createdAt: string;
}

export interface TaskWorkbenchTaskRunDetail {
  run: TaskWorkbenchTaskRun;
  task?: TaskWorkbenchTask;
  events: TaskWorkbenchRunEvent[];
  artifacts: TaskWorkbenchArtifactMetadata[];
}

export interface TaskWorkbenchTaskRunRequest {
  runId?: string;
}

export interface TaskWorkbenchTaskRunCancelRequest {
  reason?: string;
}

export interface TaskWorkbenchTaskRunCancelResult {
  runId: string;
  status: "cancelled" | "not-running" | "failed" | "unsupported";
}
