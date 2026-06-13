export type WorkflowRunGraphRunStatus = "pending" | "running" | "completed" | "failed" | "resumable" | "cancelled";
export type WorkflowRunGraphStepStatus = "pending" | "running" | "completed" | "failed" | "skipped" | "cancelled";
export type WorkflowRunGraphEventLevel = "info" | "warning" | "error";

export interface WorkflowRunStatusSummary {
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
}

export interface WorkflowRunStatusProgress {
  totalSteps: number;
  completedSteps: number;
  runningSteps: number;
  failedSteps: number;
  pendingSteps: number;
  readySteps: number;
  blockedSteps: number;
  percentComplete: number;
}

export interface WorkflowRunStatusTaskArtifactSummary {
  id: string;
  label: string;
  kind: string;
  format: string;
}

export interface WorkflowRunStatusTaskRunEvidence {
  id: string;
  status: string;
  outputSummary?: string;
  artifactCount: number;
  artifacts: WorkflowRunStatusTaskArtifactSummary[];
}

export interface WorkflowRunStatusStepAttempt {
  attempt: number;
  status: "running" | "completed" | "failed" | "cancelled";
  startedAt: string;
  finishedAt?: string;
  failure?: unknown;
  output?: unknown;
}

export interface WorkflowRunStatusNode {
  id: string;
  status: WorkflowRunGraphStepStatus;
  ready: boolean;
  attempt: number;
  attemptHistory: WorkflowRunStatusStepAttempt[];
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
}

export interface WorkflowRunStatusEdge {
  from: string;
  to: string;
}

export interface WorkflowRunStatusEvent {
  id: string;
  stepId?: string;
  type: string;
  level: WorkflowRunGraphEventLevel;
  message: string;
  timestamp: string;
  payload?: unknown;
}

export interface WorkflowRunGraphStatus {
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
}
