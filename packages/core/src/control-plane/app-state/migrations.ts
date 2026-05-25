import type Database from "better-sqlite3";
import { AppStateMigrationRepository } from "./repositories.js";

export interface AppStateMigration {
  version: number;
  name: string;
  sql: string;
}

export const APP_STATE_MIGRATIONS: readonly AppStateMigration[] = [
  {
    version: 1,
    name: "create-foundational-app-state-tables",
    sql: `
      create table if not exists app_state_migrations (
        version integer primary key,
        name text not null,
        applied_at text not null
      );

      create table if not exists app_settings (
        key text primary key,
        value_json text not null,
        updated_at text not null
      );

      create table if not exists plugin_index (
        id text not null,
        version text not null,
        path text not null,
        enabled integer not null default 1 check (enabled in (0, 1)),
        status text not null,
        manifest_json text not null default '{}',
        validation_errors_json text not null default '[]',
        created_at text not null,
        updated_at text not null,
        primary key (id, version)
      );

      create table if not exists agent_index (
        id text not null,
        version text not null,
        plugin_id text not null,
        plugin_version text not null,
        name text not null,
        capabilities_json text not null default '[]',
        manifest_json text not null default '{}',
        status text not null,
        created_at text not null,
        updated_at text not null,
        primary key (id, version),
        foreign key (plugin_id, plugin_version) references plugin_index(id, version) on delete cascade
      );

      create table if not exists missions (
        id text primary key,
        title text not null,
        goal text not null default '',
        context_json text not null default '{}',
        status text not null,
        task_order_json text not null default '[]',
        created_at text not null,
        updated_at text not null,
        archived_at text
      );

      create table if not exists tasks (
        id text primary key,
        title text not null,
        description text not null default '',
        status text not null,
        capability_requirements_json text not null default '[]',
        assigned_agent_id text,
        assigned_agent_version text,
        inputs_json text not null default '{}',
        mission_id text,
        source_run_id text,
        provenance_json text,
        created_by text,
        created_at text not null,
        updated_at text not null,
        archived_at text,
        foreign key (assigned_agent_id, assigned_agent_version) references agent_index(id, version),
        foreign key (mission_id) references missions(id) on delete set null
      );

      create table if not exists runs (
        id text primary key,
        target_type text not null,
        target_id text not null,
        status text not null,
        backend text,
        agent_id text,
        agent_version text,
        started_at text,
        ended_at text,
        output_json text,
        failure_json text,
        safety_stop_json text,
        created_at text not null,
        updated_at text not null,
        foreign key (agent_id, agent_version) references agent_index(id, version)
      );

      create table if not exists run_events (
        id text primary key,
        run_id text not null,
        task_id text,
        mission_id text,
        agent_id text,
        type text not null,
        level text not null,
        timestamp text not null,
        message text not null default '',
        payload_json text not null default '{}',
        parent_event_id text,
        trace_id text,
        foreign key (run_id) references runs(id) on delete cascade,
        foreign key (task_id) references tasks(id) on delete set null,
        foreign key (mission_id) references missions(id) on delete set null,
        foreign key (parent_event_id) references run_events(id) on delete set null
      );

      create table if not exists artifact_metadata (
        id text primary key,
        run_id text not null,
        task_id text,
        agent_id text,
        label text not null,
        kind text not null,
        format text not null,
        storage_uri text not null,
        size_bytes integer,
        hash text,
        metadata_json text not null default '{}',
        schema_validation_json text,
        created_at text not null,
        foreign key (run_id) references runs(id) on delete cascade,
        foreign key (task_id) references tasks(id) on delete set null
      );

      create table if not exists approvals (
        id text primary key,
        run_id text not null,
        agent_id text,
        risk_class text not null,
        action text not null,
        reason text not null default '',
        scope_json text not null default '{}',
        decision text not null default 'pending',
        created_at text not null,
        resolved_at text,
        expires_at text,
        foreign key (run_id) references runs(id) on delete cascade
      );

      create table if not exists schedules (
        id text primary key,
        name text not null,
        target_type text not null,
        target_id text not null,
        input_bindings_json text not null default '{}',
        rrule text,
        timezone text not null,
        status text not null,
        last_run_id text,
        next_run_at text,
        failure_policy_json text not null default '{}',
        created_at text not null,
        updated_at text not null,
        foreign key (last_run_id) references runs(id) on delete set null
      );

      create index if not exists idx_agent_index_plugin on agent_index(plugin_id, plugin_version);
      create index if not exists idx_tasks_status on tasks(status);
      create index if not exists idx_tasks_mission on tasks(mission_id);
      create index if not exists idx_runs_target on runs(target_type, target_id);
      create index if not exists idx_run_events_run_timestamp on run_events(run_id, timestamp);
      create index if not exists idx_artifact_metadata_run on artifact_metadata(run_id);
      create index if not exists idx_approvals_decision on approvals(decision);
      create index if not exists idx_schedules_status_next_run on schedules(status, next_run_at);
    `
  },
  {
    version: 2,
    name: "add-plugin-source-type",
    sql: `
      alter table plugin_index add column source_type text not null default 'local';
      create index if not exists idx_plugin_index_source_type on plugin_index(source_type);
    `
  },
  {
    version: 3,
    name: "add-task-dependencies",
    sql: `
      alter table tasks add column depends_on_json text not null default '[]';
    `
  }
];

export function ensureAppStateMigrationTable(db: Database.Database): void {
  db.exec(`
    create table if not exists app_state_migrations (
      version integer primary key,
      name text not null,
      applied_at text not null
    )
  `);
}

export function runAppStateMigrations(
  db: Database.Database,
  migrations: readonly AppStateMigration[] = APP_STATE_MIGRATIONS
): AppStateMigrationRepository {
  ensureAppStateMigrationTable(db);
  const migrationRepository = new AppStateMigrationRepository(db);
  const appliedVersions = new Set(migrationRepository.listVersions());
  const orderedMigrations = [...migrations].sort((left, right) => left.version - right.version);

  const applyMigration = db.transaction((migration: AppStateMigration) => {
    db.exec(migration.sql);
    migrationRepository.recordApplied(migration.version, migration.name, new Date().toISOString());
  });

  for (const migration of orderedMigrations) {
    if (!appliedVersions.has(migration.version)) {
      applyMigration(migration);
      appliedVersions.add(migration.version);
    }
  }

  return migrationRepository;
}
