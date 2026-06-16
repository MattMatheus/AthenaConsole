import type Database from "better-sqlite3";

export type ConnectedRepositoryRecordSourceType = "existing-path" | "managed-clone";
export type ConnectedRepositoryRecordStatus = "ready" | "missing" | "invalid" | "auth-required" | "error";
export type ConnectedRepositoryRecordDirtyState = "clean" | "dirty" | "unknown";

interface ConnectedRepositoryRow {
  id: string;
  name: string;
  source_type: ConnectedRepositoryRecordSourceType;
  workspace_path: string;
  host_path: string | null;
  remote_url: string | null;
  default_branch: string | null;
  current_branch: string | null;
  head_commit: string | null;
  dirty_state: ConnectedRepositoryRecordDirtyState;
  status: ConnectedRepositoryRecordStatus;
  status_message: string | null;
  last_inspected_at: string | null;
  workspace_id: string;
  created_at: string;
  updated_at: string;
}

export interface ConnectedRepositoryRecord {
  id: string;
  name: string;
  sourceType: ConnectedRepositoryRecordSourceType;
  workspacePath: string;
  hostPath?: string;
  remoteUrl?: string;
  defaultBranch?: string;
  currentBranch?: string;
  headCommit?: string;
  dirtyState: ConnectedRepositoryRecordDirtyState;
  status: ConnectedRepositoryRecordStatus;
  statusMessage?: string;
  lastInspectedAt?: string;
  workspaceId: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateConnectedRepositoryInput {
  id: string;
  name: string;
  sourceType: ConnectedRepositoryRecordSourceType;
  workspacePath: string;
  hostPath?: string;
  remoteUrl?: string;
  defaultBranch?: string;
  status?: ConnectedRepositoryRecordStatus;
  dirtyState?: ConnectedRepositoryRecordDirtyState;
  statusMessage?: string;
  workspaceId?: string;
  now?: Date;
}

export interface UpdateConnectedRepositoryInput {
  name?: string;
  sourceType?: ConnectedRepositoryRecordSourceType;
  workspacePath?: string;
  hostPath?: string;
  remoteUrl?: string;
  defaultBranch?: string;
  currentBranch?: string;
  headCommit?: string;
  dirtyState?: ConnectedRepositoryRecordDirtyState;
  status?: ConnectedRepositoryRecordStatus;
  statusMessage?: string;
  lastInspectedAt?: string;
  workspaceId?: string;
  now?: Date;
}

export interface ListConnectedRepositoriesOptions {
  workspaceId?: string;
  workspaceIds?: string[];
}

export class ConnectedRepositoryRepository {
  private readonly getStatement: Database.Statement;
  private readonly listStatement: Database.Statement;
  private readonly insertStatement: Database.Statement;
  private readonly updateStatement: Database.Statement;
  private readonly deleteStatement: Database.Statement;

  constructor(private readonly db: Database.Database) {
    this.getStatement = db.prepare(connectedRepositorySelectSql("where id = ?"));
    this.listStatement = db.prepare(connectedRepositorySelectSql("order by updated_at desc, created_at desc, id asc"));
    this.insertStatement = db.prepare(`
      insert into connected_repositories (
        id,
        name,
        source_type,
        workspace_path,
        host_path,
        remote_url,
        default_branch,
        current_branch,
        head_commit,
        dirty_state,
        status,
        status_message,
        last_inspected_at,
        workspace_id,
        created_at,
        updated_at
      )
      values (
        @id,
        @name,
        @sourceType,
        @workspacePath,
        @hostPath,
        @remoteUrl,
        @defaultBranch,
        @currentBranch,
        @headCommit,
        @dirtyState,
        @status,
        @statusMessage,
        @lastInspectedAt,
        @workspaceId,
        @createdAt,
        @updatedAt
      )
    `);
    this.updateStatement = db.prepare(`
      update connected_repositories set
        name = @name,
        source_type = @sourceType,
        workspace_path = @workspacePath,
        host_path = @hostPath,
        remote_url = @remoteUrl,
        default_branch = @defaultBranch,
        current_branch = @currentBranch,
        head_commit = @headCommit,
        dirty_state = @dirtyState,
        status = @status,
        status_message = @statusMessage,
        last_inspected_at = @lastInspectedAt,
        workspace_id = @workspaceId,
        updated_at = @updatedAt
      where id = @id
    `);
    this.deleteStatement = db.prepare("delete from connected_repositories where id = ?");
  }

  create(input: CreateConnectedRepositoryInput): ConnectedRepositoryRecord {
    const now = (input.now ?? new Date()).toISOString();
    this.insertStatement.run({
      id: input.id,
      name: input.name,
      sourceType: input.sourceType,
      workspacePath: input.workspacePath,
      hostPath: input.hostPath ?? null,
      remoteUrl: input.remoteUrl ?? null,
      defaultBranch: input.defaultBranch ?? null,
      currentBranch: null,
      headCommit: null,
      dirtyState: input.dirtyState ?? "unknown",
      status: input.status ?? "invalid",
      statusMessage: input.statusMessage ?? null,
      lastInspectedAt: null,
      workspaceId: input.workspaceId ?? "default",
      createdAt: now,
      updatedAt: now
    });
    return this.require(input.id);
  }

  get(id: string): ConnectedRepositoryRecord | undefined {
    const row = this.getStatement.get(id) as ConnectedRepositoryRow | undefined;
    return row ? mapConnectedRepositoryRow(row) : undefined;
  }

  require(id: string): ConnectedRepositoryRecord {
    const repository = this.get(id);
    if (!repository) {
      throw new Error(`Connected repository not found: ${id}`);
    }
    return repository;
  }

  list(options: ListConnectedRepositoriesOptions = {}): ConnectedRepositoryRecord[] {
    if (options.workspaceIds && options.workspaceIds.length === 0) {
      return [];
    }
    if (options.workspaceId || options.workspaceIds) {
      const workspaceIds = options.workspaceId ? [options.workspaceId] : (options.workspaceIds ?? []);
      const placeholders = workspaceIds.map(() => "?").join(", ");
      return this.db
        .prepare(connectedRepositorySelectSql(`where workspace_id in (${placeholders}) order by updated_at desc, created_at desc, id asc`))
        .all(...workspaceIds)
        .map((row) => mapConnectedRepositoryRow(row as ConnectedRepositoryRow));
    }
    return this.listStatement
      .all()
      .map((row) => mapConnectedRepositoryRow(row as ConnectedRepositoryRow))
  }

  update(id: string, input: UpdateConnectedRepositoryInput): ConnectedRepositoryRecord | undefined {
    const existing = this.get(id);
    if (!existing) {
      return undefined;
    }
    this.updateStatement.run({
      id,
      name: input.name ?? existing.name,
      sourceType: input.sourceType ?? existing.sourceType,
      workspacePath: input.workspacePath ?? existing.workspacePath,
      hostPath: input.hostPath ?? existing.hostPath ?? null,
      remoteUrl: input.remoteUrl ?? existing.remoteUrl ?? null,
      defaultBranch: input.defaultBranch ?? existing.defaultBranch ?? null,
      currentBranch: input.currentBranch ?? existing.currentBranch ?? null,
      headCommit: input.headCommit ?? existing.headCommit ?? null,
      dirtyState: input.dirtyState ?? existing.dirtyState,
      status: input.status ?? existing.status,
      statusMessage: input.statusMessage ?? existing.statusMessage ?? null,
      lastInspectedAt: input.lastInspectedAt ?? existing.lastInspectedAt ?? null,
      workspaceId: input.workspaceId ?? existing.workspaceId,
      updatedAt: (input.now ?? new Date()).toISOString()
    });
    return this.require(id);
  }

  delete(id: string): boolean {
    const result = this.deleteStatement.run(id);
    return result.changes > 0;
  }
}

function connectedRepositorySelectSql(suffix: string): string {
  return `select id, name, source_type, workspace_path, host_path, remote_url, default_branch, current_branch, head_commit, dirty_state, status, status_message, last_inspected_at, workspace_id, created_at, updated_at from connected_repositories ${suffix}`;
}

function mapConnectedRepositoryRow(row: ConnectedRepositoryRow): ConnectedRepositoryRecord {
  return {
    id: row.id,
    name: row.name,
    sourceType: row.source_type,
    workspacePath: row.workspace_path,
    ...(row.host_path ? { hostPath: row.host_path } : {}),
    ...(row.remote_url ? { remoteUrl: row.remote_url } : {}),
    ...(row.default_branch ? { defaultBranch: row.default_branch } : {}),
    ...(row.current_branch ? { currentBranch: row.current_branch } : {}),
    ...(row.head_commit ? { headCommit: row.head_commit } : {}),
    dirtyState: row.dirty_state,
    status: row.status,
    ...(row.status_message ? { statusMessage: row.status_message } : {}),
    ...(row.last_inspected_at ? { lastInspectedAt: row.last_inspected_at } : {}),
    workspaceId: row.workspace_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}
