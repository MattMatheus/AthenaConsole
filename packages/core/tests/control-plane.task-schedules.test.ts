import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { openAppStateDatabase } from "../src/control-plane/app-state/index.js";
import { LocalScheduleService } from "../src/control-plane/services/local-services.js";
import type { ExecutionBackend } from "../src/control-plane/backends.js";
import type { PolicyService } from "../src/control-plane/interfaces.js";
import { loadConfig } from "../src/shared/config.js";

describe("task schedule service", () => {
  it("creates, gets, lists, updates, and deletes task-target schedules in app state", async () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-task-schedule-"));
    try {
      const config = loadConfig(dir);
      const appState = openAppStateDatabase(config);
      try {
        seedReadyTask(appState, "task-scheduled");
        const service = new LocalScheduleService(config, noopBackend, noopPolicyService, { appState });

        const created = await service.upsert({
          id: "schedule-task",
          name: "Run task later",
          targetType: "task",
          targetId: "task-scheduled",
          inputBindings: { priority: "normal" },
          runAt: "2026-06-01T09:00:00.000Z",
          timezone: "America/Los_Angeles"
        });

        expect(created).toMatchObject({
          id: "schedule-task",
          name: "Run task later",
          targetType: "task",
          targetId: "task-scheduled",
          inputBindings: { priority: "normal" },
          timezone: "America/Los_Angeles",
          status: "active",
          nextRunAt: "2026-06-01T09:00:00.000Z"
        });
        await expect(service.get("schedule-task")).resolves.toMatchObject({ id: "schedule-task" });
        await expect(service.list()).resolves.toEqual([expect.objectContaining({ id: "schedule-task" })]);

        const updated = await service.upsert({
          id: "schedule-task",
          name: "Run task daily",
          targetType: "task",
          targetId: "task-scheduled",
          rrule: "FREQ=DAILY;INTERVAL=1",
          timezone: "UTC",
          status: "paused",
          failurePolicy: { overlap: "skip-if-running" }
        });

        expect(updated).toMatchObject({
          id: "schedule-task",
          name: "Run task daily",
          rrule: "FREQ=DAILY;INTERVAL=1",
          timezone: "UTC",
          status: "paused",
          failurePolicy: { overlap: "skip-if-running" }
        });
        await expect(service.remove("schedule-task")).resolves.toBe(true);
        await expect(service.get("schedule-task")).resolves.toBeUndefined();
      } finally {
        appState.close();
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("validates scheduled task targets", async () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-task-schedule-invalid-"));
    try {
      const config = loadConfig(dir);
      const appState = openAppStateDatabase(config);
      try {
        appState.tasks.create({
          id: "task-draft",
          title: "Draft task"
        });
        const service = new LocalScheduleService(config, noopBackend, noopPolicyService, { appState });

        await expect(
          service.upsert({
            id: "schedule-missing",
            targetType: "task",
            targetId: "task-missing",
            runAt: "2026-06-01T09:00:00.000Z"
          })
        ).rejects.toMatchObject({ code: "PROVIDER_NOT_FOUND" });
        await expect(
          service.upsert({
            id: "schedule-draft",
            targetType: "task",
            targetId: "task-draft",
            runAt: "2026-06-01T09:00:00.000Z"
          })
        ).rejects.toThrow("must be ready");
      } finally {
        appState.close();
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

function seedReadyTask(appState: ReturnType<typeof openAppStateDatabase>, taskId: string): void {
  appState.plugins.upsert({
    id: "team-orchestrator.test.scheduler",
    version: "0.1.0",
    path: "/tmp/team-orchestrator-test-scheduler",
    enabled: true,
    status: "loaded",
    sourceType: "local",
    manifest: { plugin: { name: "Scheduler Test" } },
    validationErrors: []
  });
  appState.agents.upsert({
    id: "scheduler.agent",
    version: "1.0.0",
    pluginId: "team-orchestrator.test.scheduler",
    pluginVersion: "0.1.0",
    name: "Scheduler Agent",
    capabilities: ["test.run"],
    manifest: {},
    status: "loaded"
  });
  appState.tasks.create({
    id: taskId,
    title: "Scheduled task",
    status: "ready",
    assignedAgentId: "scheduler.agent",
    assignedAgentVersion: "1.0.0",
    capabilityRequirements: ["test.run"]
  });
}

const noopBackend: ExecutionBackend = {
  kind: "local",
  async run() {
    return {
      sessionId: "noop",
      output: "",
      runId: "noop",
      provider: "noop",
      model: "noop",
      createdAt: new Date().toISOString()
    };
  },
  async cancel() {
    return { sessionId: "noop", status: "not-running" };
  }
};

const noopPolicyService = {
  async get() {
    return undefined;
  }
} as PolicyService;
