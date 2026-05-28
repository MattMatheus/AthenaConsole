import { randomUUID } from "node:crypto";
import type Database from "better-sqlite3";
import type { ScheduleRunLog } from "../../../shared/contracts/schedule.js";
import { clampAppStateListLimit } from "./shared.js";

export type AppStateScheduleTargetType = "task" | "mission" | "workflow-template";
export type AppStateScheduleStatus = "active" | "paused" | "disabled" | "error";

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
  workflow_dag_run_id: string | null;
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
  private readonly countStatement: Database.Statement;
  private readonly insertStatement: Database.Statement;
  private readonly updateStatement: Database.Statement;
  private readonly deleteStatement: Database.Statement;

  constructor(private readonly db: Database.Database) {
    this.getStatement = db.prepare(scheduleSelectSql("where id = ?"));
    this.countStatement = db.prepare("select count(*) as count from schedules");
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

  list(options: { status?: AppStateScheduleStatus; dueAt?: Date; limit?: number } = {}): ScheduleRecord[] {
    const clauses: string[] = [];
    const params: Record<string, unknown> = {
      limit: clampAppStateListLimit(options.limit)
    };
    if (options.status) {
      clauses.push("status = @status");
      params.status = options.status;
    }
    if (options.dueAt) {
      clauses.push("next_run_at is not null");
      clauses.push("next_run_at <= @dueAt");
      params.dueAt = options.dueAt.toISOString();
    }
    const where = clauses.length > 0 ? `where ${clauses.join(" and ")}` : "";
    return this.db
      .prepare(scheduleSelectSql(`${where} order by updated_at desc, created_at desc limit @limit`))
      .all(params)
      .map((row) => mapScheduleRow(row as ScheduleRow));
  }

  count(): number {
    const row = this.countStatement.get() as { count: number };
    return row.count;
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
        workflow_dag_run_id,
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
        @workflowDagRunId,
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
      workflowDagRunId: input.workflowDagRunId ?? null,
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
      ...(input.workflowDagRunId ? { workflowDagRunId: input.workflowDagRunId } : {}),
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


function scheduleSelectSql(suffix: string): string {
  return `select id, name, target_type, target_id, input_bindings_json, rrule, timezone, status, last_run_id, next_run_at, failure_policy_json, created_at, updated_at from schedules ${suffix}`;
}

function scheduleRunHistorySelectSql(suffix: string): string {
  return `select id, schedule_id, session_id, status, target_type, target_id, run_id, workflow_dag_run_id, mission_id, task_ids_json, started_at, finished_at, next_run_at, missed_run_at, reason, error, error_code, created_at from schedule_run_history ${suffix}`;
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
    ...(row.workflow_dag_run_id ? { workflowDagRunId: row.workflow_dag_run_id } : {}),
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
