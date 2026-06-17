import type Database from "better-sqlite3";
import type {
  DurableMemoryArchiveRequest,
  DurableMemoryCacheMetadata,
  DurableMemoryDeleteRequest,
  DurableMemoryEmbeddingMetadata,
  DurableMemoryListRequest,
  DurableMemoryNamespaceRef,
  DurableMemoryProposal,
  DurableMemoryProposalCreateRequest,
  DurableMemoryProposalStatus,
  DurableMemoryProvenanceRef,
  DurableMemoryRecord,
  DurableMemoryRecordListResult,
  DurableMemoryRecordStatus,
  DurableMemoryRetrievalDiagnostics,
  DurableMemoryRetrievalEffectiveMode,
  DurableMemoryRetrievalMode,
  DurableMemorySearchMatch,
  DurableMemoryRetrievalSignal,
  DurableMemorySearchRequest,
  DurableMemorySearchResult,
  DurableMemorySensitivity,
  DurableMemorySnapshot,
  DurableMemorySnapshotCreateRequest,
  DurableMemorySnapshotListResult,
  DurableMemorySnapshotRestoreRequest,
  DurableMemoryWriteRequest
} from "../shared/contracts/durable-memory.js";

export interface DurableMemoryServerStorage {
  writeRecord(input: DurableMemoryServerRecordWriteInput): DurableMemoryRecord;
  refreshRecordCache(input: DurableMemoryServerCacheRefreshInput): DurableMemoryRecord | undefined;
  invalidateRecordCache(input: DurableMemoryServerCacheInvalidationInput): DurableMemoryRecord | undefined;
  getRecord(id: string): DurableMemoryRecord | undefined;
  listRecords(request: DurableMemoryListRequest): DurableMemoryRecordListResult;
  searchRecords(request: DurableMemorySearchRequest): DurableMemorySearchResult;
  archiveRecord(request: DurableMemoryArchiveRequest): DurableMemoryRecord | undefined;
  deleteRecord(request: DurableMemoryDeleteRequest): DurableMemoryRecord | undefined;
  createProposal(request: DurableMemoryServerProposalCreateInput): DurableMemoryProposal;
  getProposal(id: string): DurableMemoryProposal | undefined;
  listProposals(namespace: DurableMemoryNamespaceRef): DurableMemoryProposal[];
  updateProposalStatus(id: string, status: DurableMemoryProposalStatus, reviewedBy: string, now?: Date): DurableMemoryProposal | undefined;
  createSnapshot(request: DurableMemoryServerSnapshotCreateInput): DurableMemorySnapshot;
  getSnapshot(id: string): DurableMemorySnapshot | undefined;
  listSnapshots(namespace: DurableMemoryNamespaceRef): DurableMemorySnapshotListResult;
  restoreSnapshot(request: DurableMemorySnapshotRestoreRequest): DurableMemorySnapshot | undefined;
}

export interface DurableMemoryServerRecordWriteInput extends DurableMemoryWriteRequest {
  id: string;
  summary?: string;
  provider?: DurableMemoryCacheMetadata;
  embedding?: DurableMemoryEmbeddingMetadata;
  now?: Date;
}

export interface DurableMemoryServerCacheRefreshInput {
  id: string;
  namespace: DurableMemoryNamespaceRef;
  provider: DurableMemoryCacheMetadata;
  now?: Date;
}

export interface DurableMemoryServerCacheInvalidationInput {
  id: string;
  namespace: DurableMemoryNamespaceRef;
  reason: "provider-unavailable" | "provider-config-changed" | "namespace-permission-changed" | "snapshot-restored" | "record-mutated" | "revision-mismatch";
  now?: Date;
}

export interface DurableMemoryServerProposalCreateInput extends DurableMemoryProposalCreateRequest {
  id: string;
  now?: Date;
}

export interface DurableMemoryServerSnapshotCreateInput extends DurableMemorySnapshotCreateRequest {
  id: string;
  recordIds?: string[];
  now?: Date;
}

interface DurableMemoryRecordRow {
  id: string;
  namespace_scope: string;
  namespace_id: string;
  workspace_id: string;
  namespace_json: string;
  namespace_ancestors_json: string;
  provenance_json: string;
  source_kind: string;
  memory_type: string;
  body: string;
  summary: string | null;
  sensitivity: DurableMemorySensitivity;
  status: DurableMemoryRecordStatus;
  provider_json: string | null;
  embedding_json: string | null;
  revision: string;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
  deleted_at: string | null;
}

interface DurableMemoryProposalRow {
  id: string;
  target_namespace_scope: string;
  target_namespace_id: string;
  target_workspace_id: string;
  target_namespace_json: string;
  target_namespace_ancestors_json: string;
  provenance_json: string;
  source_kind: string;
  memory_type: string;
  proposed_body: string;
  reason: string;
  evidence: string | null;
  status: DurableMemoryProposalStatus;
  created_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
}

interface DurableMemorySnapshotRow {
  id: string;
  namespace_scope: string;
  namespace_id: string;
  workspace_id: string;
  namespace_json: string;
  namespace_ancestors_json: string;
  provenance_json: string;
  source_kind: string;
  record_ids_json: string;
  reason: string;
  created_at: string;
}

export function ensureDurableMemoryServerStorageSchema(db: Database.Database): void {
  db.exec(`
    create table if not exists durable_memory_records (
      id text primary key,
      namespace_scope text not null,
      namespace_id text not null,
      workspace_id text not null default 'default',
      namespace_json text not null,
      namespace_ancestors_json text not null default '[]',
      provenance_json text not null,
      source_kind text not null,
      memory_type text not null,
      body text not null,
      summary text,
      sensitivity text not null,
      status text not null,
      provider_json text,
      embedding_json text,
      revision text not null,
      created_at text not null,
      updated_at text not null,
      archived_at text,
      deleted_at text
    );

    create index if not exists durable_memory_records_namespace_idx
      on durable_memory_records(namespace_scope, namespace_id, status, updated_at);

    create index if not exists durable_memory_records_source_kind_idx
      on durable_memory_records(source_kind);

    create table if not exists durable_memory_proposals (
      id text primary key,
      target_namespace_scope text not null,
      target_namespace_id text not null,
      target_workspace_id text not null default 'default',
      target_namespace_json text not null,
      target_namespace_ancestors_json text not null default '[]',
      provenance_json text not null,
      source_kind text not null,
      memory_type text not null,
      proposed_body text not null,
      reason text not null,
      evidence text,
      status text not null,
      created_at text not null,
      reviewed_at text,
      reviewed_by text
    );

    create index if not exists durable_memory_proposals_namespace_idx
      on durable_memory_proposals(target_namespace_scope, target_namespace_id, status, created_at);

    create table if not exists durable_memory_snapshots (
      id text primary key,
      namespace_scope text not null,
      namespace_id text not null,
      workspace_id text not null default 'default',
      namespace_json text not null,
      namespace_ancestors_json text not null default '[]',
      provenance_json text not null,
      source_kind text not null,
      record_ids_json text not null,
      reason text not null,
      created_at text not null
    );

    create index if not exists durable_memory_snapshots_namespace_idx
      on durable_memory_snapshots(namespace_scope, namespace_id, created_at);
  `);
  ensureColumn(db, "durable_memory_records", "embedding_json", "text");
  ensureColumn(db, "durable_memory_proposals", "evidence", "text");
  ensureColumn(db, "durable_memory_records", "workspace_id", "text not null default 'default'");
  ensureColumn(db, "durable_memory_proposals", "target_workspace_id", "text not null default 'default'");
  ensureColumn(db, "durable_memory_snapshots", "workspace_id", "text not null default 'default'");
  db.exec(`
    create index if not exists durable_memory_records_workspace_idx
      on durable_memory_records(workspace_id, status, updated_at);
    create index if not exists durable_memory_proposals_workspace_idx
      on durable_memory_proposals(target_workspace_id, status, created_at);
    create index if not exists durable_memory_snapshots_workspace_idx
      on durable_memory_snapshots(workspace_id, created_at);
  `);
}

export class SqliteDurableMemoryServerStorage implements DurableMemoryServerStorage {
  private readonly insertRecordStatement: Database.Statement;
  private readonly getRecordStatement: Database.Statement;
  private readonly updateRecordProviderStatement: Database.Statement;
  private readonly updateRecordStatusStatement: Database.Statement;
  private readonly listRecordStatement: Database.Statement;
  private readonly listAllRecordsStatement: Database.Statement;
  private readonly insertProposalStatement: Database.Statement;
  private readonly getProposalStatement: Database.Statement;
  private readonly updateProposalStatusStatement: Database.Statement;
  private readonly listProposalStatement: Database.Statement;
  private readonly insertSnapshotStatement: Database.Statement;
  private readonly getSnapshotStatement: Database.Statement;
  private readonly listSnapshotStatement: Database.Statement;

  constructor(private readonly db: Database.Database) {
    ensureDurableMemoryServerStorageSchema(db);
    this.insertRecordStatement = db.prepare(`
      insert into durable_memory_records (
        id,
        namespace_scope,
        namespace_id,
        workspace_id,
        namespace_json,
        namespace_ancestors_json,
        provenance_json,
        source_kind,
        memory_type,
        body,
        summary,
        sensitivity,
        status,
        provider_json,
        embedding_json,
        revision,
        created_at,
        updated_at,
        archived_at,
        deleted_at
      )
      values (
        @id,
        @namespaceScope,
        @namespaceId,
        @workspaceId,
        @namespaceJson,
        @namespaceAncestorsJson,
        @provenanceJson,
        @sourceKind,
        @memoryType,
        @body,
        @summary,
        @sensitivity,
        @status,
        @providerJson,
        @embeddingJson,
        @revision,
        @createdAt,
        @updatedAt,
        @archivedAt,
        @deletedAt
      )
    `);
    this.getRecordStatement = db.prepare(recordSelectSql("where id = ?"));
    this.updateRecordProviderStatement = db.prepare(`
      update durable_memory_records set
        provider_json = @providerJson,
        revision = @revision,
        updated_at = @updatedAt
      where id = @id
    `);
    this.updateRecordStatusStatement = db.prepare(`
      update durable_memory_records set
        status = @status,
        revision = @revision,
        updated_at = @updatedAt,
        archived_at = @archivedAt,
        deleted_at = @deletedAt
      where id = @id
    `);
    this.listRecordStatement = db.prepare(recordSelectSql("order by updated_at desc, created_at desc, id asc"));
    this.listAllRecordsStatement = db.prepare(recordSelectSql("where status != 'deleted' order by updated_at desc, created_at desc, id asc"));
    this.insertProposalStatement = db.prepare(`
      insert into durable_memory_proposals (
        id,
        target_namespace_scope,
        target_namespace_id,
        target_workspace_id,
        target_namespace_json,
        target_namespace_ancestors_json,
        provenance_json,
        source_kind,
        memory_type,
        proposed_body,
        reason,
        evidence,
        status,
        created_at,
        reviewed_at,
        reviewed_by
      )
      values (
        @id,
        @targetNamespaceScope,
        @targetNamespaceId,
        @targetWorkspaceId,
        @targetNamespaceJson,
        @targetNamespaceAncestorsJson,
        @provenanceJson,
        @sourceKind,
        @memoryType,
        @proposedBody,
        @reason,
        @evidence,
        @status,
        @createdAt,
        @reviewedAt,
        @reviewedBy
      )
    `);
    this.getProposalStatement = db.prepare(proposalSelectSql("where id = ?"));
    this.updateProposalStatusStatement = db.prepare(`
      update durable_memory_proposals set
        status = @status,
        reviewed_at = @reviewedAt,
        reviewed_by = @reviewedBy
      where id = @id
    `);
    this.listProposalStatement = db.prepare(proposalSelectSql("order by created_at desc, id asc"));
    this.insertSnapshotStatement = db.prepare(`
      insert into durable_memory_snapshots (
        id,
        namespace_scope,
        namespace_id,
        workspace_id,
        namespace_json,
        namespace_ancestors_json,
        provenance_json,
        source_kind,
        record_ids_json,
        reason,
        created_at
      )
      values (
        @id,
        @namespaceScope,
        @namespaceId,
        @workspaceId,
        @namespaceJson,
        @namespaceAncestorsJson,
        @provenanceJson,
        @sourceKind,
        @recordIdsJson,
        @reason,
        @createdAt
      )
    `);
    this.getSnapshotStatement = db.prepare(snapshotSelectSql("where id = ?"));
    this.listSnapshotStatement = db.prepare(snapshotSelectSql("order by created_at desc, id asc"));
  }

  writeRecord(input: DurableMemoryServerRecordWriteInput): DurableMemoryRecord {
    const now = (input.now ?? new Date()).toISOString();
    const namespaceParts = toNamespaceStorageParts(input.namespace);
    const provider = input.provider ?? {
      providerId: "server-mode",
      providerRecordId: input.id,
      revision: "1",
      syncStatus: "not-cached",
      operatorStatus: "remote-current"
    };
    this.insertRecordStatement.run({
      id: input.id,
      namespaceScope: input.namespace.scope,
      namespaceId: input.namespace.id,
      workspaceId: namespaceParts.workspaceId,
      namespaceJson: JSON.stringify(input.namespace),
      namespaceAncestorsJson: JSON.stringify(namespaceParts.ancestorKeys),
      provenanceJson: JSON.stringify(input.provenance),
      sourceKind: input.provenance.sourceKind,
      memoryType: input.memoryType,
      body: input.body,
      summary: input.summary ?? null,
      sensitivity: input.sensitivity ?? "internal",
      status: "active",
      providerJson: JSON.stringify(provider),
      embeddingJson: input.embedding ? JSON.stringify(input.embedding) : null,
      revision: provider.revision ?? "1",
      createdAt: now,
      updatedAt: now,
      archivedAt: null,
      deletedAt: null
    });
    return this.requireRecord(input.id);
  }

  getRecord(id: string): DurableMemoryRecord | undefined {
    const row = this.getRecordStatement.get(id) as DurableMemoryRecordRow | undefined;
    return row ? mapRecordRow(row) : undefined;
  }

  refreshRecordCache(input: DurableMemoryServerCacheRefreshInput): DurableMemoryRecord | undefined {
    const existing = this.getRecord(input.id);
    if (!existing || !sameNamespace(existing.namespace, input.namespace)) {
      return undefined;
    }
    const now = (input.now ?? new Date()).toISOString();
    const provider: DurableMemoryCacheMetadata = {
      ...input.provider,
      providerRecordId: input.provider.providerRecordId ?? input.id,
      syncStatus: "cache-current",
      operatorStatus: "cache-current",
      fetchedAt: input.provider.fetchedAt ?? now
    };
    this.updateRecordProviderStatement.run({
      id: input.id,
      providerJson: JSON.stringify(provider),
      revision: provider.revision ?? existing.provider?.revision ?? "1",
      updatedAt: now
    });
    return this.getRecord(input.id);
  }

  invalidateRecordCache(input: DurableMemoryServerCacheInvalidationInput): DurableMemoryRecord | undefined {
    const existing = this.getRecord(input.id);
    if (!existing || !sameNamespace(existing.namespace, input.namespace)) {
      return undefined;
    }
    const now = (input.now ?? new Date()).toISOString();
    const provider: DurableMemoryCacheMetadata = {
      providerId: existing.provider?.providerId ?? "server-mode",
      providerRecordId: existing.provider?.providerRecordId ?? input.id,
      revision: existing.provider?.revision ?? "1",
      ...(existing.provider?.etag ? { etag: existing.provider.etag } : {}),
      syncStatus: input.reason === "provider-unavailable" ? "offline" : "cache-stale",
      operatorStatus: input.reason === "provider-unavailable" ? "remote-unavailable" : "cache-stale",
      ...(existing.provider?.fetchedAt ? { fetchedAt: existing.provider.fetchedAt } : {}),
      staleAt: now,
      ...(existing.provider?.expiresAt ? { expiresAt: existing.provider.expiresAt } : {}),
      ...(existing.provider?.localDevOnly !== undefined ? { localDevOnly: existing.provider.localDevOnly } : {})
    };
    this.updateRecordProviderStatement.run({
      id: input.id,
      providerJson: JSON.stringify(provider),
      revision: provider.revision ?? "1",
      updatedAt: now
    });
    return this.getRecord(input.id);
  }

  listRecords(request: DurableMemoryListRequest): DurableMemoryRecordListResult {
    const rows = this.listRecordStatement.all().map((row) => mapRecordRow(row as DurableMemoryRecordRow));
    const records = rows.filter((record) => matchesRecordQuery(record, request));
    const limit = clampLimit(request.limit);
    return {
      records: records.slice(0, limit),
      ...(records.length > limit ? { nextCursor: records[limit - 1]?.id } : {})
    };
  }

  searchRecords(request: DurableMemorySearchRequest): DurableMemorySearchResult {
    const query = request.query.trim().toLowerCase();
    const requestedMode = request.mode ?? "keyword";
    if (!query) {
      return {
        records: [],
        total: 0,
        operatorStatus: aggregateOperatorStatus([]),
        matches: [],
        diagnostics: buildRetrievalDiagnostics({
          requestedMode,
          effectiveMode: "keyword",
          degraded: requestedMode !== "keyword",
          degradationReasons: requestedMode === "keyword" ? [] : ["semantic retrieval requires a configured semantic index adapter"],
          omitted: []
        })
      };
    }
    const rows = this.listAllRecordsStatement.all().map((row) => mapRecordRow(row as DurableMemoryRecordRow));
    const namespaceRows = rows.filter((record) => matchesNamespace(record.namespace, request.namespace, request.includeDescendants ?? false));
    const ranked = namespaceRows
      .map((record, index) => scoreSearchRecord(record, query, index, namespaceRows.length))
      .filter((match): match is { record: DurableMemoryRecord; match: DurableMemorySearchMatch } => Boolean(match))
      .sort((left, right) => right.match.score - left.match.score || right.record.updatedAt.localeCompare(left.record.updatedAt));
    const limit = clampLimit(request.limit);
    const limited = ranked.slice(0, limit);
    const degradationReasons = semanticDegradationReasons(requestedMode, namespaceRows);
    return {
      records: limited.map((entry) => entry.record),
      total: ranked.length,
      operatorStatus: aggregateOperatorStatus(limited.map((entry) => entry.record)),
      matches: limited.map((entry) => entry.match),
      diagnostics: buildRetrievalDiagnostics({
        requestedMode,
        effectiveMode: "keyword",
        degraded: degradationReasons.length > 0,
        degradationReasons,
        omitted: [
          { category: "namespace-mismatch", count: rows.length - namespaceRows.length },
          { category: "keyword-no-match", count: namespaceRows.length - ranked.length }
        ].filter((entry) => entry.count > 0)
      })
    };
  }

  archiveRecord(request: DurableMemoryArchiveRequest): DurableMemoryRecord | undefined {
    return this.updateRecordStatus(request.id, request.namespace, "archived", request.provenance, request.reason);
  }

  deleteRecord(request: DurableMemoryDeleteRequest): DurableMemoryRecord | undefined {
    return this.updateRecordStatus(request.id, request.namespace, "deleted", request.provenance, request.reason);
  }

  createProposal(request: DurableMemoryServerProposalCreateInput): DurableMemoryProposal {
    const now = (request.now ?? new Date()).toISOString();
    const namespaceParts = toNamespaceStorageParts(request.targetNamespace);
    this.insertProposalStatement.run({
      id: request.id,
      targetNamespaceScope: request.targetNamespace.scope,
      targetNamespaceId: request.targetNamespace.id,
      targetWorkspaceId: namespaceParts.workspaceId,
      targetNamespaceJson: JSON.stringify(request.targetNamespace),
      targetNamespaceAncestorsJson: JSON.stringify(namespaceParts.ancestorKeys),
      provenanceJson: JSON.stringify(request.provenance),
      sourceKind: request.provenance.sourceKind,
      memoryType: request.memoryType,
      proposedBody: request.proposedBody,
      reason: request.reason,
      evidence: request.evidence ?? null,
      status: "pending",
      createdAt: now,
      reviewedAt: null,
      reviewedBy: null
    });
    return this.requireProposal(request.id);
  }

  getProposal(id: string): DurableMemoryProposal | undefined {
    const row = this.getProposalStatement.get(id) as DurableMemoryProposalRow | undefined;
    return row ? mapProposalRow(row) : undefined;
  }

  listProposals(namespace: DurableMemoryNamespaceRef): DurableMemoryProposal[] {
    return this.listProposalStatement
      .all()
      .map((row) => mapProposalRow(row as DurableMemoryProposalRow))
      .filter((proposal) => matchesNamespace(proposal.targetNamespace, namespace, true));
  }

  updateProposalStatus(
    id: string,
    status: DurableMemoryProposalStatus,
    reviewedBy: string,
    now: Date = new Date()
  ): DurableMemoryProposal | undefined {
    this.updateProposalStatusStatement.run({
      id,
      status,
      reviewedAt: now.toISOString(),
      reviewedBy
    });
    return this.getProposal(id);
  }

  createSnapshot(request: DurableMemoryServerSnapshotCreateInput): DurableMemorySnapshot {
    const now = (request.now ?? new Date()).toISOString();
    const namespaceParts = toNamespaceStorageParts(request.namespace);
    const recordIds =
      request.recordIds ??
      this.listRecords({
        namespace: request.namespace,
        includeDescendants: true,
        includeArchived: false
      }).records.map((record) => record.id);
    this.insertSnapshotStatement.run({
      id: request.id,
      namespaceScope: request.namespace.scope,
      namespaceId: request.namespace.id,
      workspaceId: namespaceParts.workspaceId,
      namespaceJson: JSON.stringify(request.namespace),
      namespaceAncestorsJson: JSON.stringify(namespaceParts.ancestorKeys),
      provenanceJson: JSON.stringify(request.provenance),
      sourceKind: request.provenance.sourceKind,
      recordIdsJson: JSON.stringify(recordIds),
      reason: request.reason,
      createdAt: now
    });
    return this.requireSnapshot(request.id);
  }

  listSnapshots(namespace: DurableMemoryNamespaceRef): DurableMemorySnapshotListResult {
    const snapshots = this.listSnapshotStatement
      .all()
      .map((row) => mapSnapshotRow(row as DurableMemorySnapshotRow))
      .filter((snapshot) => matchesNamespace(snapshot.namespace, namespace, true));
    return { snapshots };
  }

  restoreSnapshot(request: DurableMemorySnapshotRestoreRequest): DurableMemorySnapshot | undefined {
    const snapshot = this.getSnapshot(request.id);
    if (!snapshot) {
      return undefined;
    }
    if (!sameNamespace(snapshot.namespace, request.targetNamespace)) {
      throw new Error("snapshot restore target namespace must match snapshot namespace");
    }
    return snapshot;
  }

  private requireRecord(id: string): DurableMemoryRecord {
    const record = this.getRecord(id);
    if (!record) {
      throw new Error(`Durable memory record not found: ${id}`);
    }
    return record;
  }

  private requireProposal(id: string): DurableMemoryProposal {
    const proposal = this.getProposal(id);
    if (!proposal) {
      throw new Error(`Durable memory proposal not found: ${id}`);
    }
    return proposal;
  }

  private requireSnapshot(id: string): DurableMemorySnapshot {
    const snapshot = this.getSnapshot(id);
    if (!snapshot) {
      throw new Error(`Durable memory snapshot not found: ${id}`);
    }
    return snapshot;
  }

  getSnapshot(id: string): DurableMemorySnapshot | undefined {
    const row = this.getSnapshotStatement.get(id) as DurableMemorySnapshotRow | undefined;
    return row ? mapSnapshotRow(row) : undefined;
  }

  private updateRecordStatus(
    id: string,
    namespace: DurableMemoryNamespaceRef,
    status: DurableMemoryRecordStatus,
    _provenance: DurableMemoryProvenanceRef,
    _reason: string
  ): DurableMemoryRecord | undefined {
    const existing = this.getRecord(id);
    if (!existing) {
      return undefined;
    }
    if (!sameNamespace(existing.namespace, namespace)) {
      return undefined;
    }
    const now = new Date().toISOString();
    this.updateRecordStatusStatement.run({
      id,
      status,
      revision: nextRevision(existing.provider?.revision),
      updatedAt: now,
      archivedAt: status === "archived" ? now : (existing.archivedAt ?? null),
      deletedAt: status === "deleted" ? now : (existing.deletedAt ?? null)
    });
    return this.getRecord(id);
  }
}

function recordSelectSql(suffix: string): string {
  return `
    select id, namespace_scope, namespace_id, workspace_id, namespace_json, namespace_ancestors_json, provenance_json, source_kind,
      memory_type, body, summary, sensitivity, status, provider_json, embedding_json, revision, created_at, updated_at, archived_at, deleted_at
    from durable_memory_records ${suffix}
  `;
}

function proposalSelectSql(suffix: string): string {
  return `
    select id, target_namespace_scope, target_namespace_id, target_workspace_id, target_namespace_json, target_namespace_ancestors_json,
      provenance_json, source_kind, memory_type, proposed_body, reason, evidence, status, created_at, reviewed_at, reviewed_by
    from durable_memory_proposals ${suffix}
  `;
}

function snapshotSelectSql(suffix: string): string {
  return `
    select id, namespace_scope, namespace_id, workspace_id, namespace_json, namespace_ancestors_json, provenance_json, source_kind,
      record_ids_json, reason, created_at
    from durable_memory_snapshots ${suffix}
  `;
}

function mapRecordRow(row: DurableMemoryRecordRow): DurableMemoryRecord {
  const provider = row.provider_json ? (JSON.parse(row.provider_json) as DurableMemoryCacheMetadata) : undefined;
  const embedding = row.embedding_json ? (JSON.parse(row.embedding_json) as DurableMemoryEmbeddingMetadata) : undefined;
  return {
    id: row.id,
    namespace: JSON.parse(row.namespace_json) as DurableMemoryNamespaceRef,
    provenance: JSON.parse(row.provenance_json) as DurableMemoryProvenanceRef,
    memoryType: row.memory_type,
    body: row.body,
    ...(row.summary ? { summary: row.summary } : {}),
    sensitivity: row.sensitivity,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    ...(row.archived_at ? { archivedAt: row.archived_at } : {}),
    ...(row.deleted_at ? { deletedAt: row.deleted_at } : {}),
    ...(provider ? { provider: { ...provider, revision: row.revision } } : {}),
    ...(embedding ? { embedding } : {})
  };
}

function ensureColumn(db: Database.Database, table: string, column: string, definition: string): void {
  const columns = db.pragma(`table_info(${table})`) as Array<{ name: string }>;
  if (!columns.some((entry) => entry.name === column)) {
    db.exec(`alter table ${table} add column ${column} ${definition}`);
  }
}

function mapProposalRow(row: DurableMemoryProposalRow): DurableMemoryProposal {
  return {
    id: row.id,
    targetNamespace: JSON.parse(row.target_namespace_json) as DurableMemoryNamespaceRef,
    provenance: JSON.parse(row.provenance_json) as DurableMemoryProvenanceRef,
    memoryType: row.memory_type,
    proposedBody: row.proposed_body,
    reason: row.reason,
    ...(row.evidence ? { evidence: row.evidence } : {}),
    status: row.status,
    createdAt: row.created_at,
    ...(row.reviewed_at ? { reviewedAt: row.reviewed_at } : {}),
    ...(row.reviewed_by ? { reviewedBy: row.reviewed_by } : {})
  };
}

function mapSnapshotRow(row: DurableMemorySnapshotRow): DurableMemorySnapshot {
  return {
    id: row.id,
    namespace: JSON.parse(row.namespace_json) as DurableMemoryNamespaceRef,
    provenance: JSON.parse(row.provenance_json) as DurableMemoryProvenanceRef,
    recordIds: JSON.parse(row.record_ids_json) as string[],
    createdAt: row.created_at,
    reason: row.reason
  };
}

function matchesRecordQuery(record: DurableMemoryRecord, request: DurableMemoryListRequest): boolean {
  if (!request.includeArchived && record.status !== "active") {
    return false;
  }
  return matchesNamespace(record.namespace, request.namespace, request.includeDescendants ?? false);
}

function scoreSearchRecord(
  record: DurableMemoryRecord,
  query: string,
  index: number,
  total: number
): { record: DurableMemoryRecord; match: DurableMemorySearchMatch } | undefined {
  const signals: DurableMemoryRetrievalSignal[] = [];
  const bodyMatch = record.body.toLowerCase().includes(query) || (record.summary ?? "").toLowerCase().includes(query);
  if (bodyMatch) {
    signals.push({ kind: "keyword", score: 0.65, evidence: "body-or-summary" });
  }
  if (record.memoryType.toLowerCase().includes(query)) {
    signals.push({ kind: "metadata", score: 0.2, evidence: "memoryType" });
  }
  const provenanceText = JSON.stringify(record.provenance).toLowerCase();
  if (provenanceText.includes(query)) {
    signals.push({ kind: "provenance", score: 0.15, evidence: record.provenance.sourceKind });
  }
  if (signals.length === 0) {
    return undefined;
  }
  const recencyScore = total > 1 ? Math.max(0, 0.1 * (1 - index / (total - 1))) : 0.1;
  signals.push({ kind: "recency", score: Number(recencyScore.toFixed(3)), evidence: record.updatedAt });
  const score = Number(signals.reduce((sum, signal) => sum + signal.score, 0).toFixed(3));
  return {
    record,
    match: {
      recordId: record.id,
      score,
      signals,
      snippet: snippetFor(record, query)
    }
  };
}

function semanticDegradationReasons(requestedMode: DurableMemoryRetrievalMode, records: DurableMemoryRecord[]): string[] {
  if (requestedMode === "keyword") {
    return [];
  }
  const reasons = ["semantic retrieval requires a configured semantic index adapter"];
  const indexedCount = records.filter((record) => record.embedding?.status === "indexed").length;
  if (indexedCount > 0 && indexedCount < records.length) {
    reasons.push("only some records have current semantic indexes");
  }
  if (records.some((record) => record.embedding?.status === "failed")) {
    reasons.push("one or more records have failed embedding lifecycle state");
  }
  if (records.some((record) => record.embedding?.status === "stale")) {
    reasons.push("one or more records have stale embedding lifecycle state");
  }
  return reasons;
}

function buildRetrievalDiagnostics(input: {
  requestedMode: DurableMemoryRetrievalMode;
  effectiveMode: DurableMemoryRetrievalEffectiveMode;
  degraded: boolean;
  degradationReasons: string[];
  omitted: DurableMemoryRetrievalDiagnostics["omitted"];
}): DurableMemoryRetrievalDiagnostics {
  return {
    requestedMode: input.requestedMode,
    effectiveMode: input.effectiveMode,
    degraded: input.degraded,
    degradationReasons: input.degradationReasons,
    providerCapabilities: {
      keyword: true,
      semantic: false,
      hybrid: false
    },
    omitted: input.omitted
  };
}

function aggregateOperatorStatus(records: DurableMemoryRecord[]): DurableMemorySearchResult["operatorStatus"] {
  if (records.some((record) => record.provider?.operatorStatus === "remote-unavailable")) {
    return "remote-unavailable";
  }
  if (records.some((record) => record.provider?.operatorStatus === "conflict-review-required")) {
    return "conflict-review-required";
  }
  if (records.some((record) => record.provider?.operatorStatus === "cache-stale")) {
    return "cache-stale";
  }
  if (records.some((record) => record.provider?.operatorStatus === "queued-intent")) {
    return "queued-intent";
  }
  if (records.some((record) => record.provider?.operatorStatus === "cache-current")) {
    return "cache-current";
  }
  if (records.every((record) => record.provider?.operatorStatus === "local-dev-only") && records.length > 0) {
    return "local-dev-only";
  }
  return "remote-current";
}

function snippetFor(record: DurableMemoryRecord, query: string): string | undefined {
  const text = record.summary ?? record.body;
  const lower = text.toLowerCase();
  const index = lower.indexOf(query);
  if (index < 0) {
    return text.slice(0, 160);
  }
  return text.slice(Math.max(0, index - 40), Math.min(text.length, index + query.length + 80));
}

function matchesNamespace(
  candidate: DurableMemoryNamespaceRef,
  requested: DurableMemoryNamespaceRef,
  includeDescendants: boolean
): boolean {
  if (sameNamespace(candidate, requested)) {
    return true;
  }
  return includeDescendants ? toNamespaceStorageParts(candidate).ancestorKeys.includes(namespaceKey(requested)) : false;
}

function sameNamespace(left: DurableMemoryNamespaceRef, right: DurableMemoryNamespaceRef): boolean {
  return left.scope === right.scope && left.id === right.id;
}

function namespaceKey(namespace: DurableMemoryNamespaceRef): string {
  return `${namespace.scope}:${namespace.id}`;
}

function toNamespaceStorageParts(namespace: DurableMemoryNamespaceRef): { ancestorKeys: string[]; workspaceId: string } {
  const ancestorKeys: string[] = [];
  let workspaceId = resolveDurableMemoryNamespaceWorkspaceId(namespace);
  let parent = namespace.parent;
  while (parent) {
    ancestorKeys.push(namespaceKey(parent));
    parent = parent.parent;
  }
  return { ancestorKeys, workspaceId };
}

export function resolveDurableMemoryNamespaceWorkspaceId(namespace: DurableMemoryNamespaceRef): string {
  if (namespace.scope === "workspace") {
    return namespace.id;
  }
  let parent = namespace.parent;
  while (parent) {
    if (parent.scope === "workspace") {
      return parent.id;
    }
    parent = parent.parent;
  }
  return "default";
}

function clampLimit(limit: number | undefined): number {
  if (limit === undefined || !Number.isFinite(limit)) {
    return 500;
  }
  return Math.max(1, Math.min(Math.trunc(limit), 1000));
}

function nextRevision(current: string | undefined): string {
  const parsed = Number.parseInt(current ?? "1", 10);
  return Number.isFinite(parsed) ? String(parsed + 1) : `${current}-next`;
}
