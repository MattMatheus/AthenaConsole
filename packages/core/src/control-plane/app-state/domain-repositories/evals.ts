import type Database from "better-sqlite3";
import type {
  EvalFailureDetail,
  EvalResultRecord,
  EvalResultStatus,
  EvalRunRecord,
  EvalRunStatus,
  EvalSuiteRecord,
  EvalSuiteStatus
} from "../../../shared/contracts/evals.js";
import { clampAppStateListLimit, jsonOrNull } from "./shared.js";

interface EvalSuiteRow {
  id: string;
  name: string;
  description: string;
  status: EvalSuiteStatus;
  metadata_json: string;
  created_at: string;
  updated_at: string;
}

interface EvalRunRow {
  id: string;
  suite_id: string;
  source_run_id: string | null;
  agent_id: string;
  agent_version: string;
  provider_id: string | null;
  provider_kind: string | null;
  model: string | null;
  prompt_template_id: string | null;
  prompt_template_version: string | null;
  prompt_template_hash: string;
  status: EvalRunStatus;
  started_at: string | null;
  finished_at: string | null;
  failure_json: string | null;
  metadata_json: string;
  created_at: string;
  updated_at: string;
}

interface EvalResultRow {
  id: string;
  eval_run_id: string;
  case_id: string;
  status: EvalResultStatus;
  score: number | null;
  expected_artifact_uri: string | null;
  actual_artifact_uri: string | null;
  failure_json: string | null;
  metrics_json: string;
  metadata_json: string;
  created_at: string;
}

export interface CreateEvalSuiteInput {
  id: string;
  name: string;
  description?: string;
  status?: EvalSuiteStatus;
  metadata?: unknown;
  now?: Date;
}

export interface UpdateEvalSuiteInput {
  name?: string;
  description?: string;
  status?: EvalSuiteStatus;
  metadata?: unknown;
  now?: Date;
}

export interface ListEvalSuitesOptions {
  status?: EvalSuiteStatus;
  limit?: number;
}

export interface CreateEvalRunInput {
  id: string;
  suiteId: string;
  sourceRunId?: string;
  agentId: string;
  agentVersion: string;
  providerId?: string;
  providerKind?: string;
  model?: string;
  promptTemplateId?: string;
  promptTemplateVersion?: string;
  promptTemplateHash: string;
  status?: EvalRunStatus;
  startedAt?: string;
  finishedAt?: string;
  failure?: EvalFailureDetail;
  metadata?: unknown;
  now?: Date;
}

export interface UpdateEvalRunInput {
  sourceRunId?: string | null;
  providerId?: string | null;
  providerKind?: string | null;
  model?: string | null;
  promptTemplateId?: string | null;
  promptTemplateVersion?: string | null;
  promptTemplateHash?: string;
  status?: EvalRunStatus;
  startedAt?: string | null;
  finishedAt?: string | null;
  failure?: EvalFailureDetail | null;
  metadata?: unknown;
  now?: Date;
}

export interface ListEvalRunsOptions {
  suiteId?: string;
  agentId?: string;
  agentVersion?: string;
  status?: EvalRunStatus;
  limit?: number;
}

export interface CreateEvalResultInput {
  id: string;
  evalRunId: string;
  caseId: string;
  status: EvalResultStatus;
  score?: number;
  expectedArtifactUri?: string;
  actualArtifactUri?: string;
  failure?: EvalFailureDetail;
  metrics?: unknown;
  metadata?: unknown;
  createdAt?: string;
}

export interface ListEvalResultsOptions {
  evalRunId: string;
  status?: EvalResultStatus;
  limit?: number;
}

export class EvalRepository {
  private readonly getSuiteStatement: Database.Statement;
  private readonly insertSuiteStatement: Database.Statement;
  private readonly updateSuiteStatement: Database.Statement;
  private readonly getRunStatement: Database.Statement;
  private readonly insertRunStatement: Database.Statement;
  private readonly updateRunStatement: Database.Statement;
  private readonly getResultStatement: Database.Statement;
  private readonly insertResultStatement: Database.Statement;

  constructor(private readonly db: Database.Database) {
    this.getSuiteStatement = db.prepare(evalSuiteSelectSql("where id = ?"));
    this.insertSuiteStatement = db.prepare(`
      insert into eval_suites (id, name, description, status, metadata_json, created_at, updated_at)
      values (@id, @name, @description, @status, @metadataJson, @createdAt, @updatedAt)
    `);
    this.updateSuiteStatement = db.prepare(`
      update eval_suites set
        name = @name,
        description = @description,
        status = @status,
        metadata_json = @metadataJson,
        updated_at = @updatedAt
      where id = @id
    `);

    this.getRunStatement = db.prepare(evalRunSelectSql("where id = ?"));
    this.insertRunStatement = db.prepare(`
      insert into eval_runs (
        id,
        suite_id,
        source_run_id,
        agent_id,
        agent_version,
        provider_id,
        provider_kind,
        model,
        prompt_template_id,
        prompt_template_version,
        prompt_template_hash,
        status,
        started_at,
        finished_at,
        failure_json,
        metadata_json,
        created_at,
        updated_at
      )
      values (
        @id,
        @suiteId,
        @sourceRunId,
        @agentId,
        @agentVersion,
        @providerId,
        @providerKind,
        @model,
        @promptTemplateId,
        @promptTemplateVersion,
        @promptTemplateHash,
        @status,
        @startedAt,
        @finishedAt,
        @failureJson,
        @metadataJson,
        @createdAt,
        @updatedAt
      )
    `);
    this.updateRunStatement = db.prepare(`
      update eval_runs set
        source_run_id = @sourceRunId,
        provider_id = @providerId,
        provider_kind = @providerKind,
        model = @model,
        prompt_template_id = @promptTemplateId,
        prompt_template_version = @promptTemplateVersion,
        prompt_template_hash = @promptTemplateHash,
        status = @status,
        started_at = @startedAt,
        finished_at = @finishedAt,
        failure_json = @failureJson,
        metadata_json = @metadataJson,
        updated_at = @updatedAt
      where id = @id
    `);

    this.getResultStatement = db.prepare(evalResultSelectSql("where id = ?"));
    this.insertResultStatement = db.prepare(`
      insert into eval_results (
        id,
        eval_run_id,
        case_id,
        status,
        score,
        expected_artifact_uri,
        actual_artifact_uri,
        failure_json,
        metrics_json,
        metadata_json,
        created_at
      )
      values (
        @id,
        @evalRunId,
        @caseId,
        @status,
        @score,
        @expectedArtifactUri,
        @actualArtifactUri,
        @failureJson,
        @metricsJson,
        @metadataJson,
        @createdAt
      )
    `);
  }

  createSuite(input: CreateEvalSuiteInput): EvalSuiteRecord {
    const now = (input.now ?? new Date()).toISOString();
    this.insertSuiteStatement.run({
      id: input.id,
      name: input.name,
      description: input.description ?? "",
      status: input.status ?? "draft",
      metadataJson: JSON.stringify(input.metadata ?? {}),
      createdAt: now,
      updatedAt: now
    });
    return this.requireSuite(input.id);
  }

  getSuite(id: string): EvalSuiteRecord | undefined {
    const row = this.getSuiteStatement.get(id) as EvalSuiteRow | undefined;
    return row ? mapEvalSuiteRow(row) : undefined;
  }

  requireSuite(id: string): EvalSuiteRecord {
    const suite = this.getSuite(id);
    if (!suite) {
      throw new Error(`Eval suite not found: ${id}`);
    }
    return suite;
  }

  listSuites(options: ListEvalSuitesOptions = {}): EvalSuiteRecord[] {
    const clauses: string[] = [];
    const params: Record<string, unknown> = { limit: clampAppStateListLimit(options.limit) };
    if (options.status) {
      clauses.push("status = @status");
      params.status = options.status;
    }
    const where = clauses.length > 0 ? `where ${clauses.join(" and ")}` : "";
    return this.db
      .prepare(evalSuiteSelectSql(`${where} order by updated_at desc, created_at desc, id asc limit @limit`))
      .all(params)
      .map((row) => mapEvalSuiteRow(row as EvalSuiteRow));
  }

  updateSuite(id: string, input: UpdateEvalSuiteInput): EvalSuiteRecord {
    const existing = this.requireSuite(id);
    const updatedAt = (input.now ?? new Date()).toISOString();
    this.updateSuiteStatement.run({
      id,
      name: input.name ?? existing.name,
      description: input.description ?? existing.description,
      status: input.status ?? existing.status,
      metadataJson: input.metadata === undefined ? JSON.stringify(existing.metadata) : JSON.stringify(input.metadata),
      updatedAt
    });
    return this.requireSuite(id);
  }

  createRun(input: CreateEvalRunInput): EvalRunRecord {
    const now = (input.now ?? new Date()).toISOString();
    this.insertRunStatement.run({
      id: input.id,
      suiteId: input.suiteId,
      sourceRunId: input.sourceRunId ?? null,
      agentId: input.agentId,
      agentVersion: input.agentVersion,
      providerId: input.providerId ?? null,
      providerKind: input.providerKind ?? null,
      model: input.model ?? null,
      promptTemplateId: input.promptTemplateId ?? null,
      promptTemplateVersion: input.promptTemplateVersion ?? null,
      promptTemplateHash: input.promptTemplateHash,
      status: input.status ?? "queued",
      startedAt: input.startedAt ?? null,
      finishedAt: input.finishedAt ?? null,
      failureJson: jsonOrNull(input.failure),
      metadataJson: JSON.stringify(input.metadata ?? {}),
      createdAt: now,
      updatedAt: now
    });
    return this.requireRun(input.id);
  }

  getRun(id: string): EvalRunRecord | undefined {
    const row = this.getRunStatement.get(id) as EvalRunRow | undefined;
    return row ? mapEvalRunRow(row) : undefined;
  }

  requireRun(id: string): EvalRunRecord {
    const run = this.getRun(id);
    if (!run) {
      throw new Error(`Eval run not found: ${id}`);
    }
    return run;
  }

  listRuns(options: ListEvalRunsOptions = {}): EvalRunRecord[] {
    const clauses: string[] = [];
    const params: Record<string, unknown> = { limit: clampAppStateListLimit(options.limit) };
    if (options.suiteId) {
      clauses.push("suite_id = @suiteId");
      params.suiteId = options.suiteId;
    }
    if (options.agentId) {
      clauses.push("agent_id = @agentId");
      params.agentId = options.agentId;
    }
    if (options.agentVersion) {
      clauses.push("agent_version = @agentVersion");
      params.agentVersion = options.agentVersion;
    }
    if (options.status) {
      clauses.push("status = @status");
      params.status = options.status;
    }
    const where = clauses.length > 0 ? `where ${clauses.join(" and ")}` : "";
    return this.db
      .prepare(evalRunSelectSql(`${where} order by created_at desc, id asc limit @limit`))
      .all(params)
      .map((row) => mapEvalRunRow(row as EvalRunRow));
  }

  updateRun(id: string, input: UpdateEvalRunInput): EvalRunRecord {
    const existing = this.requireRun(id);
    const updatedAt = (input.now ?? new Date()).toISOString();
    this.updateRunStatement.run({
      id,
      sourceRunId: input.sourceRunId === undefined ? existing.sourceRunId ?? null : input.sourceRunId,
      providerId: input.providerId === undefined ? existing.providerId ?? null : input.providerId,
      providerKind: input.providerKind === undefined ? existing.providerKind ?? null : input.providerKind,
      model: input.model === undefined ? existing.model ?? null : input.model,
      promptTemplateId: input.promptTemplateId === undefined ? existing.promptTemplateId ?? null : input.promptTemplateId,
      promptTemplateVersion: input.promptTemplateVersion === undefined ? existing.promptTemplateVersion ?? null : input.promptTemplateVersion,
      promptTemplateHash: input.promptTemplateHash ?? existing.promptTemplateHash,
      status: input.status ?? existing.status,
      startedAt: input.startedAt === undefined ? existing.startedAt ?? null : input.startedAt,
      finishedAt: input.finishedAt === undefined ? existing.finishedAt ?? null : input.finishedAt,
      failureJson: input.failure === undefined ? jsonOrNull(existing.failure) : jsonOrNull(input.failure ?? undefined),
      metadataJson: input.metadata === undefined ? JSON.stringify(existing.metadata) : JSON.stringify(input.metadata),
      updatedAt
    });
    return this.requireRun(id);
  }

  createResult(input: CreateEvalResultInput): EvalResultRecord {
    const createdAt = input.createdAt ?? new Date().toISOString();
    this.insertResultStatement.run({
      id: input.id,
      evalRunId: input.evalRunId,
      caseId: input.caseId,
      status: input.status,
      score: input.score ?? null,
      expectedArtifactUri: input.expectedArtifactUri ?? null,
      actualArtifactUri: input.actualArtifactUri ?? null,
      failureJson: jsonOrNull(input.failure),
      metricsJson: JSON.stringify(input.metrics ?? {}),
      metadataJson: JSON.stringify(input.metadata ?? {}),
      createdAt
    });
    return this.requireResult(input.id);
  }

  getResult(id: string): EvalResultRecord | undefined {
    const row = this.getResultStatement.get(id) as EvalResultRow | undefined;
    return row ? mapEvalResultRow(row) : undefined;
  }

  requireResult(id: string): EvalResultRecord {
    const result = this.getResult(id);
    if (!result) {
      throw new Error(`Eval result not found: ${id}`);
    }
    return result;
  }

  listResults(options: ListEvalResultsOptions): EvalResultRecord[] {
    const clauses = ["eval_run_id = @evalRunId"];
    const params: Record<string, unknown> = {
      evalRunId: options.evalRunId,
      limit: clampAppStateListLimit(options.limit)
    };
    if (options.status) {
      clauses.push("status = @status");
      params.status = options.status;
    }
    return this.db
      .prepare(evalResultSelectSql(`where ${clauses.join(" and ")} order by case_id asc, created_at asc limit @limit`))
      .all(params)
      .map((row) => mapEvalResultRow(row as EvalResultRow));
  }
}

function evalSuiteSelectSql(suffix: string): string {
  return `select id, name, description, status, metadata_json, created_at, updated_at from eval_suites ${suffix}`;
}

function evalRunSelectSql(suffix: string): string {
  return `select id, suite_id, source_run_id, agent_id, agent_version, provider_id, provider_kind, model, prompt_template_id, prompt_template_version, prompt_template_hash, status, started_at, finished_at, failure_json, metadata_json, created_at, updated_at from eval_runs ${suffix}`;
}

function evalResultSelectSql(suffix: string): string {
  return `select id, eval_run_id, case_id, status, score, expected_artifact_uri, actual_artifact_uri, failure_json, metrics_json, metadata_json, created_at from eval_results ${suffix}`;
}

function mapEvalSuiteRow(row: EvalSuiteRow): EvalSuiteRecord {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    status: row.status,
    metadata: JSON.parse(row.metadata_json) as unknown,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapEvalRunRow(row: EvalRunRow): EvalRunRecord {
  return {
    id: row.id,
    suiteId: row.suite_id,
    ...(row.source_run_id ? { sourceRunId: row.source_run_id } : {}),
    agentId: row.agent_id,
    agentVersion: row.agent_version,
    ...(row.provider_id ? { providerId: row.provider_id } : {}),
    ...(row.provider_kind ? { providerKind: row.provider_kind } : {}),
    ...(row.model ? { model: row.model } : {}),
    ...(row.prompt_template_id ? { promptTemplateId: row.prompt_template_id } : {}),
    ...(row.prompt_template_version ? { promptTemplateVersion: row.prompt_template_version } : {}),
    promptTemplateHash: row.prompt_template_hash,
    status: row.status,
    ...(row.started_at ? { startedAt: row.started_at } : {}),
    ...(row.finished_at ? { finishedAt: row.finished_at } : {}),
    ...(row.failure_json ? { failure: JSON.parse(row.failure_json) as EvalFailureDetail } : {}),
    metadata: JSON.parse(row.metadata_json) as unknown,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapEvalResultRow(row: EvalResultRow): EvalResultRecord {
  return {
    id: row.id,
    evalRunId: row.eval_run_id,
    caseId: row.case_id,
    status: row.status,
    ...(row.score !== null ? { score: row.score } : {}),
    ...(row.expected_artifact_uri ? { expectedArtifactUri: row.expected_artifact_uri } : {}),
    ...(row.actual_artifact_uri ? { actualArtifactUri: row.actual_artifact_uri } : {}),
    ...(row.failure_json ? { failure: JSON.parse(row.failure_json) as EvalFailureDetail } : {}),
    metrics: JSON.parse(row.metrics_json) as unknown,
    metadata: JSON.parse(row.metadata_json) as unknown,
    createdAt: row.created_at
  };
}
