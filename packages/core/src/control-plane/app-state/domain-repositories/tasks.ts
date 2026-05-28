import type Database from "better-sqlite3";
import { clampAppStateListLimit, jsonOrNull } from "./shared.js";

export type TaskStatus =
  | "draft"
  | "proposed"
  | "ready"
  | "running"
  | "blocked"
  | "completed"
  | "failed"
  | "cancelled"
  | "archived";

interface TaskRow {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  capability_requirements_json: string;
  assigned_agent_id: string | null;
  assigned_agent_version: string | null;
  inputs_json: string;
  depends_on_json: string;
  mission_id: string | null;
  source_run_id: string | null;
  provenance_json: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
}

export interface TaskRecord {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  capabilityRequirements: string[];
  assignedAgentId?: string;
  assignedAgentVersion?: string;
  inputs: unknown;
  dependsOn: string[];
  missionId?: string;
  sourceRunId?: string;
  provenance?: unknown;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
  archivedAt?: string;
}

export interface CreateTaskInput {
  id: string;
  title: string;
  description?: string;
  status?: TaskStatus;
  capabilityRequirements?: string[];
  assignedAgentId?: string;
  assignedAgentVersion?: string;
  inputs?: unknown;
  dependsOn?: string[];
  missionId?: string;
  sourceRunId?: string;
  provenance?: unknown;
  createdBy?: string;
  now?: Date;
}

export interface UpdateTaskInput {
  title?: string;
  description?: string;
  status?: TaskStatus;
  capabilityRequirements?: string[];
  assignedAgentId?: string;
  assignedAgentVersion?: string;
  inputs?: unknown;
  dependsOn?: string[];
  missionId?: string;
  sourceRunId?: string;
  provenance?: unknown;
  createdBy?: string;
  now?: Date;
}

export interface ListTasksOptions {
  includeArchived?: boolean;
  status?: TaskStatus;
  missionId?: string;
  limit?: number;
}

export class TaskRepository {
  private readonly getStatement: Database.Statement;
  private readonly insertStatement: Database.Statement;
  private readonly updateStatement: Database.Statement;

  constructor(private readonly db: Database.Database) {
    this.getStatement = db.prepare(taskSelectSql("where id = ?"));
    this.insertStatement = db.prepare(`
      insert into tasks (
        id,
        title,
        description,
        status,
        capability_requirements_json,
        assigned_agent_id,
        assigned_agent_version,
        inputs_json,
        depends_on_json,
        mission_id,
        source_run_id,
        provenance_json,
        created_by,
        created_at,
        updated_at,
        archived_at
      )
      values (
        @id,
        @title,
        @description,
        @status,
        @capabilityRequirementsJson,
        @assignedAgentId,
        @assignedAgentVersion,
        @inputsJson,
        @dependsOnJson,
        @missionId,
        @sourceRunId,
        @provenanceJson,
        @createdBy,
        @createdAt,
        @updatedAt,
        @archivedAt
      )
    `);
    this.updateStatement = db.prepare(`
      update tasks set
        title = @title,
        description = @description,
        status = @status,
        capability_requirements_json = @capabilityRequirementsJson,
        assigned_agent_id = @assignedAgentId,
        assigned_agent_version = @assignedAgentVersion,
        inputs_json = @inputsJson,
        depends_on_json = @dependsOnJson,
        mission_id = @missionId,
        source_run_id = @sourceRunId,
        provenance_json = @provenanceJson,
        created_by = @createdBy,
        updated_at = @updatedAt,
        archived_at = @archivedAt
      where id = @id
    `);
  }

  create(input: CreateTaskInput): TaskRecord {
    const status = input.status ?? "draft";
    assertTaskReadyAssignment(status, input.assignedAgentId);
    const now = (input.now ?? new Date()).toISOString();
    this.insertStatement.run({
      id: input.id,
      title: input.title,
      description: input.description ?? "",
      status,
      capabilityRequirementsJson: JSON.stringify(input.capabilityRequirements ?? []),
      assignedAgentId: input.assignedAgentId ?? null,
      assignedAgentVersion: input.assignedAgentVersion ?? null,
      inputsJson: JSON.stringify(input.inputs ?? {}),
      dependsOnJson: JSON.stringify(input.dependsOn ?? []),
      missionId: input.missionId ?? null,
      sourceRunId: input.sourceRunId ?? null,
      provenanceJson: input.provenance === undefined ? null : JSON.stringify(input.provenance),
      createdBy: input.createdBy ?? null,
      createdAt: now,
      updatedAt: now,
      archivedAt: status === "archived" ? now : null
    });
    return this.require(input.id);
  }

  get(id: string): TaskRecord | undefined {
    const row = this.getStatement.get(id) as TaskRow | undefined;
    return row ? mapTaskRow(row) : undefined;
  }

  require(id: string): TaskRecord {
    const task = this.get(id);
    if (!task) {
      throw new Error(`Task not found: ${id}`);
    }
    return task;
  }

  list(options: ListTasksOptions = {}): TaskRecord[] {
    const clauses: string[] = [];
    const params: Record<string, unknown> = {
      limit: clampAppStateListLimit(options.limit)
    };
    if (!options.includeArchived) {
      clauses.push("status != 'archived'");
    }
    if (options.status) {
      clauses.push("status = @status");
      params.status = options.status;
    }
    if (options.missionId) {
      clauses.push("mission_id = @missionId");
      params.missionId = options.missionId;
    }
    const where = clauses.length > 0 ? `where ${clauses.join(" and ")}` : "";
    return this.db
      .prepare(taskSelectSql(`${where} order by updated_at desc, created_at desc limit @limit`))
      .all(params)
      .map((row) => mapTaskRow(row as TaskRow));
  }

  update(id: string, input: UpdateTaskInput): TaskRecord {
    const existing = this.require(id);
    const status = input.status ?? existing.status;
    const assignedAgentId = input.assignedAgentId ?? existing.assignedAgentId;
    assertTaskReadyAssignment(status, assignedAgentId);
    const updatedAt = (input.now ?? new Date()).toISOString();
    this.updateStatement.run({
      id,
      title: input.title ?? existing.title,
      description: input.description ?? existing.description,
      status,
      capabilityRequirementsJson: JSON.stringify(input.capabilityRequirements ?? existing.capabilityRequirements),
      assignedAgentId: assignedAgentId ?? null,
      assignedAgentVersion: input.assignedAgentVersion ?? existing.assignedAgentVersion ?? null,
      inputsJson: JSON.stringify(input.inputs ?? existing.inputs),
      dependsOnJson: JSON.stringify(input.dependsOn ?? existing.dependsOn),
      missionId: input.missionId ?? existing.missionId ?? null,
      sourceRunId: input.sourceRunId ?? existing.sourceRunId ?? null,
      provenanceJson: input.provenance === undefined ? jsonOrNull(existing.provenance) : JSON.stringify(input.provenance),
      createdBy: input.createdBy ?? existing.createdBy ?? null,
      updatedAt,
      archivedAt: status === "archived" ? existing.archivedAt ?? updatedAt : existing.archivedAt ?? null
    });
    return this.require(id);
  }

  archive(id: string, now: Date = new Date()): TaskRecord {
    return this.update(id, { status: "archived", now });
  }
}

function assertTaskReadyAssignment(status: TaskStatus, assignedAgentId: string | undefined): void {
  if (status === "ready" && !assignedAgentId) {
    throw new Error("ready tasks require assignedAgentId");
  }
}

function taskSelectSql(suffix: string): string {
  return `select id, title, description, status, capability_requirements_json, assigned_agent_id, assigned_agent_version, inputs_json, depends_on_json, mission_id, source_run_id, provenance_json, created_by, created_at, updated_at, archived_at from tasks ${suffix}`;
}

function mapTaskRow(row: TaskRow): TaskRecord {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    status: row.status,
    capabilityRequirements: JSON.parse(row.capability_requirements_json) as string[],
    ...(row.assigned_agent_id ? { assignedAgentId: row.assigned_agent_id } : {}),
    ...(row.assigned_agent_version ? { assignedAgentVersion: row.assigned_agent_version } : {}),
    inputs: JSON.parse(row.inputs_json) as unknown,
    dependsOn: JSON.parse(row.depends_on_json) as string[],
    ...(row.mission_id ? { missionId: row.mission_id } : {}),
    ...(row.source_run_id ? { sourceRunId: row.source_run_id } : {}),
    ...(row.provenance_json ? { provenance: JSON.parse(row.provenance_json) as unknown } : {}),
    ...(row.created_by ? { createdBy: row.created_by } : {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    ...(row.archived_at ? { archivedAt: row.archived_at } : {})
  };
}
