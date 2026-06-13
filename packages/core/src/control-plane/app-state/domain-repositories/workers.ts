import type Database from "better-sqlite3";
import { clampAppStateListLimit, jsonOrNull } from "./shared.js";

interface WorkerHeartbeatRow {
  worker_id: string;
  identity_json: string;
  active_run_id: string | null;
  active_session_id: string | null;
  capacity: number;
  version: string;
  metadata_json: string | null;
  last_heartbeat_at: string;
  expires_at: string;
  created_at: string;
  updated_at: string;
}

export interface WorkerHeartbeatRecord {
  workerId: string;
  identity: unknown;
  activeRunId?: string;
  activeSessionId?: string;
  capacity: number;
  version: string;
  metadata?: unknown;
  lastHeartbeatAt: string;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface WorkerHeartbeatUpsert {
  workerId: string;
  identity?: unknown;
  activeRunId?: string | null;
  activeSessionId?: string | null;
  capacity?: number;
  version?: string;
  metadata?: unknown;
  lastHeartbeatAt?: Date;
  ttlMs?: number;
  now?: Date;
}

export interface ListWorkerHeartbeatsOptions {
  expiredBefore?: Date;
  activeAt?: Date;
  limit?: number;
}

export class WorkerHeartbeatRepository {
  private readonly getStatement: Database.Statement;
  private readonly upsertStatement: Database.Statement;
  private readonly deleteExpiredStatement: Database.Statement;

  constructor(private readonly db: Database.Database) {
    this.getStatement = db.prepare(workerHeartbeatSelectSql("where worker_id = ?"));
    this.upsertStatement = db.prepare(`
      insert into worker_heartbeats (
        worker_id,
        identity_json,
        active_run_id,
        active_session_id,
        capacity,
        version,
        metadata_json,
        last_heartbeat_at,
        expires_at,
        created_at,
        updated_at
      )
      values (
        @workerId,
        @identityJson,
        @activeRunId,
        @activeSessionId,
        @capacity,
        @version,
        @metadataJson,
        @lastHeartbeatAt,
        @expiresAt,
        @createdAt,
        @updatedAt
      )
      on conflict(worker_id) do update set
        identity_json = excluded.identity_json,
        active_run_id = excluded.active_run_id,
        active_session_id = excluded.active_session_id,
        capacity = excluded.capacity,
        version = excluded.version,
        metadata_json = excluded.metadata_json,
        last_heartbeat_at = excluded.last_heartbeat_at,
        expires_at = excluded.expires_at,
        updated_at = excluded.updated_at
    `);
    this.deleteExpiredStatement = db.prepare("delete from worker_heartbeats where expires_at < ?");
  }

  get(workerId: string): WorkerHeartbeatRecord | undefined {
    const row = this.getStatement.get(workerId) as WorkerHeartbeatRow | undefined;
    return row ? mapWorkerHeartbeatRow(row) : undefined;
  }

  require(workerId: string): WorkerHeartbeatRecord {
    const record = this.get(workerId);
    if (!record) {
      throw new Error(`Worker heartbeat not found: ${workerId}`);
    }
    return record;
  }

  list(options: ListWorkerHeartbeatsOptions = {}): WorkerHeartbeatRecord[] {
    const clauses: string[] = [];
    const params: Record<string, unknown> = {
      limit: clampAppStateListLimit(options.limit)
    };
    if (options.expiredBefore) {
      clauses.push("expires_at < @expiredBefore");
      params.expiredBefore = options.expiredBefore.toISOString();
    }
    if (options.activeAt) {
      clauses.push("expires_at >= @activeAt");
      params.activeAt = options.activeAt.toISOString();
    }
    const where = clauses.length > 0 ? `where ${clauses.join(" and ")}` : "";
    return this.db
      .prepare(workerHeartbeatSelectSql(`${where} order by last_heartbeat_at desc, worker_id asc limit @limit`))
      .all(params)
      .map((row) => mapWorkerHeartbeatRow(row as WorkerHeartbeatRow));
  }

  upsert(input: WorkerHeartbeatUpsert): WorkerHeartbeatRecord {
    const now = input.now ?? new Date();
    const lastHeartbeatAt = input.lastHeartbeatAt ?? now;
    const ttlMs = input.ttlMs ?? 60_000;
    const existing = this.get(input.workerId);
    const createdAt = existing?.createdAt ?? now.toISOString();
    this.upsertStatement.run({
      workerId: input.workerId,
      identityJson: JSON.stringify(input.identity ?? existing?.identity ?? {}),
      activeRunId: input.activeRunId === undefined ? existing?.activeRunId ?? null : input.activeRunId,
      activeSessionId: input.activeSessionId === undefined ? existing?.activeSessionId ?? null : input.activeSessionId,
      capacity: input.capacity ?? existing?.capacity ?? 1,
      version: input.version ?? existing?.version ?? "unknown",
      metadataJson: input.metadata === undefined ? jsonOrNull(existing?.metadata) : jsonOrNull(input.metadata),
      lastHeartbeatAt: lastHeartbeatAt.toISOString(),
      expiresAt: new Date(lastHeartbeatAt.getTime() + ttlMs).toISOString(),
      createdAt,
      updatedAt: now.toISOString()
    });
    return this.require(input.workerId);
  }

  deleteExpired(before: Date): number {
    return this.deleteExpiredStatement.run(before.toISOString()).changes;
  }
}

function workerHeartbeatSelectSql(suffix: string): string {
  return `select worker_id, identity_json, active_run_id, active_session_id, capacity, version, metadata_json, last_heartbeat_at, expires_at, created_at, updated_at from worker_heartbeats ${suffix}`;
}

function mapWorkerHeartbeatRow(row: WorkerHeartbeatRow): WorkerHeartbeatRecord {
  return {
    workerId: row.worker_id,
    identity: JSON.parse(row.identity_json) as unknown,
    ...(row.active_run_id ? { activeRunId: row.active_run_id } : {}),
    ...(row.active_session_id ? { activeSessionId: row.active_session_id } : {}),
    capacity: row.capacity,
    version: row.version,
    ...(row.metadata_json ? { metadata: JSON.parse(row.metadata_json) as unknown } : {}),
    lastHeartbeatAt: row.last_heartbeat_at,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}
