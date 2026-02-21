import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import type { AthenaConfig } from "../src/shared/config.js";
import { ScheduleManager } from "../src/schedule/index.js";

function testConfig(workspaceRoot: string): AthenaConfig {
  return {
    workspaceRoot,
    stateDir: ".athena",
    defaultProvider: "mock",
    defaultModel: "mock-model",
    providerFallbackOrder: [],
    localProviderCommand: "/bin/echo",
    localProviderArgs: [],
    httpProviderUrl: undefined,
    httpProviderApiKey: undefined,
    httpProviderTimeoutMs: 20000,
    runtimeRunTimeoutMs: 30000,
    scheduleRunTimeoutMs: 45000
  };
}

describe("schedule manager", () => {
  it("persists scheduled tasks", async () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-schedule-"));
    try {
      const managerA = new ScheduleManager(testConfig(dir));
      await managerA.upsertTask({
        id: "heartbeat",
        sessionId: "s1",
        input: "ping",
        everyMinutes: 15
      });

      const managerB = new ScheduleManager(testConfig(dir));
      const tasks = await managerB.listTasks();
      expect(tasks.length).toBe(1);
      expect(tasks[0]?.id).toBe("heartbeat");
      expect(tasks[0]?.sessionId).toBe("s1");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("guards overlap and logs already-running status", async () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-schedule-overlap-"));
    try {
      const manager = new ScheduleManager(testConfig(dir));
      await manager.upsertTask({
        id: "job",
        sessionId: "s1",
        input: "do work",
        everyMinutes: 10
      });

      const first = manager.runTask("job", async () => {
        await new Promise((resolvePromise) => setTimeout(resolvePromise, 50));
      });
      const second = manager.runTask("job", async () => {});

      const [a, b] = await Promise.all([first, second]);
      expect([a.status, b.status].sort()).toEqual(["already-running", "ok"]);

      const logs = await manager.readLogs("job", 10);
      expect(logs.some((log) => log.status === "already-running")).toBe(true);
      expect(logs.some((log) => log.status === "ok")).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("runs due tasks and updates next run", async () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-schedule-due-"));
    try {
      const manager = new ScheduleManager(testConfig(dir));
      await manager.upsertTask({
        id: "due-job",
        sessionId: "s1",
        input: "due input",
        everyMinutes: 5,
        startNow: true
      });

      const result = await manager.runDue(new Date(), async () => {});
      expect(result.run.length).toBe(1);
      expect(result.run[0]?.status).toBe("ok");

      const tasks = await manager.listTasks();
      expect(tasks[0]?.lastRunAt).toBeDefined();
      expect(tasks[0]?.nextRunAt).toBeDefined();
      expect(tasks[0]?.running).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("records failed runs and clears running flag", async () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-schedule-fail-"));
    try {
      const manager = new ScheduleManager(testConfig(dir));
      await manager.upsertTask({
        id: "job",
        sessionId: "s1",
        input: "do work",
        everyMinutes: 10,
        startNow: true
      });

      const result = await manager.runTask("job", async () => {
        throw new Error("boom");
      });
      expect(result.status).toBe("failed");
      expect(result.error).toContain("boom");

      const tasks = await manager.listTasks();
      expect(tasks[0]?.running).toBe(false);

      const logPath = join(dir, ".athena", "schedule", "logs", "job.jsonl");
      const raw = readFileSync(logPath, "utf8");
      expect(raw).toContain("\"status\":\"failed\"");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("times out long schedule runs and clears running flag", async () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-schedule-timeout-"));
    try {
      const manager = new ScheduleManager({
        ...testConfig(dir),
        scheduleRunTimeoutMs: 40
      });
      await manager.upsertTask({
        id: "job",
        sessionId: "s1",
        input: "do work",
        everyMinutes: 10,
        startNow: true
      });

      const result = await manager.runTask("job", async () => {
        await new Promise((resolvePromise) => setTimeout(resolvePromise, 100));
      });

      expect(result.status).toBe("failed");
      expect(result.error).toContain("timed out");
      expect(result.errorCode).toBe("SCHEDULE_TIMEOUT");

      const tasks = await manager.listTasks();
      expect(tasks[0]?.running).toBe(false);

      const logs = await manager.readLogs("job", 5);
      expect(logs.some((row) => row.status === "failed" && row.error?.includes("timed out"))).toBe(true);
      expect(logs.some((row) => row.status === "failed" && row.errorCode === "SCHEDULE_TIMEOUT")).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("migrates legacy tasks.json array format and writes versioned state envelope", async () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-schedule-migrate-"));
    try {
      const scheduleDir = join(dir, ".athena", "schedule");
      const tasksPath = join(scheduleDir, "tasks.json");
      mkdirSync(scheduleDir, { recursive: true });
      const now = new Date().toISOString();
      writeFileSync(
        tasksPath,
        JSON.stringify(
          [
            {
              id: "legacy-job",
              sessionId: "s1",
              input: "legacy",
              everyMinutes: 15,
              enabled: true,
              running: false,
              createdAt: now,
              updatedAt: now,
              nextRunAt: now
            }
          ],
          null,
          2
        ),
        "utf8"
      );

      const manager = new ScheduleManager(testConfig(dir));
      const tasks = await manager.listTasks();
      expect(tasks[0]?.schemaVersion).toBe(1);

      await manager.upsertTask({
        id: "legacy-job",
        sessionId: "s1",
        input: "updated",
        everyMinutes: 20
      });

      const persisted = JSON.parse(readFileSync(tasksPath, "utf8")) as {
        schemaVersion: number;
        tasks: Array<{ schemaVersion?: number }>;
      };
      expect(persisted.schemaVersion).toBe(2);
      expect(Array.isArray(persisted.tasks)).toBe(true);
      expect(persisted.tasks[0]?.schemaVersion).toBe(1);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("recovers from stale running=true task state after restart", async () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-schedule-stale-running-"));
    try {
      const scheduleDir = join(dir, ".athena", "schedule");
      mkdirSync(scheduleDir, { recursive: true });
      const tasksPath = join(scheduleDir, "tasks.json");
      const now = new Date().toISOString();
      writeFileSync(
        tasksPath,
        JSON.stringify(
          {
            schemaVersion: 2,
            tasks: [
              {
                schemaVersion: 1,
                id: "job",
                sessionId: "s1",
                input: "run me",
                everyMinutes: 10,
                enabled: true,
                running: true,
                createdAt: now,
                updatedAt: now,
                nextRunAt: now
              }
            ]
          },
          null,
          2
        ),
        "utf8"
      );

      const manager = new ScheduleManager(testConfig(dir));
      const result = await manager.runTask("job", async () => {});
      expect(result.status).toBe("ok");

      const tasks = await manager.listTasks();
      expect(tasks[0]?.running).toBe(false);
      expect(tasks[0]?.lastRunAt).toBeDefined();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
