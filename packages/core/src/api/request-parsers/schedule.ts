import { AthenaError } from "../../runtime/errors.js";
import type { ScheduleStatus, ScheduleTargetType, UpsertScheduleRequest } from "../../shared/contracts.js";
import { optionalBoolean, optionalString, requireString } from "../validation.js";

export function parseScheduleUpsertRequest(
  body: Record<string, unknown>,
  context: "schedules.create" | "schedules.update"
): Omit<UpsertScheduleRequest, "id"> & { id?: string } {
  const enabled = optionalBoolean(body, "enabled", context);
  const targetType = parseOptionalTargetType(body.targetType, `${context}.targetType`);
  if (!targetType) {
    throw new AthenaError(
      "CONFIG_ERROR",
      `${context}.targetType is required; schedules must target task, mission, or workflow-template.`
    );
  }
  const runAt = optionalString(body, "runAt", context);
  const rrule = optionalString(body, "rrule", context);
  if (!runAt && !rrule) {
    throw new AthenaError("CONFIG_ERROR", `${context} requires runAt or rrule for target schedules.`);
  }
  if (runAt && Number.isNaN(new Date(runAt).getTime())) {
    throw new AthenaError("CONFIG_ERROR", `${context}.runAt must be a valid ISO datetime.`);
  }
  if (targetType === "workflow-template") {
    validateWorkflowTemplateScheduleBindings(body.inputBindings, `${context}.inputBindings`);
  }
  const timezone = optionalString(body, "timezone", context);
  const status = parseOptionalStatus(body.status, `${context}.status`);
  return {
    ...(body.id !== undefined ? { id: requireString(body, "id", context) } : {}),
    name: optionalString(body, "name", context),
    targetType,
    targetId: requireString(body, "targetId", context),
    ...(body.inputBindings !== undefined ? { inputBindings: body.inputBindings } : {}),
    ...(runAt ? { runAt } : {}),
    ...(rrule ? { rrule } : {}),
    ...(timezone ? { timezone } : {}),
    ...(status ? { status } : {}),
    ...(body.failurePolicy !== undefined ? { failurePolicy: body.failurePolicy } : {}),
    ...(enabled !== undefined ? { enabled } : {})
  };
}

function validateWorkflowTemplateScheduleBindings(value: unknown, context: string): void {
  if (value === undefined || value === null) {
    return;
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new AthenaError("CONFIG_ERROR", `${context} must be an object for workflow-template schedules.`);
  }
  const bindings = value as Record<string, unknown>;
  for (const field of ["version", "pluginId", "pluginVersion"]) {
    const raw = bindings[field];
    if (raw !== undefined && typeof raw !== "string") {
      throw new AthenaError("CONFIG_ERROR", `${context}.${field} must be a string when provided.`);
    }
  }
  const inputs = bindings.inputs;
  if (inputs !== undefined && (!inputs || typeof inputs !== "object" || Array.isArray(inputs))) {
    throw new AthenaError("CONFIG_ERROR", `${context}.inputs must be an object when provided.`);
  }
}

function parseOptionalTargetType(value: unknown, context: string): ScheduleTargetType | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (value !== "task" && value !== "mission" && value !== "workflow-template") {
    throw new AthenaError("CONFIG_ERROR", `${context} must be task, mission, or workflow-template.`);
  }
  return value;
}

function parseOptionalStatus(value: unknown, context: string): ScheduleStatus | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (value !== "active" && value !== "paused" && value !== "disabled" && value !== "error") {
    throw new AthenaError("CONFIG_ERROR", `${context} must be active, paused, disabled, or error.`);
  }
  return value;
}

export function parseScheduleRunRequest(body: Record<string, unknown>): {
  provider?: string;
  model?: string;
} {
  const provider = optionalString(body, "provider", "schedules.run");
  const model = optionalString(body, "model", "schedules.run");
  return {
    ...(provider ? { provider } : {}),
    ...(model ? { model } : {})
  };
}

export function parseScheduleTickRequest(body: Record<string, unknown>): {
  at: Date;
  provider?: string;
  model?: string;
} {
  const atRaw = optionalString(body, "at", "schedules.tick");
  const provider = optionalString(body, "provider", "schedules.tick");
  const model = optionalString(body, "model", "schedules.tick");
  const at = atRaw ? new Date(atRaw) : new Date();
  if (Number.isNaN(at.getTime())) {
    throw new AthenaError("CONFIG_ERROR", `schedules.tick.at must be valid ISO datetime: '${atRaw}'.`);
  }
  return {
    at,
    ...(provider ? { provider } : {}),
    ...(model ? { model } : {})
  };
}
