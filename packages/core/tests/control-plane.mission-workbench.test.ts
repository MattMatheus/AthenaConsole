import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { openAppStateDatabase } from "../src/control-plane/app-state/index.js";
import { LocalMissionWorkbenchService } from "../src/control-plane/services/mission-workbench.js";
import { loadConfig } from "../src/shared/config.js";

describe("mission workbench service", () => {
  it("creates, gets, updates, and lists missions", async () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-mission-workbench-basic-"));
    try {
      const config = loadConfig(dir);
      const appState = openAppStateDatabase(config);
      try {
        const service = new LocalMissionWorkbenchService(config, { appState });

        const mission = await service.create({
          id: "mission-release",
          title: "Release workflow",
          goal: "Prepare a release",
          context: { release: "v1.2.3" },
          taskOrder: ["task-build", "task-notes"]
        });

        expect(mission).toMatchObject({
          id: "mission-release",
          title: "Release workflow",
          goal: "Prepare a release",
          context: { release: "v1.2.3" },
          status: "draft",
          taskOrder: ["task-build", "task-notes"]
        });
        await expect(service.get("mission-release")).resolves.toMatchObject({ id: "mission-release" });

        const updated = await service.update("mission-release", {
          status: "ready",
          taskOrder: ["task-notes", "task-notes", "task-build"]
        });
        expect(updated).toMatchObject({
          status: "ready",
          taskOrder: ["task-notes", "task-build"]
        });

        const list = await service.list();
        expect(list).toMatchObject({
          total: 1,
          missions: [expect.objectContaining({ id: "mission-release", status: "ready" })],
          filters: {}
        });
      } finally {
        appState.close();
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("attaches existing tasks, creates mission tasks, preserves dependencies, and lists tasks in mission order", async () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-mission-workbench-tasks-"));
    try {
      const config = loadConfig(dir);
      const appState = openAppStateDatabase(config);
      try {
        const service = new LocalMissionWorkbenchService(config, { appState });
        await service.create({
          id: "mission-podcast",
          title: "Podcast workflow",
          goal: "Prepare show notes",
          context: { episode: 42 }
        });
        appState.tasks.create({
          id: "task-transcribe",
          title: "Transcribe",
          capabilityRequirements: ["audio.transcribe"]
        });
        appState.tasks.create({
          id: "task-publish",
          title: "Publish",
          capabilityRequirements: ["content.publish"]
        });
        appState.tasks.create({
          id: "task-unordered",
          title: "Unordered",
          missionId: "mission-podcast",
          capabilityRequirements: ["content.review"]
        });

        await service.attachTask("mission-podcast", {
          taskId: "task-publish",
          dependsOn: ["task-notes"]
        });
        await service.attachTask("mission-podcast", {
          taskId: "task-transcribe",
          position: 0
        });
        const withCreatedTask = await service.createTask("mission-podcast", {
          id: "task-notes",
          title: "Write notes",
          capabilityRequirements: ["content.draft"],
          dependsOn: ["task-transcribe"],
          position: 1,
          inputs: { style: "concise" }
        });

        expect(withCreatedTask.mission).toMatchObject({
          id: "mission-podcast",
          taskOrder: ["task-transcribe", "task-notes", "task-publish"]
        });
        expect(withCreatedTask.tasks.map((task) => task.id)).toEqual([
          "task-transcribe",
          "task-notes",
          "task-publish",
          "task-unordered"
        ]);
        expect(withCreatedTask.tasks.find((task) => task.id === "task-notes")).toMatchObject({
          missionId: "mission-podcast",
          dependsOn: ["task-transcribe"],
          inputs: { style: "concise" }
        });
        expect(withCreatedTask.tasks.find((task) => task.id === "task-publish")).toMatchObject({
          missionId: "mission-podcast",
          dependsOn: ["task-notes"]
        });

        const listed = await service.listTasks("mission-podcast");
        expect(listed.tasks.map((task) => task.id)).toEqual(withCreatedTask.tasks.map((task) => task.id));
      } finally {
        appState.close();
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
