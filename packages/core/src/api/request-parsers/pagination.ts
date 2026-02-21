import type { URL } from "node:url";
import { normalizeCursorPageQuery, normalizeTailQuery } from "../../control-plane/api-contracts.js";
import { parseOptionalInt } from "./helpers.js";

export function parseCursorPageQuery(requestUrl: URL): { cursor?: string; limit: number } {
  const cursor = requestUrl.searchParams.get("cursor");
  const limit = parseOptionalInt(requestUrl.searchParams.get("limit"));
  return normalizeCursorPageQuery({
    ...(cursor ? { cursor } : {}),
    ...(limit !== undefined ? { limit } : {})
  });
}

export function parseTailQuery(requestUrl: URL): { after?: string; limit: number } {
  const after = requestUrl.searchParams.get("after");
  const limit = parseOptionalInt(requestUrl.searchParams.get("limit"));
  return normalizeTailQuery({
    ...(after ? { after } : {}),
    ...(limit !== undefined ? { limit } : {})
  });
}
