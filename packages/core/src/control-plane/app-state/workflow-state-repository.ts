import { randomUUID } from "node:crypto";
import type Database from "better-sqlite3";

export type WorkflowDagRunStatus = "pending" | "running" | "completed" | "failed" | "resumable" | "cancelled";
export type WorkflowDagStepStatus = "pending" | "running" | "completed" | "failed" | "skipped" | "cancelled";
export type WorkflowDagStepAttemptStatus = "running" | "completed" | "failed" | "cancelled";
export type WorkflowDagRunEventLevel = "info" | "warning" | "error";

interface WorkflowDagRunRow {
  id: string;
  workflow_template_id: string;
  workflow_template_version: string | null;
  plugin_id: string | null;
  plugin_version: string | null;
  status: WorkflowDagRunStatus;
  step_order_json: string;
  dependencies_json: string;
  failure_json: string | null;
  created_at: string;
  updated_at: string;
  started_at: string | null;
  finished_at: string | null;
}

interface WorkflowDagRunStepRow {
  run_id: string;
  step_id: string;
  status: WorkflowDagStepStatus;
  attempt: number;
  ready: number;
  dependencies_json: string;
  blocking_step_ids_json: string;
  started_at: string | null;
  finished_at: string | null;
  failure_json: string | null;
  output_json: string | null;
  updated_at: string;
}

interface WorkflowDagRunEventRow {
  id: string;
  run_id: string;
  step_id: string | null;
  type: string;
  level: WorkflowDagRunEventLevel;
  message: string;
  payload_json: string;
  timestamp: string;
}

interface WorkflowDagRunStepAttemptRow {
  run_id: string;
  step_id: string;
  attempt: number;
  status: WorkflowDagStepAttemptStatus;
  started_at: string;
  finished_at: string | null;
  failure_json: string | null;
  output_json: string | null;
  updated_at: string;
}

export interface WorkflowDagRunRecord {
  id: string;
  workflowTemplateId: string;
  workflowTemplateVersion?: string;
  pluginId?: string;
  pluginVersion?: string;
  status: WorkflowDagRunStatus;
  stepOrder: string[];
  dependencies: Record<string, string[]>;
  failure?: unknown;
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  finishedAt?: string;
}

export interface WorkflowDagStepRecord {
  runId: string;
  stepId: string;
  status: WorkflowDagStepStatus;
  attempt: number;
  ready: boolean;
  dependencies: string[];
  blockingStepIds: string[];
  startedAt?: string;
  finishedAt?: string;
  failure?: unknown;
  output?: unknown;
  updatedAt: string;
}

export interface WorkflowDagStepAttemptRecord {
  runId: string;
  stepId: string;
  attempt: number;
  status: WorkflowDagStepAttemptStatus;
  startedAt: string;
  finishedAt?: string;
  failure?: unknown;
  output?: unknown;
  updatedAt: string;
}

export interface WorkflowDagRunEventRecord {
  id: string;
  runId: string;
  stepId?: string;
  type: string;
  level: WorkflowDagRunEventLevel;
  message: string;
  payload: unknown;
  timestamp: string;
}

export interface WorkflowDagRunSnapshot {
  run: WorkflowDagRunRecord;
  steps: WorkflowDagStepRecord[];
  attempts: WorkflowDagStepAttemptRecord[];
  events: WorkflowDagRunEventRecord[];
}

export interface CreateWorkflowDagRunInput {
  id?: string;
  workflowTemplateId: string;
  workflowTemplateVersion?: string;
  pluginId?: string;
  pluginVersion?: string;
  stepOrder: string[];
  dependencies: Record<string, string[]>;
  now?: Date;
}

export interface ListWorkflowDagRunsOptions {
  status?: WorkflowDagRunStatus;
  limit?: number;
}

export interface UpdateWorkflowDagRunInput {
  status?: WorkflowDagRunStatus;
  failure?: unknown;
  startedAt?: string | null;
  finishedAt?: string | null;
  now?: Date;
}

export interface UpdateWorkflowDagStepInput {
  status?: WorkflowDagStepStatus;
  attempt?: number;
  ready?: boolean;
  blockingStepIds?: string[];
  startedAt?: string | null;
  finishedAt?: string | null;
  failure?: unknown;
  output?: unknown;
  now?: Date;
}

export interface StartWorkflowDagStepAttemptInput {
  runId: string;
  stepId: string;
  attempt: number;
  startedAt: string;
  now?: Date;
}

export interface FinishWorkflowDagStepAttemptInput {
  runId: string;
  stepId: string;
  attempt: number;
  status: Exclude<WorkflowDagStepAttemptStatus, "running">;
  finishedAt: string;
  failure?: unknown;
  output?: unknown;
  now?: Date;
}

export class WorkflowDagRunRepository {
  private readonly getRunStatement: Database.Statement;
  private readonly listRunsForTemplateStatement: Database.Statement;
  private readonly insertRunStatement: Database.Statement;
  private readonly updateRunStatement: Database.Statement;
  private readonly insertStepStatement: Database.Statement;
  private readonly updateStepStatement: Database.Statement;
  private readonly listStepsStatement: Database.Statement;
  private readonly insertAttemptStatement: Database.Statement;
  private readonly updateAttemptStatement: Database.Statement;
  private readonly listAttemptsStatement: Database.Statement;
  private readonly insertEventStatement: Database.Statement;
  private readonly listEventsStatement: Database.Statement;

  constructor(private readonly db: Database.Database) {
    this.getRunStatement = db.prepare(workflowDagRunSelectSql("where id = ?"));
    this.listRunsForTemplateStatement = db.prepare(
      workflowDagRunSelectSql("where workflow_template_id = ? order by updated_at desc, created_at desc")
    );
    this.insertRunStatement = db.prepare(`
      insert into workflow_dag_runs (
        id,
        workflow_template_id,
        workflow_template_version,
        plugin_id,
        plugin_version,
        status,
        step_order_json,
        dependencies_json,
        failure_json,
        created_at,
        updated_at,
        started_at,
        finished_at
      )
      values (
        @id,
        @workflowTemplateId,
        @workflowTemplateVersion,
        @pluginId,
        @pluginVersion,
        @status,
        @stepOrderJson,
        @dependenciesJson,
        @failureJson,
        @createdAt,
        @updatedAt,
        @startedAt,
        @finishedAt
      )
    `);
    this.updateRunStatement = db.prepare(`
      update workflow_dag_runs set
        status = @status,
        failure_json = @failureJson,
        updated_at = @updatedAt,
        started_at = @startedAt,
        finished_at = @finishedAt
      where id = @id
    `);
    this.insertStepStatement = db.prepare(`
      insert into workflow_dag_run_steps (
        run_id,
        step_id,
        status,
        attempt,
        ready,
        dependencies_json,
        blocking_step_ids_json,
        started_at,
        finished_at,
        failure_json,
        output_json,
        updated_at
      )
      values (
        @runId,
        @stepId,
        @status,
        @attempt,
        @ready,
        @dependenciesJson,
        @blockingStepIdsJson,
        @startedAt,
        @finishedAt,
        @failureJson,
        @outputJson,
        @updatedAt
      )
    `);
    this.updateStepStatement = db.prepare(`
      update workflow_dag_run_steps set
        status = @status,
        attempt = @attempt,
        ready = @ready,
        blocking_step_ids_json = @blockingStepIdsJson,
        started_at = @startedAt,
        finished_at = @finishedAt,
        failure_json = @failureJson,
        output_json = @outputJson,
        updated_at = @updatedAt
      where run_id = @runId and step_id = @stepId
    `);
    this.listStepsStatement = db.prepare(
      "select run_id, step_id, status, attempt, ready, dependencies_json, blocking_step_ids_json, started_at, finished_at, failure_json, output_json, updated_at from workflow_dag_run_steps where run_id = ? order by rowid asc"
    );
    this.insertAttemptStatement = db.prepare(`
      insert into workflow_dag_run_step_attempts (
        run_id,
        step_id,
        attempt,
        status,
        started_at,
        finished_at,
        failure_json,
        output_json,
        updated_at
      )
      values (
        @runId,
        @stepId,
        @attempt,
        @status,
        @startedAt,
        @finishedAt,
        @failureJson,
        @outputJson,
        @updatedAt
      )
      on conflict (run_id, step_id, attempt) do update set
        status = excluded.status,
        started_at = excluded.started_at,
        finished_at = excluded.finished_at,
        failure_json = excluded.failure_json,
        output_json = excluded.output_json,
        updated_at = excluded.updated_at
    `);
    this.updateAttemptStatement = db.prepare(`
      update workflow_dag_run_step_attempts set
        status = @status,
        finished_at = @finishedAt,
        failure_json = @failureJson,
        output_json = @outputJson,
        updated_at = @updatedAt
      where run_id = @runId and step_id = @stepId and attempt = @attempt
    `);
    this.listAttemptsStatement = db.prepare(
      "select run_id, step_id, attempt, status, started_at, finished_at, failure_json, output_json, updated_at from workflow_dag_run_step_attempts where run_id = ? order by step_id asc, attempt asc"
    );
    this.insertEventStatement = db.prepare(`
      insert into workflow_dag_run_events (
        id,
        run_id,
        step_id,
        type,
        level,
        message,
        payload_json,
        timestamp
      )
      values (
        @id,
        @runId,
        @stepId,
        @type,
        @level,
        @message,
        @payloadJson,
        @timestamp
      )
    `);
    this.listEventsStatement = db.prepare(
      "select id, run_id, step_id, type, level, message, payload_json, timestamp from workflow_dag_run_events where run_id = ? order by timestamp asc, rowid asc"
    );
  }

  create(input: CreateWorkflowDagRunInput): WorkflowDagRunSnapshot {
    const id = input.id ?? `workflow-run-${randomUUID()}`;
    const now = (input.now ?? new Date()).toISOString();
    const createTransaction = this.db.transaction(() => {
      this.insertRunStatement.run({
        id,
        workflowTemplateId: input.workflowTemplateId,
        workflowTemplateVersion: input.workflowTemplateVersion ?? null,
        pluginId: input.pluginId ?? null,
        pluginVersion: input.pluginVersion ?? null,
        status: "pending",
        stepOrderJson: JSON.stringify(input.stepOrder),
        dependenciesJson: JSON.stringify(input.dependencies),
        failureJson: null,
        createdAt: now,
        updatedAt: now,
        startedAt: null,
        finishedAt: null
      });
      for (const stepId of input.stepOrder) {
        const dependencies = input.dependencies[stepId] ?? [];
        this.insertStepStatement.run({
          runId: id,
          stepId,
          status: "pending",
          attempt: 0,
          ready: dependencies.length === 0 ? 1 : 0,
          dependenciesJson: JSON.stringify(dependencies),
          blockingStepIdsJson: JSON.stringify(dependencies),
          startedAt: null,
          finishedAt: null,
          failureJson: null,
          outputJson: null,
          updatedAt: now
        });
      }
      this.appendEventInternal({
        id: `workflow-event-${randomUUID()}`,
        runId: id,
        type: "workflow.created",
        level: "info",
        message: "Workflow DAG run state created.",
        payload: {},
        timestamp: now
      });
    });
    createTransaction();
    return this.requireSnapshot(id);
  }

  get(id: string): WorkflowDagRunRecord | undefined {
    const row = this.getRunStatement.get(id) as WorkflowDagRunRow | undefined;
    return row ? mapWorkflowDagRunRow(row) : undefined;
  }

  require(id: string): WorkflowDagRunRecord {
    const run = this.get(id);
    if (!run) {
      throw new Error(`Workflow DAG run not found: ${id}`);
    }
    return run;
  }

  getSnapshot(id: string): WorkflowDagRunSnapshot | undefined {
    const run = this.get(id);
    if (!run) {
      return undefined;
    }
    return {
      run,
      steps: this.listSteps(id),
      attempts: this.listAttempts(id),
      events: this.listEvents(id)
    };
  }

  requireSnapshot(id: string): WorkflowDagRunSnapshot {
    const snapshot = this.getSnapshot(id);
    if (!snapshot) {
      throw new Error(`Workflow DAG run not found: ${id}`);
    }
    return snapshot;
  }

  listForTemplate(workflowTemplateId: string): WorkflowDagRunRecord[] {
    return this.listRunsForTemplateStatement
      .all(workflowTemplateId)
      .map((row) => mapWorkflowDagRunRow(row as WorkflowDagRunRow));
  }

  list(options: ListWorkflowDagRunsOptions = {}): WorkflowDagRunRecord[] {
    const clauses: string[] = [];
    const params: Record<string, unknown> = {
      limit: clampWorkflowDagRunListLimit(options.limit)
    };
    if (options.status) {
      clauses.push("status = @status");
      params.status = options.status;
    }
    const where = clauses.length > 0 ? `where ${clauses.join(" and ")}` : "";
    return this.db
      .prepare(workflowDagRunSelectSql(`${where} order by updated_at desc, created_at desc limit @limit`))
      .all(params)
      .map((row) => mapWorkflowDagRunRow(row as WorkflowDagRunRow));
  }

  listSteps(runId: string): WorkflowDagStepRecord[] {
    return this.listStepsStatement.all(runId).map((row) => mapWorkflowDagStepRow(row as WorkflowDagRunStepRow));
  }

  listEvents(runId: string): WorkflowDagRunEventRecord[] {
    return this.listEventsStatement.all(runId).map((row) => mapWorkflowDagRunEventRow(row as WorkflowDagRunEventRow));
  }

  listAttempts(runId: string): WorkflowDagStepAttemptRecord[] {
    return this.listAttemptsStatement.all(runId).map((row) => mapWorkflowDagStepAttemptRow(row as WorkflowDagRunStepAttemptRow));
  }

  updateRun(id: string, input: UpdateWorkflowDagRunInput): WorkflowDagRunRecord {
    const existing = this.require(id);
    const updatedAt = (input.now ?? new Date()).toISOString();
    this.updateRunStatement.run({
      id,
      status: input.status ?? existing.status,
      failureJson: input.failure === undefined ? jsonOrNull(existing.failure) : jsonOrNull(input.failure),
      updatedAt,
      startedAt: input.startedAt === undefined ? existing.startedAt ?? null : input.startedAt,
      finishedAt: input.finishedAt === undefined ? existing.finishedAt ?? null : input.finishedAt
    });
    return this.require(id);
  }

  updateStep(runId: string, stepId: string, input: UpdateWorkflowDagStepInput): WorkflowDagStepRecord {
    const existing = this.requireStep(runId, stepId);
    const updatedAt = (input.now ?? new Date()).toISOString();
    this.updateStepStatement.run({
      runId,
      stepId,
      status: input.status ?? existing.status,
      attempt: input.attempt ?? existing.attempt,
      ready: (input.ready ?? existing.ready) ? 1 : 0,
      blockingStepIdsJson: JSON.stringify(input.blockingStepIds ?? existing.blockingStepIds),
      startedAt: input.startedAt === undefined ? existing.startedAt ?? null : input.startedAt,
      finishedAt: input.finishedAt === undefined ? existing.finishedAt ?? null : input.finishedAt,
      failureJson: input.failure === undefined ? jsonOrNull(existing.failure) : jsonOrNull(input.failure),
      outputJson: input.output === undefined ? jsonOrNull(existing.output) : jsonOrNull(input.output),
      updatedAt
    });
    return this.requireStep(runId, stepId);
  }

  startAttempt(input: StartWorkflowDagStepAttemptInput): WorkflowDagStepAttemptRecord {
    const updatedAt = (input.now ?? new Date()).toISOString();
    this.insertAttemptStatement.run({
      runId: input.runId,
      stepId: input.stepId,
      attempt: input.attempt,
      status: "running",
      startedAt: input.startedAt,
      finishedAt: null,
      failureJson: null,
      outputJson: null,
      updatedAt
    });
    return this.requireAttempt(input.runId, input.stepId, input.attempt);
  }

  finishAttempt(input: FinishWorkflowDagStepAttemptInput): WorkflowDagStepAttemptRecord {
    const updatedAt = (input.now ?? new Date()).toISOString();
    const params = {
      runId: input.runId,
      stepId: input.stepId,
      attempt: input.attempt,
      status: input.status,
      finishedAt: input.finishedAt,
      failureJson: jsonOrNull(input.failure),
      outputJson: jsonOrNull(input.output),
      updatedAt
    };
    const result = this.updateAttemptStatement.run(params);
    if (result.changes === 0) {
      this.insertAttemptStatement.run({
        ...params,
        startedAt: input.finishedAt
      });
    }
    return this.requireAttempt(input.runId, input.stepId, input.attempt);
  }

  appendEvent(input: {
    id?: string;
    runId: string;
    stepId?: string;
    type: string;
    level?: WorkflowDagRunEventLevel;
    message?: string;
    payload?: unknown;
    timestamp?: string;
  }): WorkflowDagRunEventRecord {
    const event = {
      id: input.id ?? `workflow-event-${randomUUID()}`,
      runId: input.runId,
      ...(input.stepId ? { stepId: input.stepId } : {}),
      type: input.type,
      level: input.level ?? "info",
      message: input.message ?? "",
      payload: input.payload ?? {},
      timestamp: input.timestamp ?? new Date().toISOString()
    };
    this.appendEventInternal(event);
    return event;
  }

  private requireStep(runId: string, stepId: string): WorkflowDagStepRecord {
    const step = this.listSteps(runId).find((candidate) => candidate.stepId === stepId);
    if (!step) {
      throw new Error(`Workflow DAG step not found: ${runId}/${stepId}`);
    }
    return step;
  }

  private requireAttempt(runId: string, stepId: string, attempt: number): WorkflowDagStepAttemptRecord {
    const record = this.listAttempts(runId).find((candidate) => candidate.stepId === stepId && candidate.attempt === attempt);
    if (!record) {
      throw new Error(`Workflow DAG step attempt not found: ${runId}/${stepId}/${attempt}`);
    }
    return record;
  }

  private appendEventInternal(input: WorkflowDagRunEventRecord): void {
    this.insertEventStatement.run({
      id: input.id,
      runId: input.runId,
      stepId: input.stepId ?? null,
      type: input.type,
      level: input.level,
      message: input.message,
      payloadJson: JSON.stringify(input.payload),
      timestamp: input.timestamp
    });
  }
}

function workflowDagRunSelectSql(suffix: string): string {
  return `select id, workflow_template_id, workflow_template_version, plugin_id, plugin_version, status, step_order_json, dependencies_json, failure_json, created_at, updated_at, started_at, finished_at from workflow_dag_runs ${suffix}`;
}

function mapWorkflowDagRunRow(row: WorkflowDagRunRow): WorkflowDagRunRecord {
  return {
    id: row.id,
    workflowTemplateId: row.workflow_template_id,
    ...(row.workflow_template_version ? { workflowTemplateVersion: row.workflow_template_version } : {}),
    ...(row.plugin_id ? { pluginId: row.plugin_id } : {}),
    ...(row.plugin_version ? { pluginVersion: row.plugin_version } : {}),
    status: row.status,
    stepOrder: JSON.parse(row.step_order_json) as string[],
    dependencies: JSON.parse(row.dependencies_json) as Record<string, string[]>,
    ...(row.failure_json ? { failure: JSON.parse(row.failure_json) as unknown } : {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    ...(row.started_at ? { startedAt: row.started_at } : {}),
    ...(row.finished_at ? { finishedAt: row.finished_at } : {})
  };
}

function mapWorkflowDagStepRow(row: WorkflowDagRunStepRow): WorkflowDagStepRecord {
  return {
    runId: row.run_id,
    stepId: row.step_id,
    status: row.status,
    attempt: row.attempt,
    ready: row.ready === 1,
    dependencies: JSON.parse(row.dependencies_json) as string[],
    blockingStepIds: JSON.parse(row.blocking_step_ids_json) as string[],
    ...(row.started_at ? { startedAt: row.started_at } : {}),
    ...(row.finished_at ? { finishedAt: row.finished_at } : {}),
    ...(row.failure_json ? { failure: JSON.parse(row.failure_json) as unknown } : {}),
    ...(row.output_json ? { output: JSON.parse(row.output_json) as unknown } : {}),
    updatedAt: row.updated_at
  };
}

function mapWorkflowDagStepAttemptRow(row: WorkflowDagRunStepAttemptRow): WorkflowDagStepAttemptRecord {
  return {
    runId: row.run_id,
    stepId: row.step_id,
    attempt: row.attempt,
    status: row.status,
    startedAt: row.started_at,
    ...(row.finished_at ? { finishedAt: row.finished_at } : {}),
    ...(row.failure_json ? { failure: JSON.parse(row.failure_json) as unknown } : {}),
    ...(row.output_json ? { output: JSON.parse(row.output_json) as unknown } : {}),
    updatedAt: row.updated_at
  };
}

function mapWorkflowDagRunEventRow(row: WorkflowDagRunEventRow): WorkflowDagRunEventRecord {
  return {
    id: row.id,
    runId: row.run_id,
    ...(row.step_id ? { stepId: row.step_id } : {}),
    type: row.type,
    level: row.level,
    message: row.message,
    payload: JSON.parse(row.payload_json) as unknown,
    timestamp: row.timestamp
  };
}

function jsonOrNull(value: unknown): string | null {
  return value === undefined ? null : JSON.stringify(value);
}

function clampWorkflowDagRunListLimit(limit: number | undefined): number {
  if (limit === undefined || !Number.isFinite(limit)) {
    return 500;
  }
  return Math.max(1, Math.min(Math.trunc(limit), 1000));
}
