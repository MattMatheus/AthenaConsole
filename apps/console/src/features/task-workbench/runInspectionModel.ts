import type {
  TaskWorkbenchRunEvent,
  TaskWorkbenchRunStatus,
  TaskWorkbenchVerificationFailure,
  TaskWorkbenchVerificationStatus,
} from "./types";

export type RunEventKind = "log" | "artifact" | "lifecycle";
export type RunStatusTone = "neutral" | "running" | "success" | "danger" | "warning";
export type VerificationStatusTone = "neutral" | "success" | "danger";

export function classifyRunEvent(event: Pick<TaskWorkbenchRunEvent, "type">): RunEventKind {
  if (event.type === "run.log") {
    return "log";
  }
  if (event.type.startsWith("artifact.")) {
    return "artifact";
  }
  return "lifecycle";
}

export function runStatusTone(status: TaskWorkbenchRunStatus): RunStatusTone {
  if (status === "completed") {
    return "success";
  }
  if (status === "failed" || status === "cancelled" || status === "stopped-by-limit") {
    return "danger";
  }
  if (status === "waiting-for-approval") {
    return "warning";
  }
  if (status === "running" || status === "validating") {
    return "running";
  }
  return "neutral";
}

export function verificationStatusLabel(status: TaskWorkbenchVerificationStatus | undefined): string {
  if (status === "passed") {
    return "passed";
  }
  if (status === "verification-failed") {
    return "verification failed";
  }
  return "not evaluated";
}

export function verificationStatusTone(status: TaskWorkbenchVerificationStatus | undefined): VerificationStatusTone {
  if (status === "passed") {
    return "success";
  }
  if (status === "verification-failed") {
    return "danger";
  }
  return "neutral";
}

export function formatVerificationFailureDetails(failure: Pick<TaskWorkbenchVerificationFailure, "details">): string {
  if (!failure.details || Object.keys(failure.details).length === 0) {
    return "No details recorded.";
  }
  return Object.entries(failure.details)
    .map(([key, value]) => `${key}: ${value}`)
    .join("\n");
}

export function formatUnknown(value: unknown): string {
  if (value === undefined) {
    return "";
  }
  if (value === null) {
    return "null";
  }
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return JSON.stringify(value, null, 2);
}

export function formatBytes(value: number | undefined): string {
  if (value === undefined) {
    return "not recorded";
  }
  if (value < 1024) {
    return `${value} B`;
  }
  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1)} KB`;
  }
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}
