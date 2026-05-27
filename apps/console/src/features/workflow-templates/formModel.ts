import {
  buildTaskInputs,
  initialInputValues,
  normalizeInputFields,
  type TaskInputField,
  type TaskInputValues,
} from "../task-workbench";
import type { WorkflowTemplateInstantiateRequest, WorkflowTemplateSummary } from "./types";

export type WorkflowTemplateInputValidation = Record<string, string>;

export function workflowTemplateInputFields(template: WorkflowTemplateSummary | undefined): TaskInputField[] {
  return normalizeInputFields(template?.metadata.inputs);
}

export function initialWorkflowTemplateInputValues(template: WorkflowTemplateSummary | undefined): TaskInputValues {
  return initialInputValues(workflowTemplateInputFields(template));
}

export function validateWorkflowTemplateInputs(fields: TaskInputField[], values: TaskInputValues): WorkflowTemplateInputValidation {
  const validation: WorkflowTemplateInputValidation = {};
  for (const field of fields) {
    const value = values[field.key];
    if (field.required && (value === undefined || value === "")) {
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
): WorkflowTemplateInstantiateRequest {
  const inputs = buildTaskInputs(fields, values);
  return {
    version: template.version,
    pluginId: template.plugin.id,
    pluginVersion: template.plugin.version,
    ...(Object.keys(inputs).length > 0 ? { inputs } : {}),
    createdBy: "console",
  };
}
