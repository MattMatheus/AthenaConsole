import type Database from "better-sqlite3";
import type {
  DurableMemoryArchiveRequest,
  DurableMemoryCacheMetadata,
  DurableMemoryDeleteRequest,
  DurableMemoryListRequest,
  DurableMemoryNamespaceRef,
  DurableMemoryProposal,
  DurableMemoryProposalCreateRequest,
  DurableMemoryProposalStatus,
  DurableMemoryProvenanceRef,
  DurableMemoryRecord,
  DurableMemoryRecordListResult,
  DurableMemoryRecordStatus,
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
  listSnapshots(namespace: DurableMemoryNamespaceRef): DurableMemorySnapshotListResult;
  restoreSnapshot(request: DurableMemorySnapshotRestoreRequest): DurableMemorySnapshot | undefined;
}

export interface DurableMemoryServerRecordWriteInput extends DurableMemoryWriteRequest {
  id: string;
  summary?: string;
  provider?: DurableMemoryCacheMetadata;
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
  target_namespace_json: string;
  target_namespace_ancestors_json: string;
  provenance_json: string;
  source_kind: string;
  memory_type: string;
  proposed_body: string;
  reason: string;
  status: DurableMemoryProposalStatus;
  created_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
}

interface DurableMemorySnapshotRow {
  id: string;
  namespace_scope: string;
  namespace_id: string;
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
      target_namespace_json text not null,
      target_namespace_ancestors_json text not null default '[]',
      provenance_json text not null,
      source_kind text not null,
      memory_type text not null,
      proposed_body text not null,
      reason text not null,
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
}

export class SqliteDurableMemoryServerStorage implements DurableMemoryServerStorage {
  private readonly insertRecordStatement: Database.Statement;
  private readonly getRecordStatement: Database.Statement;
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
        @revision,
        @createdAt,
        @updatedAt,
        @archivedAt,
        @deletedAt
      )
    `);
    this.getRecordStatement = db.prepare(recordSelectSql("where id = ?"));
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
        target_namespace_json,
        target_namespace_ancestors_json,
        provenance_json,
        source_kind,
        memory_type,
        proposed_body,
        reason,
        status,
        created_at,
        reviewed_at,
        reviewed_by
      )
      values (
        @id,
        @targetNamespaceScope,
        @targetNamespaceId,
        @targetNamespaceJson,
        @targetNamespaceAncestorsJson,
        @provenanceJson,
        @sourceKind,
        @memoryType,
        @proposedBody,
        @reason,
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
    if (!query) {
      return {
        records: [],
        total: 0,
        operatorStatus: "remote-current"
      };
    }
    const rows = this.listAllRecordsStatement.all().map((row) => mapRecordRow(row as DurableMemoryRecordRow));
    const records = rows
      .filter((record) => matchesNamespace(record.namespace, request.namespace, request.includeDescendants ?? false))
      .filter((record) => [record.memoryType, record.summary ?? "", record.body].join("\n").toLowerCase().includes(query));
    const limit = clampLimit(request.limit);
    return {
      records: records.slice(0, limit),
      total: records.length,
      operatorStatus: "remote-current"
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
      targetNamespaceJson: JSON.stringify(request.targetNamespace),
      targetNamespaceAncestorsJson: JSON.stringify(namespaceParts.ancestorKeys),
      provenanceJson: JSON.stringify(request.provenance),
      sourceKind: request.provenance.sourceKind,
      memoryType: request.memoryType,
      proposedBody: request.proposedBody,
      reason: request.reason,
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

  private getSnapshot(id: string): DurableMemorySnapshot | undefined {
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
    select id, namespace_scope, namespace_id, namespace_json, namespace_ancestors_json, provenance_json, source_kind,
      memory_type, body, summary, sensitivity, status, provider_json, revision, created_at, updated_at, archived_at, deleted_at
    from durable_memory_records ${suffix}
  `;
}

function proposalSelectSql(suffix: string): string {
  return `
    select id, target_namespace_scope, target_namespace_id, target_namespace_json, target_namespace_ancestors_json,
      provenance_json, source_kind, memory_type, proposed_body, reason, status, created_at, reviewed_at, reviewed_by
    from durable_memory_proposals ${suffix}
  `;
}

function snapshotSelectSql(suffix: string): string {
  return `
    select id, namespace_scope, namespace_id, namespace_json, namespace_ancestors_json, provenance_json, source_kind,
      record_ids_json, reason, created_at
    from durable_memory_snapshots ${suffix}
  `;
}

function mapRecordRow(row: DurableMemoryRecordRow): DurableMemoryRecord {
  const provider = row.provider_json ? (JSON.parse(row.provider_json) as DurableMemoryCacheMetadata) : undefined;
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
    ...(provider ? { provider: { ...provider, revision: row.revision } } : {})
  };
}

function mapProposalRow(row: DurableMemoryProposalRow): DurableMemoryProposal {
  return {
    id: row.id,
    targetNamespace: JSON.parse(row.target_namespace_json) as DurableMemoryNamespaceRef,
    provenance: JSON.parse(row.provenance_json) as DurableMemoryProvenanceRef,
    memoryType: row.memory_type,
    proposedBody: row.proposed_body,
    reason: row.reason,
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

function toNamespaceStorageParts(namespace: DurableMemoryNamespaceRef): { ancestorKeys: string[] } {
  const ancestorKeys: string[] = [];
  let parent = namespace.parent;
  while (parent) {
    ancestorKeys.push(namespaceKey(parent));
    parent = parent.parent;
  }
  return { ancestorKeys };
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
