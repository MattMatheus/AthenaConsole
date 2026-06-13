export type WorkflowQueueItemState = "pending" | "running" | "retryable" | "stuck";

export interface WorkflowQueueStatusQuery {
  at?: string;
  staleAfterMs?: number;
  limit?: number;
}

export interface WorkflowQueueStatusWorker {
  workerId: string;
  status: "active" | "expired";
  activeRunId?: string;
  activeSessionId?: string;
  capacity: number;
  version: string;
  lastHeartbeatAt: string;
  expiresAt: string;
}

export interface WorkflowQueueStatusItem {
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
}

export interface WorkflowQueueStatusResult {
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
}
