import { randomUUID } from "node:crypto";
import type Database from "better-sqlite3";
import type {
  Directive,
  DirectiveCreateRequest,
  HarnessEgressRule,
  HarnessProfile,
  HarnessProfileConfig,
  HarnessProfileCreateRequest,
  HarnessProfilePolicies,
  HarnessVerificationPolicy
} from "../../shared/contracts.js";

export interface AppStateMigrationRecord {
  version: number;
  name: string;
  appliedAt: string;
}

interface AppStateMigrationRow {
  version: number;
  name: string;
  applied_at: string;
}

interface AppSettingRow {
  key: string;
  value_json: string;
  updated_at: string;
}

interface PluginIndexRow {
  id: string;
  version: string;
  path: string;
  enabled: number;
  status: string;
  source_type: string;
  manifest_json: string;
  validation_errors_json: string;
  created_at: string;
  updated_at: string;
}

interface AgentIndexRow {
  id: string;
  version: string;
  plugin_id: string;
  plugin_version: string;
  name: string;
  capabilities_json: string;
  manifest_json: string;
  status: string;
  created_at: string;
  updated_at: string;
}

interface WorkflowTemplateIndexRow {
  id: string;
  version: string;
  plugin_id: string;
  plugin_version: string;
  name: string;
  description: string;
  task_count: number;
  manifest_json: string;
  status: string;
  validation_errors_json: string;
  created_at: string;
  updated_at: string;
}

interface HarnessProfileRow {
  id: string;
  display_name: string;
  version: string;
  config_json: string;
  policies_json: string;
  allowed_egress_json: string;
  verification_policies_json: string;
  created_at: string;
}

interface DirectiveRow {
  id: string;
  input: string;
  context_refs_json: string;
  metadata_json: string;
  created_at: string;
}

export class AppStateMigrationRepository {
  private readonly listVersionsStatement: Database.Statement;
  private readonly listStatement: Database.Statement;
  private readonly insertStatement: Database.Statement;

  constructor(private readonly db: Database.Database) {
    this.listVersionsStatement = db.prepare("select version from app_state_migrations order by version asc");
    this.listStatement = db.prepare("select version, name, applied_at from app_state_migrations order by version asc");
    this.insertStatement = db.prepare(
      "insert into app_state_migrations (version, name, applied_at) values (@version, @name, @appliedAt)"
    );
  }

  listVersions(): number[] {
    return this.listVersionsStatement.all().map((row) => (row as { version: number }).version);
  }

  list(): AppStateMigrationRecord[] {
    return this.listStatement.all().map((row) => this.mapRow(row as AppStateMigrationRow));
  }

  recordApplied(version: number, name: string, appliedAt: string): void {
    this.insertStatement.run({ version, name, appliedAt });
  }

  private mapRow(row: AppStateMigrationRow): AppStateMigrationRecord {
    return {
      version: row.version,
      name: row.name,
      appliedAt: row.applied_at
    };
  }
}

export interface AppSettingRecord<T = unknown> {
  key: string;
  value: T;
  updatedAt: string;
}

export class AppSettingsRepository {
  private readonly getStatement: Database.Statement;
  private readonly listStatement: Database.Statement;
  private readonly upsertStatement: Database.Statement;
  private readonly deleteStatement: Database.Statement;

  constructor(private readonly db: Database.Database) {
    this.getStatement = db.prepare("select key, value_json, updated_at from app_settings where key = ?");
    this.listStatement = db.prepare("select key, value_json, updated_at from app_settings order by key asc");
    this.upsertStatement = db.prepare(`
      insert into app_settings (key, value_json, updated_at)
      values (@key, @valueJson, @updatedAt)
      on conflict(key) do update set
        value_json = excluded.value_json,
        updated_at = excluded.updated_at
    `);
    this.deleteStatement = db.prepare("delete from app_settings where key = ?");
  }

  get<T = unknown>(key: string): AppSettingRecord<T> | undefined {
    const row = this.getStatement.get(key) as AppSettingRow | undefined;
    return row ? this.mapRow<T>(row) : undefined;
  }

  list<T = unknown>(): AppSettingRecord<T>[] {
    return this.listStatement.all().map((row) => this.mapRow<T>(row as AppSettingRow));
  }

  set(key: string, value: unknown, now: Date = new Date()): AppSettingRecord {
    const updatedAt = now.toISOString();
    this.upsertStatement.run({
      key,
      valueJson: JSON.stringify(value),
      updatedAt
    });
    return {
      key,
      value,
      updatedAt
    };
  }

  delete(key: string): boolean {
    const result = this.deleteStatement.run(key);
    return result.changes > 0;
  }

  private mapRow<T>(row: AppSettingRow): AppSettingRecord<T> {
    return {
      key: row.key,
      value: JSON.parse(row.value_json) as T,
      updatedAt: row.updated_at
    };
  }
}

export type PluginIndexStatus = "loaded" | "invalid";
export type PluginSourceType = "local" | "system";

export interface PluginIndexRecord {
  id: string;
  version: string;
  path: string;
  enabled: boolean;
  status: PluginIndexStatus | string;
  sourceType: PluginSourceType | string;
  manifest: unknown;
  validationErrors: unknown[];
  createdAt: string;
  updatedAt: string;
}

export interface PluginIndexUpsert {
  id: string;
  version: string;
  path: string;
  enabled?: boolean;
  status: PluginIndexStatus;
  sourceType: PluginSourceType;
  manifest: unknown;
  validationErrors: unknown[];
  now?: Date;
}

export class PluginIndexRepository {
  private readonly getStatement: Database.Statement;
  private readonly listStatement: Database.Statement;
  private readonly upsertStatement: Database.Statement;
  private readonly setEnabledStatement: Database.Statement;

  constructor(private readonly db: Database.Database) {
    this.getStatement = db.prepare(
      "select id, version, path, enabled, status, source_type, manifest_json, validation_errors_json, created_at, updated_at from plugin_index where id = ? and version = ?"
    );
    this.listStatement = db.prepare(
      "select id, version, path, enabled, status, source_type, manifest_json, validation_errors_json, created_at, updated_at from plugin_index order by id asc, version asc"
    );
    this.upsertStatement = db.prepare(`
      insert into plugin_index (
        id,
        version,
        path,
        enabled,
        status,
        source_type,
        manifest_json,
        validation_errors_json,
        created_at,
        updated_at
      )
      values (
        @id,
        @version,
        @path,
        @enabled,
        @status,
        @sourceType,
        @manifestJson,
        @validationErrorsJson,
        @createdAt,
        @updatedAt
      )
      on conflict(id, version) do update set
        path = excluded.path,
        status = excluded.status,
        source_type = excluded.source_type,
        manifest_json = excluded.manifest_json,
        validation_errors_json = excluded.validation_errors_json,
        updated_at = excluded.updated_at
    `);
    this.setEnabledStatement = db.prepare(
      "update plugin_index set enabled = @enabled, updated_at = @updatedAt where id = @id and version = @version"
    );
  }

  get(id: string, version: string): PluginIndexRecord | undefined {
    const row = this.getStatement.get(id, version) as PluginIndexRow | undefined;
    return row ? this.mapRow(row) : undefined;
  }

  list(): PluginIndexRecord[] {
    return this.listStatement.all().map((row) => this.mapRow(row as PluginIndexRow));
  }

  upsert(input: PluginIndexUpsert): PluginIndexRecord {
    const existing = this.get(input.id, input.version);
    const now = (input.now ?? new Date()).toISOString();
    const enabled = existing?.enabled ?? input.enabled ?? true;
    this.upsertStatement.run({
      id: input.id,
      version: input.version,
      path: input.path,
      enabled: enabled ? 1 : 0,
      status: input.status,
      sourceType: input.sourceType,
      manifestJson: JSON.stringify(input.manifest),
      validationErrorsJson: JSON.stringify(input.validationErrors),
      createdAt: existing?.createdAt ?? now,
      updatedAt: now
    });
    const record = this.get(input.id, input.version);
    if (!record) {
      throw new Error(`Failed to load indexed plugin ${input.id}@${input.version}.`);
    }
    return record;
  }

  setEnabled(id: string, version: string, enabled: boolean, now: Date = new Date()): boolean {
    const result = this.setEnabledStatement.run({
      id,
      version,
      enabled: enabled ? 1 : 0,
      updatedAt: now.toISOString()
    });
    return result.changes > 0;
  }

  private mapRow(row: PluginIndexRow): PluginIndexRecord {
    return {
      id: row.id,
      version: row.version,
      path: row.path,
      enabled: row.enabled === 1,
      status: row.status,
      sourceType: row.source_type,
      manifest: JSON.parse(row.manifest_json) as unknown,
      validationErrors: JSON.parse(row.validation_errors_json) as unknown[],
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}

export interface AgentIndexRecord {
  id: string;
  version: string;
  pluginId: string;
  pluginVersion: string;
  name: string;
  capabilities: string[];
  manifest: unknown;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface AgentIndexUpsert {
  id: string;
  version: string;
  pluginId: string;
  pluginVersion: string;
  name: string;
  capabilities: string[];
  manifest: unknown;
  status: "loaded";
  now?: Date;
}

export class AgentIndexRepository {
  private readonly listStatement: Database.Statement;
  private readonly listForPluginStatement: Database.Statement;
  private readonly upsertStatement: Database.Statement;
  private readonly deleteForPluginStatement: Database.Statement;

  constructor(private readonly db: Database.Database) {
    this.listStatement = db.prepare(
      "select id, version, plugin_id, plugin_version, name, capabilities_json, manifest_json, status, created_at, updated_at from agent_index order by id asc, version asc"
    );
    this.listForPluginStatement = db.prepare(
      "select id, version, plugin_id, plugin_version, name, capabilities_json, manifest_json, status, created_at, updated_at from agent_index where plugin_id = ? and plugin_version = ? order by id asc, version asc"
    );
    this.upsertStatement = db.prepare(`
      insert into agent_index (
        id,
        version,
        plugin_id,
        plugin_version,
        name,
        capabilities_json,
        manifest_json,
        status,
        created_at,
        updated_at
      )
      values (
        @id,
        @version,
        @pluginId,
        @pluginVersion,
        @name,
        @capabilitiesJson,
        @manifestJson,
        @status,
        @createdAt,
        @updatedAt
      )
      on conflict(id, version) do update set
        plugin_id = excluded.plugin_id,
        plugin_version = excluded.plugin_version,
        name = excluded.name,
        capabilities_json = excluded.capabilities_json,
        manifest_json = excluded.manifest_json,
        status = excluded.status,
        updated_at = excluded.updated_at
    `);
    this.deleteForPluginStatement = db.prepare("delete from agent_index where plugin_id = ? and plugin_version = ?");
  }

  list(): AgentIndexRecord[] {
    return this.listStatement.all().map((row) => this.mapRow(row as AgentIndexRow));
  }

  listForPlugin(pluginId: string, pluginVersion: string): AgentIndexRecord[] {
    return this.listForPluginStatement.all(pluginId, pluginVersion).map((row) => this.mapRow(row as AgentIndexRow));
  }

  upsert(input: AgentIndexUpsert): void {
    const now = (input.now ?? new Date()).toISOString();
    const existing = this.listForPlugin(input.pluginId, input.pluginVersion).find(
      (agent) => agent.id === input.id && agent.version === input.version
    );
    this.upsertStatement.run({
      id: input.id,
      version: input.version,
      pluginId: input.pluginId,
      pluginVersion: input.pluginVersion,
      name: input.name,
      capabilitiesJson: JSON.stringify(input.capabilities),
      manifestJson: JSON.stringify(input.manifest),
      status: input.status,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now
    });
  }

  deleteForPlugin(pluginId: string, pluginVersion: string): number {
    return this.deleteForPluginStatement.run(pluginId, pluginVersion).changes;
  }

  private mapRow(row: AgentIndexRow): AgentIndexRecord {
    return {
      id: row.id,
      version: row.version,
      pluginId: row.plugin_id,
      pluginVersion: row.plugin_version,
      name: row.name,
      capabilities: JSON.parse(row.capabilities_json) as string[],
      manifest: JSON.parse(row.manifest_json) as unknown,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}

export interface WorkflowTemplateIndexRecord {
  id: string;
  version: string;
  pluginId: string;
  pluginVersion: string;
  name: string;
  description: string;
  taskCount: number;
  manifest: unknown;
  status: string;
  validationErrors: unknown[];
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowTemplateIndexUpsert {
  id: string;
  version: string;
  pluginId: string;
  pluginVersion: string;
  name: string;
  description?: string;
  taskCount?: number;
  manifest: unknown;
  status: "loaded" | "invalid";
  validationErrors?: unknown[];
  now?: Date;
}

export class WorkflowTemplateIndexRepository {
  private readonly listStatement: Database.Statement;
  private readonly listForPluginStatement: Database.Statement;
  private readonly upsertStatement: Database.Statement;
  private readonly deleteForPluginStatement: Database.Statement;

  constructor(private readonly db: Database.Database) {
    this.listStatement = db.prepare(
      "select id, version, plugin_id, plugin_version, name, description, task_count, manifest_json, status, validation_errors_json, created_at, updated_at from workflow_template_index order by id asc, version asc, plugin_id asc, plugin_version asc"
    );
    this.listForPluginStatement = db.prepare(
      "select id, version, plugin_id, plugin_version, name, description, task_count, manifest_json, status, validation_errors_json, created_at, updated_at from workflow_template_index where plugin_id = ? and plugin_version = ? order by id asc, version asc"
    );
    this.upsertStatement = db.prepare(`
      insert into workflow_template_index (
        id,
        version,
        plugin_id,
        plugin_version,
        name,
        description,
        task_count,
        manifest_json,
        status,
        validation_errors_json,
        created_at,
        updated_at
      )
      values (
        @id,
        @version,
        @pluginId,
        @pluginVersion,
        @name,
        @description,
        @taskCount,
        @manifestJson,
        @status,
        @validationErrorsJson,
        @createdAt,
        @updatedAt
      )
      on conflict(id, version, plugin_id, plugin_version) do update set
        name = excluded.name,
        description = excluded.description,
        task_count = excluded.task_count,
        manifest_json = excluded.manifest_json,
        status = excluded.status,
        validation_errors_json = excluded.validation_errors_json,
        updated_at = excluded.updated_at
    `);
    this.deleteForPluginStatement = db.prepare("delete from workflow_template_index where plugin_id = ? and plugin_version = ?");
  }

  list(): WorkflowTemplateIndexRecord[] {
    return this.listStatement.all().map((row) => this.mapRow(row as WorkflowTemplateIndexRow));
  }

  listForPlugin(pluginId: string, pluginVersion: string): WorkflowTemplateIndexRecord[] {
    return this.listForPluginStatement.all(pluginId, pluginVersion).map((row) => this.mapRow(row as WorkflowTemplateIndexRow));
  }

  upsert(input: WorkflowTemplateIndexUpsert): void {
    const now = (input.now ?? new Date()).toISOString();
    const existing = this.listForPlugin(input.pluginId, input.pluginVersion).find(
      (template) => template.id === input.id && template.version === input.version
    );
    this.upsertStatement.run({
      id: input.id,
      version: input.version,
      pluginId: input.pluginId,
      pluginVersion: input.pluginVersion,
      name: input.name,
      description: input.description ?? "",
      taskCount: input.taskCount ?? 0,
      manifestJson: JSON.stringify(input.manifest),
      status: input.status,
      validationErrorsJson: JSON.stringify(input.validationErrors ?? []),
      createdAt: existing?.createdAt ?? now,
      updatedAt: now
    });
  }

  deleteForPlugin(pluginId: string, pluginVersion: string): number {
    return this.deleteForPluginStatement.run(pluginId, pluginVersion).changes;
  }

  private mapRow(row: WorkflowTemplateIndexRow): WorkflowTemplateIndexRecord {
    return {
      id: row.id,
      version: row.version,
      pluginId: row.plugin_id,
      pluginVersion: row.plugin_version,
      name: row.name,
      description: row.description,
      taskCount: row.task_count,
      manifest: JSON.parse(row.manifest_json) as unknown,
      status: row.status,
      validationErrors: JSON.parse(row.validation_errors_json) as unknown[],
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}

export class HarnessProfileRepository {
  private readonly listStatement: Database.Statement;
  private readonly getStatement: Database.Statement;
  private readonly insertStatement: Database.Statement;

  constructor(private readonly db: Database.Database) {
    this.listStatement = db.prepare(
      "select id, display_name, version, config_json, policies_json, allowed_egress_json, verification_policies_json, created_at from harness_profiles order by created_at desc, id asc"
    );
    this.getStatement = db.prepare(
      "select id, display_name, version, config_json, policies_json, allowed_egress_json, verification_policies_json, created_at from harness_profiles where id = ?"
    );
    this.insertStatement = db.prepare(`
      insert into harness_profiles (
        id,
        display_name,
        version,
        config_json,
        policies_json,
        allowed_egress_json,
        verification_policies_json,
        created_at
      )
      values (
        @id,
        @displayName,
        @version,
        @configJson,
        @policiesJson,
        @allowedEgressJson,
        @verificationPoliciesJson,
        @createdAt
      )
    `);
  }

  list(): HarnessProfile[] {
    return this.listStatement.all().map((row) => this.mapRow(row as HarnessProfileRow));
  }

  get(id: string): HarnessProfile | undefined {
    const row = this.getStatement.get(id) as HarnessProfileRow | undefined;
    return row ? this.mapRow(row) : undefined;
  }

  create(request: HarnessProfileCreateRequest, now: Date = new Date()): HarnessProfile {
    const createdAt = now.toISOString();
    const profile: HarnessProfile = {
      id: this.allocateId(),
      displayName: request.displayName,
      version: request.version,
      config: {
        provider: request.config.provider,
        model: request.config.model,
        tools: [...request.config.tools]
      },
      policies: {
        timeoutMs: request.policies.timeoutMs,
        retryLimit: request.policies.retryLimit,
        budgetUsd: request.policies.budgetUsd
      },
      ...(request.allowedEgress
        ? {
            allowedEgress: request.allowedEgress.map((rule) => ({
              host: rule.host,
              ...(rule.port !== undefined ? { port: rule.port } : {})
            }))
          }
        : {}),
      ...(request.verificationPolicies
        ? {
            verificationPolicies: request.verificationPolicies.map((policy) => ({ ...policy }))
          }
        : {}),
      createdAt
    };
    this.insertStatement.run({
      id: profile.id,
      displayName: profile.displayName,
      version: profile.version,
      configJson: JSON.stringify(profile.config),
      policiesJson: JSON.stringify(profile.policies),
      allowedEgressJson: JSON.stringify(profile.allowedEgress ?? []),
      verificationPoliciesJson: JSON.stringify(profile.verificationPolicies ?? []),
      createdAt
    });
    return profile;
  }

  private allocateId(): string {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const id = randomUUID();
      if (!this.get(id)) {
        return id;
      }
    }
    throw new Error("Unable to allocate unique harness profile ID.");
  }

  private mapRow(row: HarnessProfileRow): HarnessProfile {
    const allowedEgress = JSON.parse(row.allowed_egress_json) as HarnessEgressRule[];
    const verificationPolicies = JSON.parse(row.verification_policies_json) as HarnessVerificationPolicy[];
    return {
      id: row.id,
      displayName: row.display_name,
      version: row.version === "v2" ? "v2" : "v1",
      config: JSON.parse(row.config_json) as HarnessProfileConfig,
      policies: JSON.parse(row.policies_json) as HarnessProfilePolicies,
      ...(allowedEgress.length > 0 ? { allowedEgress } : {}),
      ...(verificationPolicies.length > 0 ? { verificationPolicies } : {}),
      createdAt: row.created_at
    };
  }
}

export class DirectiveRepository {
  private readonly listStatement: Database.Statement;
  private readonly getStatement: Database.Statement;
  private readonly insertStatement: Database.Statement;

  constructor(private readonly db: Database.Database) {
    this.listStatement = db.prepare(
      "select id, input, context_refs_json, metadata_json, created_at from directives order by created_at desc, id asc"
    );
    this.getStatement = db.prepare("select id, input, context_refs_json, metadata_json, created_at from directives where id = ?");
    this.insertStatement = db.prepare(`
      insert into directives (
        id,
        input,
        context_refs_json,
        metadata_json,
        created_at
      )
      values (
        @id,
        @input,
        @contextRefsJson,
        @metadataJson,
        @createdAt
      )
    `);
  }

  list(): Directive[] {
    return this.listStatement.all().map((row) => this.mapRow(row as DirectiveRow));
  }

  get(id: string): Directive | undefined {
    const row = this.getStatement.get(id) as DirectiveRow | undefined;
    return row ? this.mapRow(row) : undefined;
  }

  create(request: DirectiveCreateRequest, now: Date = new Date()): Directive {
    const directive: Directive = {
      id: this.allocateId(),
      input: request.input,
      ...(request.contextRefs ? { contextRefs: [...request.contextRefs] } : {}),
      ...(request.metadata ? { metadata: { ...request.metadata } } : {}),
      createdAt: now.toISOString()
    };
    this.insertStatement.run({
      id: directive.id,
      input: directive.input,
      contextRefsJson: JSON.stringify(directive.contextRefs ?? []),
      metadataJson: JSON.stringify(directive.metadata ?? {}),
      createdAt: directive.createdAt
    });
    return directive;
  }

  private allocateId(): string {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const id = randomUUID();
      if (!this.get(id)) {
        return id;
      }
    }
    throw new Error("Unable to allocate unique directive ID.");
  }

  private mapRow(row: DirectiveRow): Directive {
    const contextRefs = JSON.parse(row.context_refs_json) as string[];
    const metadata = JSON.parse(row.metadata_json) as Record<string, string>;
    return {
      id: row.id,
      input: row.input,
      ...(contextRefs.length > 0 ? { contextRefs } : {}),
      ...(Object.keys(metadata).length > 0 ? { metadata } : {}),
      createdAt: row.created_at
    };
  }
}
