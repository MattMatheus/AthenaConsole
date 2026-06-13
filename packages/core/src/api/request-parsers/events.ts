import type { URL } from "node:url";
import { parseCursorPageQuery } from "./pagination.js";
import { parseOptionalIsoDateTime } from "./helpers.js";
import type { GovernanceAuditChangeCategory } from "../../shared/contracts.js";

const GOVERNANCE_AUDIT_CATEGORIES = new Set<GovernanceAuditChangeCategory>([
  "policy",
  "rbac-role",
  "identity-assignment",
  "identity",
  "provider",
  "secret-reference",
  "task-workflow",
  "connector",
  "artifact",
  "memory",
  "evidence"
]);

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
  subject?: string;
  categories?: GovernanceAuditChangeCategory[];
  resourceId?: string;
  workspaceId?: string;
  runId?: string;
  createdAfter?: string;
  createdBefore?: string;
} {
  const page = parseCursorPageQuery(requestUrl);
  const actor = requestUrl.searchParams.get("actor")?.trim();
  const subject = requestUrl.searchParams.get("subject")?.trim();
  const resourceId = requestUrl.searchParams.get("resourceId")?.trim() ?? requestUrl.searchParams.get("resource")?.trim();
  const workspaceId = requestUrl.searchParams.get("workspaceId")?.trim() ?? requestUrl.searchParams.get("workspace")?.trim();
  const runId = requestUrl.searchParams.get("runId")?.trim() ?? requestUrl.searchParams.get("run")?.trim();
  const categoriesRaw = [requestUrl.searchParams.get("categories"), requestUrl.searchParams.get("category")]
    .filter((item): item is string => typeof item === "string")
    .join(",");
  const categories = categoriesRaw
    ? categoriesRaw
        .split(",")
        .map((item) => item.trim())
        .filter((item): item is GovernanceAuditChangeCategory => GOVERNANCE_AUDIT_CATEGORIES.has(item as GovernanceAuditChangeCategory))
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
    ...(subject ? { subject } : {}),
    ...(categories && categories.length > 0 ? { categories } : {}),
    ...(resourceId ? { resourceId } : {}),
    ...(workspaceId ? { workspaceId } : {}),
    ...(runId ? { runId } : {}),
    ...(createdAfter ? { createdAfter } : {}),
    ...(createdBefore ? { createdBefore } : {})
  };
}
