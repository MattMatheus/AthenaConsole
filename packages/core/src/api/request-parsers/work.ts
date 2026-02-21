import { optionalString, requireMode, requireString } from "../validation.js";

export function parseWorkEnqueueRequest(body: Record<string, unknown>): {
  sessionId: string;
  payload: string;
  mode: "followup" | "collect";
} {
  return {
    sessionId: requireString(body, "sessionId", "work.enqueue"),
    payload: requireString(body, "payload", "work.enqueue"),
    mode: requireMode(body, "mode", "work.enqueue")
  };
}

export function parseWorkDrainRequest(body: Record<string, unknown>): {
  provider?: string;
  model?: string;
} {
  const provider = optionalString(body, "provider", "work.drain");
  const model = optionalString(body, "model", "work.drain");
  return {
    ...(provider ? { provider } : {}),
    ...(model ? { model } : {})
  };
}
