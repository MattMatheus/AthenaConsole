import {
  buildTaskInputs,
  initialInputValues,
  normalizeInputFields,
  parseRawInputJson,
  validateRawInputJson,
  type TaskInputField,
  type TaskInputValues,
  type TaskWorkbenchRunMode,
} from "../task-workbench";
import type { WorkflowTemplateInstantiateRequest, WorkflowTemplateSummary } from "./types";

export type WorkflowTemplateInputValidation = Record<string, string>;

export type WorkflowTemplateInputOptions = {
  useRawInputs?: boolean;
  rawInputJson?: string;
  repoContextAvailable?: boolean;
  runMode?: TaskWorkbenchRunMode;
};

export function workflowTemplateInputFields(template: WorkflowTemplateSummary | undefined): TaskInputField[] {
  return normalizeInputFields(template?.metadata.inputs);
}

export function initialWorkflowTemplateInputValues(template: WorkflowTemplateSummary | undefined): TaskInputValues {
  return initialInputValues(workflowTemplateInputFields(template));
}

export function validateWorkflowTemplateInputs(
  fields: TaskInputField[],
  values: TaskInputValues,
  options: WorkflowTemplateInputOptions = {},
): WorkflowTemplateInputValidation {
  const validation: WorkflowTemplateInputValidation = {};
  if (options.useRawInputs) {
    const rawValidation = validateRawInputJson(options.rawInputJson ?? "");
    if (rawValidation) {
      validation.__raw = rawValidation;
    }
    return validation;
  }
  for (const field of fields) {
    const value = values[field.key];
    const missing = value === undefined || value === "";
    if (field.repoContext && options.repoContextAvailable && missing) {
      continue;
    }
    if (field.required && missing) {
      validation[field.key] = `${field.label} is required.`;
    }
    if ((field.type === "integer" || field.type === "number") && value !== undefined && value !== "") {
      const parsed = Number(value);
      if (!Number.isFinite(parsed) || (field.type === "integer" && !Number.isInteger(parsed))) {
        validation[field.key] = `${field.label} must be a valid ${field.type}.`;
      }
    }
    if (field.type === "json" && typeof value === "string" && value.trim().length > 0) {
      try {
        JSON.parse(value);
      } catch {
        validation[field.key] = `${field.label} must be valid JSON.`;
      }
    }
    if (field.type === "enum" && typeof value === "string" && value.trim().length > 0 && !field.enumValues.includes(value)) {
      validation[field.key] = `${field.label} must be one of the available options.`;
    }
  }
  return validation;
}

export function hasWorkflowTemplateInputErrors(validation: WorkflowTemplateInputValidation): boolean {
  return Object.keys(validation).length > 0;
}

export function buildWorkflowTemplateInstantiateRequest(
  template: WorkflowTemplateSummary,
  fields: TaskInputField[],
  values: TaskInputValues,
  options: WorkflowTemplateInputOptions = {},
): WorkflowTemplateInstantiateRequest {
  const inputs = options.useRawInputs ? parseRawInputJson(options.rawInputJson) : buildTaskInputs(fields, values);
  inputs.runMode = options.runMode ?? "read-only";
  return {
    version: template.version,
    pluginId: template.plugin.id,
    pluginVersion: template.plugin.version,
    ...(Object.keys(inputs).length > 0 ? { inputs } : {}),
    createdBy: "console",
  };
}
