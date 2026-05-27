import type { AgentCatalogAgentSummary } from "../agent-catalog";
import type { TaskWorkbenchTaskCreateRequest, TaskWorkbenchTaskStatus } from "./types";

export type TaskInputType = "string" | "markdown" | "integer" | "number" | "boolean" | "file" | "json";

export type TaskInputField = {
  key: string;
  label: string;
  type: TaskInputType;
  required: boolean;
  defaultValue: unknown;
  order: number;
};

export type TaskInputValues = Record<string, string | boolean>;

export type TaskFormDraft = {
  title: string;
  description: string;
  status: TaskWorkbenchTaskStatus;
  selectedAgent?: AgentCatalogAgentSummary;
  capabilityRequirements: string[];
  inputFields: TaskInputField[];
  inputValues: TaskInputValues;
};

export type TaskFormValidation = {
  title?: string;
  assignedAgent?: string;
  inputs: Record<string, string>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asType(value: unknown): TaskInputType {
  if (value === "markdown" || value === "integer" || value === "number" || value === "boolean" || value === "file") {
    return value;
  }
  if (value === "object" || value === "array" || value === "json") {
    return "json";
  }
  return "string";
}

function fieldLabel(key: string, config: Record<string, unknown>): string {
  return typeof config.label === "string" && config.label.trim().length > 0 ? config.label : titleize(key);
}

function fieldOrder(config: Record<string, unknown>): number {
  const ui = isRecord(config.ui) ? config.ui : {};
  return typeof ui.order === "number" && Number.isFinite(ui.order) ? ui.order : Number.MAX_SAFE_INTEGER;
}

function titleize(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[-_.]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function normalizeInputFields(inputs: Record<string, unknown> | undefined): TaskInputField[] {
  return Object.entries(inputs ?? {})
    .map(([key, value]) => {
      const config = isRecord(value) ? value : {};
      return {
        key,
        label: fieldLabel(key, config),
        type: asType(config.type),
        required: config.required === true,
        defaultValue: config.default,
        order: fieldOrder(config),
      };
    })
    .sort((left, right) => left.order - right.order || left.label.localeCompare(right.label));
}

export function initialInputValues(fields: TaskInputField[]): TaskInputValues {
  return Object.fromEntries(
    fields.map((field) => [
      field.key,
      field.type === "boolean" ? Boolean(field.defaultValue) : field.defaultValue === undefined ? "" : String(field.defaultValue),
    ]),
  );
}

export function filterCompatibleAgents(
  agents: AgentCatalogAgentSummary[],
  capabilityRequirements: string[],
): AgentCatalogAgentSummary[] {
  return agents.filter(
    (agent) =>
      agent.available &&
      capabilityRequirements.every((capability) => agent.capabilities.includes(capability)),
  );
}

export function validateTaskForm(draft: TaskFormDraft): TaskFormValidation {
  const validation: TaskFormValidation = { inputs: {} };
  if (draft.title.trim().length === 0) {
    validation.title = "Title is required.";
  }
  if (draft.status === "ready" && !draft.selectedAgent) {
    validation.assignedAgent = "Ready tasks require an assigned agent.";
  }
  for (const field of draft.inputFields) {
    const value = draft.inputValues[field.key];
    if (field.required && (value === undefined || value === "")) {
      validation.inputs[field.key] = `${field.label} is required.`;
    }
    if ((field.type === "integer" || field.type === "number") && value !== undefined && value !== "") {
      const parsed = Number(value);
      if (!Number.isFinite(parsed) || (field.type === "integer" && !Number.isInteger(parsed))) {
        validation.inputs[field.key] = `${field.label} must be a valid ${field.type}.`;
      }
    }
    if (field.type === "json" && typeof value === "string" && value.trim().length > 0) {
      try {
        JSON.parse(value);
      } catch {
        validation.inputs[field.key] = `${field.label} must be valid JSON.`;
      }
    }
  }
  return validation;
}

export function hasValidationErrors(validation: TaskFormValidation): boolean {
  return Boolean(validation.title || validation.assignedAgent || Object.keys(validation.inputs).length > 0);
}

export function buildTaskInputs(fields: TaskInputField[], values: TaskInputValues): Record<string, unknown> {
  const inputs: Record<string, unknown> = {};
  for (const field of fields) {
    const raw = values[field.key];
    if (raw === undefined || raw === "") {
      continue;
    }
    if (field.type === "boolean") {
      inputs[field.key] = Boolean(raw);
    } else if (field.type === "integer") {
      inputs[field.key] = Number.parseInt(String(raw), 10);
    } else if (field.type === "number") {
      inputs[field.key] = Number.parseFloat(String(raw));
    } else if (field.type === "json") {
      inputs[field.key] = JSON.parse(String(raw));
    } else {
      inputs[field.key] = String(raw);
    }
  }
  return inputs;
}

export function buildCreateTaskRequest(draft: TaskFormDraft): TaskWorkbenchTaskCreateRequest {
  const request: TaskWorkbenchTaskCreateRequest = {
    title: draft.title.trim(),
    status: draft.status,
    inputs: buildTaskInputs(draft.inputFields, draft.inputValues),
  };
  const description = draft.description.trim();
  if (description) {
    request.description = description;
  }
  if (draft.capabilityRequirements.length > 0) {
    request.capabilityRequirements = draft.capabilityRequirements;
  }
  if (draft.selectedAgent) {
    request.assignedAgentId = draft.selectedAgent.id;
    request.assignedAgentVersion = draft.selectedAgent.version;
  }
  return request;
}
