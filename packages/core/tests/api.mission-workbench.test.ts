import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createApiServer } from "../src/api/server.js";
import { openAppStateDatabase } from "../src/control-plane/app-state/index.js";
import { loadConfig } from "../src/shared/config.js";

describe("mission workbench api", () => {
  it("creates missions, creates mission tasks, attaches existing tasks, and lists mission tasks in order", async () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-api-mission-workbench-"));
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
      rmSync(dir, { recursive: true, force: true });
      if (message.includes("EPERM")) {
        return;
      }
      throw error;
    }
    const base = `http://${bound.host}:${bound.port}`;

    try {
      const createMissionResponse = await fetch(`${base}/api/v1/missions`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          id: "mission-api",
          title: "API mission",
          goal: "Coordinate an API workflow",
          context: { release: "2026.14" }
        })
      });
      expect(createMissionResponse.status).toBe(200);
      const createMissionEnvelope = (await createMissionResponse.json()) as {
        ok: boolean;
        data: { id: string; status: string; taskOrder: string[]; context: unknown };
      };
      expect(createMissionEnvelope).toMatchObject({
        ok: true,
        data: {
          id: "mission-api",
          status: "draft",
          taskOrder: [],
          context: { release: "2026.14" }
        }
      });

      const createFirstTaskResponse = await fetch(`${base}/api/v1/missions/mission-api/tasks`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          id: "task-api-plan",
          title: "Plan",
          capabilityRequirements: ["task.plan"],
          inputs: { brief: "Plan the work" }
        })
      });
      expect(createFirstTaskResponse.status).toBe(200);

      const createLooseTaskResponse = await fetch(`${base}/api/v1/tasks`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          id: "task-api-build",
          title: "Build",
          capabilityRequirements: ["code.modify"]
        })
      });
      expect(createLooseTaskResponse.status).toBe(200);

      const attachTaskResponse = await fetch(`${base}/api/v1/missions/mission-api/tasks/attach`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          taskId: "task-api-build",
          dependsOn: ["task-api-plan"]
        })
      });
      expect(attachTaskResponse.status).toBe(200);
      const attachTaskEnvelope = (await attachTaskResponse.json()) as {
        ok: boolean;
        data: {
          mission: { id: string; taskOrder: string[] };
          tasks: Array<{ id: string; missionId?: string; dependsOn: string[] }>;
          total: number;
        };
      };
      expect(attachTaskEnvelope).toMatchObject({
        ok: true,
        data: {
          mission: {
            id: "mission-api",
            taskOrder: ["task-api-plan", "task-api-build"]
          },
          total: 2
        }
      });
      expect(attachTaskEnvelope.data.tasks.map((task) => task.id)).toEqual(["task-api-plan", "task-api-build"]);
      expect(attachTaskEnvelope.data.tasks[1]).toMatchObject({
        id: "task-api-build",
        missionId: "mission-api",
        dependsOn: ["task-api-plan"]
      });

      const listMissionsResponse = await fetch(`${base}/api/v1/missions`);
      expect(listMissionsResponse.status).toBe(200);
      const listMissionsEnvelope = (await listMissionsResponse.json()) as {
        ok: boolean;
        data: { total: number; missions: Array<{ id: string }> };
      };
      expect(listMissionsEnvelope.data).toMatchObject({
        total: 1,
        missions: [expect.objectContaining({ id: "mission-api" })]
      });

      const listTasksResponse = await fetch(`${base}/api/v1/missions/mission-api/tasks`);
      expect(listTasksResponse.status).toBe(200);
      const listTasksEnvelope = (await listTasksResponse.json()) as {
        ok: boolean;
        data: { tasks: Array<{ id: string }> };
      };
      expect(listTasksEnvelope.data.tasks.map((task) => task.id)).toEqual(["task-api-plan", "task-api-build"]);
    } finally {
      await server.stop();
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("runs a ready mission and fetches mission run lineage", async () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-api-mission-run-"));
    const config = loadConfig(dir);
    const pluginDir = join(dir, "plugin");
    mkdirSync(pluginDir, { recursive: true });
    writeFileSync(
      join(pluginDir, "runner.js"),
      "process.stdout.write(JSON.stringify({ output: { ok: true }, artifacts: [] }));",
      "utf8"
    );
    const appState = openAppStateDatabase(config);
    try {
      seedRunnableCatalog(appState, pluginDir);
      appState.missions.create({
        id: "mission-api-run",
        title: "API mission run",
        status: "ready",
        taskOrder: ["task-api-run-1", "task-api-run-2"]
      });
      createReadyTask(appState, "mission-api-run", "task-api-run-1");
      createReadyTask(appState, "mission-api-run", "task-api-run-2");
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
      const runResponse = await fetch(`${base}/api/v1/missions/mission-api-run/run`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ runId: "mission-api-run-1" })
      });
      expect(runResponse.status).toBe(200);
      const runEnvelope = (await runResponse.json()) as {
        ok: boolean;
        data: {
          run: { id: string; status: string; output: unknown };
          mission: { id: string; status: string };
          childRuns: Array<{ targetId: string; status: string }>;
        };
      };
      expect(runEnvelope).toMatchObject({
        ok: true,
        data: {
          run: { id: "mission-api-run-1", status: "completed" },
          mission: { id: "mission-api-run", status: "completed" },
          childRuns: [
            { targetId: "task-api-run-1", status: "completed" },
            { targetId: "task-api-run-2", status: "completed" }
          ]
        }
      });

      const getRunResponse = await fetch(`${base}/api/v1/mission-runs/mission-api-run-1`);
      expect(getRunResponse.status).toBe(200);
      const getRunEnvelope = (await getRunResponse.json()) as {
        ok: boolean;
        data: { run: { id: string }; childRuns: Array<{ targetId: string }>; events: Array<{ type: string }> };
      };
      expect(getRunEnvelope).toMatchObject({
        ok: true,
        data: {
          run: { id: "mission-api-run-1" },
          childRuns: [{ targetId: "task-api-run-1" }, { targetId: "task-api-run-2" }]
        }
      });
      expect(getRunEnvelope.data.events.map((event) => event.type)).toContain("mission.run.completed");
    } finally {
      await server.stop();
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

function seedRunnableCatalog(appState: ReturnType<typeof openAppStateDatabase>, pluginDir: string): void {
  appState.plugins.upsert({
    id: "team-orchestrator.test.api-mission-runner",
    version: "0.1.0",
    path: pluginDir,
    enabled: true,
    status: "loaded",
    sourceType: "local",
    manifest: {
      plugin: {
        name: "API Mission Runner Plugin"
      }
    },
    validationErrors: []
  });
  appState.agents.upsert({
    id: "api.mission.runner.local",
    version: "1.0.0",
    pluginId: "team-orchestrator.test.api-mission-runner",
    pluginVersion: "0.1.0",
    name: "API Mission Runner",
    capabilities: ["mission.run"],
    status: "loaded",
    manifest: {
      agent: {
        inputs: {
          taskBrief: {
            type: "markdown",
            required: true
          }
        },
        implementation: {
          type: "local-command",
          command: process.execPath,
          args: ["runner.js"]
        },
        runtime: {
          preferredBackend: "local-process",
          workingDirectory: "."
        }
      }
    }
  });
}

function createReadyTask(appState: ReturnType<typeof openAppStateDatabase>, missionId: string, taskId: string): void {
  appState.tasks.create({
    id: taskId,
    title: `Run ${taskId}`,
    status: "ready",
    missionId,
    assignedAgentId: "api.mission.runner.local",
    assignedAgentVersion: "1.0.0",
    capabilityRequirements: ["mission.run"],
    inputs: {
      taskBrief: `Run ${taskId}`
    }
  });
}
