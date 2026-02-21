import type { URL } from "node:url";
import { AthenaError } from "../../runtime/errors.js";
import { optionalString, requireString } from "../validation.js";
import { parseCursorPageQuery } from "./pagination.js";

export function parseCreateRunRequest(body: Record<string, unknown>): {
  sessionId: string;
  input?: string;
  directiveId?: string;
  harnessProfileId?: string;
  provider?: string;
  model?: string;
  metadata?: Record<string, string>;
} {
  const input = optionalString(body, "input", "runs.create");
  const directiveId = optionalString(body, "directiveId", "runs.create");
  const harnessProfileId = optionalString(body, "harnessProfileId", "runs.create");
  const provider = optionalString(body, "provider", "runs.create");
  const model = optionalString(body, "model", "runs.create");
  const metadata = parseRunMetadata(body.metadata);
  if (!input && !directiveId) {
    throw new AthenaError("CONFIG_ERROR", "runs.create requires either input or directiveId.");
  }
  if (harnessProfileId && (provider || model)) {
    throw new AthenaError(
      "CONFIG_ERROR",
      "runs.create.provider/model cannot be combined with harnessProfileId."
    );
  }
  return {
    sessionId: requireString(body, "sessionId", "runs.create"),
    ...(input ? { input } : {}),
    ...(directiveId ? { directiveId } : {}),
    ...(harnessProfileId ? { harnessProfileId } : {}),
    ...(provider ? { provider } : {}),
    ...(model ? { model } : {}),
    ...(metadata ? { metadata } : {})
  };
}

export function parseCancelRunRequest(body: Record<string, unknown>): { reason?: string } {
  const reason = optionalString(body, "reason", "runs.cancel");
  return {
    ...(reason ? { reason } : {})
  };
}

export function parseRunControlQuery(requestUrl: URL): {
  cursor?: string;
  limit: number;
  sessionId?: string;
  runId?: string;
} {
  const page = parseCursorPageQuery(requestUrl);
  const sessionId = requestUrl.searchParams.get("sessionId")?.trim();
  const runId = requestUrl.searchParams.get("runId")?.trim();
  return {
    ...page,
    ...(sessionId ? { sessionId } : {}),
    ...(runId ? { runId } : {})
  };
}

function parseRunMetadata(value: unknown): Record<string, string> | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new AthenaError("CONFIG_ERROR", "runs.create.metadata must be an object when provided.");
  }
  const metadata: Record<string, string> = {};
  for (const [key, item] of Object.entries(value)) {
    if (typeof item !== "string" || item.trim().length === 0) {
      throw new AthenaError("CONFIG_ERROR", `runs.create.metadata.${key} must be a non-empty string.`);
    }
    metadata[key] = item.trim();
  }
  return Object.keys(metadata).length > 0 ? metadata : undefined;
}
