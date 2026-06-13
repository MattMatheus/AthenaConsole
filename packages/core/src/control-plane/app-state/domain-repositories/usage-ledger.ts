import type Database from "better-sqlite3";
import { clampAppStateListLimit, jsonOrNull } from "./shared.js";

interface UsageLedgerRow {
  id: string;
  run_id: string;
  target_type: string | null;
  target_id: string | null;
  task_id: string | null;
  agent_id: string | null;
  agent_version: string | null;
  provider: string | null;
  provider_id: string | null;
  provider_kind: string | null;
  model: string | null;
  user_id: string | null;
  workspace_id: string | null;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  cost_usd: number | null;
  provider_usage_json: string | null;
  source: string;
  recorded_at: string;
  created_at: string;
  updated_at: string;
}

export interface UsageLedgerRecord {
  id: string;
  runId: string;
  targetType?: string;
  targetId?: string;
  taskId?: string;
  agentId?: string;
  agentVersion?: string;
  provider?: string;
  providerId?: string;
  providerKind?: string;
  model?: string;
  userId?: string;
  workspaceId?: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  costUsd?: number;
  providerUsage?: unknown;
  source: string;
  recordedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface UpsertUsageLedgerInput {
  id?: string;
  runId: string;
  targetType?: string;
  targetId?: string;
  taskId?: string;
  agentId?: string;
  agentVersion?: string;
  provider?: string;
  providerId?: string;
  providerKind?: string;
  model?: string;
  userId?: string;
  workspaceId?: string;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  costUsd?: number;
  providerUsage?: unknown;
  source: string;
  recordedAt?: string;
  now?: Date;
}

export interface ListUsageLedgerOptions {
  runId?: string;
  agentId?: string;
  provider?: string;
  model?: string;
  userId?: string;
  workspaceId?: string;
  windowStart?: string;
  windowEnd?: string;
  limit?: number;
}

export class UsageLedgerRepository {
  private readonly getByRunStatement: Database.Statement;
  private readonly upsertStatement: Database.Statement;

  constructor(private readonly db: Database.Database) {
    this.getByRunStatement = db.prepare(`${usageLedgerSelectSql("where run_id = ?")} limit 1`);
    this.upsertStatement = db.prepare(`
      insert into usage_ledger (
        id,
        run_id,
        target_type,
        target_id,
        task_id,
        agent_id,
        agent_version,
        provider,
        provider_id,
        provider_kind,
        model,
        user_id,
        workspace_id,
        input_tokens,
        output_tokens,
        total_tokens,
        cost_usd,
        provider_usage_json,
        source,
        recorded_at,
        created_at,
        updated_at
      )
      values (
        @id,
        @runId,
        @targetType,
        @targetId,
        @taskId,
        @agentId,
        @agentVersion,
        @provider,
        @providerId,
        @providerKind,
        @model,
        @userId,
        @workspaceId,
        @inputTokens,
        @outputTokens,
        @totalTokens,
        @costUsd,
        @providerUsageJson,
        @source,
        @recordedAt,
        @createdAt,
        @updatedAt
      )
      on conflict(run_id) do update set
        target_type = excluded.target_type,
        target_id = excluded.target_id,
        task_id = excluded.task_id,
        agent_id = excluded.agent_id,
        agent_version = excluded.agent_version,
        provider = excluded.provider,
        provider_id = excluded.provider_id,
        provider_kind = excluded.provider_kind,
        model = excluded.model,
        user_id = excluded.user_id,
        workspace_id = excluded.workspace_id,
        input_tokens = excluded.input_tokens,
        output_tokens = excluded.output_tokens,
        total_tokens = excluded.total_tokens,
        cost_usd = excluded.cost_usd,
        provider_usage_json = excluded.provider_usage_json,
        source = excluded.source,
        recorded_at = excluded.recorded_at,
        updated_at = excluded.updated_at
    `);
  }

  getByRunId(runId: string): UsageLedgerRecord | undefined {
    const row = this.getByRunStatement.get(runId) as UsageLedgerRow | undefined;
    return row ? mapUsageLedgerRow(row) : undefined;
  }

  upsert(input: UpsertUsageLedgerInput): UsageLedgerRecord {
    const now = (input.now ?? new Date()).toISOString();
    const inputTokens = normalizeTokenCount(input.inputTokens);
    const outputTokens = normalizeTokenCount(input.outputTokens);
    const totalTokens = Math.max(normalizeTokenCount(input.totalTokens), inputTokens + outputTokens);
    this.upsertStatement.run({
      id: input.id ?? `usage-${input.runId}`,
      runId: input.runId,
      targetType: input.targetType ?? null,
      targetId: input.targetId ?? null,
      taskId: input.taskId ?? null,
      agentId: input.agentId ?? null,
      agentVersion: input.agentVersion ?? null,
      provider: input.provider ?? null,
      providerId: input.providerId ?? null,
      providerKind: input.providerKind ?? null,
      model: input.model ?? null,
      userId: input.userId ?? null,
      workspaceId: input.workspaceId ?? null,
      inputTokens,
      outputTokens,
      totalTokens,
      costUsd: input.costUsd !== undefined && Number.isFinite(input.costUsd) ? Math.max(0, input.costUsd) : null,
      providerUsageJson: jsonOrNull(input.providerUsage),
      source: input.source,
      recordedAt: input.recordedAt ?? now,
      createdAt: now,
      updatedAt: now
    });
    return this.getByRunId(input.runId) as UsageLedgerRecord;
  }

  list(options: ListUsageLedgerOptions = {}): UsageLedgerRecord[] {
    const clauses: string[] = [];
    const params: Record<string, unknown> = {};
    if (options.runId) {
      clauses.push("run_id = @runId");
      params.runId = options.runId;
    }
    if (options.agentId) {
      clauses.push("agent_id = @agentId");
      params.agentId = options.agentId;
    }
    if (options.provider) {
      clauses.push("provider = @provider");
      params.provider = options.provider;
    }
    if (options.model) {
      clauses.push("model = @model");
      params.model = options.model;
    }
    if (options.userId) {
      clauses.push("user_id = @userId");
      params.userId = options.userId;
    }
    if (options.workspaceId) {
      clauses.push("workspace_id = @workspaceId");
      params.workspaceId = options.workspaceId;
    }
    if (options.windowStart) {
      clauses.push("recorded_at >= @windowStart");
      params.windowStart = options.windowStart;
    }
    if (options.windowEnd) {
      clauses.push("recorded_at < @windowEnd");
      params.windowEnd = options.windowEnd;
    }
    params.limit = clampAppStateListLimit(options.limit);
    const where = clauses.length > 0 ? `where ${clauses.join(" and ")}` : "";
    const rows = this.db
      .prepare(`${usageLedgerSelectSql(where)} order by recorded_at desc, id desc limit @limit`)
      .all(params) as UsageLedgerRow[];
    return rows.map(mapUsageLedgerRow);
  }
}

function usageLedgerSelectSql(where: string): string {
  return `
    select
      id,
      run_id,
      target_type,
      target_id,
      task_id,
      agent_id,
      agent_version,
      provider,
      provider_id,
      provider_kind,
      model,
      user_id,
      workspace_id,
      input_tokens,
      output_tokens,
      total_tokens,
      cost_usd,
      provider_usage_json,
      source,
      recorded_at,
      created_at,
      updated_at
    from usage_ledger
    ${where}
  `;
}

function mapUsageLedgerRow(row: UsageLedgerRow): UsageLedgerRecord {
  return {
    id: row.id,
    runId: row.run_id,
    ...(row.target_type ? { targetType: row.target_type } : {}),
    ...(row.target_id ? { targetId: row.target_id } : {}),
    ...(row.task_id ? { taskId: row.task_id } : {}),
    ...(row.agent_id ? { agentId: row.agent_id } : {}),
    ...(row.agent_version ? { agentVersion: row.agent_version } : {}),
    ...(row.provider ? { provider: row.provider } : {}),
    ...(row.provider_id ? { providerId: row.provider_id } : {}),
    ...(row.provider_kind ? { providerKind: row.provider_kind } : {}),
    ...(row.model ? { model: row.model } : {}),
    ...(row.user_id ? { userId: row.user_id } : {}),
    ...(row.workspace_id ? { workspaceId: row.workspace_id } : {}),
    inputTokens: row.input_tokens,
    outputTokens: row.output_tokens,
    totalTokens: row.total_tokens,
    ...(row.cost_usd !== null ? { costUsd: row.cost_usd } : {}),
    ...(row.provider_usage_json ? { providerUsage: JSON.parse(row.provider_usage_json) as unknown } : {}),
    source: row.source,
    recordedAt: row.recorded_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function normalizeTokenCount(value: number | undefined): number {
  return value !== undefined && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
}
