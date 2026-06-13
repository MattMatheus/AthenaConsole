import type Database from "better-sqlite3";
import type { VerificationPolicyFailure } from "../../../shared/contracts/harness.js";
import { clampAppStateListLimit, jsonOrNull } from "./shared.js";

export type RunTargetType = "task" | "mission";
export type RunStatus =
  | "queued"
  | "validating"
  | "running"
  | "waiting-for-approval"
  | "completed"
  | "failed"
  | "cancelled"
  | "stopped-by-limit";
export type RunVerificationStatus = "passed" | "verification-failed";

export type RunEventLevel = "debug" | "info" | "warning" | "error";

interface RunRow {
  id: string;
  target_type: RunTargetType;
  target_id: string;
  status: RunStatus;
  backend: string | null;
  agent_id: string | null;
  agent_version: string | null;
  started_at: string | null;
  ended_at: string | null;
  output_json: string | null;
  failure_json: string | null;
  safety_stop_json: string | null;
  verification_status: RunVerificationStatus | null;
  verification_failures_json: string | null;
  workspace_id: string;
  created_at: string;
  updated_at: string;
}

interface RunEventRow {
  id: string;
  run_id: string;
  task_id: string | null;
  mission_id: string | null;
  agent_id: string | null;
  type: string;
  level: RunEventLevel;
  timestamp: string;
  message: string;
  payload_json: string;
  parent_event_id: string | null;
  trace_id: string | null;
  workspace_id: string;
}

interface ArtifactMetadataRow {
  id: string;
  run_id: string;
  task_id: string | null;
  agent_id: string | null;
  label: string;
  kind: string;
  format: string;
  storage_uri: string;
  size_bytes: number | null;
  hash: string | null;
  metadata_json: string;
  schema_validation_json: string | null;
  workspace_id: string;
  created_at: string;
}

export interface RunRecord {
  id: string;
  targetType: RunTargetType;
  targetId: string;
  status: RunStatus;
  backend?: string;
  agentId?: string;
  agentVersion?: string;
  startedAt?: string;
  endedAt?: string;
  output?: unknown;
  failure?: unknown;
  safetyStop?: unknown;
  verificationStatus?: RunVerificationStatus;
  verificationFailures?: VerificationPolicyFailure[];
  workspaceId: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateRunInput {
  id: string;
  targetType: RunTargetType;
  targetId: string;
  status?: RunStatus;
  backend?: string;
  agentId?: string;
  agentVersion?: string;
  startedAt?: string;
  endedAt?: string;
  output?: unknown;
  failure?: unknown;
  safetyStop?: unknown;
  verificationStatus?: RunVerificationStatus;
  verificationFailures?: VerificationPolicyFailure[];
  workspaceId?: string;
  now?: Date;
}

export interface UpdateRunInput {
  status?: RunStatus;
  backend?: string;
  agentId?: string;
  agentVersion?: string;
  startedAt?: string;
  endedAt?: string;
  output?: unknown;
  failure?: unknown;
  safetyStop?: unknown;
  verificationStatus?: RunVerificationStatus;
  verificationFailures?: VerificationPolicyFailure[];
  workspaceId?: string;
  now?: Date;
}

export interface ListRunsOptions {
  targetType?: RunTargetType;
  targetId?: string;
  status?: RunStatus;
  workspaceId?: string;
  limit?: number;
}

export class RunRepository {
  private readonly getStatement: Database.Statement;
  private readonly insertStatement: Database.Statement;
  private readonly updateStatement: Database.Statement;

  constructor(private readonly db: Database.Database) {
    this.getStatement = db.prepare(runSelectSql("where id = ?"));
    this.insertStatement = db.prepare(`
      insert into runs (
        id,
        target_type,
        target_id,
        status,
        backend,
        agent_id,
        agent_version,
        started_at,
        ended_at,
        output_json,
        failure_json,
        safety_stop_json,
        verification_status,
        verification_failures_json,
        workspace_id,
        created_at,
        updated_at
      )
      values (
        @id,
        @targetType,
        @targetId,
        @status,
        @backend,
        @agentId,
        @agentVersion,
        @startedAt,
        @endedAt,
        @outputJson,
        @failureJson,
        @safetyStopJson,
        @verificationStatus,
        @verificationFailuresJson,
        @workspaceId,
        @createdAt,
        @updatedAt
      )
    `);
    this.updateStatement = db.prepare(`
      update runs set
        status = @status,
        backend = @backend,
        agent_id = @agentId,
        agent_version = @agentVersion,
        started_at = @startedAt,
        ended_at = @endedAt,
        output_json = @outputJson,
        failure_json = @failureJson,
        safety_stop_json = @safetyStopJson,
        verification_status = @verificationStatus,
        verification_failures_json = @verificationFailuresJson,
        workspace_id = @workspaceId,
        updated_at = @updatedAt
      where id = @id
    `);
  }

  create(input: CreateRunInput): RunRecord {
    const now = (input.now ?? new Date()).toISOString();
    this.insertStatement.run({
      id: input.id,
      targetType: input.targetType,
      targetId: input.targetId,
      status: input.status ?? "queued",
      backend: input.backend ?? null,
      agentId: input.agentId ?? null,
      agentVersion: input.agentVersion ?? null,
      startedAt: input.startedAt ?? null,
      endedAt: input.endedAt ?? null,
      outputJson: jsonOrNull(input.output),
      failureJson: jsonOrNull(input.failure),
      safetyStopJson: jsonOrNull(input.safetyStop),
      verificationStatus: input.verificationStatus ?? null,
      verificationFailuresJson: jsonOrNull(input.verificationFailures),
      workspaceId: input.workspaceId ?? "default",
      createdAt: now,
      updatedAt: now
    });
    return this.require(input.id);
  }

  get(id: string): RunRecord | undefined {
    const row = this.getStatement.get(id) as RunRow | undefined;
    return row ? mapRunRow(row) : undefined;
  }

  require(id: string): RunRecord {
    const run = this.get(id);
    if (!run) {
      throw new Error(`Run not found: ${id}`);
    }
    return run;
  }

  list(options: ListRunsOptions = {}): RunRecord[] {
    const clauses: string[] = [];
    const params: Record<string, unknown> = {
      limit: clampAppStateListLimit(options.limit)
    };
    if (options.targetType) {
      clauses.push("target_type = @targetType");
      params.targetType = options.targetType;
    }
    if (options.targetId) {
      clauses.push("target_id = @targetId");
      params.targetId = options.targetId;
    }
    if (options.status) {
      clauses.push("status = @status");
      params.status = options.status;
    }
    if (options.workspaceId) {
      clauses.push("workspace_id = @workspaceId");
      params.workspaceId = options.workspaceId;
    }
    const where = clauses.length > 0 ? `where ${clauses.join(" and ")}` : "";
    return this.db
      .prepare(runSelectSql(`${where} order by created_at desc limit @limit`))
      .all(params)
      .map((row) => mapRunRow(row as RunRow));
  }

  update(id: string, input: UpdateRunInput): RunRecord {
    const existing = this.require(id);
    const updatedAt = (input.now ?? new Date()).toISOString();
    this.updateStatement.run({
      id,
      status: input.status ?? existing.status,
      backend: input.backend ?? existing.backend ?? null,
      agentId: input.agentId ?? existing.agentId ?? null,
      agentVersion: input.agentVersion ?? existing.agentVersion ?? null,
      startedAt: input.startedAt ?? existing.startedAt ?? null,
      endedAt: input.endedAt ?? existing.endedAt ?? null,
      outputJson: input.output === undefined ? jsonOrNull(existing.output) : jsonOrNull(input.output),
      failureJson: input.failure === undefined ? jsonOrNull(existing.failure) : jsonOrNull(input.failure),
      safetyStopJson: input.safetyStop === undefined ? jsonOrNull(existing.safetyStop) : jsonOrNull(input.safetyStop),
      verificationStatus: input.verificationStatus ?? existing.verificationStatus ?? null,
      verificationFailuresJson:
        input.verificationFailures === undefined ? jsonOrNull(existing.verificationFailures) : jsonOrNull(input.verificationFailures),
      workspaceId: input.workspaceId ?? existing.workspaceId,
      updatedAt
    });
    return this.require(id);
  }
}

export interface RunEventRecord {
  id: string;
  runId: string;
  taskId?: string;
  missionId?: string;
  agentId?: string;
  type: string;
  level: RunEventLevel;
  timestamp: string;
  message: string;
  payload: unknown;
  parentEventId?: string;
  traceId?: string;
  workspaceId: string;
}

export interface AppendRunEventInput {
  id: string;
  runId: string;
  taskId?: string;
  missionId?: string;
  agentId?: string;
  type: string;
  level?: RunEventLevel;
  timestamp?: string;
  message?: string;
  payload?: unknown;
  parentEventId?: string;
  traceId?: string;
  workspaceId?: string;
}

export class RunEventRepository {
  private readonly insertStatement: Database.Statement;
  private readonly listForRunStatement: Database.Statement;

  constructor(private readonly db: Database.Database) {
    this.insertStatement = db.prepare(`
      insert into run_events (
        id,
        run_id,
        task_id,
        mission_id,
        agent_id,
        type,
        level,
        timestamp,
        message,
        payload_json,
        parent_event_id,
        trace_id,
        workspace_id
      )
      values (
        @id,
        @runId,
        @taskId,
        @missionId,
        @agentId,
        @type,
        @level,
        @timestamp,
        @message,
        @payloadJson,
        @parentEventId,
        @traceId,
        @workspaceId
      )
    `);
    this.listForRunStatement = db.prepare(
      "select id, run_id, task_id, mission_id, agent_id, type, level, timestamp, message, payload_json, parent_event_id, trace_id, workspace_id from run_events where run_id = ? order by timestamp asc, rowid asc"
    );
  }

  append(input: AppendRunEventInput): RunEventRecord {
    const timestamp = input.timestamp ?? new Date().toISOString();
    this.insertStatement.run({
      id: input.id,
      runId: input.runId,
      taskId: input.taskId ?? null,
      missionId: input.missionId ?? null,
      agentId: input.agentId ?? null,
      type: input.type,
      level: input.level ?? "info",
      timestamp,
      message: input.message ?? "",
      payloadJson: JSON.stringify(input.payload ?? {}),
      parentEventId: input.parentEventId ?? null,
      traceId: input.traceId ?? null,
      workspaceId: input.workspaceId ?? "default"
    });
    return {
      id: input.id,
      runId: input.runId,
      ...(input.taskId ? { taskId: input.taskId } : {}),
      ...(input.missionId ? { missionId: input.missionId } : {}),
      ...(input.agentId ? { agentId: input.agentId } : {}),
      type: input.type,
      level: input.level ?? "info",
      timestamp,
      message: input.message ?? "",
      payload: input.payload ?? {},
      ...(input.parentEventId ? { parentEventId: input.parentEventId } : {}),
      ...(input.traceId ? { traceId: input.traceId } : {}),
      workspaceId: input.workspaceId ?? "default"
    };
  }

  listForRun(runId: string): RunEventRecord[] {
    return this.listForRunStatement.all(runId).map((row) => mapRunEventRow(row as RunEventRow));
  }
}

export interface ArtifactMetadataRecord {
  id: string;
  runId: string;
  taskId?: string;
  agentId?: string;
  label: string;
  kind: string;
  format: string;
  storageUri: string;
  sizeBytes?: number;
  hash?: string;
  metadata: unknown;
  schemaValidation?: unknown;
  workspaceId: string;
  createdAt: string;
}

export interface CreateArtifactMetadataInput {
  id: string;
  runId: string;
  taskId?: string;
  agentId?: string;
  label: string;
  kind: string;
  format: string;
  storageUri: string;
  sizeBytes?: number;
  hash?: string;
  metadata?: unknown;
  schemaValidation?: unknown;
  workspaceId?: string;
  createdAt?: string;
}

export class ArtifactMetadataRepository {
  private readonly insertStatement: Database.Statement;
  private readonly listForRunStatement: Database.Statement;

  constructor(private readonly db: Database.Database) {
    this.insertStatement = db.prepare(`
      insert into artifact_metadata (
        id,
        run_id,
        task_id,
        agent_id,
        label,
        kind,
        format,
        storage_uri,
        size_bytes,
        hash,
        metadata_json,
        schema_validation_json,
        workspace_id,
        created_at
      )
      values (
        @id,
        @runId,
        @taskId,
        @agentId,
        @label,
        @kind,
        @format,
        @storageUri,
        @sizeBytes,
        @hash,
        @metadataJson,
        @schemaValidationJson,
        @workspaceId,
        @createdAt
      )
    `);
    this.listForRunStatement = db.prepare(
      "select id, run_id, task_id, agent_id, label, kind, format, storage_uri, size_bytes, hash, metadata_json, schema_validation_json, workspace_id, created_at from artifact_metadata where run_id = ? order by created_at asc, rowid asc"
    );
  }

  create(input: CreateArtifactMetadataInput): ArtifactMetadataRecord {
    const createdAt = input.createdAt ?? new Date().toISOString();
    this.insertStatement.run({
      id: input.id,
      runId: input.runId,
      taskId: input.taskId ?? null,
      agentId: input.agentId ?? null,
      label: input.label,
      kind: input.kind,
      format: input.format,
      storageUri: input.storageUri,
      sizeBytes: input.sizeBytes ?? null,
      hash: input.hash ?? null,
      metadataJson: JSON.stringify(input.metadata ?? {}),
      schemaValidationJson: jsonOrNull(input.schemaValidation),
      workspaceId: input.workspaceId ?? "default",
      createdAt
    });
    return {
      id: input.id,
      runId: input.runId,
      ...(input.taskId ? { taskId: input.taskId } : {}),
      ...(input.agentId ? { agentId: input.agentId } : {}),
      label: input.label,
      kind: input.kind,
      format: input.format,
      storageUri: input.storageUri,
      ...(input.sizeBytes !== undefined ? { sizeBytes: input.sizeBytes } : {}),
      ...(input.hash ? { hash: input.hash } : {}),
      metadata: input.metadata ?? {},
      ...(input.schemaValidation !== undefined ? { schemaValidation: input.schemaValidation } : {}),
      workspaceId: input.workspaceId ?? "default",
      createdAt
    };
  }

  listForRun(runId: string): ArtifactMetadataRecord[] {
    return this.listForRunStatement.all(runId).map((row) => mapArtifactMetadataRow(row as ArtifactMetadataRow));
  }
}

function runSelectSql(suffix: string): string {
  return `select id, target_type, target_id, status, backend, agent_id, agent_version, started_at, ended_at, output_json, failure_json, safety_stop_json, verification_status, verification_failures_json, workspace_id, created_at, updated_at from runs ${suffix}`;
}

function mapRunRow(row: RunRow): RunRecord {
  return {
    id: row.id,
    targetType: row.target_type,
    targetId: row.target_id,
    status: row.status,
    ...(row.backend ? { backend: row.backend } : {}),
    ...(row.agent_id ? { agentId: row.agent_id } : {}),
    ...(row.agent_version ? { agentVersion: row.agent_version } : {}),
    ...(row.started_at ? { startedAt: row.started_at } : {}),
    ...(row.ended_at ? { endedAt: row.ended_at } : {}),
    ...(row.output_json ? { output: JSON.parse(row.output_json) as unknown } : {}),
    ...(row.failure_json ? { failure: JSON.parse(row.failure_json) as unknown } : {}),
    ...(row.safety_stop_json ? { safetyStop: JSON.parse(row.safety_stop_json) as unknown } : {}),
    ...(row.verification_status ? { verificationStatus: row.verification_status } : {}),
    ...(row.verification_failures_json
      ? { verificationFailures: JSON.parse(row.verification_failures_json) as VerificationPolicyFailure[] }
      : {}),
    workspaceId: row.workspace_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapRunEventRow(row: RunEventRow): RunEventRecord {
  return {
    id: row.id,
    runId: row.run_id,
    ...(row.task_id ? { taskId: row.task_id } : {}),
    ...(row.mission_id ? { missionId: row.mission_id } : {}),
    ...(row.agent_id ? { agentId: row.agent_id } : {}),
    type: row.type,
    level: row.level,
    timestamp: row.timestamp,
    message: row.message,
    payload: JSON.parse(row.payload_json) as unknown,
    ...(row.parent_event_id ? { parentEventId: row.parent_event_id } : {}),
    ...(row.trace_id ? { traceId: row.trace_id } : {}),
    workspaceId: row.workspace_id
  };
}

function mapArtifactMetadataRow(row: ArtifactMetadataRow): ArtifactMetadataRecord {
  return {
    id: row.id,
    runId: row.run_id,
    ...(row.task_id ? { taskId: row.task_id } : {}),
    ...(row.agent_id ? { agentId: row.agent_id } : {}),
    label: row.label,
    kind: row.kind,
    format: row.format,
    storageUri: row.storage_uri,
    ...(row.size_bytes !== null ? { sizeBytes: row.size_bytes } : {}),
    ...(row.hash ? { hash: row.hash } : {}),
    metadata: JSON.parse(row.metadata_json) as unknown,
    ...(row.schema_validation_json ? { schemaValidation: JSON.parse(row.schema_validation_json) as unknown } : {}),
    workspaceId: row.workspace_id,
    createdAt: row.created_at
  };
}
