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
export type DurableMemoryProposalStatus = "pending" | "approved" | "rejected" | "archived";
export type DurableMemoryProviderHealthStatus = "ok" | "degraded" | "unavailable" | "unauthorized" | "disabled";
export type DurableMemoryEmbeddingStatus = "not-indexed" | "queued" | "indexed" | "stale" | "failed" | "unsupported";
export type DurableMemoryRetrievalMode = "keyword" | "semantic" | "hybrid" | "auto";
export type DurableMemoryRetrievalEffectiveMode = "keyword" | "semantic" | "hybrid";
export type DurableMemoryRetrievalSignalKind = "keyword" | "semantic" | "metadata" | "recency" | "provenance";
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

export type DurableMemoryEmbeddingMetadata = {
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
  embedding?: DurableMemoryEmbeddingMetadata;
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
  matches?: DurableMemorySearchMatch[];
  diagnostics?: DurableMemoryRetrievalDiagnostics;
};

export type DurableMemorySearchMatch = {
  recordId: string;
  score: number;
  signals: DurableMemoryRetrievalSignal[];
  snippet?: string;
};

export type DurableMemoryRetrievalSignal = {
  kind: DurableMemoryRetrievalSignalKind;
  score: number;
  evidence?: string;
};

export type DurableMemoryRetrievalDiagnostics = {
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
  diagnostics?: DurableMemoryRetrievalDiagnostics;
  matches?: DurableMemorySearchMatch[];
};
