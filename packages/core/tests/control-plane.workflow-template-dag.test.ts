import { describe, expect, it } from "vitest";
import {
  parseWorkflowTemplateDag,
  validateWorkflowTemplateDag
} from "../src/control-plane/workflow-template-dag.js";

describe("workflow template DAG parser", () => {
  it("produces deterministic topological order and dependency maps", () => {
    const dag = parseWorkflowTemplateDag([
      { id: "deploy", dependsOn: ["build"] },
      { id: "plan" },
      { id: "test", dependsOn: ["plan"] },
      { id: "build", dependsOn: ["plan", "test"] }
    ]);

    expect(dag).toEqual({
      taskOrder: ["plan", "test", "build", "deploy"],
      dependenciesByTaskId: {
        deploy: ["build"],
        plan: [],
        test: ["plan"],
        build: ["plan", "test"]
      }
    });
  });

  it("preserves legacy sequential templates without explicit dependencies", () => {
    const dag = parseWorkflowTemplateDag([{ id: "plan" }, { id: "review" }, { id: "publish" }]);

    expect(dag).toEqual({
      taskOrder: ["plan", "review", "publish"],
      dependenciesByTaskId: {
        plan: [],
        review: [],
        publish: []
      }
    });
  });

  it("validates duplicate ids, missing references, self-dependencies, and cycles", () => {
    expect(validateWorkflowTemplateDag([{ id: "plan" }, { id: "plan" }])).toEqual([
      expect.objectContaining({
        path: "$.workflow.tasks",
        message: "Workflow task ids must be unique: plan"
      })
    ]);

    expect(validateWorkflowTemplateDag([{ id: "review", dependsOn: ["plan"] }])).toEqual([
      expect.objectContaining({
        message: "Workflow task 'review' depends on missing task 'plan'."
      })
    ]);

    expect(validateWorkflowTemplateDag([{ id: "plan", dependsOn: ["plan"] }])).toEqual([
      expect.objectContaining({
        message: "Workflow task 'plan' cannot depend on itself."
      })
    ]);

    expect(validateWorkflowTemplateDag([{ id: "plan", dependsOn: ["review"] }, { id: "review", dependsOn: ["plan"] }])).toEqual([
      expect.objectContaining({
        keyword: "cycle",
        message: "Workflow task dependencies must not contain cycles: plan -> review -> plan."
      })
    ]);
  });
});
