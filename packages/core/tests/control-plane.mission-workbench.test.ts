import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
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

  it("runs ready mission tasks sequentially and records child run lineage", async () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-mission-workbench-run-"));
    try {
      const config = loadConfig(dir);
      const pluginDir = join(dir, "plugin");
      mkdirSync(pluginDir, { recursive: true });
      writeFileSync(join(pluginDir, "runner.js"), successOrFailScript(), "utf8");
      const appState = openAppStateDatabase(config);
      try {
        seedRunnableCatalog(appState, pluginDir);
        seedReadyMission(appState, "mission-sequence", ["task-plan", "task-build"]);
        const service = new LocalMissionWorkbenchService(config, { appState });

        const detail = await service.runMission("mission-sequence", { runId: "mission-run-sequence" });

        expect(detail.run).toMatchObject({
          id: "mission-run-sequence",
          targetType: "mission",
          targetId: "mission-sequence",
          status: "completed",
          backend: "sequential-mission"
        });
        expect(detail.mission).toMatchObject({ id: "mission-sequence", status: "completed" });
        expect(detail.childRuns.map((run) => run.status)).toEqual(["completed", "completed"]);
        expect(detail.childRuns.map((run) => run.targetId)).toEqual(["task-plan", "task-build"]);
        expect(detail.run.output).toMatchObject({
          childRuns: detail.childRuns.map((run) => ({
            taskId: run.targetId,
            runId: run.id,
            status: run.status
          }))
        });
        expect(appState.tasks.get("task-plan")).toMatchObject({ status: "completed" });
        expect(appState.tasks.get("task-build")).toMatchObject({ status: "completed" });
        expect(detail.events.map((event) => event.type)).toEqual(
          expect.arrayContaining(["mission.run.started", "mission.task.completed", "mission.run.completed"])
        );

        await expect(service.getMissionRun("mission-run-sequence")).resolves.toMatchObject({
          run: { id: "mission-run-sequence", status: "completed" },
          childRuns: [{ targetId: "task-plan" }, { targetId: "task-build" }]
        });
      } finally {
        appState.close();
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("stops sequential mission runs on the first failed task", async () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-mission-workbench-run-fail-"));
    try {
      const config = loadConfig(dir);
      const pluginDir = join(dir, "plugin");
      mkdirSync(pluginDir, { recursive: true });
      writeFileSync(join(pluginDir, "runner.js"), successOrFailScript(), "utf8");
      const appState = openAppStateDatabase(config);
      try {
        seedRunnableCatalog(appState, pluginDir);
        seedReadyMission(appState, "mission-stop", ["task-first", "task-second", "task-third"], {
          failingTaskId: "task-second"
        });
        const service = new LocalMissionWorkbenchService(config, { appState });

        const detail = await service.runMission("mission-stop", { runId: "mission-run-stop" });

        expect(detail.run.status).toBe("failed");
        expect(detail.mission).toMatchObject({ id: "mission-stop", status: "failed" });
        expect(detail.childRuns.map((run) => run.targetId)).toEqual(["task-first", "task-second"]);
        expect(detail.childRuns.map((run) => run.status)).toEqual(["completed", "failed"]);
        expect(appState.tasks.get("task-first")).toMatchObject({ status: "completed" });
        expect(appState.tasks.get("task-second")).toMatchObject({ status: "failed" });
        expect(appState.tasks.get("task-third")).toMatchObject({ status: "ready" });
        expect(detail.events.map((event) => event.type)).toContain("mission.run.stopped");
      } finally {
        appState.close();
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("fails mission runs before execution when task dependencies are not satisfied by earlier ordered tasks", async () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-mission-workbench-run-deps-"));
    try {
      const config = loadConfig(dir);
      const pluginDir = join(dir, "plugin");
      mkdirSync(pluginDir, { recursive: true });
      writeFileSync(join(pluginDir, "runner.js"), successOrFailScript(), "utf8");
      const appState = openAppStateDatabase(config);
      try {
        seedRunnableCatalog(appState, pluginDir);
        appState.missions.create({
          id: "mission-deps",
          title: "Mission deps",
          status: "ready",
          taskOrder: ["task-build", "task-plan"]
        });
        createReadyTask(appState, "mission-deps", "task-build", { dependsOn: ["task-plan"] });
        createReadyTask(appState, "mission-deps", "task-plan");
        const service = new LocalMissionWorkbenchService(config, { appState });

        const detail = await service.runMission("mission-deps", { runId: "mission-run-deps" });

        expect(detail.run).toMatchObject({
          status: "failed",
          failure: {
            reason: "unsatisfied-dependencies",
            taskId: "task-build",
            missingDependencies: ["task-plan"]
          }
        });
        expect(detail.childRuns).toEqual([]);
        expect(appState.tasks.get("task-build")).toMatchObject({ status: "ready" });
        expect(detail.events.map((event) => event.type)).toContain("mission.task.dependencies.unsatisfied");
      } finally {
        appState.close();
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

function seedRunnableCatalog(appState: ReturnType<typeof openAppStateDatabase>, pluginDir: string): void {
  appState.plugins.upsert({
    id: "team-orchestrator.test.mission-runner",
    version: "0.1.0",
    path: pluginDir,
    enabled: true,
    status: "loaded",
    sourceType: "local",
    manifest: {
      plugin: {
        name: "Mission Runner Plugin"
      }
    },
    validationErrors: []
  });
  appState.agents.upsert({
    id: "mission.runner.local",
    version: "1.0.0",
    pluginId: "team-orchestrator.test.mission-runner",
    pluginVersion: "0.1.0",
    name: "Mission Runner",
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

function seedReadyMission(
  appState: ReturnType<typeof openAppStateDatabase>,
  missionId: string,
  taskIds: string[],
  options: { failingTaskId?: string } = {}
): void {
  appState.missions.create({
    id: missionId,
    title: "Sequential mission",
    status: "ready",
    taskOrder: taskIds
  });
  for (const taskId of taskIds) {
    createReadyTask(appState, missionId, taskId, {
      shouldFail: taskId === options.failingTaskId
    });
  }
}

function createReadyTask(
  appState: ReturnType<typeof openAppStateDatabase>,
  missionId: string,
  taskId: string,
  options: { shouldFail?: boolean; dependsOn?: string[] } = {}
): void {
  appState.tasks.create({
    id: taskId,
    title: `Run ${taskId}`,
    status: "ready",
    missionId,
    assignedAgentId: "mission.runner.local",
    assignedAgentVersion: "1.0.0",
    capabilityRequirements: ["mission.run"],
    inputs: {
      taskBrief: `Run ${taskId}`,
      ...(options.shouldFail ? { shouldFail: true } : {})
    },
    ...(options.dependsOn ? { dependsOn: options.dependsOn } : {})
  });
}

function successOrFailScript(): string {
  return `
let raw = "";
process.stdin.on("data", (chunk) => { raw += chunk; });
process.stdin.on("end", () => {
  const envelope = JSON.parse(raw);
  if (envelope.task.inputs.shouldFail) {
    process.stderr.write("mission task failed");
    process.exit(7);
  }
  process.stdout.write(JSON.stringify({
    output: { taskId: envelope.task.id, ok: true },
    artifacts: []
  }));
});
`;
}
