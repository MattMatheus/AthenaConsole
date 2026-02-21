import type { URL } from "node:url";
import { AthenaError } from "../../runtime/errors.js";
import type { SessionSearchQuery } from "../../shared/contracts.js";
import { parseOptionalInt, parseOptionalIsoDateTime } from "./helpers.js";

const DEFAULT_SEARCH_LIMIT = 50;
const MAX_SEARCH_LIMIT = 200;

export function parseSessionSearchQuery(requestUrl: URL): SessionSearchQuery {
  const query = requestUrl.searchParams.get("query")?.trim() ?? "";

  const personaId = requestUrl.searchParams.get("specialistId")?.trim() ?? requestUrl.searchParams.get("personaId")?.trim();
  const userId = requestUrl.searchParams.get("userId")?.trim();
  const status = parseStatus(requestUrl.searchParams.get("status"));
  const from = parseOptionalIsoDateTime(requestUrl.searchParams.get("from"), "sessions.search.from");
  const to = parseOptionalIsoDateTime(requestUrl.searchParams.get("to"), "sessions.search.to");
  const limit = clampLimit(parseOptionalInt(requestUrl.searchParams.get("limit")));
  if (from && to && Date.parse(from) > Date.parse(to)) {
    throw new AthenaError("CONFIG_ERROR", "sessions.search.from must be earlier than or equal to sessions.search.to.");
  }
  return {
    query,
    ...(personaId ? { personaId } : {}),
    ...(userId ? { userId } : {}),
    ...(status ? { status } : {}),
    ...(from ? { from } : {}),
    ...(to ? { to } : {}),
    limit
  };
}

function parseStatus(value: string | null): SessionSearchQuery["status"] | undefined {
  if (!value) {
    return undefined;
  }
  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return undefined;
  }
  if (normalized === "ok" || normalized === "failed") {
    return normalized;
  }
  throw new AthenaError("CONFIG_ERROR", "sessions.search.status must be ok|failed.");
}

function clampLimit(raw: number | undefined): number {
  if (!Number.isFinite(raw)) {
    return DEFAULT_SEARCH_LIMIT;
  }
  const value = Math.floor(raw as number);
  return Math.max(1, Math.min(MAX_SEARCH_LIMIT, value));
}
