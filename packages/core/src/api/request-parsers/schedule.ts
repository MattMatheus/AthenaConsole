import { AthenaError } from "../../runtime/errors.js";
import { optionalBoolean, optionalString, requirePositiveInt, requireString } from "../validation.js";

export function parseScheduleUpsertRequest(
  body: Record<string, unknown>,
  context: "schedules.create" | "schedules.update"
): {
  sessionId: string;
  input: string;
  everyMinutes: number;
  enabled?: boolean;
  startNow?: boolean;
} {
  const enabled = optionalBoolean(body, "enabled", context);
  const startNow = optionalBoolean(body, "startNow", context);
  return {
    sessionId: requireString(body, "sessionId", context),
    input: requireString(body, "input", context),
    everyMinutes: requirePositiveInt(body, "everyMinutes", context),
    ...(enabled !== undefined ? { enabled } : {}),
    ...(startNow !== undefined ? { startNow } : {})
  };
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
