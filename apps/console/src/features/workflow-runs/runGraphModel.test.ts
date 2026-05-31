import { describe, expect, it } from "vitest";
import {
  dependencyLabel,
  edgeSummary,
  readinessLabel,
  shouldPollWorkflowRun,
  taskRunIdFromWorkflowNodeOutput,
  workflowNodeArtifactSummary,
  workflowNodeOutputSummary,
  workflowRunStatusTone,
} from "./runGraphModel";

describe("workflow run graph model", () => {
  it("classifies run and step status tones", () => {
    expect(workflowRunStatusTone("completed")).toBe("success");
    expect(workflowRunStatusTone("failed")).toBe("danger");
    expect(workflowRunStatusTone("resumable")).toBe("warning");
    expect(workflowRunStatusTone("running")).toBe("running");
    expect(workflowRunStatusTone("pending")).toBe("neutral");
  });

  it("polls non-terminal workflow runs only", () => {
    expect(shouldPollWorkflowRun("pending")).toBe(true);
    expect(shouldPollWorkflowRun("running")).toBe(true);
    expect(shouldPollWorkflowRun("resumable")).toBe(true);
    expect(shouldPollWorkflowRun("completed")).toBe(false);
    expect(shouldPollWorkflowRun("failed")).toBe(false);
  });

  it("summarizes dependency and readiness metadata for inspection", () => {
    expect(dependencyLabel({ dependencies: ["build", "test"] })).toBe("build, test");
    expect(dependencyLabel({ dependencies: [] })).toBe("none");
    expect(
      readinessLabel({
        ready: false,
        blockingStepIds: ["build"],
        readiness: { totalDependencies: 2, readyDependencies: 1, blocked: true },
      }),
    ).toBe("blocked by build");
    expect(edgeSummary([{ from: "build", to: "test" }])).toBe("build -> test");
  });

  it("extracts linked task run ids from workflow step output", () => {
    expect(taskRunIdFromWorkflowNodeOutput({ taskRunId: "run-task-1" })).toBe("run-task-1");
    expect(taskRunIdFromWorkflowNodeOutput({ taskRunId: "" })).toBeUndefined();
    expect(taskRunIdFromWorkflowNodeOutput("not output")).toBeUndefined();
  });

  it("summarizes linked task run evidence and dependency-only output", () => {
    expect(
      workflowNodeOutputSummary({
        output: { taskRunId: "run-task-1" },
        taskRunEvidence: {
          id: "run-task-1",
          status: "completed",
          outputSummary: "Task completed with evidence.",
          artifactCount: 2,
          artifacts: [],
        },
      }),
    ).toBe("Task completed with evidence.");
    expect(workflowNodeOutputSummary({ output: { taskRunId: "run-task-1" } })).toBe(
      "This workflow step produced a linked task run. Open the task evidence to inspect output and artifacts.",
    );
    expect(workflowNodeOutputSummary({ output: undefined })).toBe("No workflow step output was recorded yet.");
    expect(workflowNodeArtifactSummary({})).toBe("No artifacts recorded");
    expect(
      workflowNodeArtifactSummary({
        taskRunEvidence: {
          id: "run-task-1",
          status: "completed",
          artifactCount: 2,
          artifacts: [],
        },
      }),
    ).toBe("2 artifacts recorded");
  });
});
