import { apiClient } from "../../services";
import type {
  GovernanceAuditCategory,
  GovernanceAuditDiffField,
  GovernanceAuditEntry,
  GovernanceAuditHistoryQuery,
  GovernanceAuditHistoryResult
} from "./types";

type RecordValue = Record<string, unknown>;

function isRecord(value: unknown): value is RecordValue {
  return typeof value === "object" && value !== null;
}

function parseCategory(value: unknown): GovernanceAuditCategory | undefined {
  return value === "policy" || value === "rbac-role" || value === "identity-assignment" ? value : undefined;
}

function parseDiff(value: unknown): GovernanceAuditDiffField | undefined {
  if (!isRecord(value) || typeof value.key !== "string" || typeof value.label !== "string") {
    return undefined;
  }
  return {
    key: value.key,
    label: value.label,
    ...(typeof value.before === "string" ? { before: value.before } : {}),
    ...(typeof value.after === "string" ? { after: value.after } : {})
  };
}

function parseEntry(value: unknown): GovernanceAuditEntry | undefined {
  if (!isRecord(value)) {
    return undefined;
  }
  const category = parseCategory(value.category);
  if (!category || typeof value.id !== "string" || typeof value.eventId !== "string") {
    return undefined;
  }
  const actor = isRecord(value.actor) ? value.actor : {};
  const actorSubject = typeof actor.subject === "string" ? actor.subject : "unknown";
  return {
    id: value.id,
    eventId: value.eventId,
    category,
    action: typeof value.action === "string" ? value.action : "unknown",
    timestamp: typeof value.timestamp === "string" ? value.timestamp : new Date(0).toISOString(),
    actor: {
      subject: actorSubject,
      ...(typeof actor.role === "string" ? { role: actor.role } : {})
    },
    ...(typeof value.reason === "string" ? { reason: value.reason } : {}),
    summary: typeof value.summary === "string" ? value.summary : "Governance change.",
    diffs: Array.isArray(value.diffs)
      ? value.diffs.map(parseDiff).filter((item): item is GovernanceAuditDiffField => item !== undefined)
      : []
  };
}

function toSearchParams(query: GovernanceAuditHistoryQuery): URLSearchParams {
  const params = new URLSearchParams();
  if (query.cursor) {
    params.set("cursor", query.cursor);
  }
  if (query.limit !== undefined) {
    params.set("limit", String(query.limit));
  }
  if (query.actor && query.actor.trim().length > 0) {
    params.set("actor", query.actor.trim());
  }
  if (query.categories && query.categories.length > 0) {
    params.set("categories", query.categories.join(","));
  }
  if (query.createdAfter) {
    params.set("createdAfter", query.createdAfter);
  }
  if (query.createdBefore) {
    params.set("createdBefore", query.createdBefore);
  }
  return params;
}

export async function fetchGovernanceAuditHistory(
  query: GovernanceAuditHistoryQuery = {}
): Promise<GovernanceAuditHistoryResult> {
  const params = toSearchParams(query);
  const querySuffix = params.toString().length > 0 ? `?${params.toString()}` : "";
  const payload = await apiClient.get<unknown>(`/governance/audit-trail${querySuffix}`);
  if (!isRecord(payload)) {
    throw new Error("Governance audit payload is invalid.");
  }
  const items = Array.isArray(payload.items) ? payload.items.map(parseEntry).filter((item): item is GovernanceAuditEntry => item !== undefined) : [];
  return {
    items,
    ...(typeof payload.nextCursor === "string" && payload.nextCursor.length > 0 ? { nextCursor: payload.nextCursor } : {})
  };
}
