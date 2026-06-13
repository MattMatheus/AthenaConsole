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

const GOVERNANCE_AUDIT_CATEGORIES: GovernanceAuditChangeCategory[] = [
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
];

const EVENT_TYPES_BY_CATEGORY: Record<GovernanceAuditChangeCategory, string[]> = {
  policy: ["policy.updated"],
  "rbac-role": ["rbac.role.upserted", "rbac.role.removed"],
  "identity-assignment": ["rbac.assignment.upserted", "rbac.assignment.removed"],
  identity: ["authz.denied"],
  provider: ["run.completed", "model-provider.configured", "model-provider.tested", "model-provider.removed"],
  "secret-reference": ["secret.read"],
  "task-workflow": [
    "task.created",
    "task.updated",
    "task.run.started",
    "task.run.completed",
    "task.run.failed",
    "workflow.step.started",
    "workflow.step.completed",
    "workflow.step.failed",
    "workflow.recovered_stale_steps",
    "workflow.resume.prepared"
  ],
  connector: ["connector.readiness.checked", "connector.issue.read", "connector.write.approval_evaluated", "connector.workflow.blocked"],
  artifact: ["artifact.created", "evidence.attached"],
  memory: [
    "memory.context",
    "memory.search",
    "memory.records.selected",
    "memory.record.selected",
    "memory.proposal.created",
    "durable-memory.record.written",
    "durable-memory.proposal.created",
    "durable-memory.proposal.approved",
    "durable-memory.proposal.rejected"
  ],
  evidence: ["evidence-bundle.exported"]
};

const EVENT_CATEGORY_BY_TYPE: Record<string, GovernanceAuditChangeCategory> = {
  "policy.updated": "policy",
  "rbac.role.upserted": "rbac-role",
  "rbac.role.removed": "rbac-role",
  "rbac.assignment.upserted": "identity-assignment",
  "rbac.assignment.removed": "identity-assignment",
  "authz.denied": "identity",
  "run.completed": "provider",
  "model-provider.configured": "provider",
  "model-provider.tested": "provider",
  "model-provider.removed": "provider",
  "secret.read": "secret-reference",
  "task.created": "task-workflow",
  "task.updated": "task-workflow",
  "task.run.started": "task-workflow",
  "task.run.completed": "task-workflow",
  "task.run.failed": "task-workflow",
  "workflow.step.started": "task-workflow",
  "workflow.step.completed": "task-workflow",
  "workflow.step.failed": "task-workflow",
  "workflow.recovered_stale_steps": "task-workflow",
  "workflow.resume.prepared": "task-workflow",
  "connector.readiness.checked": "connector",
  "connector.issue.read": "connector",
  "connector.write.approval_evaluated": "connector",
  "connector.workflow.blocked": "connector",
  "artifact.created": "artifact",
  "evidence.attached": "artifact",
  "memory.context": "memory",
  "memory.search": "memory",
  "memory.records.selected": "memory",
  "memory.record.selected": "memory",
  "memory.proposal.created": "memory",
  "durable-memory.record.written": "memory",
  "durable-memory.proposal.created": "memory",
  "durable-memory.proposal.approved": "memory",
  "durable-memory.proposal.rejected": "memory",
  "evidence-bundle.exported": "evidence"
};

export class LocalGovernanceAuditService implements GovernanceAuditService {
  constructor(private readonly eventService: EventService) {}

  async list(query: GovernanceAuditHistoryQuery = {}): Promise<GovernanceAuditHistoryResult> {
    const limit = clampLimit(query.limit);
    const categories = normalizeCategories(query.categories);
    const categorySet = new Set(categories);
    const eventTypes = categories.flatMap((category) => EVENT_TYPES_BY_CATEGORY[category]);
    const actorFilter = query.actor?.trim().toLowerCase();
    const subjectFilter = query.subject?.trim().toLowerCase();
    const resourceFilter = query.resourceId?.trim().toLowerCase();
    const workspaceFilter = query.workspaceId?.trim().toLowerCase();
    const runFilter = query.runId?.trim().toLowerCase();

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
        if (subjectFilter && !auditEntryMatchesSubject(event, mapped, subjectFilter)) {
          continue;
        }
        if (resourceFilter && !auditEntryMatchesResource(event, mapped, resourceFilter)) {
          continue;
        }
        if (workspaceFilter && !auditEntryMatchesWorkspace(event, workspaceFilter)) {
          continue;
        }
        if (runFilter && !auditEntryMatchesRun(event, mapped, runFilter)) {
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

  async exportJsonl(query: GovernanceAuditHistoryQuery = {}): Promise<string> {
    const items = await this.collectExportItems(query);
    await this.emitExportAudit("jsonl", query, items.length);
    return items.map((item) => JSON.stringify(item)).join("\n") + (items.length > 0 ? "\n" : "");
  }

  async exportCsv(query: GovernanceAuditHistoryQuery = {}): Promise<string> {
    const items = await this.collectExportItems(query);
    await this.emitExportAudit("csv", query, items.length);
    const rows = [
      ["id", "eventId", "category", "action", "timestamp", "actorSubject", "actorRole", "summary", "reason", "diffsJson"],
      ...items.map((item) => [
        item.id,
        item.eventId,
        item.category,
        item.action,
        item.timestamp,
        item.actor.subject,
        item.actor.role ?? "",
        item.summary,
        item.reason ?? "",
        JSON.stringify(item.diffs)
      ])
    ];
    return `${rows.map((row) => row.map(csvCell).join(",")).join("\n")}\n`;
  }

  private async collectExportItems(query: GovernanceAuditHistoryQuery): Promise<GovernanceAuditEntry[]> {
    const items: GovernanceAuditEntry[] = [];
    let cursor = query.cursor;
    for (let pages = 0; pages < 50; pages += 1) {
      const page = await this.list({
        ...query,
        ...(cursor ? { cursor } : {}),
        limit: MAX_LIMIT
      });
      items.push(...page.items);
      if (!page.nextCursor) {
        break;
      }
      cursor = page.nextCursor;
    }
    return items;
  }

  private async emitExportAudit(format: "jsonl" | "csv", query: GovernanceAuditHistoryQuery, itemCount: number): Promise<void> {
    await this.eventService.emit({
      type: "governance.audit.exported",
      payload: {
        format,
        itemCount,
        filters: redactExportFilters(query)
      }
    });
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
  if (category === "identity") {
    return mapIdentityAuditEntry(event);
  }
  if (category === "provider") {
    return mapProviderAuditEntry(event);
  }
  if (category === "secret-reference") {
    return mapSecretReferenceAuditEntry(event);
  }
  if (category === "task-workflow") {
    return mapTaskWorkflowAuditEntry(event);
  }
  if (category === "connector") {
    return mapConnectorAuditEntry(event);
  }
  if (category === "artifact") {
    return mapArtifactAuditEntry(event);
  }
  if (category === "memory") {
    return mapMemoryAuditEntry(event);
  }
  if (category === "evidence") {
    return mapEvidenceAuditEntry(event);
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

function mapIdentityAuditEntry(event: EventRecord): GovernanceAuditEntry {
  const payload = toRecord(event.payload);
  const actor = readActor(payload);
  return {
    ...baseAuditEntry(event, "identity", actor),
    summary: `Identity authorization ${readString(payload.denyReason)?.toLowerCase() ?? "decision"} for ${readString(payload.operation) ?? "unknown operation"}.`,
    diffs: summaryDiffs(payload, ["operation", "denyReason", "detailCode", "agentName"])
  };
}

function mapProviderAuditEntry(event: EventRecord): GovernanceAuditEntry {
  const payload = toRecord(event.payload);
  const provider = readString(payload.provider) ?? readString(payload.providerId) ?? "unknown provider";
  const model = readString(payload.model) ?? readString(payload.defaultModel);
  return {
    ...baseAuditEntry(event, "provider", readActor(payload)),
    summary: model ? `Provider ${provider} used model ${model}.` : `Provider event recorded for ${provider}.`,
    diffs: summaryDiffs(payload, ["provider", "providerId", "providerKind", "model", "defaultModel", "status", "harnessProfileId"])
  };
}

function mapSecretReferenceAuditEntry(event: EventRecord): GovernanceAuditEntry {
  const payload = toRecord(event.payload);
  const reference = toRecord(payload.reference);
  const kind = readString(reference.kind) ?? "unknown";
  return {
    ...baseAuditEntry(event, "secret-reference", readActor(payload)),
    summary: `Secret reference read for ${readString(payload.purpose) ?? "unspecified purpose"}.`,
    diffs: [
      ...summaryDiffs(payload, ["purpose", "resourceId"]),
      ...summaryDiffs(reference, ["kind", "name"]).map((diff) => ({ ...diff, key: `reference.${diff.key}`, label: `Reference ${diff.label}` }))
    ].filter((diff) => diff.key !== "reference.name" || kind !== "local-file")
  };
}

function mapTaskWorkflowAuditEntry(event: EventRecord): GovernanceAuditEntry {
  const payload = toRecord(event.payload);
  const stepId = readString(payload.stepId) ?? readString(payload.workflowStepId);
  return {
    ...baseAuditEntry(event, "task-workflow", readActor(payload)),
    summary: stepId ? `Workflow event ${event.type} for step ${stepId}.` : `Task/workflow event ${event.type} recorded.`,
    diffs: summaryDiffs(payload, ["taskId", "runId", "workflowRunId", "stepId", "workflowStepId", "status", "reason"])
  };
}

function mapConnectorAuditEntry(event: EventRecord): GovernanceAuditEntry {
  const payload = toRecord(event.payload);
  const serviceId = readString(payload.serviceId) ?? readString(payload.connectorId) ?? "unknown connector";
  return {
    ...baseAuditEntry(event, "connector", readActor(payload)),
    summary: `Connector event ${event.type} recorded for ${serviceId}.`,
    diffs: summaryDiffs(payload, [
      "pluginId",
      "serviceId",
      "connectorId",
      "operationId",
      "operationClass",
      "status",
      "credentialState",
      "missingScopes",
      "rateLimitedOperations"
    ])
  };
}

function mapArtifactAuditEntry(event: EventRecord): GovernanceAuditEntry {
  const payload = toRecord(event.payload);
  const artifactId = readString(payload.artifactId) ?? readString(payload.id) ?? "unknown artifact";
  return {
    ...baseAuditEntry(event, "artifact", readActor(payload)),
    summary: `Artifact event ${event.type} recorded for ${artifactId}.`,
    diffs: summaryDiffs(payload, ["artifactId", "id", "runId", "taskId", "kind", "format", "storageUri", "label", "artifactRef"])
  };
}

function mapMemoryAuditEntry(event: EventRecord): GovernanceAuditEntry {
  const payload = toRecord(event.payload);
  const namespace = stringifyValue(payload.namespace);
  return {
    ...baseAuditEntry(event, "memory", readActor(payload)),
    summary: namespace ? `Memory event ${event.type} recorded for ${namespace}.` : `Memory event ${event.type} recorded.`,
    diffs: summaryDiffs(payload, [
      "runId",
      "taskId",
      "agentId",
      "recordId",
      "recordIds",
      "proposalId",
      "memoryType",
      "status",
      "operatorStatus",
      "resultCount",
      "total"
    ])
  };
}

function mapEvidenceAuditEntry(event: EventRecord): GovernanceAuditEntry {
  const payload = toRecord(event.payload);
  const actor = readActor(payload);
  const bundleId = readString(payload.bundleId) ?? "unknown bundle";
  return {
    ...baseAuditEntry(event, "evidence", actor),
    summary: `Evidence bundle exported: ${bundleId}.`,
    diffs: summaryDiffs(payload, [
      "runId",
      "taskId",
      "bundleId",
      "destinationKind",
      "schemaVersion",
      "eventCount",
      "artifactCount",
      "memoryCount"
    ])
  };
}

function baseAuditEntry(event: EventRecord, category: GovernanceAuditChangeCategory, actor: { subject: string; role?: string }) {
  return {
    id: `audit-${event.id}`,
    eventId: event.id,
    category,
    action: event.type,
    timestamp: event.createdAt,
    actor
  };
}

function auditEntryMatchesSubject(event: EventRecord, entry: GovernanceAuditEntry, normalizedSubject: string): boolean {
  const payload = toRecord(event.payload);
  return [entry.actor.subject, readString(payload.subject), readString(payload.updatedBy), readString(toRecord(payload.actor).subject)]
    .filter((value): value is string => Boolean(value))
    .some((value) => value.toLowerCase() === normalizedSubject);
}

function auditEntryMatchesResource(event: EventRecord, entry: GovernanceAuditEntry, normalizedResource: string): boolean {
  const payload = toRecord(event.payload);
  const candidates = [
    readString(payload.resourceId),
    readString(payload.subject),
    readString(payload.providerId),
    readString(payload.serviceId),
    readString(payload.connectorId),
    readString(payload.artifactId),
    readString(payload.recordId),
    readString(payload.proposalId),
    readString(payload.bundleId),
    readString(payload.taskId),
    readString(event.taskId),
    ...entry.diffs.filter((diff) => isResourceDiffKey(diff.key)).map((diff) => diff.after)
  ];
  return candidates
    .filter((value): value is string => Boolean(value))
    .some((value) => value.toLowerCase() === normalizedResource);
}

function auditEntryMatchesWorkspace(event: EventRecord, normalizedWorkspace: string): boolean {
  const payload = toRecord(event.payload);
  const candidates = [readString(payload.workspaceId), readString(payload.workspace), readString(toRecord(payload.resource).workspaceId)];
  return candidates
    .filter((value): value is string => Boolean(value))
    .some((value) => value.toLowerCase() === normalizedWorkspace);
}

function auditEntryMatchesRun(event: EventRecord, entry: GovernanceAuditEntry, normalizedRunId: string): boolean {
  const payload = toRecord(event.payload);
  const candidates = [event.runId, readString(payload.runId), ...entry.diffs.filter((diff) => diff.key === "runId").map((diff) => diff.after)];
  return candidates
    .filter((value): value is string => Boolean(value))
    .some((value) => value.toLowerCase() === normalizedRunId);
}

function isResourceDiffKey(key: string): boolean {
  return /^(resourceId|providerId|serviceId|connectorId|artifactId|recordId|proposalId|bundleId|taskId|id)$/.test(key);
}

function redactExportFilters(query: GovernanceAuditHistoryQuery): Record<string, unknown> {
  const filters: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || key === "cursor" || key === "limit") {
      continue;
    }
    filters[key] = value;
  }
  return filters;
}

function csvCell(value: string): string {
  if (!/[",\n\r]/.test(value)) {
    return value;
  }
  return `"${value.replaceAll('"', '""')}"`;
}

function normalizeCategories(categories: GovernanceAuditHistoryQuery["categories"]): GovernanceAuditChangeCategory[] {
  if (!categories || categories.length === 0) {
    return GOVERNANCE_AUDIT_CATEGORIES;
  }
  const normalized = new Set<GovernanceAuditChangeCategory>();
  for (const category of categories) {
    if (GOVERNANCE_AUDIT_CATEGORIES.includes(category)) {
      normalized.add(category);
    }
  }
  return normalized.size > 0 ? [...normalized] : GOVERNANCE_AUDIT_CATEGORIES;
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

function readActor(payload: Record<string, unknown>): { subject: string; role?: string } {
  const nested = toRecord(payload.actor);
  const subject = readString(nested.subject) ?? readString(payload.subject) ?? readString(payload.updatedBy) ?? "system";
  const role = readString(nested.role) ?? readString(payload.role);
  return {
    subject,
    ...(role ? { role } : {})
  };
}

function summaryDiffs(payload: Record<string, unknown>, keys: string[]): GovernanceAuditDiffField[] {
  const diffs: GovernanceAuditDiffField[] = [];
  for (const key of keys) {
    const value = stringifyValue(payload[key]);
    if (value === undefined) {
      continue;
    }
    diffs.push({
      key,
      label: toLabel(key),
      after: value
    });
  }
  return diffs;
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
