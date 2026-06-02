import { apiClient } from "../../services";
import type {
  DurableMemoryActorType,
  DurableMemoryCacheMetadata,
  DurableMemoryInspectorSummary,
  DurableMemoryNamespaceRef,
  DurableMemoryNamespaceScope,
  DurableMemoryOperatorStatus,
  DurableMemoryProposal,
  DurableMemoryProposalStatus,
  DurableMemoryProviderHealth,
  DurableMemoryProviderHealthStatus,
  DurableMemoryRecord,
  DurableMemoryRecordListResult,
  DurableMemoryRecordStatus,
  DurableMemorySearchResult,
  DurableMemorySensitivity,
  DurableMemorySnapshot,
  DurableMemorySnapshotListResult,
  DurableMemorySourceKind,
  DurableMemorySyncStatus,
} from "./types";

type RecordValue = Record<string, unknown>;

const DEFAULT_NAMESPACE: DurableMemoryNamespaceRef = { scope: "workspace", id: "default" };

function isRecord(value: unknown): value is RecordValue {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

function stringValue(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function namespaceScope(value: unknown): DurableMemoryNamespaceScope {
  if (
    value === "account" ||
    value === "operator" ||
    value === "workspace" ||
    value === "project" ||
    value === "repository" ||
    value === "team" ||
    value === "agent" ||
    value === "task" ||
    value === "run" ||
    value === "artifact"
  ) {
    return value;
  }
  return "workspace";
}

function sourceKind(value: unknown): DurableMemorySourceKind {
  if (
    value === "operator" ||
    value === "agent" ||
    value === "task-run" ||
    value === "workflow-run" ||
    value === "artifact" ||
    value === "connector" ||
    value === "import" ||
    value === "system"
  ) {
    return value;
  }
  return "system";
}

function actorType(value: unknown): DurableMemoryActorType | undefined {
  return value === "operator" || value === "agent" || value === "system" ? value : undefined;
}

function sensitivity(value: unknown): DurableMemorySensitivity {
  if (value === "public" || value === "internal" || value === "sensitive" || value === "secret-adjacent") {
    return value;
  }
  return "internal";
}

function recordStatus(value: unknown): DurableMemoryRecordStatus {
  return value === "archived" || value === "deleted" ? value : "active";
}

function proposalStatus(value: unknown): DurableMemoryProposalStatus {
  return value === "approved" || value === "rejected" ? value : "pending";
}

function providerStatus(value: unknown): DurableMemoryProviderHealthStatus {
  if (value === "ok" || value === "degraded" || value === "unavailable" || value === "unauthorized" || value === "disabled") {
    return value;
  }
  return "unavailable";
}

function operatorStatus(value: unknown): DurableMemoryOperatorStatus {
  if (
    value === "remote-current" ||
    value === "remote-unavailable" ||
    value === "cache-current" ||
    value === "cache-stale" ||
    value === "queued-intent" ||
    value === "conflict-review-required" ||
    value === "local-dev-only" ||
    value === "diagnostic-only"
  ) {
    return value;
  }
  return "diagnostic-only";
}

function syncStatus(value: unknown): DurableMemorySyncStatus {
  if (
    value === "not-cached" ||
    value === "cache-current" ||
    value === "cache-stale" ||
    value === "offline" ||
    value === "queued-intent" ||
    value === "replaying" ||
    value === "conflict-review-required" ||
    value === "local-dev-only"
  ) {
    return value;
  }
  return "not-cached";
}

export function parseDurableMemoryNamespace(value: unknown): DurableMemoryNamespaceRef {
  if (!isRecord(value)) {
    return DEFAULT_NAMESPACE;
  }
  const parent = isRecord(value.parent) ? parseDurableMemoryNamespace(value.parent) : undefined;
  return {
    scope: namespaceScope(value.scope),
    id: stringValue(value.id, "default"),
    ...(parent ? { parent } : {}),
  };
}

export function namespaceLabel(namespace: DurableMemoryNamespaceRef): string {
  const label = `${namespace.scope}:${namespace.id}`;
  return namespace.parent ? `${namespaceLabel(namespace.parent)} / ${label}` : label;
}

function parseProvenance(value: unknown): DurableMemoryRecord["provenance"] {
  if (!isRecord(value)) {
    return { sourceKind: "system", actorType: "system", createdByAction: "unknown" };
  }
  const parsedActorType = actorType(value.actorType);
  const actorId = optionalString(value.actorId);
  const agentId = optionalString(value.agentId);
  const taskId = optionalString(value.taskId);
  const runId = optionalString(value.runId);
  const workflowRunId = optionalString(value.workflowRunId);
  const artifactId = optionalString(value.artifactId);
  const connectorId = optionalString(value.connectorId);
  const externalSourceUri = optionalString(value.externalSourceUri);
  const importJobId = optionalString(value.importJobId);
  const traceId = optionalString(value.traceId);
  return {
    sourceKind: sourceKind(value.sourceKind),
    ...(parsedActorType ? { actorType: parsedActorType } : {}),
    ...(actorId ? { actorId } : {}),
    ...(agentId ? { agentId } : {}),
    ...(taskId ? { taskId } : {}),
    ...(runId ? { runId } : {}),
    ...(workflowRunId ? { workflowRunId } : {}),
    ...(artifactId ? { artifactId } : {}),
    ...(connectorId ? { connectorId } : {}),
    ...(externalSourceUri ? { externalSourceUri } : {}),
    ...(importJobId ? { importJobId } : {}),
    createdByAction: stringValue(value.createdByAction, "unknown"),
    ...(traceId ? { traceId } : {}),
  };
}

function parseProviderMetadata(value: unknown): DurableMemoryCacheMetadata | undefined {
  if (!isRecord(value) || typeof value.providerId !== "string") {
    return undefined;
  }
  const providerRecordId = optionalString(value.providerRecordId);
  const revision = optionalString(value.revision);
  const etag = optionalString(value.etag);
  const fetchedAt = optionalString(value.fetchedAt);
  const staleAt = optionalString(value.staleAt);
  const expiresAt = optionalString(value.expiresAt);
  return {
    providerId: value.providerId,
    ...(providerRecordId ? { providerRecordId } : {}),
    ...(revision ? { revision } : {}),
    ...(etag ? { etag } : {}),
    syncStatus: syncStatus(value.syncStatus),
    operatorStatus: operatorStatus(value.operatorStatus),
    ...(fetchedAt ? { fetchedAt } : {}),
    ...(staleAt ? { staleAt } : {}),
    ...(expiresAt ? { expiresAt } : {}),
    ...(typeof value.localDevOnly === "boolean" ? { localDevOnly: value.localDevOnly } : {}),
  };
}

export function parseDurableMemoryRecord(value: unknown): DurableMemoryRecord {
  if (!isRecord(value) || typeof value.id !== "string") {
    throw new Error("Durable memory record payload is invalid.");
  }
  const summary = optionalString(value.summary);
  const provider = parseProviderMetadata(value.provider);
  const archivedAt = optionalString(value.archivedAt);
  const deletedAt = optionalString(value.deletedAt);
  return {
    id: value.id,
    namespace: parseDurableMemoryNamespace(value.namespace),
    provenance: parseProvenance(value.provenance),
    memoryType: stringValue(value.memoryType, "note"),
    body: stringValue(value.body),
    ...(summary ? { summary } : {}),
    sensitivity: sensitivity(value.sensitivity),
    status: recordStatus(value.status),
    createdAt: stringValue(value.createdAt, new Date(0).toISOString()),
    updatedAt: stringValue(value.updatedAt, new Date(0).toISOString()),
    ...(archivedAt ? { archivedAt } : {}),
    ...(deletedAt ? { deletedAt } : {}),
    ...(provider ? { provider } : {}),
  };
}

export function parseDurableMemoryProposal(value: unknown): DurableMemoryProposal {
  if (!isRecord(value) || typeof value.id !== "string") {
    throw new Error("Durable memory proposal payload is invalid.");
  }
  const reviewedAt = optionalString(value.reviewedAt);
  const reviewedBy = optionalString(value.reviewedBy);
  return {
    id: value.id,
    targetNamespace: parseDurableMemoryNamespace(value.targetNamespace),
    provenance: parseProvenance(value.provenance),
    memoryType: stringValue(value.memoryType, "note"),
    proposedBody: stringValue(value.proposedBody),
    reason: stringValue(value.reason),
    status: proposalStatus(value.status),
    createdAt: stringValue(value.createdAt, new Date(0).toISOString()),
    ...(reviewedAt ? { reviewedAt } : {}),
    ...(reviewedBy ? { reviewedBy } : {}),
  };
}

export function parseDurableMemorySnapshot(value: unknown): DurableMemorySnapshot {
  if (!isRecord(value) || typeof value.id !== "string") {
    throw new Error("Durable memory snapshot payload is invalid.");
  }
  return {
    id: value.id,
    namespace: parseDurableMemoryNamespace(value.namespace),
    provenance: parseProvenance(value.provenance),
    recordIds: stringArray(value.recordIds),
    createdAt: stringValue(value.createdAt, new Date(0).toISOString()),
    reason: stringValue(value.reason),
  };
}

export function parseDurableMemoryHealth(value: unknown): DurableMemoryProviderHealth {
  if (!isRecord(value) || typeof value.providerId !== "string") {
    throw new Error("Durable memory health payload is invalid.");
  }
  const message = optionalString(value.message);
  return {
    providerId: value.providerId,
    status: providerStatus(value.status),
    operatorStatus: operatorStatus(value.operatorStatus),
    checkedAt: stringValue(value.checkedAt, new Date(0).toISOString()),
    ...(message ? { message } : {}),
  };
}

export function parseDurableMemoryRecordListResult(value: unknown): DurableMemoryRecordListResult {
  if (!isRecord(value) || !Array.isArray(value.records)) {
    throw new Error("Durable memory record list payload is invalid.");
  }
  const nextCursor = optionalString(value.nextCursor);
  return {
    records: value.records.map(parseDurableMemoryRecord),
    ...(nextCursor ? { nextCursor } : {}),
  };
}

export function parseDurableMemorySearchResult(value: unknown): DurableMemorySearchResult {
  if (!isRecord(value) || !Array.isArray(value.records)) {
    throw new Error("Durable memory search payload is invalid.");
  }
  return {
    records: value.records.map(parseDurableMemoryRecord),
    total: typeof value.total === "number" ? value.total : value.records.length,
    operatorStatus: operatorStatus(value.operatorStatus),
  };
}

export function parseDurableMemoryProposals(value: unknown): DurableMemoryProposal[] {
  if (!Array.isArray(value)) {
    throw new Error("Durable memory proposal list payload is invalid.");
  }
  return value.map(parseDurableMemoryProposal);
}

export function parseDurableMemorySnapshotListResult(value: unknown): DurableMemorySnapshotListResult {
  if (!isRecord(value) || !Array.isArray(value.snapshots)) {
    throw new Error("Durable memory snapshot list payload is invalid.");
  }
  const nextCursor = optionalString(value.nextCursor);
  return {
    snapshots: value.snapshots.map(parseDurableMemorySnapshot),
    ...(nextCursor ? { nextCursor } : {}),
  };
}

export async function fetchDurableMemoryHealth(): Promise<DurableMemoryProviderHealth> {
  return parseDurableMemoryHealth(await apiClient.get<unknown>("/v1/durable-memory/health"));
}

export async function listDurableMemoryRecords(namespace: DurableMemoryNamespaceRef): Promise<DurableMemoryRecordListResult> {
  return parseDurableMemoryRecordListResult(
    await apiClient.post<unknown>("/v1/durable-memory/records/list", {
      namespace,
      includeDescendants: true,
      includeArchived: true,
      limit: 50,
    }),
  );
}

export async function searchDurableMemoryRecords(
  namespace: DurableMemoryNamespaceRef,
  query: string,
): Promise<DurableMemorySearchResult> {
  return parseDurableMemorySearchResult(
    await apiClient.post<unknown>("/v1/durable-memory/records/search", {
      namespace,
      query,
      includeDescendants: true,
      limit: 50,
    }),
  );
}

export async function listDurableMemoryProposals(namespace: DurableMemoryNamespaceRef): Promise<DurableMemoryProposal[]> {
  return parseDurableMemoryProposals(
    await apiClient.post<unknown>("/v1/durable-memory/proposals/list", {
      namespace,
      includeDescendants: true,
      includeArchived: true,
      limit: 50,
    }),
  );
}

export async function listDurableMemorySnapshots(namespace: DurableMemoryNamespaceRef): Promise<DurableMemorySnapshotListResult> {
  return parseDurableMemorySnapshotListResult(
    await apiClient.post<unknown>("/v1/durable-memory/snapshots/list", {
      namespace,
      includeDescendants: true,
      includeArchived: true,
      limit: 50,
    }),
  );
}

export async function fetchDurableMemoryInspector(
  namespace: DurableMemoryNamespaceRef,
  query: string,
): Promise<DurableMemoryInspectorSummary> {
  const [health, recordResult, proposals, snapshotResult] = await Promise.all([
    fetchDurableMemoryHealth(),
    query.trim().length > 0 ? searchDurableMemoryRecords(namespace, query.trim()) : listDurableMemoryRecords(namespace),
    listDurableMemoryProposals(namespace),
    listDurableMemorySnapshots(namespace),
  ]);
  return {
    health,
    records: recordResult.records,
    proposals,
    snapshots: snapshotResult.snapshots,
    operatorStatus: "operatorStatus" in recordResult ? recordResult.operatorStatus : health.operatorStatus,
    totalRecords: "total" in recordResult ? recordResult.total : recordResult.records.length,
  };
}
