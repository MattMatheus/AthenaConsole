import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createApiServer } from "../src/api/server.js";
import { openAppStateDatabase } from "../src/control-plane/app-state/index.js";
import { loadConfig } from "../src/shared/config.js";

describe("task schedule api", () => {
  it("creates, gets, lists, updates, and deletes task schedules", async () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-api-task-schedules-"));
    const config = loadConfig(dir);
    const appState = openAppStateDatabase(config);
    try {
      seedReadyTask(appState, "task-api-scheduled");
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
      rmSync(dir, { recursive: true, force: true });
      if (message.includes("EPERM")) {
        return;
      }
      throw error;
    }
    const base = `http://${bound.host}:${bound.port}`;

    try {
      const createResponse = await fetch(`${base}/api/v1/schedules`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          id: "api-task-schedule",
          name: "API task schedule",
          targetType: "task",
          targetId: "task-api-scheduled",
          inputBindings: { channel: "api" },
          runAt: "2026-06-01T09:00:00.000Z",
          timezone: "America/Los_Angeles"
        })
      });
      expect(createResponse.status).toBe(200);
      const created = (await createResponse.json()) as {
        ok: boolean;
        data: { id: string; targetType?: string; targetId?: string; nextRunAt: string };
      };
      expect(created).toMatchObject({
        ok: true,
        data: {
          id: "api-task-schedule",
          targetType: "task",
          targetId: "task-api-scheduled",
          nextRunAt: "2026-06-01T09:00:00.000Z"
        }
      });

      const getResponse = await fetch(`${base}/api/v1/schedules/api-task-schedule`);
      expect(getResponse.status).toBe(200);
      await expect(getResponse.json()).resolves.toMatchObject({
        ok: true,
        data: { id: "api-task-schedule", name: "API task schedule" }
      });

      const updateResponse = await fetch(`${base}/api/v1/schedules/api-task-schedule`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: "API task schedule paused",
          targetType: "task",
          targetId: "task-api-scheduled",
          rrule: "FREQ=DAILY;INTERVAL=1",
          timezone: "UTC",
          status: "paused"
        })
      });
      expect(updateResponse.status).toBe(200);
      await expect(updateResponse.json()).resolves.toMatchObject({
        ok: true,
        data: {
          id: "api-task-schedule",
          name: "API task schedule paused",
          status: "paused",
          rrule: "FREQ=DAILY;INTERVAL=1"
        }
      });

      const listResponse = await fetch(`${base}/api/v1/schedules`);
      expect(listResponse.status).toBe(200);
      const listed = (await listResponse.json()) as { ok: boolean; data: { items: Array<{ id: string }> } };
      expect(listed.data.items.map((schedule) => schedule.id)).toContain("api-task-schedule");

      const deleteResponse = await fetch(`${base}/api/v1/schedules/api-task-schedule`, { method: "DELETE" });
      expect(deleteResponse.status).toBe(200);
      await expect(deleteResponse.json()).resolves.toMatchObject({
        ok: true,
        data: { id: "api-task-schedule", removed: true }
      });
    } finally {
      await server.stop();
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

function seedReadyTask(appState: ReturnType<typeof openAppStateDatabase>, taskId: string): void {
  appState.plugins.upsert({
    id: "team-orchestrator.test.api-scheduler",
    version: "0.1.0",
    path: "/tmp/team-orchestrator-api-scheduler",
    enabled: true,
    status: "loaded",
    sourceType: "local",
    manifest: { plugin: { name: "API Scheduler Test" } },
    validationErrors: []
  });
  appState.agents.upsert({
    id: "api.scheduler.agent",
    version: "1.0.0",
    pluginId: "team-orchestrator.test.api-scheduler",
    pluginVersion: "0.1.0",
    name: "API Scheduler Agent",
    capabilities: ["test.run"],
    manifest: {},
    status: "loaded"
  });
  appState.tasks.create({
    id: taskId,
    title: "Scheduled task",
    status: "ready",
    assignedAgentId: "api.scheduler.agent",
    assignedAgentVersion: "1.0.0",
    capabilityRequirements: ["test.run"]
  });
}
