import { describe, expect, it } from "vitest";
import type { AgentCatalogAgentSummary } from "../agent-catalog";
import {
  buildCreateTaskRequest,
  filterCompatibleAgents,
  hasValidationErrors,
  initialInputValues,
  normalizeInputFields,
  validateTaskForm,
} from "./formModel";

describe("task workbench form model", () => {
  it("normalizes manifest inputs in UI order with defaults", () => {
    const fields = normalizeInputFields({
      taskBrief: {
        type: "markdown",
        required: true,
        label: "Task Brief",
        ui: { order: 1 },
      },
      repositoryPath: {
        type: "file",
        required: true,
        default: "/workspace",
        description: "Repo checkout path.",
        ui: { order: 0 },
      },
      dryRun: {
        type: "boolean",
        default: true,
        ui: { order: 2 },
      },
    });

    expect(fields.map((field) => field.key)).toEqual(["repositoryPath", "taskBrief", "dryRun"]);
    expect(initialInputValues(fields)).toEqual({
      repositoryPath: "/workspace",
      taskBrief: "",
      dryRun: true,
    });
    expect(fields[0]).toMatchObject({
      key: "repositoryPath",
      type: "repo",
      repoContext: true,
      description: "Repo checkout path.",
    });
  });

  it("filters assignable agents by availability and selected capabilities", () => {
    const agents = [
      agent("software.fix", true, ["code.modify", "tests.run"]),
      agent("software.plan", true, ["task.plan"]),
      agent("software.offline", false, ["code.modify"]),
    ];

    expect(filterCompatibleAgents(agents, ["code.modify"]).map((item) => item.id)).toEqual(["software.fix"]);
    expect(filterCompatibleAgents(agents, []).map((item) => item.id)).toEqual(["software.fix", "software.plan"]);
  });

  it("validates ready tasks and required manifest inputs", () => {
    const inputFields = normalizeInputFields({
      taskBrief: {
        type: "markdown",
        required: true,
      },
    });
    const validation = validateTaskForm({
      title: "",
      description: "",
      status: "ready",
      capabilityRequirements: [],
      inputFields,
      inputValues: {},
    });

    expect(hasValidationErrors(validation)).toBe(true);
    expect(validation.title).toBe("Title is required.");
    expect(validation.assignedAgent).toBe("Ready tasks require an assigned agent.");
    expect(validation.inputs.taskBrief).toBe("Task Brief is required.");
  });

  it("treats connected repo context as satisfying repo inputs", () => {
    const inputFields = normalizeInputFields({
      repo: {
        type: "object",
        required: true,
      },
      objective: {
        type: "string",
        required: true,
      },
    });

    const validation = validateTaskForm({
      title: "Summarize",
      description: "",
      status: "draft",
      capabilityRequirements: [],
      inputFields,
      inputValues: {
        objective: "Summarize the repo",
      },
      repoContextAvailable: true,
    });

    expect(validation.inputs).toEqual({});
  });

  it("supports enum inputs and raw JSON fallback", () => {
    const inputFields = normalizeInputFields({
      mode: {
        type: "enum",
        enum: ["fast", "careful"],
        required: true,
      },
      advanced: {
        type: "object",
      },
    });

    expect(inputFields.map((field) => [field.key, field.type, field.enumValues])).toEqual([
      ["advanced", "json", []],
      ["mode", "enum", ["fast", "careful"]],
    ]);
    expect(validateTaskForm({
      title: "Plan",
      description: "",
      status: "draft",
      capabilityRequirements: [],
      inputFields,
      inputValues: { mode: "other" },
    }).inputs.mode).toBe("Mode must be one of the available options.");
    expect(buildCreateTaskRequest({
      title: "Plan",
      description: "",
      status: "draft",
      capabilityRequirements: [],
      inputFields,
      inputValues: {},
      useRawInputs: true,
      rawInputJson: "{\"mode\":\"careful\",\"advanced\":{\"depth\":2}}",
    }).inputs).toEqual({
      mode: "careful",
      advanced: { depth: 2 },
    });
  });

  it("builds task create payloads with parsed manifest inputs and assignment metadata", () => {
    const selectedAgent = agent("software.fix", true, ["code.modify", "tests.run"]);
    const inputFields = normalizeInputFields({
      taskBrief: { type: "markdown", required: true },
      retryCount: { type: "integer" },
      dryRun: { type: "boolean" },
      config: { type: "json" },
    });

    expect(
      buildCreateTaskRequest({
        title: "  Patch CLI  ",
        description: "  Fix schedule transport  ",
        status: "ready",
        selectedAgent,
        capabilityRequirements: ["code.modify"],
        inputFields,
        inputValues: {
          taskBrief: "Make the test deterministic",
          retryCount: "2",
          dryRun: true,
          config: "{\"scope\":\"unit\"}",
        },
      }),
    ).toEqual({
      title: "Patch CLI",
      description: "Fix schedule transport",
      status: "ready",
      capabilityRequirements: ["code.modify"],
      assignedAgentId: "software.fix",
      assignedAgentVersion: "1.0.0",
      inputs: {
        taskBrief: "Make the test deterministic",
        retryCount: 2,
        dryRun: true,
        config: { scope: "unit" },
      },
    });
  });
});

function agent(id: string, available: boolean, capabilities: string[]): AgentCatalogAgentSummary {
  return {
    id,
    version: "1.0.0",
    name: id,
    plugin: {
      id: "test.plugin",
      version: "0.1.0",
      name: "Test Plugin",
      sourceType: "local",
      sourceScope: "workspace",
      enabled: true,
      status: "loaded",
    },
    capabilities,
    status: "loaded",
    available,
    providerReadiness: {
      status: "untested",
      required: false,
      requirements: [],
      message: "No model provider requirement declared.",
    },
    metadata: {},
    validationErrors: [],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}
