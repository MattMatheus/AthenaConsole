import { describe, expect, it } from "vitest";
import { formatHeartbeatAge, workflowQueueTone, workflowQueueViewState } from "./workflowQueueModel";
import type { WorkflowQueueStatus } from "./types";

describe("workflow queue model", () => {
  it("classifies empty, error, and stuck view states", () => {
    expect(workflowQueueViewState({ isLoading: true, isError: false })).toBe("loading");
    expect(workflowQueueViewState({ isLoading: false, isError: true })).toBe("error");
    expect(workflowQueueViewState({ isLoading: false, isError: false, data: queueStatus([]) })).toBe("empty");
    expect(
      workflowQueueViewState({
        isLoading: false,
        isError: false,
        data: queueStatus([{ id: "item-1", state: "stuck", workflowRunId: "run-1", workflowTemplateId: "workflow", stepId: "plan", attempt: 1, ready: false, timestamps: { updatedAt: "2026-06-13T01:00:00.000Z" } }]),
      }),
    ).toBe("stuck");
  });

  it("formats heartbeat age and queue state tones", () => {
    expect(
      formatHeartbeatAge(
        {
          workerId: "worker-1",
          status: "active",
          capacity: 1,
          version: "0.1.0",
          lastHeartbeatAt: "2026-06-13T01:00:00.000Z",
          expiresAt: "2026-06-13T01:01:00.000Z",
        },
        new Date("2026-06-13T01:01:05.000Z"),
      ),
    ).toBe("1m 5s");
    expect(workflowQueueTone("pending")).toBe("neutral");
    expect(workflowQueueTone("running")).toBe("running");
    expect(workflowQueueTone("retryable")).toBe("warning");
    expect(workflowQueueTone("stuck")).toBe("danger");
  });
});

function queueStatus(items: WorkflowQueueStatus["items"]): WorkflowQueueStatus {
  return {
    generatedAt: "2026-06-13T01:00:00.000Z",
    staleWorkerCutoffAt: "2026-06-13T00:59:00.000Z",
    summary: {
      pending: 0,
      running: 0,
      retryable: 0,
      stuck: items.filter((item) => item.state === "stuck").length,
      workersActive: 0,
      workersExpired: 0,
    },
    items,
    workers: [],
  };
}
