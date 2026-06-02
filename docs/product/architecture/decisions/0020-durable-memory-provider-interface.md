<!-- AUDIENCE: Internal/Technical -->

# ADR 0020: Durable Memory Provider Interface

## Status

Accepted.

## Context

ADR 0019 defines durable memory as a first-class Team Orchestrator domain with a remote-capable source of truth, local-first ergonomics, explicit provenance, and provider-backed storage.

ADR 0019 intentionally accepted the service operation set without final TypeScript signatures. Before remote memory MVP work starts, the product needs concrete provider-facing request and response shapes so agents, task runs, workflow runs, authorization, artifact inspection, and console/API contracts can depend on the durable memory domain rather than one backend.

The current memory implementation remains local diagnostic behavior:

- `packages/core/src/shared/contracts/memory.ts` defines markdown/search-oriented `MemoryRecord` and `MemorySearchResult` types.
- `packages/core/src/memory/index.ts` exposes `MemoryManager` with `search` and `get` for local memory markdown and optional transcript indexing.
- `/api/v1/memory/search` and `/api/v1/memory/get` expose that diagnostic surface.
- `memory://...` artifact URIs are task-run artifact preview addresses, not durable memory ids.

Those existing surfaces must not change as part of this architecture story.

## Decision

Define a backend-neutral durable memory provider interface under the core package, separate from the current diagnostic `MemoryManager`.

The recommended implementation location is:

- `packages/core/src/memory/durable-provider.ts`

The package should export the provider types through the existing core memory barrel after implementation, but it should not replace current `MemoryManager`, `MemorySearchResult`, or `/api/v1/memory/*` behavior until a dedicated migration story does so.

The provider interface should be named `DurableMemoryProvider` and should model the ADR 0019 operation set:

```ts
export interface DurableMemoryProvider {
  writeMemory(request: DurableMemoryWriteRequest): Promise<DurableMemoryWriteResult>;
  proposeMemoryWrite(request: DurableMemoryProposalRequest): Promise<DurableMemoryProposalResult>;
  getMemory(request: DurableMemoryGetRequest): Promise<DurableMemoryGetResult>;
  searchMemory(request: DurableMemorySearchRequest): Promise<DurableMemorySearchResult>;
  listMemory(request: DurableMemoryListRequest): Promise<DurableMemoryListResult>;
  archiveMemory(request: DurableMemoryArchiveRequest): Promise<DurableMemoryMutationResult>;
  deleteMemory(request: DurableMemoryDeleteRequest): Promise<DurableMemoryMutationResult>;
  createSnapshot(request: DurableMemoryCreateSnapshotRequest): Promise<DurableMemorySnapshotResult>;
  listSnapshots(request: DurableMemoryListSnapshotsRequest): Promise<DurableMemoryListSnapshotsResult>;
  restoreSnapshot(request: DurableMemoryRestoreSnapshotRequest): Promise<DurableMemorySnapshotRestoreResult>;
}
```

## Stable Domain Types

The first interface implementation should include these stable domain shapes:

```ts
export type DurableMemoryProviderKind =
  | "local-sqlite"
  | "remote-http"
  | "semantic-vector"
  | "athena-memory-compatible";

export type DurableMemoryType =
  | "note"
  | "fact"
  | "preference"
  | "decision"
  | "summary"
  | "artifact-derived"
  | "run-derived"
  | "external-record";

export type DurableMemorySensitivity = "public" | "internal" | "private" | "secret-adjacent";

export type DurableMemoryWriteMode = "direct" | "proposal";

export type DurableMemoryMutationStatus = "applied" | "queued" | "rejected" | "not-found";
```

The stable provider record shape should be:

```ts
export interface DurableMemoryRecord {
  id: string;
  namespace: DurableMemoryNamespaceRef;
  type: DurableMemoryType;
  title: string;
  body?: string;
  payload?: unknown;
  tags: string[];
  source: DurableMemorySourceRef;
  sensitivity: DurableMemorySensitivity;
  retention: DurableMemoryRetentionPolicy;
  provenance: DurableMemoryProvenanceRef;
  createdAt: string;
  updatedAt: string;
  archivedAt?: string;
  embeddingStatus?: "not-indexed" | "pending" | "indexed" | "failed";
  provider?: {
    kind: DurableMemoryProviderKind;
    recordVersion?: string;
    etag?: string;
  };
}
```

The minimum request context should be:

```ts
export interface DurableMemoryRequestContext {
  operatorId?: string;
  workspaceId?: string;
  projectId?: string;
  repositoryId?: string;
  agentId?: string;
  taskId?: string;
  runId?: string;
  artifactId?: string;
  traceId?: string;
  requestedAt: string;
  reason?: string;
}
```

## Namespace And Provenance Placeholders

The provider interface should include namespace and provenance references now, but detailed semantics remain owned by `2026.34.03 Namespace And Provenance Model`.

For the first no-behavior-change interface implementation, use expandable references:

```ts
export interface DurableMemoryNamespaceRef {
  scope: "account" | "operator" | "workspace" | "project" | "repository" | "team" | "agent" | "task" | "run" | "artifact";
  id: string;
  parent?: DurableMemoryNamespaceRef;
}

export interface DurableMemorySourceRef {
  kind: "operator" | "agent" | "task-run" | "workflow-run" | "artifact" | "connector" | "import" | "system";
  uri?: string;
  label?: string;
}

export interface DurableMemoryProvenanceRef {
  actorType: "operator" | "agent" | "system";
  actorId?: string;
  agentId?: string;
  taskId?: string;
  runId?: string;
  workflowRunId?: string;
  artifactId?: string;
  repositoryId?: string;
  createdByAction?: string;
}
```

These fields are stable enough for provider interfaces and tests. They are not the final namespace semantics. The namespace/provenance story should decide required fields, hierarchy rules, cross-scope reads, audit/event mapping, and leak-prevention behavior.

## Request And Response Shapes

### Write Memory

```ts
export interface DurableMemoryWriteRequest {
  context: DurableMemoryRequestContext;
  namespace: DurableMemoryNamespaceRef;
  type: DurableMemoryType;
  title: string;
  body?: string;
  payload?: unknown;
  tags?: string[];
  source: DurableMemorySourceRef;
  sensitivity: DurableMemorySensitivity;
  retention?: Partial<DurableMemoryRetentionPolicy>;
  provenance: DurableMemoryProvenanceRef;
  idempotencyKey?: string;
  mode?: DurableMemoryWriteMode;
}

export interface DurableMemoryWriteResult {
  status: DurableMemoryMutationStatus;
  record?: DurableMemoryRecord;
  proposal?: DurableMemoryProposal;
  providerMetadata?: DurableMemoryProviderMetadata;
}
```

### Propose Memory Write

```ts
export interface DurableMemoryProposalRequest extends Omit<DurableMemoryWriteRequest, "mode"> {
  reviewReason?: string;
}

export interface DurableMemoryProposalResult {
  proposal: DurableMemoryProposal;
  providerMetadata?: DurableMemoryProviderMetadata;
}

export interface DurableMemoryProposal {
  id: string;
  status: "pending" | "approved" | "rejected" | "superseded";
  requestedRecord: Omit<DurableMemoryRecord, "id" | "createdAt" | "updatedAt">;
  requestedBy: DurableMemoryProvenanceRef;
  requestedAt: string;
  reviewReason?: string;
}
```

### Get Memory

```ts
export interface DurableMemoryGetRequest {
  context: DurableMemoryRequestContext;
  id: string;
  namespace?: DurableMemoryNamespaceRef;
}

export interface DurableMemoryGetResult {
  record?: DurableMemoryRecord;
  status: "found" | "not-found" | "forbidden" | "archived";
  providerMetadata?: DurableMemoryProviderMetadata;
}
```

### Search Memory

```ts
export interface DurableMemorySearchRequest {
  context: DurableMemoryRequestContext;
  query: string;
  namespaces?: DurableMemoryNamespaceRef[];
  types?: DurableMemoryType[];
  tags?: string[];
  sensitivity?: DurableMemorySensitivity[];
  includeArchived?: boolean;
  limit?: number;
  cursor?: string;
}

export interface DurableMemorySearchResult {
  items: DurableMemorySearchHit[];
  nextCursor?: string;
  providerMetadata?: DurableMemoryProviderMetadata;
}

export interface DurableMemorySearchHit {
  record: DurableMemoryRecord;
  score?: number;
  citation?: string;
  snippet?: string;
}
```

### List Memory

```ts
export interface DurableMemoryListRequest {
  context: DurableMemoryRequestContext;
  namespace: DurableMemoryNamespaceRef;
  types?: DurableMemoryType[];
  tags?: string[];
  includeArchived?: boolean;
  limit?: number;
  cursor?: string;
}

export interface DurableMemoryListResult {
  records: DurableMemoryRecord[];
  nextCursor?: string;
  providerMetadata?: DurableMemoryProviderMetadata;
}
```

### Archive And Delete Memory

```ts
export interface DurableMemoryArchiveRequest {
  context: DurableMemoryRequestContext;
  id: string;
  namespace?: DurableMemoryNamespaceRef;
  reason: string;
}

export interface DurableMemoryDeleteRequest {
  context: DurableMemoryRequestContext;
  id: string;
  namespace?: DurableMemoryNamespaceRef;
  reason: string;
  hardDelete?: boolean;
}

export interface DurableMemoryMutationResult {
  status: DurableMemoryMutationStatus;
  id: string;
  providerMetadata?: DurableMemoryProviderMetadata;
}
```

### Snapshots

```ts
export interface DurableMemoryCreateSnapshotRequest {
  context: DurableMemoryRequestContext;
  namespace: DurableMemoryNamespaceRef;
  label: string;
  description?: string;
}

export interface DurableMemorySnapshotResult {
  snapshot: DurableMemorySnapshot;
  providerMetadata?: DurableMemoryProviderMetadata;
}

export interface DurableMemoryListSnapshotsRequest {
  context: DurableMemoryRequestContext;
  namespace: DurableMemoryNamespaceRef;
  limit?: number;
  cursor?: string;
}

export interface DurableMemoryListSnapshotsResult {
  snapshots: DurableMemorySnapshot[];
  nextCursor?: string;
  providerMetadata?: DurableMemoryProviderMetadata;
}

export interface DurableMemoryRestoreSnapshotRequest {
  context: DurableMemoryRequestContext;
  snapshotId: string;
  namespace: DurableMemoryNamespaceRef;
  reason: string;
}

export interface DurableMemorySnapshotRestoreResult {
  status: "restored" | "queued" | "rejected" | "not-found";
  snapshotId: string;
  providerMetadata?: DurableMemoryProviderMetadata;
}

export interface DurableMemorySnapshot {
  id: string;
  namespace: DurableMemoryNamespaceRef;
  label: string;
  description?: string;
  createdAt: string;
  createdBy: DurableMemoryProvenanceRef;
  recordCount?: number;
}
```

### Shared Support Types

```ts
export interface DurableMemoryRetentionPolicy {
  policy: "default" | "retain" | "expire" | "archive-after";
  expiresAt?: string;
  archiveAfter?: string;
}

export interface DurableMemoryProviderMetadata {
  providerKind: DurableMemoryProviderKind;
  requestId?: string;
  cursor?: string;
  etag?: string;
  latencyMs?: number;
}
```

## Relationship To Current Memory Code

Do not replace current diagnostic memory types in the first implementation.

Current types remain local diagnostic contracts:

- `MemoryRecord`
- `MemorySearchResult`
- `MemorySearchOptions`
- `MemoryGetRequest`
- `MemoryGetResult`
- `MemoryManager`

The durable provider types should be additive. A later migration can build adapters:

- local diagnostic search can be wrapped behind `searchMemory` for development or compatibility,
- durable provider reads can power future memory-aware agents,
- existing `/api/v1/memory/search` and `/api/v1/memory/get` can either remain diagnostic routes or move behind versioned durable routes after explicit API design.

Until that migration, current routes and `memory://` artifact previews must behave exactly as they do now.

## Authorization Boundary

The provider interface is not the authorization layer.

Authorization and approval should live in services above the provider, similar to existing service authorization wrappers. Provider requests include `context` so authorization, audit, tracing, and backend diagnostics can correlate activity, but provider implementations should not silently grant agent access.

Follow-on permission work should map manifest-declared memory capabilities to:

- read/search memory
- propose memory write
- write approved memory
- archive/delete memory
- manage snapshots

## Alternatives Considered

### Keep Provider Contract Only In Prose

Rejected. Prose is not enough to prevent backend-specific assumptions from leaking into the first implementation.

### Add Backend-Specific Interfaces First

Rejected. Separate local SQLite and remote HTTP interfaces would force product services to know backend details too early.

### Reuse Current MemoryManager

Rejected. `MemoryManager` is a local diagnostic markdown/transcript search contract. It lacks write/proposal/list/archive/delete/snapshot operations, durable ids, namespaces, provenance, retention, sensitivity, and provider metadata.

### Define One Backend-Neutral Provider Interface

Accepted. This creates a stable product contract while allowing local, remote, semantic, and AthenaMemory-compatible adapters later.

## Consequences

The next no-behavior-change implementation can add TypeScript provider interfaces and compile-time tests without changing runtime behavior.

Remote memory MVP work can target `DurableMemoryProvider` rather than binding directly to HTTP or SQLite.

Namespace and provenance details remain intentionally incomplete until `2026.34.03`, but the interface has enough placeholders to avoid redesigning the provider boundary later.

Local cache behavior remains unresolved until `2026.34.04`.

Backend selection remains unresolved until `2026.34.05`.

## Follow-On Work

1. Implement the provider interface types additively under `packages/core/src/memory/durable-provider.ts`.
2. Export the types from the memory barrel and add type-focused tests or compile checks.
3. Do not wire the provider into runtime services until namespace/provenance and local-cache decisions are accepted.
4. Continue architecture refinement with `2026.34.03 Namespace And Provenance Model`.

## Validation

Architecture QA should confirm that this ADR:

- defines all ADR 0019 operations with concrete request and response shapes,
- keeps current diagnostic memory behavior unchanged,
- avoids choosing a backend,
- leaves namespace/provenance semantics and local-cache behavior to their dedicated stories,
- is concrete enough for a no-behavior-change TypeScript interface implementation.
