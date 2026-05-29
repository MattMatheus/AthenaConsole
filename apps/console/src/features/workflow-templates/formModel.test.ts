import { describe, expect, it } from "vitest";
import {
  buildWorkflowTemplateInstantiateRequest,
  initialWorkflowTemplateInputValues,
  validateWorkflowTemplateInputs,
  workflowTemplateInputFields,
} from "./formModel";
import type { WorkflowTemplateSummary } from "./types";

describe("workflow template form model", () => {
  it("normalizes template inputs, validates required fields, and builds instantiate requests", () => {
    const template = workflowTemplate({
      releaseName: { type: "string", label: "Release Name", required: true },
      dryRun: { type: "boolean", default: true },
      metadata: { type: "object", default: { channel: "stable" } },
      count: { type: "integer" },
    });

    const fields = workflowTemplateInputFields(template);
    expect(fields.map((field) => field.key)).toEqual(["count", "dryRun", "metadata", "releaseName"]);
    expect(initialWorkflowTemplateInputValues(template)).toEqual({
      count: "",
      dryRun: true,
      metadata: "{\"channel\":\"stable\"}",
      releaseName: "",
    });

    expect(validateWorkflowTemplateInputs(fields, { dryRun: true, metadata: "{}", releaseName: "", count: "2.5" })).toEqual({
      count: "Count must be a valid integer.",
      releaseName: "Release Name is required.",
    });

    expect(
      buildWorkflowTemplateInstantiateRequest(template, fields, {
        dryRun: false,
        metadata: "{\"channel\":\"beta\"}",
        releaseName: "v1.2.0",
        count: "2",
      }),
    ).toEqual({
      version: "0.1.0",
      pluginId: "test.templates",
      pluginVersion: "0.1.0",
      inputs: {
        dryRun: false,
        metadata: { channel: "beta" },
        releaseName: "v1.2.0",
        count: 2,
      },
      createdBy: "console",
    });
  });
});

function workflowTemplate(inputs: WorkflowTemplateSummary["metadata"]["inputs"]): WorkflowTemplateSummary {
  return {
    id: "release.workflow",
    version: "0.1.0",
    name: "Release Workflow",
    description: "Prepare a release.",
    plugin: {
      id: "test.templates",
      version: "0.1.0",
      name: "Template Plugin",
      sourceType: "local",
      enabled: true,
      status: "loaded",
    },
    status: "loaded",
    available: true,
    providerReadiness: {
      status: "untested",
      required: false,
      requirements: [],
      message: "No model provider requirement declared.",
    },
    taskCount: 2,
    metadata: inputs ? { inputs } : {},
    validationErrors: [],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}
