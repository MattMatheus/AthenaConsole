import { describe, expect, it } from "vitest";
import {
  dependencyLabel,
  edgeSummary,
  readinessLabel,
  shouldPollWorkflowRun,
  taskRunIdFromWorkflowNodeOutput,
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
});
