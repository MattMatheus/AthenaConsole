import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createApiServer } from "../src/api/server.js";
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
});
