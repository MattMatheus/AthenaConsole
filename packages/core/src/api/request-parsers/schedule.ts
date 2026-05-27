import { AthenaError } from "../../runtime/errors.js";
import type { ScheduleStatus, ScheduleTargetType } from "../../shared/contracts.js";
import { optionalBoolean, optionalString, requirePositiveInt, requireString } from "../validation.js";

export function parseScheduleUpsertRequest(
  body: Record<string, unknown>,
  context: "schedules.create" | "schedules.update"
): {
  sessionId?: string;
  input?: string;
  everyMinutes?: number;
  enabled?: boolean;
  startNow?: boolean;
  name?: string;
  targetType?: ScheduleTargetType;
  targetId?: string;
  inputBindings?: unknown;
  runAt?: string;
  rrule?: string;
  timezone?: string;
  status?: ScheduleStatus;
  failurePolicy?: unknown;
} {
  const enabled = optionalBoolean(body, "enabled", context);
  const startNow = optionalBoolean(body, "startNow", context);
  const targetType = parseOptionalTargetType(body.targetType, `${context}.targetType`);
  if (targetType) {
    const runAt = optionalString(body, "runAt", context);
    const rrule = optionalString(body, "rrule", context);
    if (!runAt && !rrule) {
      throw new AthenaError("CONFIG_ERROR", `${context} requires runAt or rrule for target schedules.`);
    }
    if (runAt && Number.isNaN(new Date(runAt).getTime())) {
      throw new AthenaError("CONFIG_ERROR", `${context}.runAt must be a valid ISO datetime.`);
    }
    return {
      name: optionalString(body, "name", context),
      targetType,
      targetId: requireString(body, "targetId", context),
      ...(body.inputBindings !== undefined ? { inputBindings: body.inputBindings } : {}),
      ...(runAt ? { runAt } : {}),
      ...(rrule ? { rrule } : {}),
      ...(optionalString(body, "timezone", context) ? { timezone: optionalString(body, "timezone", context) } : {}),
      ...(parseOptionalStatus(body.status, `${context}.status`) ? { status: parseOptionalStatus(body.status, `${context}.status`) } : {}),
      ...(body.failurePolicy !== undefined ? { failurePolicy: body.failurePolicy } : {}),
      ...(enabled !== undefined ? { enabled } : {}),
      ...(startNow !== undefined ? { startNow } : {})
    };
  }
  return {
    sessionId: requireString(body, "sessionId", context),
    input: requireString(body, "input", context),
    everyMinutes: requirePositiveInt(body, "everyMinutes", context),
    ...(enabled !== undefined ? { enabled } : {}),
    ...(startNow !== undefined ? { startNow } : {})
  };
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
