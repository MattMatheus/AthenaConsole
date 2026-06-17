import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { createApiServer } from "../src/api/server.js";
import { openAppStateDatabase } from "../src/control-plane/app-state/index.js";
import { runCli } from "../src/cli/index.js";
import { loadConfig } from "../src/shared/config.js";

describe("CLI schedule commands", () => {
  it("adds, lists, runs, reads logs, and removes a schedule", async () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-cli-schedule-"));
    try {
      const config = loadConfig(dir);
      const pluginDir = join(dir, "plugin");
      mkdirSync(pluginDir, { recursive: true });
      writeFileSync(
        join(pluginDir, "success.js"),
        "process.stdout.write(JSON.stringify({ output: { ok: true }, artifacts: [] }));",
        "utf8"
      );
      const appState = openAppStateDatabase(config);
      try {
        seedRunnableTask(appState, pluginDir, "success.js", "task-cli-scheduled");
      } finally {
        appState.close();
      }
      const addOut = await runCli(
        [
          "schedule",
          "add",
          "--id",
          "job1",
          "--target-type",
          "task",
          "--target-id",
          "task-cli-scheduled",
          "--run-at",
          "2026-06-01T09:00:00.000Z",
          "--timezone",
          "UTC"
        ],
        { cwd: dir }
      );
      const added = JSON.parse(addOut) as { id: string; targetType?: string; targetId?: string };
      expect(added.id).toBe("job1");
      expect(added.targetType).toBe("task");
      expect(added.targetId).toBe("task-cli-scheduled");

      const listOut = await runCli(["schedule", "list"], { cwd: dir });
      const listed = JSON.parse(listOut) as { count: number };
      expect(listed.count).toBe(1);

      const runOut = await runCli(["schedule", "run", "--id", "job1"], { cwd: dir });
      const ran = JSON.parse(runOut) as { status: string; summary: { ok: number; failed: number; alreadyRunning: number } };
      expect(ran.status).toBe("ok");
      expect(ran.summary.ok).toBe(1);
      expect(ran.summary.failed).toBe(0);

      const logsOut = await runCli(["schedule", "logs", "--id", "job1", "--limit", "5"], { cwd: dir });
      const logs = JSON.parse(logsOut) as { count: number; logs: Array<{ status: string }> };
      expect(logs.count).toBeGreaterThan(0);
      expect(logs.logs.some((row) => row.status === "ok")).toBe(true);

      const removeOut = await runCli(["schedule", "remove", "--id", "job1"], { cwd: dir });
      const removed = JSON.parse(removeOut) as { removed: boolean };
      expect(removed.removed).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("rejects invalid target types", async () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-cli-schedule-invalid-target-"));
    try {
      await expect(
        runCli(
          [
            "schedule",
            "add",
            "--id",
            "job1",
            "--target-type",
            "session",
            "--target-id",
            "task-1",
            "--run-at",
            "2026-06-01T09:00:00.000Z"
          ],
          { cwd: dir }
        )
      ).rejects.toThrow("Invalid --target-type 'session'. Expected task|mission|workflow-template.");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("runs schedule add/list/run/tick/logs/remove through API transport", async () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-cli-schedule-api-"));
    try {
      const config = loadConfig(dir);
      const pluginDir = join(dir, "plugin");
      mkdirSync(pluginDir, { recursive: true });
      writeFileSync(
        join(pluginDir, "success.js"),
        "process.stdout.write(JSON.stringify({ output: { ok: true }, artifacts: [] }));",
        "utf8"
      );
      const appState = openAppStateDatabase(config);
      try {
        seedRunnableTask(appState, pluginDir, "success.js", "task-cli-api-scheduled");
      } finally {
        appState.close();
      }
      const server = createApiServer({
        config,
        host: "127.0.0.1",
        port: 0
      });
      let bound: { host: string; port: number };
      try {
        bound = await server.start();
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (message.includes("EPERM")) {
          return;
        }
        throw error;
      }
      try {
        const baseUrl = `http://${bound.host}:${bound.port}`;
        const addOut = await runCli(
          [
            "schedule",
            "add",
            "--id",
            "job-api",
            "--target-type",
            "task",
            "--target-id",
            "task-cli-api-scheduled",
            "--run-at",
            "2026-06-01T09:00:00.000Z",
            "--timezone",
            "UTC",
            "--transport",
            "api",
            "--api-base-url",
            baseUrl
          ],
          { cwd: dir }
        );
        const added = JSON.parse(addOut) as { id: string };
        expect(added.id).toBe("job-api");

        const listOut = await runCli(
          ["schedule", "list", "--transport", "api", "--api-base-url", baseUrl],
          { cwd: dir }
        );
        const listed = JSON.parse(listOut) as { count: number };
        expect(listed.count).toBe(1);

        const runOut = await runCli(
          ["schedule", "run", "--id", "job-api", "--transport", "api", "--api-base-url", baseUrl],
          { cwd: dir }
        );
        const ran = JSON.parse(runOut) as { status: string };
        expect(ran.status).toBe("ok");

        const tickOut = await runCli(
          ["schedule", "tick", "--transport", "api", "--api-base-url", baseUrl, "--at", new Date().toISOString()],
          { cwd: dir }
        );
        const tick = JSON.parse(tickOut) as { run: unknown[]; skipped: number };
        expect(Array.isArray(tick.run)).toBe(true);
        expect(typeof tick.skipped).toBe("number");

        const logsOut = await runCli(
          ["schedule", "logs", "--id", "job-api", "--limit", "5", "--transport", "api", "--api-base-url", baseUrl],
          { cwd: dir }
        );
        const logs = JSON.parse(logsOut) as { count: number };
        expect(logs.count).toBeGreaterThan(0);

        const removeOut = await runCli(
          ["schedule", "remove", "--id", "job-api", "--transport", "api", "--api-base-url", baseUrl],
          { cwd: dir }
        );
        const removed = JSON.parse(removeOut) as { removed: boolean };
        expect(removed.removed).toBe(true);
      } finally {
        await server.stop();
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("supports schedule run/tick/remove in API-only transport and reports remote errors", async () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-cli-schedule-api-unsupported-"));
    try {
      const config = loadConfig(dir);
      const server = createApiServer({
        config,
        host: "127.0.0.1",
        port: 0
      });
      let bound: { host: string; port: number };
      try {
        bound = await server.start();
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (message.includes("EPERM")) {
          return;
        }
        throw error;
      }
      const baseUrl = `http://${bound.host}:${bound.port}`;
      try {
        const removeOut = await runCli(
          ["schedule", "remove", "--id", "job1", "--transport", "api", "--api-base-url", baseUrl],
          {
            cwd: dir
          }
        );
        expect(JSON.parse(removeOut)).toEqual({ id: "job1", removed: false });
        await expect(
          runCli(["schedule", "run", "--id", "job1", "--transport", "api", "--api-base-url", baseUrl], {
            cwd: dir
          })
        ).rejects.toThrow("Schedule 'job1' not found");
        const tickOut = await runCli(
          ["schedule", "tick", "--transport", "api", "--api-base-url", baseUrl],
          { cwd: dir }
        );
        expect(JSON.parse(tickOut)).toMatchObject({
          run: [],
          skipped: 0,
          summary: {
            ok: 0,
            failed: 0,
            alreadyRunning: 0
          }
        });
      } finally {
        await server.stop();
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

function seedRunnableTask(
  appState: ReturnType<typeof openAppStateDatabase>,
  pluginDir: string,
  scriptName: string,
  taskId: string
): void {
  appState.plugins.upsert({
    id: "team-orchestrator.test.cli-scheduler-runnable",
    version: "0.1.0",
    path: pluginDir,
    enabled: true,
    status: "loaded",
    sourceType: "local",
    manifest: { plugin: { name: "CLI Runnable Scheduler Test" } },
    validationErrors: []
  });
  appState.agents.upsert({
    id: "cli.scheduler.runnable.agent",
    version: "1.0.0",
    pluginId: "team-orchestrator.test.cli-scheduler-runnable",
    pluginVersion: "0.1.0",
    name: "CLI Runnable Scheduler Agent",
    capabilities: ["test.run"],
    manifest: {
      agent: {
        implementation: {
          type: "local-command",
          command: process.execPath,
          args: [scriptName]
        },
        runtime: {
          preferredBackend: "local-process",
          workingDirectory: "."
        }
      }
    },
    status: "loaded"
  });
  appState.tasks.create({
    id: taskId,
    title: "CLI scheduled runnable task",
    status: "ready",
    assignedAgentId: "cli.scheduler.runnable.agent",
    assignedAgentVersion: "1.0.0",
    capabilityRequirements: ["test.run"]
  });
}
