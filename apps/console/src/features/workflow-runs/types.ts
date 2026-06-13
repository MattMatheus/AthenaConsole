export type WorkflowRunGraphRunStatus = "pending" | "running" | "completed" | "failed" | "resumable" | "cancelled";
export type WorkflowRunGraphStepStatus = "pending" | "running" | "completed" | "failed" | "skipped" | "cancelled";
export type WorkflowRunGraphEventLevel = "info" | "warning" | "error";
export type WorkflowQueueItemState = "pending" | "running" | "retryable" | "stuck";

export type WorkflowRunStatusSummary = {
  id: string;
  status: WorkflowRunGraphRunStatus;
  workflowTemplate: {
    id: string;
    version?: string;
    pluginId?: string;
    pluginVersion?: string;
  };
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  finishedAt?: string;
  failure?: unknown;
};

export type WorkflowRunStatusProgress = {
  totalSteps: number;
  completedSteps: number;
  runningSteps: number;
  failedSteps: number;
  pendingSteps: number;
  readySteps: number;
  blockedSteps: number;
  percentComplete: number;
};

export type WorkflowRunStatusTaskArtifactSummary = {
  id: string;
  label: string;
  kind: string;
  format: string;
};

export type WorkflowRunStatusTaskRunEvidence = {
  id: string;
  status: string;
  outputSummary?: string;
  artifactCount: number;
  artifacts: WorkflowRunStatusTaskArtifactSummary[];
};

export type WorkflowRunStatusNode = {
  id: string;
  status: WorkflowRunGraphStepStatus;
  ready: boolean;
  attempt: number;
  dependencies: string[];
  dependents: string[];
  blockingStepIds: string[];
  readiness: {
    totalDependencies: number;
    readyDependencies: number;
    blocked: boolean;
  };
  timestamps: {
    updatedAt: string;
    startedAt?: string;
    finishedAt?: string;
  };
  failure?: unknown;
  recovery?: {
    resumable: boolean;
    reason?: "failed" | "stale-running-step";
  };
  taskRunEvidence?: WorkflowRunStatusTaskRunEvidence;
  output?: unknown;
};

export type WorkflowRunStatusEdge = {
  from: string;
  to: string;
};

export type WorkflowRunStatusEvent = {
  id: string;
  stepId?: string;
  type: string;
  level: WorkflowRunGraphEventLevel;
  message: string;
  timestamp: string;
  payload?: unknown;
};

export type WorkflowRunGraphStatus = {
  run: WorkflowRunStatusSummary;
  progress: WorkflowRunStatusProgress;
  nodes: WorkflowRunStatusNode[];
  edges: WorkflowRunStatusEdge[];
  events: WorkflowRunStatusEvent[];
  recovery: {
    resumable: boolean;
    failedStepIds: string[];
    staleRecoveredStepIds: string[];
  };
  polling: {
    recommendedIntervalMs: number;
    etag: string;
  };
};

export type WorkflowRunExecuteResult = {
  runId: string;
  status: WorkflowRunGraphRunStatus | "cancelled";
  executedStepIds: string[];
  snapshot: Record<string, unknown>;
};

export type WorkflowQueueStatusWorker = {
  workerId: string;
  status: "active" | "expired";
  activeRunId?: string;
  activeSessionId?: string;
  capacity: number;
  version: string;
  lastHeartbeatAt: string;
  expiresAt: string;
};

export type WorkflowQueueStatusItem = {
  id: string;
  state: WorkflowQueueItemState;
  workflowRunId: string;
  workflowTemplateId: string;
  stepId: string;
  taskId?: string;
  taskRunId?: string;
  workerId?: string;
  reason?: string;
  attempt: number;
  maxAttempts?: number;
  ready: boolean;
  timestamps: {
    updatedAt: string;
    startedAt?: string;
    finishedAt?: string;
  };
};

export type WorkflowQueueStatus = {
  generatedAt: string;
  staleWorkerCutoffAt: string;
  summary: {
    pending: number;
    running: number;
    retryable: number;
    stuck: number;
    workersActive: number;
    workersExpired: number;
  };
  items: WorkflowQueueStatusItem[];
  workers: WorkflowQueueStatusWorker[];
};
