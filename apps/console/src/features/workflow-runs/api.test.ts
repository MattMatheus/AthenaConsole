import { describe, expect, it } from "vitest";
import { parseWorkflowRunExecuteResult, parseWorkflowRunStatus } from "./api";

describe("workflow run status api parser", () => {
  it("parses graph-friendly workflow-template DAG run responses", () => {
    const status = parseWorkflowRunStatus({
      run: {
        id: "workflow-dag-run-1",
        status: "running",
        failure: null,
        workflowTemplate: {
          id: "release.workflow",
          version: "1.0.0",
          pluginId: "release.plugin",
          pluginVersion: "1.0.0",
        },
        createdAt: "2026-05-28T12:00:00.000Z",
        updatedAt: "2026-05-28T12:00:10.000Z",
        startedAt: "2026-05-28T12:00:01.000Z",
      },
      progress: {
        totalSteps: 3,
        completedSteps: 1,
        runningSteps: 1,
        failedSteps: 0,
        pendingSteps: 1,
        readySteps: 1,
        blockedSteps: 1,
        percentComplete: 33,
      },
      nodes: [
        {
          id: "build",
          status: "completed",
          ready: true,
          attempt: 1,
          dependencies: [],
          dependents: ["verify"],
          blockingStepIds: [],
          readiness: { totalDependencies: 0, readyDependencies: 0, blocked: false },
          timestamps: {
            updatedAt: "2026-05-28T12:00:05.000Z",
            startedAt: "2026-05-28T12:00:01.000Z",
            finishedAt: "2026-05-28T12:00:05.000Z",
          },
          failure: null,
          output: { taskRunId: "run-build" },
          taskRunEvidence: {
            id: "run-build",
            status: "completed",
            outputSummary: "Build completed.",
            artifactCount: 1,
            artifacts: [
              {
                id: "artifact-build-log",
                label: "Build log",
                kind: "log",
                format: "text",
              },
            ],
          },
        },
        {
          id: "verify",
          status: "running",
          ready: true,
          attempt: 1,
          dependencies: ["build"],
          dependents: ["publish"],
          blockingStepIds: [],
          readiness: { totalDependencies: 1, readyDependencies: 1, blocked: false },
          timestamps: {
            updatedAt: "2026-05-28T12:00:10.000Z",
            startedAt: "2026-05-28T12:00:06.000Z",
          },
        },
      ],
      edges: [{ from: "build", to: "verify" }],
      events: [
        {
          id: "event-1",
          stepId: "verify",
          type: "workflow.step.started",
          level: "info",
          message: "Step started.",
          timestamp: "2026-05-28T12:00:06.000Z",
        },
      ],
      recovery: {
        resumable: false,
        failedStepIds: [],
        staleRecoveredStepIds: [],
      },
      polling: {
        recommendedIntervalMs: 2500,
        etag: "etag-1",
      },
    });

    expect(status.run.id).toBe("workflow-dag-run-1");
    expect(status.run.failure).toBeUndefined();
    expect(status.run.workflowTemplate.pluginId).toBe("release.plugin");
    expect(status.progress.percentComplete).toBe(33);
    expect(status.nodes[1]?.dependencies).toEqual(["build"]);
    expect(status.nodes[0]?.taskRunEvidence).toMatchObject({
      id: "run-build",
      status: "completed",
      outputSummary: "Build completed.",
      artifactCount: 1,
      artifacts: [{ id: "artifact-build-log", label: "Build log", kind: "log", format: "text" }],
    });
    expect(status.nodes[0]?.failure).toBeUndefined();
    expect(status.edges).toEqual([{ from: "build", to: "verify" }]);
    expect(status.polling.recommendedIntervalMs).toBe(2500);
  });

  it("parses workflow run execution results", () => {
    const result = parseWorkflowRunExecuteResult({
      runId: "workflow-run-demo",
      status: "completed",
      executedStepIds: ["prepare", "verify"],
      snapshot: { status: "completed" },
    });

    expect(result).toEqual({
      runId: "workflow-run-demo",
      status: "completed",
      executedStepIds: ["prepare", "verify"],
      snapshot: { status: "completed" },
    });
  });
});
