export const DURABLE_MEMORY_NAMESPACE_SCOPES = [
  "account",
  "operator",
  "workspace",
  "project",
  "repository",
  "team",
  "agent",
  "task",
  "run",
  "artifact"
] as const;

export type DurableMemoryNamespaceScope = (typeof DURABLE_MEMORY_NAMESPACE_SCOPES)[number];

export interface DurableMemoryNamespaceRef {
  scope: DurableMemoryNamespaceScope;
  id: string;
  parent?: DurableMemoryNamespaceRef;
}

export const DURABLE_MEMORY_SOURCE_KINDS = [
  "operator",
  "agent",
  "task-run",
  "workflow-run",
  "artifact",
  "connector",
  "import",
  "system"
] as const;

export type DurableMemorySourceKind = (typeof DURABLE_MEMORY_SOURCE_KINDS)[number];
export type DurableMemoryActorType = "operator" | "agent" | "system";
export type DurableMemorySensitivity = "public" | "internal" | "sensitive" | "secret-adjacent";

export interface DurableMemoryProvenanceRef {
  sourceKind: DurableMemorySourceKind;
  actorType?: DurableMemoryActorType;
  actorId?: string;
  agentId?: string;
  taskId?: string;
  runId?: string;
  workflowRunId?: string;
  artifactId?: string;
  connectorId?: string;
  externalSourceUri?: string;
  importJobId?: string;
  createdByAction: string;
  traceId?: string;
}

export type DurableMemoryRecordStatus = "active" | "archived" | "deleted";
export type DurableMemoryProposalStatus = "pending" | "approved" | "rejected" | "archived";
export type DurableMemoryProviderKind = "local-dev" | "server-mode" | "remote-http";
export type DurableMemoryProviderHealthStatus = "ok" | "degraded" | "unavailable" | "unauthorized" | "disabled";
export type DurableMemoryEmbeddingStatus = "not-indexed" | "queued" | "indexed" | "stale" | "failed" | "unsupported";
export type DurableMemoryRetrievalMode = "keyword" | "semantic" | "hybrid" | "auto";
export type DurableMemoryRetrievalEffectiveMode = "keyword" | "semantic" | "hybrid";
export type DurableMemoryRetrievalSignalKind = "keyword" | "semantic" | "metadata" | "recency" | "provenance";

export interface DurableMemoryEmbeddingMetadata {
  status: DurableMemoryEmbeddingStatus;
  providerId?: string;
  model?: string;
  modelVersion?: string;
  backendKind?: string;
  indexRevision?: string;
  indexedAt?: string;
  failureCode?: string;
  failureReason?: string;
  reindexReason?: string;
}

export const DURABLE_MEMORY_OPERATOR_VISIBLE_STATUSES = [
  "remote-current",
  "remote-unavailable",
  "cache-current",
  "cache-stale",
  "queued-intent",
  "conflict-review-required",
  "local-dev-only",
  "diagnostic-only"
] as const;

export type DurableMemoryOperatorVisibleStatus = (typeof DURABLE_MEMORY_OPERATOR_VISIBLE_STATUSES)[number];

export const DURABLE_MEMORY_SYNC_STATUSES = [
  "not-cached",
  "cache-current",
  "cache-stale",
  "offline",
  "queued-intent",
  "replaying",
  "conflict-review-required",
  "local-dev-only"
] as const;

export type DurableMemorySyncStatus = (typeof DURABLE_MEMORY_SYNC_STATUSES)[number];

export interface DurableMemoryCacheMetadata {
  providerId: string;
  providerRecordId?: string;
  revision?: string;
  etag?: string;
  syncStatus: DurableMemorySyncStatus;
  operatorStatus: DurableMemoryOperatorVisibleStatus;
  fetchedAt?: string;
  staleAt?: string;
  expiresAt?: string;
  localDevOnly?: boolean;
}

export interface DurableMemoryRecord {
  id: string;
  namespace: DurableMemoryNamespaceRef;
  provenance: DurableMemoryProvenanceRef;
  memoryType: string;
  body: string;
  summary?: string;
  sensitivity: DurableMemorySensitivity;
  status: DurableMemoryRecordStatus;
  createdAt: string;
  updatedAt: string;
  archivedAt?: string;
  deletedAt?: string;
  provider?: DurableMemoryCacheMetadata;
  embedding?: DurableMemoryEmbeddingMetadata;
}

export interface DurableMemoryProposal {
  id: string;
  targetNamespace: DurableMemoryNamespaceRef;
  provenance: DurableMemoryProvenanceRef;
  memoryType: string;
  proposedBody: string;
  reason: string;
  status: DurableMemoryProposalStatus;
  createdAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
}

export interface DurableMemorySnapshot {
  id: string;
  namespace: DurableMemoryNamespaceRef;
  provenance: DurableMemoryProvenanceRef;
  recordIds: string[];
  createdAt: string;
  reason: string;
}

export interface DurableMemoryProviderConfig {
  id: string;
  kind: DurableMemoryProviderKind;
  label: string;
  baseUrl?: string;
  tokenRef?: {
    kind: "env" | "local-file";
    name: string;
  };
  cacheMode?: "disabled" | "read-through" | "read-through-write-queue";
  localDevOnly?: boolean;
}

export interface DurableMemoryProviderHealth {
  providerId: string;
  status: DurableMemoryProviderHealthStatus;
  operatorStatus: DurableMemoryOperatorVisibleStatus;
  checkedAt: string;
  message?: string;
}

export interface DurableMemoryListRequest {
  namespace: DurableMemoryNamespaceRef;
  includeDescendants?: boolean;
  includeArchived?: boolean;
  limit?: number;
  cursor?: string;
}

export interface DurableMemorySearchRequest {
  namespace: DurableMemoryNamespaceRef;
  query: string;
  includeDescendants?: boolean;
  limit?: number;
  mode?: DurableMemoryRetrievalMode;
}

export interface DurableMemoryWriteRequest {
  namespace: DurableMemoryNamespaceRef;
  provenance: DurableMemoryProvenanceRef;
  memoryType: string;
  body: string;
  sensitivity?: DurableMemorySensitivity;
  reason?: string;
  embedding?: DurableMemoryEmbeddingMetadata;
}

export interface DurableMemoryGetRequest {
  id: string;
  namespace?: DurableMemoryNamespaceRef;
}

export interface DurableMemoryArchiveRequest {
  id: string;
  namespace: DurableMemoryNamespaceRef;
  provenance: DurableMemoryProvenanceRef;
  reason: string;
}

export interface DurableMemoryDeleteRequest {
  id: string;
  namespace: DurableMemoryNamespaceRef;
  provenance: DurableMemoryProvenanceRef;
  reason: string;
  hardDelete?: boolean;
}

export interface DurableMemoryProposalCreateRequest {
  targetNamespace: DurableMemoryNamespaceRef;
  provenance: DurableMemoryProvenanceRef;
  memoryType: string;
  proposedBody: string;
  reason: string;
}

export interface DurableMemoryProposalReviewRequest {
  id: string;
  actorId: string;
  reason: string;
  editedProposedBody?: string;
}

export interface DurableMemorySnapshotCreateRequest {
  namespace: DurableMemoryNamespaceRef;
  provenance: DurableMemoryProvenanceRef;
  reason: string;
}

export interface DurableMemorySnapshotRestoreRequest {
  id: string;
  targetNamespace: DurableMemoryNamespaceRef;
  provenance: DurableMemoryProvenanceRef;
  reason: string;
}

export interface DurableMemoryRecordListResult {
  records: DurableMemoryRecord[];
  nextCursor?: string;
}

export interface DurableMemorySearchResult {
  records: DurableMemoryRecord[];
  total: number;
  operatorStatus: DurableMemoryOperatorVisibleStatus;
  matches?: DurableMemorySearchMatch[];
  diagnostics?: DurableMemoryRetrievalDiagnostics;
}

export interface DurableMemorySearchMatch {
  recordId: string;
  score: number;
  signals: DurableMemoryRetrievalSignal[];
  snippet?: string;
}

export interface DurableMemoryRetrievalSignal {
  kind: DurableMemoryRetrievalSignalKind;
  score: number;
  evidence?: string;
}

export interface DurableMemoryRetrievalDiagnostics {
  requestedMode: DurableMemoryRetrievalMode;
  effectiveMode: DurableMemoryRetrievalEffectiveMode;
  degraded: boolean;
  degradationReasons: string[];
  providerCapabilities: {
    keyword: boolean;
    semantic: boolean;
    hybrid: boolean;
  };
  omitted: Array<{
    category: string;
    count: number;
  }>;
}

export interface DurableMemorySnapshotListResult {
  snapshots: DurableMemorySnapshot[];
  nextCursor?: string;
}

export interface DurableMemoryProvider {
  write(request: DurableMemoryWriteRequest): Promise<DurableMemoryRecord>;
  get(request: DurableMemoryGetRequest): Promise<DurableMemoryRecord | undefined>;
  list(request: DurableMemoryListRequest): Promise<DurableMemoryRecordListResult>;
  search(request: DurableMemorySearchRequest): Promise<DurableMemorySearchResult>;
  createProposal(request: DurableMemoryProposalCreateRequest): Promise<DurableMemoryProposal>;
  approveProposal(request: DurableMemoryProposalReviewRequest): Promise<DurableMemoryProposal>;
  rejectProposal(request: DurableMemoryProposalReviewRequest): Promise<DurableMemoryProposal>;
  archive(request: DurableMemoryArchiveRequest): Promise<DurableMemoryRecord>;
  delete(request: DurableMemoryDeleteRequest): Promise<DurableMemoryRecord>;
  createSnapshot(request: DurableMemorySnapshotCreateRequest): Promise<DurableMemorySnapshot>;
  listSnapshots(namespace: DurableMemoryNamespaceRef): Promise<DurableMemorySnapshotListResult>;
  restoreSnapshot(request: DurableMemorySnapshotRestoreRequest): Promise<DurableMemorySnapshot>;
  getHealth(): Promise<DurableMemoryProviderHealth>;
}

export interface DurableMemoryValidationResult {
  ok: boolean;
  errors: string[];
}

export type DurableMemoryMutationOperation =
  | "write"
  | "cross-scope-write"
  | "proposal-create"
  | "proposal-approve"
  | "proposal-reject"
  | "proposal-archive"
  | "archive"
  | "delete"
  | "snapshot-create"
  | "snapshot-restore"
  | "promotion";

const VALID_NAMESPACE_SCOPES = new Set<string>(DURABLE_MEMORY_NAMESPACE_SCOPES);
const VALID_SOURCE_KINDS = new Set<string>(DURABLE_MEMORY_SOURCE_KINDS);

const ALLOWED_PARENT_SCOPES: Record<DurableMemoryNamespaceScope, DurableMemoryNamespaceScope[]> = {
  account: [],
  operator: ["account"],
  workspace: ["account", "operator"],
  project: ["workspace"],
  repository: ["workspace", "project"],
  team: ["account", "workspace", "project"],
  agent: ["workspace", "project", "repository", "team"],
  task: ["repository", "project", "workspace", "team"],
  run: ["task", "repository", "project", "workspace"],
  artifact: ["run"]
};

export function validateDurableMemoryNamespace(namespace: unknown): DurableMemoryValidationResult {
  const errors: string[] = [];
  validateNamespaceNode(namespace, "namespace", errors, new Set<string>());
  return toValidationResult(errors);
}

export function assertDurableMemoryNamespace(namespace: DurableMemoryNamespaceRef): DurableMemoryNamespaceRef {
  const result = validateDurableMemoryNamespace(namespace);
  if (!result.ok) {
    throw new Error(result.errors.join("; "));
  }
  return namespace;
}

function validateNamespaceNode(
  namespace: unknown,
  path: string,
  errors: string[],
  seen: Set<string>
): void {
  if (!namespace || typeof namespace !== "object") {
    errors.push(`${path} is required`);
    return;
  }
  const node = namespace as Partial<DurableMemoryNamespaceRef>;
  if (!VALID_NAMESPACE_SCOPES.has(String(node.scope))) {
    errors.push(`${path}.scope must be one of ${DURABLE_MEMORY_NAMESPACE_SCOPES.join(", ")}`);
    return;
  }
  if (!isNonEmptyString(node.id)) {
    errors.push(`${path}.id is required`);
  }

  const scope = node.scope as DurableMemoryNamespaceScope;
  const key = `${scope}:${node.id}`;
  if (seen.has(key)) {
    errors.push(`${path} must not contain a parent cycle`);
    return;
  }
  seen.add(key);

  if (!node.parent) {
    return;
  }
  const parent = node.parent as Partial<DurableMemoryNamespaceRef>;
  const allowedParents = ALLOWED_PARENT_SCOPES[scope];
  if (!allowedParents.includes(parent.scope as DurableMemoryNamespaceScope)) {
    errors.push(`${path}.parent.scope cannot be ${String(parent.scope)} for ${scope}`);
  }
  validateNamespaceNode(node.parent, `${path}.parent`, errors, seen);
}

export function validateDurableMemoryProvenance(provenance: unknown): DurableMemoryValidationResult {
  const errors: string[] = [];
  if (!provenance || typeof provenance !== "object") {
    return toValidationResult(["provenance is required"]);
  }
  const ref = provenance as Partial<DurableMemoryProvenanceRef>;
  if (!VALID_SOURCE_KINDS.has(String(ref.sourceKind))) {
    errors.push(`provenance.sourceKind must be one of ${DURABLE_MEMORY_SOURCE_KINDS.join(", ")}`);
    return toValidationResult(errors);
  }
  if (!isNonEmptyString(ref.createdByAction)) {
    errors.push("provenance.createdByAction is required");
  }

  switch (ref.sourceKind) {
    case "operator":
      requireField(ref.actorType === "operator" ? ref.actorType : undefined, "provenance.actorType", errors);
      requireField(ref.actorId, "provenance.actorId", errors);
      break;
    case "agent":
      requireField(ref.actorType === "agent" ? ref.actorType : undefined, "provenance.actorType", errors);
      requireField(ref.agentId, "provenance.agentId", errors);
      if (!isNonEmptyString(ref.runId) && !isNonEmptyString(ref.taskId)) {
        errors.push("provenance.runId or provenance.taskId is required for agent memory");
      }
      break;
    case "task-run":
      requireField(ref.taskId, "provenance.taskId", errors);
      requireField(ref.runId, "provenance.runId", errors);
      break;
    case "workflow-run":
      requireField(ref.workflowRunId, "provenance.workflowRunId", errors);
      break;
    case "artifact":
      requireField(ref.artifactId, "provenance.artifactId", errors);
      requireField(ref.runId, "provenance.runId", errors);
      break;
    case "connector":
      requireField(ref.connectorId, "provenance.connectorId", errors);
      requireField(ref.externalSourceUri, "provenance.externalSourceUri", errors);
      break;
    case "import":
      if (!isNonEmptyString(ref.importJobId) && !isNonEmptyString(ref.externalSourceUri)) {
        errors.push("provenance.importJobId or provenance.externalSourceUri is required for import memory");
      }
      if (!isNonEmptyString(ref.actorId) && ref.actorType !== "system") {
        errors.push("provenance.actorId or provenance.actorType=system is required for import memory");
      }
      break;
    case "system":
      requireField(ref.actorType === "system" ? ref.actorType : undefined, "provenance.actorType", errors);
      break;
  }

  return toValidationResult(errors);
}

export function assertDurableMemoryProvenance(provenance: DurableMemoryProvenanceRef): DurableMemoryProvenanceRef {
  const result = validateDurableMemoryProvenance(provenance);
  if (!result.ok) {
    throw new Error(result.errors.join("; "));
  }
  return provenance;
}

export function validateDurableMemoryMutationReason(input: {
  operation: DurableMemoryMutationOperation;
  reason?: string;
}): DurableMemoryValidationResult {
  const reasonRequired = new Set<DurableMemoryMutationOperation>([
    "cross-scope-write",
    "proposal-create",
    "proposal-approve",
    "proposal-reject",
    "archive",
    "delete",
    "snapshot-create",
    "snapshot-restore",
    "promotion"
  ]);
  const errors = reasonRequired.has(input.operation) && !isNonEmptyString(input.reason) ? [`${input.operation}.reason is required`] : [];
  return toValidationResult(errors);
}

const FORBIDDEN_EVENT_PAYLOAD_KEYS = new Set([
  "memorybody",
  "body",
  "structuredpayload",
  "transcriptbody",
  "rawtranscript",
  "artifactpayload",
  "rawartifactpayload",
  "connectorsecret",
  "providercredentials",
  "credentials",
  "apikey",
  "api_key",
  "secret"
]);

export function validateDurableMemoryEventPayload(payload: Record<string, unknown>): DurableMemoryValidationResult {
  const errors: string[] = [];
  visitPayloadKeys(payload, "event.payload", errors);
  return toValidationResult(errors);
}

function visitPayloadKeys(value: unknown, path: string, errors: string[]): void {
  if (!value || typeof value !== "object") {
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((entry, index) => visitPayloadKeys(entry, `${path}[${index}]`, errors));
    return;
  }
  for (const [key, child] of Object.entries(value)) {
    if (FORBIDDEN_EVENT_PAYLOAD_KEYS.has(normalizeKey(key))) {
      errors.push(`${path}.${key} must not include memory bodies, raw payloads, transcripts, secrets, or credentials`);
    }
    visitPayloadKeys(child, `${path}.${key}`, errors);
  }
}

function normalizeKey(key: string): string {
  return key.replace(/[-_\s]/g, "").toLowerCase();
}

function requireField(value: string | undefined, path: string, errors: string[]): void {
  if (!isNonEmptyString(value)) {
    errors.push(`${path} is required`);
  }
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function toValidationResult(errors: string[]): DurableMemoryValidationResult {
  return {
    ok: errors.length === 0,
    errors
  };
}
