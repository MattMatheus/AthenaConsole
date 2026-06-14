import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { mkdirSync } from "node:fs";
import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";
import {
  APP_STATE_DB_FILENAME,
  APP_STATE_MIGRATIONS,
  openAppStateDatabase,
  resolveAppStateDatabasePath,
  runAppStateMigrations
} from "../src/control-plane/app-state/index.js";
import { loadConfig } from "../src/shared/config.js";

describe("control-plane app-state database", () => {
  it("opens the per-workspace SQLite database with WAL and foundational tables", () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-app-state-"));
    try {
      const config = loadConfig(dir);
      const appState = openAppStateDatabase(config);
      try {
        expect(appState.path).toBe(join(dir, ".athena", APP_STATE_DB_FILENAME));
        expect(appState.path).toBe(resolveAppStateDatabasePath(config));
        expect(existsSync(appState.path)).toBe(true);
        expect(appState.db.pragma("journal_mode", { simple: true })).toBe("wal");
        expect(appState.db.pragma("foreign_keys", { simple: true })).toBe(1);

        const tables = appState.db
          .prepare("select name from sqlite_master where type = 'table' order by name asc")
          .all()
          .map((row) => (row as { name: string }).name);
        expect(tables).toEqual(
          expect.arrayContaining([
            "agent_index",
            "app_settings",
            "app_state_migrations",
            "approvals",
            "artifact_metadata",
            "eval_results",
            "eval_runs",
            "eval_suites",
            "missions",
            "plugin_index",
            "run_events",
            "runs",
            "schedules",
            "tasks",
            "usage_ledger",
            "workflow_dag_run_events",
            "workflow_dag_run_step_attempts",
            "workflow_dag_run_steps",
            "workflow_dag_runs",
            "workflow_template_index",
            "workspaces",
            "worker_heartbeats"
          ])
        );
        expect(appState.workspaces.get("default")).toMatchObject({
          id: "default",
          name: "Default Workspace",
          slug: "default"
        });

        expect(appState.migrations.list()).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              version: 1,
              name: "create-foundational-app-state-tables"
            }),
            expect.objectContaining({
              version: 2,
              name: "add-plugin-source-type"
            }),
            expect.objectContaining({
              version: 3,
              name: "add-task-dependencies"
            }),
            expect.objectContaining({
              version: 4,
              name: "add-workflow-template-index"
            }),
            expect.objectContaining({
              version: 5,
              name: "add-schedule-run-history"
            }),
            expect.objectContaining({
              version: 6,
              name: "add-workflow-dag-run-state"
            })
          ])
        );
      } finally {
        appState.close();
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("reruns migrations idempotently", () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-app-state-migrations-"));
    try {
      const config = loadConfig(dir);
      openAppStateDatabase(config).close();

        const appState = openAppStateDatabase(config);
      try {
        expect(appState.migrations.list()).toHaveLength(APP_STATE_MIGRATIONS.length);
        expect(appState.migrations.listVersions()).toEqual(APP_STATE_MIGRATIONS.map((migration) => migration.version));
      } finally {
        appState.close();
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("assigns existing app-state resources to the default workspace during migration", () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-app-state-workspace-migration-"));
    try {
      const config = loadConfig(dir);
      const databasePath = resolveAppStateDatabasePath(config);
      mkdirSync(dirname(databasePath), { recursive: true });
      const db = new Database(databasePath);
      try {
        db.pragma("foreign_keys = ON");
        runAppStateMigrations(db, APP_STATE_MIGRATIONS.filter((migration) => migration.version < 20));
        seedPreWorkspaceRows(db);
        runAppStateMigrations(db);
      } finally {
        db.close();
      }

      const appState = openAppStateDatabase(config);
      try {
        expect(appState.workspaces.list()).toEqual([
          expect.objectContaining({
            id: "default",
            name: "Default Workspace",
            slug: "default"
          })
        ]);
        for (const table of [
          "missions",
          "tasks",
          "runs",
          "run_events",
          "artifact_metadata",
          "schedules",
          "schedule_run_history",
          "connected_repositories",
          "model_provider_configs",
          "connector_credential_bindings",
          "eval_suites",
          "eval_runs",
          "eval_results",
          "usage_ledger"
        ]) {
          const rows = appState.db.prepare(`select distinct workspace_id as workspaceId from ${table}`).all() as Array<{
            workspaceId: string | null;
          }>;
          expect(rows).toEqual([{ workspaceId: "default" }]);
        }
      } finally {
        appState.close();
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("persists app settings through the repository", () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-app-state-settings-"));
    try {
      const config = loadConfig(dir);
      const firstAppState = openAppStateDatabase(config);
      try {
        firstAppState.settings.set("console.defaultView", {
          mode: "tasks",
          pinnedAgentIds: ["agent.software-planner"]
        });
      } finally {
        firstAppState.close();
      }

      const secondAppState = openAppStateDatabase(config);
      try {
        expect(secondAppState.settings.get("console.defaultView")?.value).toEqual({
          mode: "tasks",
          pinnedAgentIds: ["agent.software-planner"]
        });
        expect(secondAppState.settings.list().map((setting) => setting.key)).toEqual(["console.defaultView"]);
        expect(secondAppState.settings.delete("console.defaultView")).toBe(true);
        expect(secondAppState.settings.get("console.defaultView")).toBeUndefined();
      } finally {
        secondAppState.close();
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("looks up indexed agents by exact version and lowest version", () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-app-state-agent-index-"));
    try {
      const appState = openAppStateDatabase(loadConfig(dir));
      try {
        appState.plugins.upsert({
          id: "agent-index.plugin",
          version: "0.1.0",
          path: "/tmp/agent-index-plugin",
          enabled: true,
          sourceType: "local",
          status: "loaded",
          manifest: {},
          validationErrors: []
        });
        appState.agents.upsert({
          id: "agent-index.agent",
          version: "2.0.0",
          pluginId: "agent-index.plugin",
          pluginVersion: "0.1.0",
          name: "Agent v2",
          capabilities: ["plan"],
          manifest: { version: 2 },
          status: "loaded"
        });
        appState.agents.upsert({
          id: "agent-index.agent",
          version: "1.0.0",
          pluginId: "agent-index.plugin",
          pluginVersion: "0.1.0",
          name: "Agent v1",
          capabilities: ["plan"],
          manifest: { version: 1 },
          status: "loaded"
        });

        expect(appState.agents.get("agent-index.agent", "2.0.0")).toMatchObject({
          id: "agent-index.agent",
          version: "2.0.0",
          name: "Agent v2",
          manifest: { version: 2 }
        });
        expect(appState.agents.get("agent-index.agent", "missing")).toBeUndefined();
        expect(appState.agents.findById("agent-index.agent")).toMatchObject({
          id: "agent-index.agent",
          version: "1.0.0",
          name: "Agent v1",
          manifest: { version: 1 }
        });
        expect(appState.agents.findById("missing-agent")).toBeUndefined();
      } finally {
        appState.close();
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

function seedPreWorkspaceRows(db: Database.Database): void {
  db.exec(`
    insert into missions (id, title, status, created_at, updated_at)
    values ('mission-default', 'Mission', 'draft', '2026-06-13T00:00:00.000Z', '2026-06-13T00:00:00.000Z');

    insert into tasks (id, title, status, mission_id, created_at, updated_at)
    values ('task-default', 'Task', 'draft', 'mission-default', '2026-06-13T00:00:00.000Z', '2026-06-13T00:00:00.000Z');

    insert into runs (id, target_type, target_id, status, created_at, updated_at)
    values ('run-default', 'task', 'task-default', 'completed', '2026-06-13T00:00:00.000Z', '2026-06-13T00:00:00.000Z');

    insert into run_events (id, run_id, task_id, type, level, timestamp, payload_json)
    values ('event-default', 'run-default', 'task-default', 'run.completed', 'info', '2026-06-13T00:00:00.000Z', '{}');

    insert into artifact_metadata (id, run_id, task_id, label, kind, format, storage_uri, created_at)
    values ('artifact-default', 'run-default', 'task-default', 'Result', 'primary', 'markdown', 'memory://artifact', '2026-06-13T00:00:00.000Z');

    insert into schedules (id, name, target_type, target_id, input_bindings_json, timezone, status, failure_policy_json, created_at, updated_at)
    values ('schedule-default', 'Schedule', 'task', 'task-default', '{}', 'UTC', 'active', '{}', '2026-06-13T00:00:00.000Z', '2026-06-13T00:00:00.000Z');

    insert into schedule_run_history (id, schedule_id, session_id, status, target_type, target_id, run_id, started_at, created_at)
    values ('schedule-history-default', 'schedule-default', 'session-default', 'ok', 'task', 'task-default', 'run-default', '2026-06-13T00:00:00.000Z', '2026-06-13T00:00:00.000Z');

    insert into connected_repositories (id, name, source_type, workspace_path, dirty_state, status, created_at, updated_at)
    values ('repo-default', 'Repo', 'existing-path', 'Repos/AthenaConsole', 'clean', 'ready', '2026-06-13T00:00:00.000Z', '2026-06-13T00:00:00.000Z');

    insert into model_provider_configs (id, name, provider_kind, base_url, default_model, secret_ref_json, status, created_at, updated_at)
    values ('provider-default', 'Provider', 'openai-compatible', 'https://example.invalid/v1', 'gpt-fixture', '{"kind":"env","name":"OPENAI_API_KEY"}', 'configured', '2026-06-13T00:00:00.000Z', '2026-06-13T00:00:00.000Z');

    insert into connector_credential_bindings (plugin_id, plugin_version, service_id, binding_ref, scopes_json, status, created_at, updated_at)
    values ('plugin-default', '0.1.0', 'service-default', 'env:FIXTURE_TOKEN', '[]', 'bound', '2026-06-13T00:00:00.000Z', '2026-06-13T00:00:00.000Z');

    insert into eval_suites (id, name, status, created_at, updated_at)
    values ('eval-suite-default', 'Eval Suite', 'active', '2026-06-13T00:00:00.000Z', '2026-06-13T00:00:00.000Z');

    insert into eval_runs (id, suite_id, agent_id, agent_version, prompt_template_hash, status, created_at, updated_at)
    values ('eval-run-default', 'eval-suite-default', 'agent-default', '1.0.0', 'sha256:fixture', 'completed', '2026-06-13T00:00:00.000Z', '2026-06-13T00:00:00.000Z');

    insert into eval_results (id, eval_run_id, case_id, status, created_at)
    values ('eval-result-default', 'eval-run-default', 'case-default', 'passed', '2026-06-13T00:00:00.000Z');

    insert into usage_ledger (id, run_id, task_id, input_tokens, output_tokens, total_tokens, source, recorded_at, created_at, updated_at)
    values ('usage-default', 'run-default', 'task-default', 10, 5, 15, 'run-output', '2026-06-13T00:00:00.000Z', '2026-06-13T00:00:00.000Z', '2026-06-13T00:00:00.000Z');
  `);
}
