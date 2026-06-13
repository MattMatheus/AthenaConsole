import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  APP_STATE_DB_FILENAME,
  APP_STATE_MIGRATIONS,
  openAppStateDatabase,
  resolveAppStateDatabasePath
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
            "workflow_dag_run_events",
            "workflow_dag_run_step_attempts",
            "workflow_dag_run_steps",
            "workflow_dag_runs",
            "workflow_template_index",
            "worker_heartbeats"
          ])
        );

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
});
