import type { WorkflowQueueStatus, WorkflowQueueStatusItem, WorkflowQueueStatusWorker } from "./types";

export type WorkflowQueueViewState = "loading" | "error" | "empty" | "stuck" | "active";
export type WorkflowQueueTone = "neutral" | "running" | "warning" | "danger" | "success";

export function workflowQueueViewState(input: {
  isLoading: boolean;
  isError: boolean;
  data?: WorkflowQueueStatus;
}): WorkflowQueueViewState {
  if (input.isLoading) {
    return "loading";
  }
  if (input.isError) {
    return "error";
  }
  const items = input.data?.items ?? [];
  if (items.length === 0) {
    return "empty";
  }
  return items.some((item) => item.state === "stuck") ? "stuck" : "active";
}

export function workflowQueueTone(state: WorkflowQueueStatusItem["state"]): WorkflowQueueTone {
  if (state === "running") {
    return "running";
  }
  if (state === "retryable") {
    return "warning";
  }
  if (state === "stuck") {
    return "danger";
  }
  return "neutral";
}

export function workerTone(worker: WorkflowQueueStatusWorker): WorkflowQueueTone {
  return worker.status === "active" ? "success" : "danger";
}

export function formatHeartbeatAge(worker: WorkflowQueueStatusWorker, now = new Date()): string {
  const heartbeatMs = Date.parse(worker.lastHeartbeatAt);
  if (!Number.isFinite(heartbeatMs)) {
    return "unknown";
  }
  const seconds = Math.max(0, Math.round((now.getTime() - heartbeatMs) / 1000));
  if (seconds < 60) {
    return `${seconds}s`;
  }
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return remainder === 0 ? `${minutes}m` : `${minutes}m ${remainder}s`;
}

export function queueItemLabel(item: WorkflowQueueStatusItem): string {
  return `${item.workflowTemplateId} / ${item.stepId}`;
}
