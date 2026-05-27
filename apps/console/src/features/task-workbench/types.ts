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

export type TaskWorkbenchTask = {
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
};

export type TaskWorkbenchTaskListQuery = {
  status?: TaskWorkbenchTaskStatus;
  missionId?: string;
  includeArchived?: boolean;
};

export type TaskWorkbenchTaskListResult = {
  tasks: TaskWorkbenchTask[];
  total: number;
  filters: TaskWorkbenchTaskListQuery;
};

export type TaskWorkbenchMetadata = {
  statuses: TaskWorkbenchTaskStatus[];
  defaultStatus: TaskWorkbenchTaskStatus;
  readyRequiresAssignedAgent: boolean;
};

export type TaskWorkbenchRunStatus =
  | "queued"
  | "validating"
  | "running"
  | "waiting-for-approval"
  | "completed"
  | "failed"
  | "cancelled"
  | "stopped-by-limit";

export type TaskWorkbenchTaskRun = {
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
  createdAt: string;
  updatedAt: string;
};

export type TaskWorkbenchRunEvent = {
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
};

export type TaskWorkbenchArtifactMetadata = {
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
};

export type TaskWorkbenchTaskRunDetail = {
  run: TaskWorkbenchTaskRun;
  task?: TaskWorkbenchTask;
  events: TaskWorkbenchRunEvent[];
  artifacts: TaskWorkbenchArtifactMetadata[];
};

export type TaskWorkbenchTaskCreateRequest = {
  title: string;
  description?: string;
  status?: TaskWorkbenchTaskStatus;
  capabilityRequirements?: string[];
  assignedAgentId?: string;
  assignedAgentVersion?: string;
  inputs?: unknown;
  createdBy?: string;
};
