export type DurableMemoryNamespaceScope =
  | "account"
  | "operator"
  | "workspace"
  | "project"
  | "repository"
  | "team"
  | "agent"
  | "task"
  | "run"
  | "artifact";

export type DurableMemoryNamespaceRef = {
  scope: DurableMemoryNamespaceScope;
  id: string;
  parent?: DurableMemoryNamespaceRef;
};

export type DurableMemorySourceKind =
  | "operator"
  | "agent"
  | "task-run"
  | "workflow-run"
  | "artifact"
  | "connector"
  | "import"
  | "system";

export type DurableMemoryActorType = "operator" | "agent" | "system";
export type DurableMemorySensitivity = "public" | "internal" | "sensitive" | "secret-adjacent";
export type DurableMemoryRecordStatus = "active" | "archived" | "deleted";
export type DurableMemoryProposalStatus = "pending" | "approved" | "rejected";
export type DurableMemoryProviderHealthStatus = "ok" | "degraded" | "unavailable" | "unauthorized" | "disabled";
export type DurableMemoryOperatorStatus =
  | "remote-current"
  | "remote-unavailable"
  | "cache-current"
  | "cache-stale"
  | "queued-intent"
  | "conflict-review-required"
  | "local-dev-only"
  | "diagnostic-only";
export type DurableMemorySyncStatus =
  | "not-cached"
  | "cache-current"
  | "cache-stale"
  | "offline"
  | "queued-intent"
  | "replaying"
  | "conflict-review-required"
  | "local-dev-only";

export type DurableMemoryProvenanceRef = {
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
};

export type DurableMemoryCacheMetadata = {
  providerId: string;
  providerRecordId?: string;
  revision?: string;
  etag?: string;
  syncStatus: DurableMemorySyncStatus;
  operatorStatus: DurableMemoryOperatorStatus;
  fetchedAt?: string;
  staleAt?: string;
  expiresAt?: string;
  localDevOnly?: boolean;
};

export type DurableMemoryRecord = {
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
};

export type DurableMemoryProposal = {
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
};

export type DurableMemorySnapshot = {
  id: string;
  namespace: DurableMemoryNamespaceRef;
  provenance: DurableMemoryProvenanceRef;
  recordIds: string[];
  createdAt: string;
  reason: string;
};

export type DurableMemoryProviderHealth = {
  providerId: string;
  status: DurableMemoryProviderHealthStatus;
  operatorStatus: DurableMemoryOperatorStatus;
  checkedAt: string;
  message?: string;
};

export type DurableMemoryRecordListResult = {
  records: DurableMemoryRecord[];
  nextCursor?: string;
};

export type DurableMemorySearchResult = {
  records: DurableMemoryRecord[];
  total: number;
  operatorStatus: DurableMemoryOperatorStatus;
};

export type DurableMemorySnapshotListResult = {
  snapshots: DurableMemorySnapshot[];
  nextCursor?: string;
};

export type DurableMemoryInspectorSummary = {
  health: DurableMemoryProviderHealth;
  records: DurableMemoryRecord[];
  proposals: DurableMemoryProposal[];
  snapshots: DurableMemorySnapshot[];
  operatorStatus: DurableMemoryOperatorStatus;
  totalRecords: number;
};
