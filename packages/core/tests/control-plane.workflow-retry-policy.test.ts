import { describe, expect, it } from "vitest";
import type { TaskRecord } from "../src/control-plane/app-state/index.js";
import { computeRetryBackoffMs, parseWorkflowTaskRetryPolicy } from "../src/control-plane/services/workflow-retry-policy.js";

describe("workflow retry policy parser", () => {
  it("parses a valid full retry policy", () => {
    expect(parseWorkflowTaskRetryPolicy(taskWithRetryPolicy(validRetryPolicy()))).toEqual({
      maxAttempts: 3,
      backoff: "exponential",
      retryableFailurePhases: ["provider", "connector-rate-limit"],
      idempotency: "idempotent",
      externalWriteRetry: "require-approval"
    });
  });

  it("rejects non-integer maxAttempts", () => {
    expect(parseWorkflowTaskRetryPolicy(taskWithRetryPolicy({ ...validRetryPolicy(), maxAttempts: 2.5 }))).toBeUndefined();
  });

  it("rejects empty or all-invalid retryable phases", () => {
    expect(parseWorkflowTaskRetryPolicy(taskWithRetryPolicy({ ...validRetryPolicy(), retryableFailurePhases: [] }))).toBeUndefined();
    expect(parseWorkflowTaskRetryPolicy(taskWithRetryPolicy({ ...validRetryPolicy(), retryableFailurePhases: ["network"] }))).toBeUndefined();
  });

  it("rejects missing or invalid backoff", () => {
    expect(parseWorkflowTaskRetryPolicy(taskWithRetryPolicy({ ...validRetryPolicy(), backoff: undefined }))).toBeUndefined();
    expect(parseWorkflowTaskRetryPolicy(taskWithRetryPolicy({ ...validRetryPolicy(), backoff: "jitter" }))).toBeUndefined();
  });

  it("returns undefined when provenance.retryPolicy is missing", () => {
    expect(parseWorkflowTaskRetryPolicy({ provenance: {} } as TaskRecord)).toBeUndefined();
  });

  it("computes retry backoff delays for all modes", () => {
    expect(computeRetryBackoffMs("none", 3, 250)).toBe(0);
    expect(computeRetryBackoffMs("fixed", 3, 250)).toBe(250);
    expect(computeRetryBackoffMs("linear", 3, 250)).toBe(750);
    expect(computeRetryBackoffMs("exponential", 3, 250)).toBe(1000);
    expect(computeRetryBackoffMs("exponential", 10, 1000)).toBe(60_000);
    expect(computeRetryBackoffMs("linear", 0, 250)).toBe(250);
  });
});

function validRetryPolicy(): Record<string, unknown> {
  return {
    maxAttempts: 3,
    backoff: "exponential",
    retryableFailurePhases: ["provider", "connector-rate-limit"],
    idempotency: "idempotent",
    externalWriteRetry: "require-approval"
  };
}

function taskWithRetryPolicy(retryPolicy: unknown): TaskRecord {
  return {
    provenance: {
      retryPolicy
    }
  } as TaskRecord;
}
