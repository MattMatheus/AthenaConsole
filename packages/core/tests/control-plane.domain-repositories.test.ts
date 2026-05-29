import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { openAppStateDatabase } from "../src/control-plane/app-state/index.js";
import { loadConfig } from "../src/shared/config.js";

describe("task, mission, and run repositories", () => {
  it("stores model provider configs as secret references", () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-domain-model-provider-"));
    try {
      const appState = openAppStateDatabase(loadConfig(dir));
      try {
        const provider = appState.modelProviderConfigs.create({
          id: "provider-openai",
          name: "OpenAI",
          providerKind: "openai-compatible",
          baseUrl: "https://api.openai.com/v1",
          defaultModel: "gpt-4.1-mini",
          secretRef: {
            kind: "env",
            name: "OPENAI_API_KEY"
          },
          status: "missing",
          statusMessage: "Environment secret is not configured.",
          now: new Date("2026-05-29T00:00:00.000Z")
        });

        expect(provider).toMatchObject({
          id: "provider-openai",
          name: "OpenAI",
          providerKind: "openai-compatible",
          baseUrl: "https://api.openai.com/v1",
          defaultModel: "gpt-4.1-mini",
          secretRef: {
            kind: "env",
            name: "OPENAI_API_KEY"
          },
          status: "missing"
        });

        const updated = appState.modelProviderConfigs.update("provider-openai", {
          secretRef: {
            kind: "local-file",
            name: "/run/secrets/openai"
          },
          status: "configured",
          statusMessage: "local-file secret reference is configured.",
          now: new Date("2026-05-29T00:01:00.000Z")
        });
        expect(updated).toMatchObject({
          status: "configured",
          secretRef: {
            kind: "local-file",
            name: "/run/secrets/openai"
          },
          updatedAt: "2026-05-29T00:01:00.000Z"
        });
        expect(appState.modelProviderConfigs.list().map((entry) => entry.id)).toEqual(["provider-openai"]);
        expect(appState.modelProviderConfigs.delete("provider-openai")).toBe(true);
      } finally {
        appState.close();
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("stores connected repository records with workspace and host paths", () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-domain-connected-repo-"));
    try {
      const appState = openAppStateDatabase(loadConfig(dir));
      try {
        const repository = appState.connectedRepositories.create({
          id: "repo-docs",
          name: "Docs Repo",
          sourceType: "existing-path",
          workspacePath: "/workspace/repos/docs",
          hostPath: "/srv/team-orchestrator/repos/docs",
          status: "missing",
          dirtyState: "unknown",
          statusMessage: "Path does not exist.",
          now: new Date("2026-05-29T00:00:00.000Z")
        });

        expect(repository).toMatchObject({
          id: "repo-docs",
          name: "Docs Repo",
          sourceType: "existing-path",
          workspacePath: "/workspace/repos/docs",
          hostPath: "/srv/team-orchestrator/repos/docs",
          status: "missing",
          dirtyState: "unknown",
          statusMessage: "Path does not exist."
        });

        const inspected = appState.connectedRepositories.update("repo-docs", {
          status: "ready",
          dirtyState: "clean",
          currentBranch: "main",
          headCommit: "abc123",
          remoteUrl: "https://example.test/repo.git",
          lastInspectedAt: "2026-05-29T00:01:00.000Z"
        });
        expect(inspected).toMatchObject({
          status: "ready",
          dirtyState: "clean",
          currentBranch: "main",
          headCommit: "abc123",
          remoteUrl: "https://example.test/repo.git",
          lastInspectedAt: "2026-05-29T00:01:00.000Z"
        });
        expect(appState.connectedRepositories.list().map((entry) => entry.id)).toEqual(["repo-docs"]);
        expect(appState.connectedRepositories.delete("repo-docs")).toBe(true);
        expect(appState.connectedRepositories.get("repo-docs")).toBeUndefined();
      } finally {
        appState.close();
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("enforces that ready tasks require an assigned agent", () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-domain-ready-"));
    try {
      const appState = openAppStateDatabase(loadConfig(dir));
      try {
        seedAgent(appState, {
          id: "software.task.local",
          version: "0.1.0"
        });

        expect(() =>
          appState.tasks.create({
            id: "task-unassigned-ready",
            title: "Unassigned ready task",
            status: "ready"
          })
        ).toThrow("ready tasks require assignedAgentId");

        const draft = appState.tasks.create({
          id: "task-draft",
          title: "Draft task",
          capabilityRequirements: ["code.modify"],
          inputs: { brief: "Do the thing" }
        });
        expect(draft.status).toBe("draft");
        expect(draft.capabilityRequirements).toEqual(["code.modify"]);
        expect(draft.inputs).toEqual({ brief: "Do the thing" });

        expect(() => appState.tasks.update("task-draft", { status: "ready" })).toThrow(
          "ready tasks require assignedAgentId"
        );

        const ready = appState.tasks.update("task-draft", {
          status: "ready",
          assignedAgentId: "software.task.local",
          assignedAgentVersion: "0.1.0"
        });
        expect(ready).toMatchObject({
          status: "ready",
          assignedAgentId: "software.task.local",
          assignedAgentVersion: "0.1.0"
        });
      } finally {
        appState.close();
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("stores missions with task order and task dependsOn arrays", () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-domain-mission-"));
    try {
      const appState = openAppStateDatabase(loadConfig(dir));
      try {
        const mission = appState.missions.create({
          id: "mission-podcast",
          title: "Podcast workflow",
          goal: "Prepare show notes",
          context: { source: "episode-42" },
          taskOrder: ["task-transcribe", "task-notes"]
        });
        appState.tasks.create({
          id: "task-transcribe",
          title: "Transcribe",
          status: "ready",
          missionId: mission.id,
          assignedAgentId: "podcast.transcriber",
          capabilityRequirements: ["audio.transcribe"]
        });
        appState.tasks.create({
          id: "task-notes",
          title: "Write notes",
          status: "draft",
          missionId: mission.id,
          capabilityRequirements: ["content.draft"],
          dependsOn: ["task-transcribe"]
        });

        expect(appState.missions.get("mission-podcast")).toMatchObject({
          id: "mission-podcast",
          taskOrder: ["task-transcribe", "task-notes"],
          context: { source: "episode-42" }
        });
        expect(appState.tasks.get("task-notes")?.dependsOn).toEqual(["task-transcribe"]);
        expect(appState.tasks.list({ missionId: "mission-podcast" }).map((task) => task.id).sort()).toEqual([
          "task-notes",
          "task-transcribe"
        ]);
      } finally {
        appState.close();
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("retains completed tasks and archives only explicitly", () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-domain-retention-"));
    try {
      const appState = openAppStateDatabase(loadConfig(dir));
      try {
        appState.tasks.create({
          id: "task-completed",
          title: "Completed task",
          status: "completed"
        });

        expect(appState.tasks.list().map((task) => task.id)).toContain("task-completed");
        appState.tasks.archive("task-completed");
        expect(appState.tasks.list().map((task) => task.id)).not.toContain("task-completed");
        expect(appState.tasks.list({ includeArchived: true }).find((task) => task.id === "task-completed")).toMatchObject({
          status: "archived"
        });
      } finally {
        appState.close();
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("bounds and filters task lists in repository order", () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-domain-task-list-bounds-"));
    try {
      const appState = openAppStateDatabase(loadConfig(dir));
      try {
        appState.missions.create({
          id: "mission-even",
          title: "Even mission"
        });
        appState.missions.create({
          id: "mission-other",
          title: "Other mission"
        });
        for (let index = 0; index < 550; index += 1) {
          appState.tasks.create({
            id: `task-bulk-${index.toString().padStart(3, "0")}`,
            title: `Bulk task ${index}`,
            status: index % 10 === 0 ? "archived" : index % 2 === 0 ? "completed" : "draft",
            missionId: index % 3 === 0 ? "mission-even" : "mission-other",
            now: new Date(`2026-01-01T00:${Math.floor(index / 60)
              .toString()
              .padStart(2, "0")}:${(index % 60).toString().padStart(2, "0")}.000Z`)
          });
        }

        const visible = appState.tasks.list();
        expect(visible).toHaveLength(495);
        expect(visible.map((task) => task.id)).not.toContain("task-bulk-000");
        expect(visible[0]?.id).toBe("task-bulk-549");

        const completedMissionTasks = appState.tasks.list({ status: "completed", missionId: "mission-even" });
        expect(completedMissionTasks).toHaveLength(73);
        expect(completedMissionTasks.every((task) => task.status === "completed" && task.missionId === "mission-even")).toBe(true);

        expect(appState.tasks.list({ status: "archived" })).toEqual([]);
        expect(appState.tasks.list({ status: "archived", includeArchived: true })).toHaveLength(55);
      } finally {
        appState.close();
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("applies the default task list cap in SQL-backed list calls", () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-domain-task-list-cap-"));
    try {
      const appState = openAppStateDatabase(loadConfig(dir));
      try {
        for (let index = 0; index < 520; index += 1) {
          appState.tasks.create({
            id: `task-cap-${index.toString().padStart(3, "0")}`,
            title: `Capped task ${index}`,
            now: new Date(`2026-01-01T00:${Math.floor(index / 60)
              .toString()
              .padStart(2, "0")}:${(index % 60).toString().padStart(2, "0")}.000Z`)
          });
        }

        expect(appState.tasks.list()).toHaveLength(500);
        expect(appState.tasks.list({ limit: 25 })).toHaveLength(25);
      } finally {
        appState.close();
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("creates proposed follow-up tasks with source run and provenance", () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-domain-followup-"));
    try {
      const appState = openAppStateDatabase(loadConfig(dir));
      try {
        appState.tasks.create({
          id: "task-source",
          title: "Source task",
          status: "ready",
          assignedAgentId: "research.agent"
        });
        appState.runs.create({
          id: "run-source",
          targetType: "task",
          targetId: "task-source",
          status: "completed",
          agentId: "research.agent"
        });

        const followUp = appState.tasks.create({
          id: "task-follow-up",
          title: "Investigate source claim",
          status: "proposed",
          sourceRunId: "run-source",
          provenance: {
            sourceAgentId: "research.agent",
            reason: "Found an unresolved claim"
          },
          inputs: {
            claim: "Check this"
          },
          capabilityRequirements: ["research.verify"]
        });

        expect(followUp).toMatchObject({
          status: "proposed",
          sourceRunId: "run-source",
          provenance: {
            sourceAgentId: "research.agent",
            reason: "Found an unresolved claim"
          },
          inputs: {
            claim: "Check this"
          },
          capabilityRequirements: ["research.verify"]
        });
      } finally {
        appState.close();
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("creates runs and appends ordered events and artifact metadata", () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-domain-run-"));
    try {
      const appState = openAppStateDatabase(loadConfig(dir));
      try {
        appState.tasks.create({
          id: "task-run",
          title: "Run task",
          status: "ready",
          assignedAgentId: "software.task.local"
        });
        const run = appState.runs.create({
          id: "run-1",
          targetType: "task",
          targetId: "task-run",
          status: "running",
          backend: "local-process",
          agentId: "software.task.local"
        });

        expect(run).toMatchObject({
          id: "run-1",
          targetType: "task",
          targetId: "task-run",
          status: "running",
          backend: "local-process"
        });

        appState.runEvents.append({
          id: "event-2",
          runId: "run-1",
          taskId: "task-run",
          agentId: "software.task.local",
          type: "run.log",
          level: "info",
          timestamp: "2026-01-01T00:00:02.000Z",
          message: "Working",
          payload: { step: 1 }
        });
        appState.runEvents.append({
          id: "event-1",
          runId: "run-1",
          taskId: "task-run",
          type: "run.started",
          timestamp: "2026-01-01T00:00:01.000Z"
        });
        appState.artifacts.create({
          id: "artifact-summary",
          runId: "run-1",
          taskId: "task-run",
          agentId: "software.task.local",
          label: "Summary",
          kind: "primary",
          format: "markdown",
          storageUri: "artifacts/run-1/summary.md",
          sizeBytes: 42,
          metadata: { audience: "operator" }
        });

        expect(appState.runEvents.listForRun("run-1").map((event) => event.id)).toEqual(["event-1", "event-2"]);
        expect(appState.runEvents.listForRun("run-1")[1]).toMatchObject({
          message: "Working",
          payload: { step: 1 }
        });
        expect(appState.artifacts.listForRun("run-1")).toEqual([
          expect.objectContaining({
            id: "artifact-summary",
            label: "Summary",
            storageUri: "artifacts/run-1/summary.md",
            metadata: { audience: "operator" }
          })
        ]);

        const completed = appState.runs.update("run-1", {
          status: "completed",
          endedAt: "2026-01-01T00:00:03.000Z",
          output: { summary: "Done" }
        });
        expect(completed).toMatchObject({
          status: "completed",
          output: { summary: "Done" }
        });
      } finally {
        appState.close();
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("bounds and filters run lists in repository order", () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-domain-run-list-bounds-"));
    try {
      const appState = openAppStateDatabase(loadConfig(dir));
      try {
        for (let index = 0; index < 530; index += 1) {
          appState.runs.create({
            id: `run-bulk-${index.toString().padStart(3, "0")}`,
            targetType: index % 2 === 0 ? "task" : "mission",
            targetId: index % 4 === 0 ? "target-a" : "target-b",
            status: index % 5 === 0 ? "failed" : "completed",
            now: new Date(`2026-01-01T00:${Math.floor(index / 60)
              .toString()
              .padStart(2, "0")}:${(index % 60).toString().padStart(2, "0")}.000Z`)
          });
        }

        expect(appState.runs.list()).toHaveLength(500);
        expect(appState.runs.list()[0]?.id).toBe("run-bulk-529");

        const targetTaskRuns = appState.runs.list({ targetType: "task", targetId: "target-a" });
        expect(targetTaskRuns).toHaveLength(133);
        expect(targetTaskRuns.every((run) => run.targetType === "task" && run.targetId === "target-a")).toBe(true);
        expect(appState.runs.list({ status: "failed" })).toHaveLength(106);
        expect(appState.runs.list({ targetType: "mission", limit: 20 })).toHaveLength(20);
      } finally {
        appState.close();
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("queries and bounds schedule lists by status and due time", () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-domain-schedule-list-bounds-"));
    try {
      const appState = openAppStateDatabase(loadConfig(dir));
      try {
        for (let index = 0; index < 515; index += 1) {
          const due = index % 5 === 0;
          appState.schedules.create({
            id: `schedule-bulk-${index.toString().padStart(3, "0")}`,
            name: `Schedule ${index}`,
            targetType: "task",
            targetId: `task-${index}`,
            timezone: "UTC",
            status: index % 7 === 0 ? "paused" : "active",
            nextRunAt: due ? "2026-01-01T00:00:00.000Z" : "2026-01-02T00:00:00.000Z",
            now: new Date(`2026-01-01T00:${Math.floor(index / 60)
              .toString()
              .padStart(2, "0")}:${(index % 60).toString().padStart(2, "0")}.000Z`)
          });
        }

        expect(appState.schedules.list()).toHaveLength(500);
        expect(appState.schedules.count()).toBe(515);

        const dueActive = appState.schedules.list({ status: "active", dueAt: new Date("2026-01-01T12:00:00.000Z") });
        expect(dueActive).toHaveLength(88);
        expect(dueActive.every((schedule) => schedule.status === "active" && schedule.nextRunAt === "2026-01-01T00:00:00.000Z")).toBe(true);
        expect(appState.schedules.list({ status: "paused", limit: 10 })).toHaveLength(10);
      } finally {
        appState.close();
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

function seedAgent(appState: ReturnType<typeof openAppStateDatabase>, options: { id: string; version: string }): void {
  appState.plugins.upsert({
    id: "team-orchestrator.test",
    version: "0.1.0",
    path: "/tmp/team-orchestrator-test-plugin",
    sourceType: "local",
    status: "loaded",
    manifest: {},
    validationErrors: []
  });
  appState.agents.upsert({
    id: options.id,
    version: options.version,
    pluginId: "team-orchestrator.test",
    pluginVersion: "0.1.0",
    name: options.id,
    capabilities: ["test.run"],
    manifest: {},
    status: "loaded"
  });
}
