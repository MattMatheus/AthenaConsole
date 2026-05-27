import { AthenaError } from "../../runtime/errors.js";
import type { WorkflowTemplateInstantiateRequest } from "../../shared/contracts.js";
import { optionalString } from "../validation.js";

export function parseWorkflowTemplateInstantiateRequest(body: Record<string, unknown>): WorkflowTemplateInstantiateRequest {
  const inputs = body.inputs;
  if (inputs !== undefined && (!inputs || typeof inputs !== "object" || Array.isArray(inputs))) {
    throw new AthenaError("CONFIG_ERROR", "workflowTemplates.instantiate.inputs must be an object when provided.");
  }
  const context = "workflowTemplates.instantiate";
  const version = optionalString(body, "version", context);
  const pluginId = optionalString(body, "pluginId", context);
  const pluginVersion = optionalString(body, "pluginVersion", context);
  const missionId = optionalString(body, "missionId", context);
  const taskIdPrefix = optionalString(body, "taskIdPrefix", context);
  const createdBy = optionalString(body, "createdBy", context);

  return {
    ...(version ? { version } : {}),
    ...(pluginId ? { pluginId } : {}),
    ...(pluginVersion ? { pluginVersion } : {}),
    ...(missionId ? { missionId } : {}),
    ...(taskIdPrefix ? { taskIdPrefix } : {}),
    ...(inputs !== undefined ? { inputs: inputs as Record<string, unknown> } : {}),
    ...(createdBy ? { createdBy } : {})
  };
}
