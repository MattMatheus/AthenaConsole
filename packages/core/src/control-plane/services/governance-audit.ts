import type {
  EventRecord,
  GovernanceAuditChangeCategory,
  GovernanceAuditDiffField,
  GovernanceAuditEntry,
  GovernanceAuditHistoryQuery,
  GovernanceAuditHistoryResult
} from "../../shared/contracts.js";
import type { EventService, GovernanceAuditService } from "../interfaces.js";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

const EVENT_TYPES_BY_CATEGORY: Record<GovernanceAuditChangeCategory, string[]> = {
  policy: ["policy.updated"],
  "rbac-role": ["rbac.role.upserted", "rbac.role.removed"],
  "identity-assignment": ["rbac.assignment.upserted", "rbac.assignment.removed"]
};

const EVENT_CATEGORY_BY_TYPE: Record<string, GovernanceAuditChangeCategory> = {
  "policy.updated": "policy",
  "rbac.role.upserted": "rbac-role",
  "rbac.role.removed": "rbac-role",
  "rbac.assignment.upserted": "identity-assignment",
  "rbac.assignment.removed": "identity-assignment"
};

export class LocalGovernanceAuditService implements GovernanceAuditService {
  constructor(private readonly eventService: EventService) {}

  async list(query: GovernanceAuditHistoryQuery = {}): Promise<GovernanceAuditHistoryResult> {
    const limit = clampLimit(query.limit);
    const categories = normalizeCategories(query.categories);
    const categorySet = new Set(categories);
    const eventTypes = categories.flatMap((category) => EVENT_TYPES_BY_CATEGORY[category]);
    const actorFilter = query.actor?.trim().toLowerCase();

    let currentOffset = decodeOffsetCursor(query.cursor);
    const items: GovernanceAuditEntry[] = [];

    while (items.length < limit) {
      const page = await this.eventService.list({
        ...(currentOffset > 0 ? { cursor: encodeOffsetCursor(currentOffset) } : {}),
        limit: 500,
        types: eventTypes,
        ...(query.createdAfter ? { createdAfter: query.createdAfter } : {}),
        ...(query.createdBefore ? { createdBefore: query.createdBefore } : {})
      });
      if (page.events.length === 0) {
        break;
      }

      for (const event of page.events) {
        currentOffset += 1;
        const mapped = mapAuditEntry(event);
        if (!mapped || !categorySet.has(mapped.category)) {
          continue;
        }
        if (actorFilter && mapped.actor.subject.toLowerCase() !== actorFilter) {
          continue;
        }
        items.push(mapped);
        if (items.length >= limit) {
          return {
            items,
            nextCursor: encodeOffsetCursor(currentOffset)
          };
        }
      }

      if (!page.nextCursor) {
        break;
      }
    }

    return { items };
  }
}

function mapAuditEntry(event: EventRecord): GovernanceAuditEntry | undefined {
  const category = EVENT_CATEGORY_BY_TYPE[event.type];
  if (!category) {
    return undefined;
  }
  if (event.type === "policy.updated") {
    return mapPolicyAuditEntry(event);
  }
  if (event.type === "rbac.assignment.upserted" || event.type === "rbac.assignment.removed") {
    return mapIdentityAssignmentAuditEntry(event);
  }
  if (event.type === "rbac.role.upserted" || event.type === "rbac.role.removed") {
    return mapRbacRoleAuditEntry(event);
  }
  return undefined;
}

function mapPolicyAuditEntry(event: EventRecord): GovernanceAuditEntry {
  const payload = toRecord(event.payload);
  const actorSubject = readString(payload.updatedBy) ?? readString(payload.actor) ?? "system";
  const reason = readString(payload.auditComment) ?? readString(payload.reason);

  const before = toRecord(payload.before);
  const after = toOptionalRecord(payload.after) ?? toRecord(payload.policy);
  const keys = new Set<string>([...Object.keys(before), ...Object.keys(after)]);
  keys.delete("updatedAt");
  keys.delete("schemaVersion");

  const diffs: GovernanceAuditDiffField[] = [];
  for (const key of [...keys].sort()) {
    const beforeValue = stringifyValue(before[key]);
    const afterValue = stringifyValue(after[key]);
    if (beforeValue === afterValue) {
      continue;
    }
    diffs.push({
      key,
      label: toLabel(key),
      ...(beforeValue !== undefined ? { before: beforeValue } : {}),
      ...(afterValue !== undefined ? { after: afterValue } : {})
    });
  }

  return {
    id: `audit-${event.id}`,
    eventId: event.id,
    category: "policy",
    action: "policy.updated",
    timestamp: event.createdAt,
    actor: {
      subject: actorSubject,
      ...(event.policy?.origin?.engine ? { role: event.policy.origin.engine } : {})
    },
    ...(reason ? { reason } : {}),
    summary: "Policy document updated.",
    diffs
  };
}

function mapIdentityAssignmentAuditEntry(event: EventRecord): GovernanceAuditEntry {
  const payload = toRecord(event.payload);
  const actorSubject = readString(payload.updatedBy) ?? "system";
  const subject = readString(payload.subject) ?? "unknown";
  const subjectType = readString(payload.subjectType);
  const previous = toRecord(payload.previous);

  const diffs: GovernanceAuditDiffField[] = [];
  const previousRole = readString(previous.role);
  const nextRole = event.type === "rbac.assignment.removed" ? undefined : readString(payload.role);
  if (previousRole !== nextRole) {
    diffs.push({
      key: "role",
      label: "Role",
      ...(previousRole ? { before: previousRole } : {}),
      ...(nextRole ? { after: nextRole } : {})
    });
  }

  const previousType = readString(previous.subjectType);
  const nextType = event.type === "rbac.assignment.removed" ? undefined : subjectType;
  if (previousType !== nextType) {
    diffs.push({
      key: "subjectType",
      label: "Subject Type",
      ...(previousType ? { before: previousType } : {}),
      ...(nextType ? { after: nextType } : {})
    });
  }

  return {
    id: `audit-${event.id}`,
    eventId: event.id,
    category: "identity-assignment",
    action: event.type,
    timestamp: event.createdAt,
    actor: {
      subject: actorSubject
    },
    summary:
      event.type === "rbac.assignment.removed"
        ? `Identity assignment removed for ${subject}.`
        : `Identity assignment upserted for ${subject}.`,
    diffs
  };
}

function mapRbacRoleAuditEntry(event: EventRecord): GovernanceAuditEntry {
  const payload = toRecord(event.payload);
  const actorSubject = readString(payload.updatedBy) ?? "system";
  const roleName = readString(payload.name) ?? readString(payload.role) ?? "unknown";
  const previous = toRecord(payload.previous);

  const previousPermissions = normalizeStringArray(previous.permissions);
  const nextPermissions = normalizeStringArray(payload.permissions);
  const diffs: GovernanceAuditDiffField[] = [];
  if (previousPermissions.join(",") !== nextPermissions.join(",")) {
    diffs.push({
      key: "permissions",
      label: "Permissions",
      ...(previousPermissions.length > 0 ? { before: previousPermissions.join(", ") } : {}),
      ...(nextPermissions.length > 0 ? { after: nextPermissions.join(", ") } : {})
    });
  }

  return {
    id: `audit-${event.id}`,
    eventId: event.id,
    category: "rbac-role",
    action: event.type,
    timestamp: event.createdAt,
    actor: {
      subject: actorSubject
    },
    summary: event.type === "rbac.role.removed" ? `RBAC role removed: ${roleName}.` : `RBAC role updated: ${roleName}.`,
    diffs
  };
}

function normalizeCategories(categories: GovernanceAuditHistoryQuery["categories"]): GovernanceAuditChangeCategory[] {
  if (!categories || categories.length === 0) {
    return ["policy", "rbac-role", "identity-assignment"];
  }
  const normalized = new Set<GovernanceAuditChangeCategory>();
  for (const category of categories) {
    if (category === "policy" || category === "rbac-role" || category === "identity-assignment") {
      normalized.add(category);
    }
  }
  return normalized.size > 0 ? [...normalized] : ["policy", "rbac-role", "identity-assignment"];
}

function clampLimit(value: number | undefined): number {
  if (!Number.isFinite(value)) {
    return DEFAULT_LIMIT;
  }
  const parsed = Math.floor(value as number);
  return Math.max(1, Math.min(MAX_LIMIT, parsed));
}

function decodeOffsetCursor(cursor: string | undefined): number {
  if (!cursor) {
    return 0;
  }
  try {
    const decoded = Buffer.from(cursor, "base64url").toString("utf8");
    const parsed = Number.parseInt(decoded, 10);
    if (!Number.isFinite(parsed) || parsed < 0) {
      return 0;
    }
    return parsed;
  } catch {
    return 0;
  }
}

function encodeOffsetCursor(offset: number): string {
  return Buffer.from(String(offset), "utf8").toString("base64url");
}

function toRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return value as Record<string, unknown>;
}

function toOptionalRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  return value as Record<string, unknown>;
}

function readString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
    .sort((left, right) => left.localeCompare(right));
}

function stringifyValue(value: unknown): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : "";
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (Array.isArray(value)) {
    const items = value
      .map((item) => stringifyValue(item))
      .filter((item): item is string => item !== undefined);
    return `[${items.join(", ")}]`;
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function toLabel(key: string): string {
  const withSpaces = key.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/[_.-]+/g, " ");
  return withSpaces
    .trim()
    .split(/\s+/)
    .map((token) => token[0]!.toUpperCase() + token.slice(1))
    .join(" ");
}
