import type { URL } from "node:url";
import type { MemoryGetRequest, MemorySearchOptions } from "../../memory/index.js";
import { AthenaError } from "../../runtime/errors.js";
import { optionalPositiveInt, requireString } from "../validation.js";
import { parseOptionalFloat, parseOptionalInt } from "./helpers.js";

export function parseMemorySearchQuery(requestUrl: URL): { query: string; options: MemorySearchOptions } {
  const query = requestUrl.searchParams.get("query")?.trim();
  if (!query) {
    throw new AthenaError("CONFIG_ERROR", "memory.search.query must be a non-empty string.");
  }
  const maxResults = parseOptionalInt(requestUrl.searchParams.get("maxResults"));
  const minScore = parseOptionalFloat(requestUrl.searchParams.get("minScore"));
  if (maxResults !== undefined && maxResults <= 0) {
    throw new AthenaError("CONFIG_ERROR", "memory.search.maxResults must be a positive integer when provided.");
  }
  if (minScore !== undefined && minScore < 0) {
    throw new AthenaError("CONFIG_ERROR", "memory.search.minScore must be >= 0 when provided.");
  }
  return {
    query,
    options: {
      ...(maxResults !== undefined ? { maxResults } : {}),
      ...(minScore !== undefined ? { minScore } : {})
    }
  };
}

export function parseMemoryGetRequest(body: Record<string, unknown>): MemoryGetRequest {
  const from = optionalPositiveInt(body, "from", "memory.get");
  const lines = optionalPositiveInt(body, "lines", "memory.get");
  return {
    path: requireString(body, "path", "memory.get"),
    ...(from !== undefined ? { from } : {}),
    ...(lines !== undefined ? { lines } : {})
  };
}
