import type Database from "better-sqlite3";
import type {
  ModelProviderKind,
  ModelProviderSecretReference,
  ModelProviderSecretStatus
} from "../../../shared/contracts/model-providers.js";

interface ModelProviderConfigRow {
  id: string;
  name: string;
  provider_kind: ModelProviderKind;
  base_url: string;
  default_model: string;
  secret_ref_json: string;
  status: ModelProviderSecretStatus;
  status_message: string | null;
  workspace_id: string;
  created_at: string;
  updated_at: string;
}

export interface ModelProviderConfigRecord {
  id: string;
  name: string;
  providerKind: ModelProviderKind;
  baseUrl: string;
  defaultModel: string;
  secretRef: ModelProviderSecretReference;
  status: ModelProviderSecretStatus;
  statusMessage?: string;
  workspaceId: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateModelProviderConfigInput {
  id: string;
  name: string;
  providerKind: ModelProviderKind;
  baseUrl: string;
  defaultModel: string;
  secretRef: ModelProviderSecretReference;
  status?: ModelProviderSecretStatus;
  statusMessage?: string;
  workspaceId?: string;
  now?: Date;
}

export interface UpdateModelProviderConfigInput {
  name?: string;
  providerKind?: ModelProviderKind;
  baseUrl?: string;
  defaultModel?: string;
  secretRef?: ModelProviderSecretReference;
  status?: ModelProviderSecretStatus;
  statusMessage?: string;
  workspaceId?: string;
  now?: Date;
}

export interface ListModelProviderConfigOptions {
  workspaceId?: string;
}

export class ModelProviderConfigRepository {
  private readonly getStatement: Database.Statement;
  private readonly listStatement: Database.Statement;
  private readonly insertStatement: Database.Statement;
  private readonly updateStatement: Database.Statement;
  private readonly deleteStatement: Database.Statement;

  constructor(private readonly db: Database.Database) {
    this.getStatement = db.prepare(modelProviderConfigSelectSql("where id = ?"));
    this.listStatement = db.prepare(modelProviderConfigSelectSql("order by updated_at desc, created_at desc, id asc"));
    this.insertStatement = db.prepare(`
      insert into model_provider_configs (
        id,
        name,
        provider_kind,
        base_url,
        default_model,
        secret_ref_json,
        status,
        status_message,
        workspace_id,
        created_at,
        updated_at
      )
      values (
        @id,
        @name,
        @providerKind,
        @baseUrl,
        @defaultModel,
        @secretRefJson,
        @status,
        @statusMessage,
        @workspaceId,
        @createdAt,
        @updatedAt
      )
    `);
    this.updateStatement = db.prepare(`
      update model_provider_configs set
        name = @name,
        provider_kind = @providerKind,
        base_url = @baseUrl,
        default_model = @defaultModel,
        secret_ref_json = @secretRefJson,
        status = @status,
        status_message = @statusMessage,
        workspace_id = @workspaceId,
        updated_at = @updatedAt
      where id = @id
    `);
    this.deleteStatement = db.prepare("delete from model_provider_configs where id = ?");
  }

  create(input: CreateModelProviderConfigInput): ModelProviderConfigRecord {
    const now = (input.now ?? new Date()).toISOString();
    this.insertStatement.run({
      id: input.id,
      name: input.name,
      providerKind: input.providerKind,
      baseUrl: input.baseUrl,
      defaultModel: input.defaultModel,
      secretRefJson: JSON.stringify(input.secretRef),
      status: input.status ?? "missing",
      statusMessage: input.statusMessage ?? null,
      workspaceId: input.workspaceId ?? "default",
      createdAt: now,
      updatedAt: now
    });
    return this.require(input.id);
  }

  get(id: string): ModelProviderConfigRecord | undefined {
    const row = this.getStatement.get(id) as ModelProviderConfigRow | undefined;
    return row ? mapModelProviderConfigRow(row) : undefined;
  }

  require(id: string): ModelProviderConfigRecord {
    const provider = this.get(id);
    if (!provider) {
      throw new Error(`Model provider config not found: ${id}`);
    }
    return provider;
  }

  list(options: ListModelProviderConfigOptions = {}): ModelProviderConfigRecord[] {
    return this.listStatement
      .all()
      .map((row) => mapModelProviderConfigRow(row as ModelProviderConfigRow))
      .filter((row) => (options.workspaceId ? row.workspaceId === options.workspaceId : true));
  }

  update(id: string, input: UpdateModelProviderConfigInput): ModelProviderConfigRecord | undefined {
    const existing = this.get(id);
    if (!existing) {
      return undefined;
    }
    const secretRef = input.secretRef ?? existing.secretRef;
    this.updateStatement.run({
      id,
      name: input.name ?? existing.name,
      providerKind: input.providerKind ?? existing.providerKind,
      baseUrl: input.baseUrl ?? existing.baseUrl,
      defaultModel: input.defaultModel ?? existing.defaultModel,
      secretRefJson: JSON.stringify(secretRef),
      status: input.status ?? existing.status,
      statusMessage: input.statusMessage ?? existing.statusMessage ?? null,
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

function modelProviderConfigSelectSql(suffix: string): string {
  return `select id, name, provider_kind, base_url, default_model, secret_ref_json, status, status_message, workspace_id, created_at, updated_at from model_provider_configs ${suffix}`;
}

function mapModelProviderConfigRow(row: ModelProviderConfigRow): ModelProviderConfigRecord {
  return {
    id: row.id,
    name: row.name,
    providerKind: row.provider_kind,
    baseUrl: row.base_url,
    defaultModel: row.default_model,
    secretRef: JSON.parse(row.secret_ref_json) as ModelProviderSecretReference,
    status: row.status,
    ...(row.status_message ? { statusMessage: row.status_message } : {}),
    workspaceId: row.workspace_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}
