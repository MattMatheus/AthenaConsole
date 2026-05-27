import { randomUUID } from "node:crypto";
import type Database from "better-sqlite3";
import type { ScheduleRunLog } from "../../shared/contracts/schedule.js";

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

export type MissionStatus = "draft" | "ready" | "running" | "blocked" | "completed" | "failed" | "cancelled" | "archived";

export type RunTargetType = "task" | "mission";
export type AppStateScheduleTargetType = "task" | "mission" | "workflow-template";
export type AppStateScheduleStatus = "active" | "paused" | "disabled" | "error";
export type RunStatus =
  | "queued"
  | "validating"
  | "running"
  | "waiting-for-approval"
  | "completed"
  | "failed"
  | "cancelled"
  | "stopped-by-limit";

export type RunEventLevel = "debug" | "info" | "warning" | "error";

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

interface MissionRow {
  id: string;
  title: string;
  goal: string;
  context_json: string;
  status: MissionStatus;
  task_order_json: string;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
}

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
  created_at: string;
  updated_at: string;
}

interface ScheduleRow {
  id: string;
  name: string;
  target_type: AppStateScheduleTargetType;
  target_id: string;
  input_bindings_json: string;
  rrule: string | null;
  timezone: string;
  status: AppStateScheduleStatus;
  last_run_id: string | null;
  next_run_at: string | null;
  failure_policy_json: string;
  created_at: string;
  updated_at: string;
}

interface ScheduleRunHistoryRow {
  id: string;
  schedule_id: string;
  session_id: string;
  status: ScheduleRunLog["status"];
  target_type: AppStateScheduleTargetType | null;
  target_id: string | null;
  run_id: string | null;
  mission_id: string | null;
  task_ids_json: string;
  started_at: string;
  finished_at: string | null;
  next_run_at: string | null;
  missed_run_at: string | null;
  reason: string | null;
  error: string | null;
  error_code: ScheduleRunLog["errorCode"] | null;
  created_at: string;
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
  created_at: string;
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
}

export class TaskRepository {
  private readonly getStatement: Database.Statement;
  private readonly listStatement: Database.Statement;
  private readonly insertStatement: Database.Statement;
  private readonly updateStatement: Database.Statement;

  constructor(private readonly db: Database.Database) {
    this.getStatement = db.prepare(taskSelectSql("where id = ?"));
    this.listStatement = db.prepare(taskSelectSql("order by updated_at desc, created_at desc"));
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
    return this.listStatement
      .all()
      .map((row) => mapTaskRow(row as TaskRow))
      .filter((task) => (options.includeArchived ? true : task.status !== "archived"))
      .filter((task) => (options.status ? task.status === options.status : true))
      .filter((task) => (options.missionId ? task.missionId === options.missionId : true));
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

export interface MissionRecord {
  id: string;
  title: string;
  goal: string;
  context: unknown;
  status: MissionStatus;
  taskOrder: string[];
  createdAt: string;
  updatedAt: string;
  archivedAt?: string;
}

export interface CreateMissionInput {
  id: string;
  title: string;
  goal?: string;
  context?: unknown;
  status?: MissionStatus;
  taskOrder?: string[];
  now?: Date;
}

export interface UpdateMissionInput {
  title?: string;
  goal?: string;
  context?: unknown;
  status?: MissionStatus;
  taskOrder?: string[];
  now?: Date;
}

export class MissionRepository {
  private readonly getStatement: Database.Statement;
  private readonly listStatement: Database.Statement;
  private readonly insertStatement: Database.Statement;
  private readonly updateStatement: Database.Statement;

  constructor(private readonly db: Database.Database) {
    this.getStatement = db.prepare(missionSelectSql("where id = ?"));
    this.listStatement = db.prepare(missionSelectSql("order by updated_at desc, created_at desc"));
    this.insertStatement = db.prepare(`
      insert into missions (id, title, goal, context_json, status, task_order_json, created_at, updated_at, archived_at)
      values (@id, @title, @goal, @contextJson, @status, @taskOrderJson, @createdAt, @updatedAt, @archivedAt)
    `);
    this.updateStatement = db.prepare(`
      update missions set
        title = @title,
        goal = @goal,
        context_json = @contextJson,
        status = @status,
        task_order_json = @taskOrderJson,
        updated_at = @updatedAt,
        archived_at = @archivedAt
      where id = @id
    `);
  }

  create(input: CreateMissionInput): MissionRecord {
    const status = input.status ?? "draft";
    const now = (input.now ?? new Date()).toISOString();
    this.insertStatement.run({
      id: input.id,
      title: input.title,
      goal: input.goal ?? "",
      contextJson: JSON.stringify(input.context ?? {}),
      status,
      taskOrderJson: JSON.stringify(input.taskOrder ?? []),
      createdAt: now,
      updatedAt: now,
      archivedAt: status === "archived" ? now : null
    });
    return this.require(input.id);
  }

  get(id: string): MissionRecord | undefined {
    const row = this.getStatement.get(id) as MissionRow | undefined;
    return row ? mapMissionRow(row) : undefined;
  }

  require(id: string): MissionRecord {
    const mission = this.get(id);
    if (!mission) {
      throw new Error(`Mission not found: ${id}`);
    }
    return mission;
  }

  list(options: { includeArchived?: boolean } = {}): MissionRecord[] {
    return this.listStatement
      .all()
      .map((row) => mapMissionRow(row as MissionRow))
      .filter((mission) => (options.includeArchived ? true : mission.status !== "archived"));
  }

  update(id: string, input: UpdateMissionInput): MissionRecord {
    const existing = this.require(id);
    const status = input.status ?? existing.status;
    const updatedAt = (input.now ?? new Date()).toISOString();
    this.updateStatement.run({
      id,
      title: input.title ?? existing.title,
      goal: input.goal ?? existing.goal,
      contextJson: JSON.stringify(input.context ?? existing.context),
      status,
      taskOrderJson: JSON.stringify(input.taskOrder ?? existing.taskOrder),
      updatedAt,
      archivedAt: status === "archived" ? existing.archivedAt ?? updatedAt : existing.archivedAt ?? null
    });
    return this.require(id);
  }

  archive(id: string, now: Date = new Date()): MissionRecord {
    return this.update(id, { status: "archived", now });
  }
}

export interface ScheduleRecord {
  id: string;
  name: string;
  targetType: AppStateScheduleTargetType;
  targetId: string;
  inputBindings: unknown;
  rrule?: string;
  timezone: string;
  status: AppStateScheduleStatus;
  lastRunId?: string;
  nextRunAt?: string;
  failurePolicy: unknown;
  createdAt: string;
  updatedAt: string;
}

export interface CreateScheduleInput {
  id: string;
  name: string;
  targetType: AppStateScheduleTargetType;
  targetId: string;
  inputBindings?: unknown;
  rrule?: string;
  timezone: string;
  status?: AppStateScheduleStatus;
  lastRunId?: string;
  nextRunAt?: string;
  failurePolicy?: unknown;
  now?: Date;
}

export interface UpdateScheduleInput {
  name?: string;
  targetType?: AppStateScheduleTargetType;
  targetId?: string;
  inputBindings?: unknown;
  rrule?: string | null;
  timezone?: string;
  status?: AppStateScheduleStatus;
  lastRunId?: string | null;
  nextRunAt?: string | null;
  failurePolicy?: unknown;
  now?: Date;
}

export class ScheduleRepository {
  private readonly getStatement: Database.Statement;
  private readonly listStatement: Database.Statement;
  private readonly insertStatement: Database.Statement;
  private readonly updateStatement: Database.Statement;
  private readonly deleteStatement: Database.Statement;

  constructor(private readonly db: Database.Database) {
    this.getStatement = db.prepare(scheduleSelectSql("where id = ?"));
    this.listStatement = db.prepare(scheduleSelectSql("order by updated_at desc, created_at desc"));
    this.insertStatement = db.prepare(`
      insert into schedules (
        id,
        name,
        target_type,
        target_id,
        input_bindings_json,
        rrule,
        timezone,
        status,
        last_run_id,
        next_run_at,
        failure_policy_json,
        created_at,
        updated_at
      )
      values (
        @id,
        @name,
        @targetType,
        @targetId,
        @inputBindingsJson,
        @rrule,
        @timezone,
        @status,
        @lastRunId,
        @nextRunAt,
        @failurePolicyJson,
        @createdAt,
        @updatedAt
      )
    `);
    this.updateStatement = db.prepare(`
      update schedules set
        name = @name,
        target_type = @targetType,
        target_id = @targetId,
        input_bindings_json = @inputBindingsJson,
        rrule = @rrule,
        timezone = @timezone,
        status = @status,
        last_run_id = @lastRunId,
        next_run_at = @nextRunAt,
        failure_policy_json = @failurePolicyJson,
        updated_at = @updatedAt
      where id = @id
    `);
    this.deleteStatement = db.prepare("delete from schedules where id = ?");
  }

  create(input: CreateScheduleInput): ScheduleRecord {
    const now = (input.now ?? new Date()).toISOString();
    this.insertStatement.run({
      id: input.id,
      name: input.name,
      targetType: input.targetType,
      targetId: input.targetId,
      inputBindingsJson: JSON.stringify(input.inputBindings ?? {}),
      rrule: input.rrule ?? null,
      timezone: input.timezone,
      status: input.status ?? "active",
      lastRunId: input.lastRunId ?? null,
      nextRunAt: input.nextRunAt ?? null,
      failurePolicyJson: JSON.stringify(input.failurePolicy ?? {}),
      createdAt: now,
      updatedAt: now
    });
    return this.require(input.id);
  }

  get(id: string): ScheduleRecord | undefined {
    const row = this.getStatement.get(id) as ScheduleRow | undefined;
    return row ? mapScheduleRow(row) : undefined;
  }

  require(id: string): ScheduleRecord {
    const schedule = this.get(id);
    if (!schedule) {
      throw new Error(`Schedule not found: ${id}`);
    }
    return schedule;
  }

  list(): ScheduleRecord[] {
    return this.listStatement.all().map((row) => mapScheduleRow(row as ScheduleRow));
  }

  upsert(input: CreateScheduleInput): ScheduleRecord {
    const existing = this.get(input.id);
    if (!existing) {
      return this.create(input);
    }
    return this.update(input.id, {
      name: input.name,
      targetType: input.targetType,
      targetId: input.targetId,
      inputBindings: input.inputBindings,
      rrule: input.rrule ?? null,
      timezone: input.timezone,
      status: input.status,
      lastRunId: input.lastRunId,
      nextRunAt: input.nextRunAt ?? null,
      failurePolicy: input.failurePolicy,
      now: input.now
    });
  }

  update(id: string, input: UpdateScheduleInput): ScheduleRecord {
    const existing = this.require(id);
    const updatedAt = (input.now ?? new Date()).toISOString();
    this.updateStatement.run({
      id,
      name: input.name ?? existing.name,
      targetType: input.targetType ?? existing.targetType,
      targetId: input.targetId ?? existing.targetId,
      inputBindingsJson: JSON.stringify(input.inputBindings ?? existing.inputBindings),
      rrule: input.rrule === undefined ? existing.rrule ?? null : input.rrule,
      timezone: input.timezone ?? existing.timezone,
      status: input.status ?? existing.status,
      lastRunId: input.lastRunId === undefined ? existing.lastRunId ?? null : input.lastRunId,
      nextRunAt: input.nextRunAt === undefined ? existing.nextRunAt ?? null : input.nextRunAt,
      failurePolicyJson: JSON.stringify(input.failurePolicy ?? existing.failurePolicy),
      updatedAt
    });
    return this.require(id);
  }

  delete(id: string): boolean {
    return this.deleteStatement.run(id).changes > 0;
  }
}

export type CreateScheduleRunHistoryInput = Omit<ScheduleRunLog, "id" | "scheduleId"> & {
  id?: string;
  scheduleId: string;
  createdAt?: string;
};

export class ScheduleRunHistoryRepository {
  private readonly insertStatement: Database.Statement;
  private readonly listForScheduleStatement: Database.Statement;

  constructor(private readonly db: Database.Database) {
    this.insertStatement = db.prepare(`
      insert into schedule_run_history (
        id,
        schedule_id,
        session_id,
        status,
        target_type,
        target_id,
        run_id,
        mission_id,
        task_ids_json,
        started_at,
        finished_at,
        next_run_at,
        missed_run_at,
        reason,
        error,
        error_code,
        created_at
      )
      values (
        @id,
        @scheduleId,
        @sessionId,
        @status,
        @targetType,
        @targetId,
        @runId,
        @missionId,
        @taskIdsJson,
        @startedAt,
        @finishedAt,
        @nextRunAt,
        @missedRunAt,
        @reason,
        @error,
        @errorCode,
        @createdAt
      )
    `);
    this.listForScheduleStatement = db.prepare(
      scheduleRunHistorySelectSql("where schedule_id = @scheduleId order by started_at desc, created_at desc limit @limit")
    );
  }

  create(input: CreateScheduleRunHistoryInput): ScheduleRunLog {
    const id = input.id ?? `schedule-run-${randomUUID()}`;
    const createdAt = input.createdAt ?? input.finishedAt ?? input.startedAt;
    this.insertStatement.run({
      id,
      scheduleId: input.scheduleId,
      sessionId: input.sessionId,
      status: input.status,
      targetType: input.targetType ?? null,
      targetId: input.targetId ?? null,
      runId: input.runId ?? null,
      missionId: input.missionId ?? null,
      taskIdsJson: JSON.stringify(input.taskIds ?? []),
      startedAt: input.startedAt,
      finishedAt: input.finishedAt ?? null,
      nextRunAt: input.nextRunAt ?? null,
      missedRunAt: input.missedRunAt ?? null,
      reason: input.reason ?? null,
      error: input.error ?? null,
      errorCode: input.errorCode ?? null,
      createdAt
    });
    return {
      id,
      scheduleId: input.scheduleId,
      sessionId: input.sessionId,
      startedAt: input.startedAt,
      ...(input.finishedAt ? { finishedAt: input.finishedAt } : {}),
      status: input.status,
      ...(input.targetType ? { targetType: input.targetType } : {}),
      ...(input.targetId ? { targetId: input.targetId } : {}),
      ...(input.runId ? { runId: input.runId } : {}),
      ...(input.missionId ? { missionId: input.missionId } : {}),
      ...(input.taskIds && input.taskIds.length > 0 ? { taskIds: input.taskIds } : {}),
      ...(input.nextRunAt ? { nextRunAt: input.nextRunAt } : {}),
      ...(input.missedRunAt ? { missedRunAt: input.missedRunAt } : {}),
      ...(input.reason ? { reason: input.reason } : {}),
      ...(input.error ? { error: input.error } : {}),
      ...(input.errorCode ? { errorCode: input.errorCode } : {})
    };
  }

  listForSchedule(scheduleId: string, options: { limit?: number } = {}): ScheduleRunLog[] {
    const limit = Math.max(1, Math.min(options.limit ?? 20, 100));
    return this.listForScheduleStatement
      .all({ scheduleId, limit })
      .map((row) => mapScheduleRunHistoryRow(row as ScheduleRunHistoryRow));
  }
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
  now?: Date;
}

export class RunRepository {
  private readonly getStatement: Database.Statement;
  private readonly listStatement: Database.Statement;
  private readonly insertStatement: Database.Statement;
  private readonly updateStatement: Database.Statement;

  constructor(private readonly db: Database.Database) {
    this.getStatement = db.prepare(runSelectSql("where id = ?"));
    this.listStatement = db.prepare(runSelectSql("order by created_at desc"));
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

  list(options: { targetType?: RunTargetType; targetId?: string } = {}): RunRecord[] {
    return this.listStatement
      .all()
      .map((row) => mapRunRow(row as RunRow))
      .filter((run) => (options.targetType ? run.targetType === options.targetType : true))
      .filter((run) => (options.targetId ? run.targetId === options.targetId : true));
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
        trace_id
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
        @traceId
      )
    `);
    this.listForRunStatement = db.prepare(
      "select id, run_id, task_id, mission_id, agent_id, type, level, timestamp, message, payload_json, parent_event_id, trace_id from run_events where run_id = ? order by timestamp asc, rowid asc"
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
      traceId: input.traceId ?? null
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
      ...(input.traceId ? { traceId: input.traceId } : {})
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
        @createdAt
      )
    `);
    this.listForRunStatement = db.prepare(
      "select id, run_id, task_id, agent_id, label, kind, format, storage_uri, size_bytes, hash, metadata_json, schema_validation_json, created_at from artifact_metadata where run_id = ? order by created_at asc, rowid asc"
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
      createdAt
    };
  }

  listForRun(runId: string): ArtifactMetadataRecord[] {
    return this.listForRunStatement.all(runId).map((row) => mapArtifactMetadataRow(row as ArtifactMetadataRow));
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

function missionSelectSql(suffix: string): string {
  return `select id, title, goal, context_json, status, task_order_json, created_at, updated_at, archived_at from missions ${suffix}`;
}

function scheduleSelectSql(suffix: string): string {
  return `select id, name, target_type, target_id, input_bindings_json, rrule, timezone, status, last_run_id, next_run_at, failure_policy_json, created_at, updated_at from schedules ${suffix}`;
}

function scheduleRunHistorySelectSql(suffix: string): string {
  return `select id, schedule_id, session_id, status, target_type, target_id, run_id, mission_id, task_ids_json, started_at, finished_at, next_run_at, missed_run_at, reason, error, error_code, created_at from schedule_run_history ${suffix}`;
}

function runSelectSql(suffix: string): string {
  return `select id, target_type, target_id, status, backend, agent_id, agent_version, started_at, ended_at, output_json, failure_json, safety_stop_json, created_at, updated_at from runs ${suffix}`;
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

function mapMissionRow(row: MissionRow): MissionRecord {
  return {
    id: row.id,
    title: row.title,
    goal: row.goal,
    context: JSON.parse(row.context_json) as unknown,
    status: row.status,
    taskOrder: JSON.parse(row.task_order_json) as string[],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    ...(row.archived_at ? { archivedAt: row.archived_at } : {})
  };
}

function mapScheduleRow(row: ScheduleRow): ScheduleRecord {
  return {
    id: row.id,
    name: row.name,
    targetType: row.target_type,
    targetId: row.target_id,
    inputBindings: JSON.parse(row.input_bindings_json) as unknown,
    ...(row.rrule ? { rrule: row.rrule } : {}),
    timezone: row.timezone,
    status: row.status,
    ...(row.last_run_id ? { lastRunId: row.last_run_id } : {}),
    ...(row.next_run_at ? { nextRunAt: row.next_run_at } : {}),
    failurePolicy: JSON.parse(row.failure_policy_json) as unknown,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapScheduleRunHistoryRow(row: ScheduleRunHistoryRow): ScheduleRunLog {
  const taskIds = JSON.parse(row.task_ids_json) as unknown;
  return {
    id: row.id,
    scheduleId: row.schedule_id,
    sessionId: row.session_id,
    startedAt: row.started_at,
    ...(row.finished_at ? { finishedAt: row.finished_at } : {}),
    status: row.status,
    ...(row.target_type ? { targetType: row.target_type } : {}),
    ...(row.target_id ? { targetId: row.target_id } : {}),
    ...(row.run_id ? { runId: row.run_id } : {}),
    ...(row.mission_id ? { missionId: row.mission_id } : {}),
    ...(Array.isArray(taskIds) && taskIds.length > 0
      ? { taskIds: taskIds.filter((item): item is string => typeof item === "string") }
      : {}),
    ...(row.next_run_at ? { nextRunAt: row.next_run_at } : {}),
    ...(row.missed_run_at ? { missedRunAt: row.missed_run_at } : {}),
    ...(row.reason ? { reason: row.reason } : {}),
    ...(row.error ? { error: row.error } : {}),
    ...(row.error_code ? { errorCode: row.error_code } : {})
  };
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
    ...(row.trace_id ? { traceId: row.trace_id } : {})
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
    createdAt: row.created_at
  };
}

function jsonOrNull(value: unknown): string | null {
  return value === undefined ? null : JSON.stringify(value);
}
