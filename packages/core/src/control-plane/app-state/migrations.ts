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

      create table if not exists workflow_template_index (
        id text not null,
        version text not null,
        plugin_id text not null,
        plugin_version text not null,
        name text not null,
        description text not null default '',
        task_count integer not null default 0,
        manifest_json text not null default '{}',
        status text not null,
        validation_errors_json text not null default '[]',
        created_at text not null,
        updated_at text not null,
        primary key (id, version, plugin_id, plugin_version),
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
      create index if not exists idx_workflow_template_index_plugin on workflow_template_index(plugin_id, plugin_version);
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
  },
  {
    version: 4,
    name: "add-workflow-template-index",
    sql: `
      create table if not exists workflow_template_index (
        id text not null,
        version text not null,
        plugin_id text not null,
        plugin_version text not null,
        name text not null,
        description text not null default '',
        task_count integer not null default 0,
        manifest_json text not null default '{}',
        status text not null,
        validation_errors_json text not null default '[]',
        created_at text not null,
        updated_at text not null,
        primary key (id, version, plugin_id, plugin_version),
        foreign key (plugin_id, plugin_version) references plugin_index(id, version) on delete cascade
      );
      create index if not exists idx_workflow_template_index_plugin on workflow_template_index(plugin_id, plugin_version);
    `
  },
  {
    version: 5,
    name: "add-schedule-run-history",
    sql: `
      create table if not exists schedule_run_history (
        id text primary key,
        schedule_id text not null,
        session_id text not null,
        status text not null,
        target_type text,
        target_id text,
        run_id text,
        mission_id text,
        task_ids_json text not null default '[]',
        started_at text not null,
        finished_at text,
        next_run_at text,
        missed_run_at text,
        reason text,
        error text,
        error_code text,
        created_at text not null,
        foreign key (schedule_id) references schedules(id) on delete cascade,
        foreign key (run_id) references runs(id) on delete set null,
        foreign key (mission_id) references missions(id) on delete set null
      );

      create index if not exists idx_schedule_run_history_schedule_started
        on schedule_run_history(schedule_id, started_at desc);
    `
  },
  {
    version: 6,
    name: "add-workflow-dag-run-state",
    sql: `
      create table if not exists workflow_dag_runs (
        id text primary key,
        workflow_template_id text not null,
        workflow_template_version text,
        plugin_id text,
        plugin_version text,
        status text not null,
        step_order_json text not null default '[]',
        dependencies_json text not null default '{}',
        failure_json text,
        created_at text not null,
        updated_at text not null,
        started_at text,
        finished_at text
      );

      create table if not exists workflow_dag_run_steps (
        run_id text not null,
        step_id text not null,
        status text not null,
        attempt integer not null default 0,
        ready integer not null default 0 check (ready in (0, 1)),
        dependencies_json text not null default '[]',
        blocking_step_ids_json text not null default '[]',
        started_at text,
        finished_at text,
        failure_json text,
        output_json text,
        updated_at text not null,
        primary key (run_id, step_id),
        foreign key (run_id) references workflow_dag_runs(id) on delete cascade
      );

      create table if not exists workflow_dag_run_events (
        id text primary key,
        run_id text not null,
        step_id text,
        type text not null,
        level text not null,
        message text not null default '',
        payload_json text not null default '{}',
        timestamp text not null,
        foreign key (run_id) references workflow_dag_runs(id) on delete cascade
      );

      create index if not exists idx_workflow_dag_runs_template_updated
        on workflow_dag_runs(workflow_template_id, updated_at desc);
      create index if not exists idx_workflow_dag_runs_status
        on workflow_dag_runs(status);
      create index if not exists idx_workflow_dag_run_steps_status
        on workflow_dag_run_steps(run_id, status);
      create index if not exists idx_workflow_dag_run_events_run_timestamp
        on workflow_dag_run_events(run_id, timestamp);
    `
  },
  {
    version: 7,
    name: "add-run-verification-results",
    sql: `
      alter table runs add column verification_status text;
      alter table runs add column verification_failures_json text;
    `
  },
  {
    version: 8,
    name: "add-schedule-workflow-dag-run-correlation",
    sql: `
      alter table schedule_run_history add column workflow_dag_run_id text;
    `
  },
  {
    version: 9,
    name: "add-harness-profiles",
    sql: `
      create table if not exists harness_profiles (
        id text primary key,
        display_name text not null,
        version text not null,
        config_json text not null,
        policies_json text not null,
        allowed_egress_json text not null default '[]',
        verification_policies_json text not null default '[]',
        created_at text not null
      );

      create index if not exists idx_harness_profiles_created
        on harness_profiles(created_at desc);
    `
  },
  {
    version: 10,
    name: "add-directives",
    sql: `
      create table if not exists directives (
        id text primary key,
        input text not null,
        context_refs_json text not null default '[]',
        metadata_json text not null default '{}',
        created_at text not null
      );

      create index if not exists idx_directives_created
        on directives(created_at desc);
    `
  },
  {
    version: 11,
    name: "add-run-templates",
    sql: `
      create table if not exists run_templates (
        id text primary key,
        harness_profile_id text not null,
        directive_template text not null,
        default_params_json text not null default '{}',
        created_at text not null,
        foreign key (harness_profile_id) references harness_profiles(id) on delete restrict
      );

      create index if not exists idx_run_templates_created
        on run_templates(created_at desc);
      create index if not exists idx_run_templates_harness_profile
        on run_templates(harness_profile_id);
    `
  },
  {
    version: 12,
    name: "add-connected-repositories",
    sql: `
      create table if not exists connected_repositories (
        id text primary key,
        name text not null,
        source_type text not null,
        workspace_path text not null,
        host_path text,
        remote_url text,
        default_branch text,
        current_branch text,
        head_commit text,
        dirty_state text not null default 'unknown',
        status text not null,
        status_message text,
        last_inspected_at text,
        created_at text not null,
        updated_at text not null
      );

      create index if not exists idx_connected_repositories_status
        on connected_repositories(status);
      create index if not exists idx_connected_repositories_updated
        on connected_repositories(updated_at desc);
    `
  },
  {
    version: 13,
    name: "add-model-provider-configs",
    sql: `
      create table if not exists model_provider_configs (
        id text primary key,
        name text not null,
        provider_kind text not null,
        base_url text not null,
        default_model text not null,
        secret_ref_json text not null,
        status text not null,
        status_message text,
        created_at text not null,
        updated_at text not null
      );

      create index if not exists idx_model_provider_configs_kind
        on model_provider_configs(provider_kind);
      create index if not exists idx_model_provider_configs_updated
        on model_provider_configs(updated_at desc);
    `
  },
  {
    version: 14,
    name: "add-connector-credential-bindings",
    sql: `
      create table if not exists connector_credential_bindings (
        plugin_id text not null,
        plugin_version text not null,
        service_id text not null,
        binding_ref text not null,
        display_name text,
        scopes_json text not null default '[]',
        status text not null,
        created_at text not null,
        updated_at text not null,
        primary key (plugin_id, plugin_version, service_id)
      );
      create index if not exists idx_connector_credential_bindings_status on connector_credential_bindings(status);
    `
  },
  {
    version: 15,
    name: "add-workflow-dag-step-attempt-history",
    sql: `
      create table if not exists workflow_dag_run_step_attempts (
        run_id text not null,
        step_id text not null,
        attempt integer not null,
        status text not null,
        started_at text not null,
        finished_at text,
        failure_json text,
        output_json text,
        updated_at text not null,
        primary key (run_id, step_id, attempt),
        foreign key (run_id, step_id) references workflow_dag_run_steps(run_id, step_id) on delete cascade
      );

      create index if not exists idx_workflow_dag_run_step_attempts_run_step
        on workflow_dag_run_step_attempts(run_id, step_id, attempt);
    `
  },
  {
    version: 16,
    name: "add-worker-heartbeats",
    sql: `
      create table if not exists worker_heartbeats (
        worker_id text primary key,
        identity_json text not null default '{}',
        active_run_id text,
        active_session_id text,
        capacity integer not null default 1,
        version text not null default 'unknown',
        metadata_json text,
        last_heartbeat_at text not null,
        expires_at text not null,
        created_at text not null,
        updated_at text not null
      );

      create index if not exists idx_worker_heartbeats_expires_at
        on worker_heartbeats(expires_at);
      create index if not exists idx_worker_heartbeats_active_run
        on worker_heartbeats(active_run_id);
    `
  },
  {
    version: 17,
    name: "add-eval-suite-run-results",
    sql: `
      create table if not exists eval_suites (
        id text primary key,
        name text not null,
        description text not null default '',
        status text not null,
        metadata_json text not null default '{}',
        created_at text not null,
        updated_at text not null
      );

      create table if not exists eval_runs (
        id text primary key,
        suite_id text not null,
        source_run_id text,
        agent_id text not null,
        agent_version text not null,
        provider_id text,
        provider_kind text,
        model text,
        prompt_template_id text,
        prompt_template_version text,
        prompt_template_hash text not null,
        status text not null,
        started_at text,
        finished_at text,
        failure_json text,
        metadata_json text not null default '{}',
        created_at text not null,
        updated_at text not null,
        foreign key (suite_id) references eval_suites(id) on delete cascade
      );

      create table if not exists eval_results (
        id text primary key,
        eval_run_id text not null,
        case_id text not null,
        status text not null,
        score real,
        expected_artifact_uri text,
        actual_artifact_uri text,
        failure_json text,
        metrics_json text not null default '{}',
        metadata_json text not null default '{}',
        created_at text not null,
        unique (eval_run_id, case_id),
        foreign key (eval_run_id) references eval_runs(id) on delete cascade
      );

      create index if not exists idx_eval_suites_status
        on eval_suites(status);
      create index if not exists idx_eval_runs_suite_status
        on eval_runs(suite_id, status);
      create index if not exists idx_eval_runs_agent
        on eval_runs(agent_id, agent_version);
      create index if not exists idx_eval_runs_source_run
        on eval_runs(source_run_id);
      create index if not exists idx_eval_results_run_status
        on eval_results(eval_run_id, status);
    `
  },
  {
    version: 18,
    name: "add-usage-ledger",
    sql: `
      create table if not exists usage_ledger (
        id text primary key,
        run_id text not null,
        target_type text,
        target_id text,
        task_id text,
        agent_id text,
        agent_version text,
        provider text,
        provider_id text,
        provider_kind text,
        model text,
        user_id text,
        workspace_id text,
        input_tokens integer not null default 0,
        output_tokens integer not null default 0,
        total_tokens integer not null default 0,
        cost_usd real,
        provider_usage_json text,
        source text not null,
        recorded_at text not null,
        created_at text not null,
        updated_at text not null,
        unique(run_id),
        foreign key (run_id) references runs(id) on delete cascade,
        foreign key (task_id) references tasks(id) on delete set null
      );

      create index if not exists idx_usage_ledger_recorded_at
        on usage_ledger(recorded_at);
      create index if not exists idx_usage_ledger_agent
        on usage_ledger(agent_id, agent_version);
      create index if not exists idx_usage_ledger_provider
        on usage_ledger(provider, provider_id);
      create index if not exists idx_usage_ledger_model
        on usage_ledger(model);
      create index if not exists idx_usage_ledger_user_workspace
        on usage_ledger(user_id, workspace_id);
    `
  },
  {
    version: 19,
    name: "add-agent-lifecycle-status",
    sql: `
      alter table agent_index add column lifecycle_status text not null default 'approved';
      create index if not exists idx_agent_index_lifecycle_status
        on agent_index(lifecycle_status);
    `
  },
  {
    version: 20,
    name: "add-default-workspace",
    sql: `
      create table if not exists workspaces (
        id text primary key,
        name text not null,
        slug text not null unique,
        created_at text not null,
        updated_at text not null
      );

      insert into workspaces (id, name, slug, created_at, updated_at)
      values ('default', 'Default Workspace', 'default', '1970-01-01T00:00:00.000Z', '1970-01-01T00:00:00.000Z')
      on conflict(id) do nothing;

      alter table missions add column workspace_id text not null default 'default';
      alter table tasks add column workspace_id text not null default 'default';
      alter table runs add column workspace_id text not null default 'default';
      alter table run_events add column workspace_id text not null default 'default';
      alter table artifact_metadata add column workspace_id text not null default 'default';
      alter table schedules add column workspace_id text not null default 'default';
      alter table schedule_run_history add column workspace_id text not null default 'default';
      alter table connected_repositories add column workspace_id text not null default 'default';
      alter table model_provider_configs add column workspace_id text not null default 'default';
      alter table connector_credential_bindings add column workspace_id text not null default 'default';
      alter table eval_suites add column workspace_id text not null default 'default';
      alter table eval_runs add column workspace_id text not null default 'default';
      alter table eval_results add column workspace_id text not null default 'default';

      update usage_ledger set workspace_id = 'default' where workspace_id is null or workspace_id = '';

      create index if not exists idx_missions_workspace
        on missions(workspace_id);
      create index if not exists idx_tasks_workspace
        on tasks(workspace_id);
      create index if not exists idx_runs_workspace
        on runs(workspace_id);
      create index if not exists idx_run_events_workspace
        on run_events(workspace_id);
      create index if not exists idx_artifact_metadata_workspace
        on artifact_metadata(workspace_id);
      create index if not exists idx_schedules_workspace
        on schedules(workspace_id);
      create index if not exists idx_schedule_run_history_workspace
        on schedule_run_history(workspace_id);
      create index if not exists idx_connected_repositories_workspace
        on connected_repositories(workspace_id);
      create index if not exists idx_model_provider_configs_workspace
        on model_provider_configs(workspace_id);
      create index if not exists idx_connector_credential_bindings_workspace
        on connector_credential_bindings(workspace_id);
      create index if not exists idx_eval_suites_workspace
        on eval_suites(workspace_id);
      create index if not exists idx_eval_runs_workspace
        on eval_runs(workspace_id);
      create index if not exists idx_eval_results_workspace
        on eval_results(workspace_id);
      create index if not exists idx_usage_ledger_workspace
        on usage_ledger(workspace_id);
    `
  },
  {
    version: 21,
    name: "add-workspace-members",
    sql: `
      create table if not exists workspace_members (
        workspace_id text not null references workspaces(id),
        subject text not null,
        role text not null check (role in ('Viewer', 'Operator', 'Admin')),
        created_at text not null,
        updated_at text not null,
        primary key (workspace_id, subject)
      );

      create index if not exists workspace_members_subject_idx
        on workspace_members(subject, workspace_id);
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
