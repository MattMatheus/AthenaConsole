import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { openAppStateDatabase } from "../src/control-plane/app-state/index.js";
import { loadConfig } from "../src/shared/config.js";

describe("task, mission, and run repositories", () => {
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
