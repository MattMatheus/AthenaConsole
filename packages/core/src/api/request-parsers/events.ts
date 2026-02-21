import type { URL } from "node:url";
import { parseCursorPageQuery } from "./pagination.js";
import { parseOptionalIsoDateTime } from "./helpers.js";
import type { GovernanceAuditChangeCategory } from "../../shared/contracts.js";

export function parseEventsListQuery(requestUrl: URL): {
  cursor?: string;
  limit: number;
  traceId?: string;
  sessionId?: string;
  types?: string[];
  createdAfter?: string;
  createdBefore?: string;
} {
  const page = parseCursorPageQuery(requestUrl);
  const traceId = requestUrl.searchParams.get("traceId")?.trim();
  const sessionId = requestUrl.searchParams.get("sessionId")?.trim();
  const typesRaw = requestUrl.searchParams.get("types");
  const types = typesRaw
    ? typesRaw
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
    : undefined;
  const createdAfter = parseOptionalIsoDateTime(requestUrl.searchParams.get("createdAfter"), "events.list.createdAfter");
  const createdBefore = parseOptionalIsoDateTime(requestUrl.searchParams.get("createdBefore"), "events.list.createdBefore");

  return {
    ...page,
    ...(traceId ? { traceId } : {}),
    ...(sessionId ? { sessionId } : {}),
    ...(types && types.length > 0 ? { types } : {}),
    ...(createdAfter ? { createdAfter } : {}),
    ...(createdBefore ? { createdBefore } : {})
  };
}

export function parseGovernanceAuditHistoryQuery(requestUrl: URL): {
  cursor?: string;
  limit: number;
  actor?: string;
  categories?: GovernanceAuditChangeCategory[];
  createdAfter?: string;
  createdBefore?: string;
} {
  const page = parseCursorPageQuery(requestUrl);
  const actor = requestUrl.searchParams.get("actor")?.trim();
  const categoriesRaw = requestUrl.searchParams.get("categories");
  const categories = categoriesRaw
    ? categoriesRaw
        .split(",")
        .map((item) => item.trim())
        .filter((item): item is GovernanceAuditChangeCategory =>
          item === "policy" || item === "rbac-role" || item === "identity-assignment"
        )
    : undefined;
  const createdAfter = parseOptionalIsoDateTime(
    requestUrl.searchParams.get("createdAfter"),
    "governance.audit.createdAfter"
  );
  const createdBefore = parseOptionalIsoDateTime(
    requestUrl.searchParams.get("createdBefore"),
    "governance.audit.createdBefore"
  );

  return {
    ...page,
    ...(actor ? { actor } : {}),
    ...(categories && categories.length > 0 ? { categories } : {}),
    ...(createdAfter ? { createdAfter } : {}),
    ...(createdBefore ? { createdBefore } : {})
  };
}
