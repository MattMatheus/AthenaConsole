import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
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

  it("ticks due task schedules", async () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-api-task-schedule-tick-"));
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
      seedRunnableTask(appState, pluginDir, "success.js", "task-api-due");
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
          id: "api-task-schedule-due",
          targetType: "task",
          targetId: "task-api-due",
          runAt: "2026-06-01T09:00:00.000Z",
          timezone: "UTC"
        })
      });
      expect(createResponse.status).toBe(200);

      const tickResponse = await fetch(`${base}/api/v1/schedules/tick`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ at: "2026-06-01T09:00:00.000Z" })
      });
      expect(tickResponse.status).toBe(200);
      await expect(tickResponse.json()).resolves.toMatchObject({
        ok: true,
        data: {
          skipped: 0,
          run: [
            {
              id: "api-task-schedule-due",
              status: "ok",
              targetType: "task",
              targetId: "task-api-due"
            }
          ]
        }
      });

      const getResponse = await fetch(`${base}/api/v1/schedules/api-task-schedule-due`);
      expect(getResponse.status).toBe(200);
      await expect(getResponse.json()).resolves.toMatchObject({
        ok: true,
        data: {
          id: "api-task-schedule-due",
          status: "disabled"
        }
      });

      const logsResponse = await fetch(`${base}/api/v1/schedules/api-task-schedule-due/logs`);
      expect(logsResponse.status).toBe(200);
      await expect(logsResponse.json()).resolves.toMatchObject({
        ok: true,
        data: [
          {
            scheduleId: "api-task-schedule-due",
            status: "ok",
            targetType: "task",
            targetId: "task-api-due",
            runId: expect.stringMatching(/^run-/)
          }
        ]
      });
    } finally {
      await server.stop();
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("creates and ticks workflow-template schedules", async () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-api-workflow-template-schedule-"));
    const config = loadConfig(dir);
    const appState = openAppStateDatabase(config);
    try {
      seedWorkflowTemplateScheduleTarget(appState);
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
          id: "api-workflow-template-schedule",
          targetType: "workflow-template",
          targetId: "templates.release.workflow",
          inputBindings: {
            version: "0.1.0",
            pluginId: "team-orchestrator.test.api-scheduler-templates",
            pluginVersion: "0.1.0",
            inputs: { releaseName: "v3.0.0" }
          },
          runAt: "2026-06-01T09:00:00.000Z",
          timezone: "UTC"
        })
      });
      expect(createResponse.status).toBe(200);
      await expect(createResponse.json()).resolves.toMatchObject({
        ok: true,
        data: {
          id: "api-workflow-template-schedule",
          targetType: "workflow-template",
          targetId: "templates.release.workflow",
          inputBindings: {
            version: "0.1.0",
            inputs: { releaseName: "v3.0.0" }
          }
        }
      });

      const tickResponse = await fetch(`${base}/api/v1/schedules/tick`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ at: "2026-06-01T09:00:00.000Z" })
      });
      expect(tickResponse.status).toBe(200);
      const ticked = (await tickResponse.json()) as {
        ok: boolean;
        data: { run: Array<{ missionId?: string; taskIds?: string[] }> };
      };
      expect(ticked).toMatchObject({
        ok: true,
        data: {
          run: [
            {
              id: "api-workflow-template-schedule",
              status: "ok",
              targetType: "workflow-template",
              targetId: "templates.release.workflow",
              missionId: expect.stringMatching(/^mission-/),
              taskIds: expect.any(Array)
            }
          ]
        }
      });
      expect(ticked.data.run[0]?.taskIds?.[0]).toMatch(/^mission-.*-plan$/);

      const logsResponse = await fetch(`${base}/api/v1/schedules/api-workflow-template-schedule/logs`);
      expect(logsResponse.status).toBe(200);
      await expect(logsResponse.json()).resolves.toMatchObject({
        ok: true,
        data: [
          {
            scheduleId: "api-workflow-template-schedule",
            status: "ok",
            targetType: "workflow-template",
            targetId: "templates.release.workflow",
            missionId: ticked.data.run[0]?.missionId,
            taskIds: ticked.data.run[0]?.taskIds
          }
        ]
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

function seedRunnableTask(
  appState: ReturnType<typeof openAppStateDatabase>,
  pluginDir: string,
  scriptName: string,
  taskId: string
): void {
  appState.plugins.upsert({
    id: "team-orchestrator.test.api-scheduler-runnable",
    version: "0.1.0",
    path: pluginDir,
    enabled: true,
    status: "loaded",
    sourceType: "local",
    manifest: { plugin: { name: "API Runnable Scheduler Test" } },
    validationErrors: []
  });
  appState.agents.upsert({
    id: "api.scheduler.runnable.agent",
    version: "1.0.0",
    pluginId: "team-orchestrator.test.api-scheduler-runnable",
    pluginVersion: "0.1.0",
    name: "API Runnable Scheduler Agent",
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
    title: "API scheduled runnable task",
    status: "ready",
    assignedAgentId: "api.scheduler.runnable.agent",
    assignedAgentVersion: "1.0.0",
    capabilityRequirements: ["test.run"]
  });
}

function seedWorkflowTemplateScheduleTarget(appState: ReturnType<typeof openAppStateDatabase>): void {
  appState.plugins.upsert({
    id: "team-orchestrator.test.api-scheduler-templates",
    version: "0.1.0",
    path: "/tmp/team-orchestrator-api-scheduler-template-plugin",
    enabled: true,
    sourceType: "local",
    status: "loaded",
    manifest: { plugin: { name: "API Scheduler Template Plugin" } },
    validationErrors: []
  });
  appState.agents.upsert({
    id: "api.scheduler.template.agent",
    version: "1.0.0",
    pluginId: "team-orchestrator.test.api-scheduler-templates",
    pluginVersion: "0.1.0",
    name: "API Scheduler Template Agent",
    capabilities: ["release.plan"],
    manifest: {},
    status: "loaded"
  });
  appState.workflowTemplates.upsert({
    id: "templates.release.workflow",
    version: "0.1.0",
    pluginId: "team-orchestrator.test.api-scheduler-templates",
    pluginVersion: "0.1.0",
    name: "Release Workflow",
    description: "Prepare a release.",
    taskCount: 1,
    manifest: {
      workflow: {
        id: "templates.release.workflow",
        name: "Release Workflow",
        version: "0.1.0",
        goal: "Prepare release {{releaseName}}.",
        inputs: {
          releaseName: { required: true }
        },
        tasks: [
          {
            id: "plan",
            title: "Plan {{releaseName}}",
            capabilityRequirements: ["release.plan"],
            assignedAgentId: "api.scheduler.template.agent",
            assignedAgentVersion: "1.0.0",
            inputs: {
              release: "{{releaseName}}"
            }
          }
        ]
      }
    },
    status: "loaded",
    validationErrors: []
  });
}
