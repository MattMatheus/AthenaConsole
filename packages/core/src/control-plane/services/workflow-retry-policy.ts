import type { TaskRecord } from "../app-state/index.js";

const DEFAULT_RETRY_BASE_DELAY_MS = 1000;
const MAX_RETRY_DELAY_MS = 60_000;

export type RetryFailurePhase =
  | "runtime-start"
  | "execution"
  | "provider"
  | "verification"
  | "artifact-export"
  | "connector-rate-limit";

export interface WorkflowTaskRetryPolicy {
  maxAttempts: number;
  backoff: "none" | "fixed" | "linear" | "exponential";
  retryableFailurePhases: RetryFailurePhase[];
  idempotency: "read-only" | "idempotent" | "non-idempotent";
  externalWriteRetry: "forbid" | "require-approval" | "allow";
}

export function parseWorkflowTaskRetryPolicy(task: TaskRecord): WorkflowTaskRetryPolicy | undefined {
  if (!isRecord(task.provenance) || !isRecord(task.provenance.retryPolicy)) {
    return undefined;
  }
  const policy = task.provenance.retryPolicy;
  if (
    typeof policy.maxAttempts !== "number" ||
    !Number.isInteger(policy.maxAttempts) ||
    !isRetryBackoff(policy.backoff) ||
    !Array.isArray(policy.retryableFailurePhases) ||
    !isRetryIdempotency(policy.idempotency) ||
    !isExternalWriteRetry(policy.externalWriteRetry)
  ) {
    return undefined;
  }
  const retryableFailurePhases = policy.retryableFailurePhases.filter(isRetryFailurePhase);
  if (retryableFailurePhases.length === 0) {
    return undefined;
  }
  return {
    maxAttempts: policy.maxAttempts,
    backoff: policy.backoff,
    retryableFailurePhases,
    idempotency: policy.idempotency,
    externalWriteRetry: policy.externalWriteRetry
  };
}

export function computeRetryBackoffMs(
  backoff: WorkflowTaskRetryPolicy["backoff"],
  attempt: number,
  baseMs: number = DEFAULT_RETRY_BASE_DELAY_MS
): number {
  const n = Math.max(1, Math.trunc(attempt));
  let ms: number;
  switch (backoff) {
    case "none":
      ms = 0;
      break;
    case "fixed":
      ms = baseMs;
      break;
    case "linear":
      ms = baseMs * n;
      break;
    case "exponential":
      ms = baseMs * 2 ** (n - 1);
      break;
    default:
      ms = 0;
      break;
  }
  return Math.min(ms, MAX_RETRY_DELAY_MS);
}

export function isRetryBackoff(value: unknown): value is WorkflowTaskRetryPolicy["backoff"] {
  return value === "none" || value === "fixed" || value === "linear" || value === "exponential";
}

export function isRetryFailurePhase(value: unknown): value is RetryFailurePhase {
  return (
    value === "runtime-start" ||
    value === "execution" ||
    value === "provider" ||
    value === "verification" ||
    value === "artifact-export" ||
    value === "connector-rate-limit"
  );
}

export function isRetryIdempotency(value: unknown): value is WorkflowTaskRetryPolicy["idempotency"] {
  return value === "read-only" || value === "idempotent" || value === "non-idempotent";
}

export function isExternalWriteRetry(value: unknown): value is WorkflowTaskRetryPolicy["externalWriteRetry"] {
  return value === "forbid" || value === "require-approval" || value === "allow";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
