import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createAppStateProviderFromDatabase, openAppStateDatabase, type AppStateDatabase } from "../src/control-plane/app-state/index.js";
import { LocalWorkerHeartbeatService } from "../src/control-plane/services/worker-heartbeats.js";
import { loadConfig } from "../src/shared/config.js";

// Backend-agnostic contract for app-state repositories. Any future backend
// such as Postgres must satisfy these behaviors through the same public methods.

function withAppState(assertions: (appState: AppStateDatabase) => void): void {
  const dir = mkdtempSync(join(tmpdir(), "athena-app-state-contract-"));
  try {
    const appState = openAppStateDatabase(loadConfig(dir));
    try {
      assertions(appState);
    } finally {
      appState.close();
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

describe("app-state repository contracts", () => {
  it("services can use an injected app-state provider", () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-app-state-provider-contract-"));
    try {
      const config = loadConfig(dir);
      const appState = openAppStateDatabase(config);
      try {
        const provider = createAppStateProviderFromDatabase(appState);
        const service = new LocalWorkerHeartbeatService(config, {
          appStateProvider: provider,
          defaultTtlMs: 30_000
        });

        service.heartbeat({
          workerId: "worker-provider-contract",
          lastHeartbeatAt: new Date("2026-06-14T00:00:00.000Z")
        });

        expect(service.listActive(new Date("2026-06-14T00:00:10.000Z")).map((worker) => worker.workerId)).toEqual([
          "worker-provider-contract"
        ]);
      } finally {
        appState.close();
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("tasks can be created, retrieved, listed with bounds, and updated", () => {
    withAppState((appState) => {
      const created = appState.tasks.create({
        id: "contract-task-1",
        title: "Contract task",
        status: "draft",
        inputs: { repository: "AthenaConsole" },
        workspaceId: "workspace-contract"
      });

      expect(created).toEqual(expect.objectContaining({ id: "contract-task-1", workspaceId: "workspace-contract" }));
      expect(appState.tasks.get("contract-task-1")).toEqual(
        expect.objectContaining({ id: "contract-task-1", inputs: { repository: "AthenaConsole" } })
      );
      expect(appState.tasks.list({ limit: 1 }).map((task) => task.id)).toContain("contract-task-1");
      expect(appState.tasks.list({ workspaceId: "workspace-contract" }).map((task) => task.id)).toEqual(["contract-task-1"]);

      const updated = appState.tasks.update("contract-task-1", {
        status: "ready",
        assignedAgentId: "agent.contract"
      });

      expect(updated).toEqual(expect.objectContaining({ id: "contract-task-1", status: "ready", assignedAgentId: "agent.contract" }));
    });
  });

  it("runs can be created, retrieved, listed, and transitioned by update", () => {
    withAppState((appState) => {
      appState.tasks.create({
        id: "contract-run-task",
        title: "Run target",
        status: "ready",
        assignedAgentId: "agent.contract",
        workspaceId: "workspace-contract"
      });

      const created = appState.runs.create({
        id: "contract-run-1",
        targetType: "task",
        targetId: "contract-run-task",
        status: "queued",
        backend: "local-process",
        workspaceId: "workspace-contract"
      });

      expect(created).toEqual(expect.objectContaining({ id: "contract-run-1", status: "queued" }));
      expect(appState.runs.get("contract-run-1")).toEqual(expect.objectContaining({ targetId: "contract-run-task" }));
      expect(appState.runs.list({ targetId: "contract-run-task" }).map((run) => run.id)).toEqual(["contract-run-1"]);

      const completed = appState.runs.update("contract-run-1", {
        status: "completed",
        endedAt: "2026-06-14T00:00:00.000Z",
        output: { ok: true }
      });

      expect(completed).toEqual(expect.objectContaining({ status: "completed", output: { ok: true } }));
    });
  });

  it("missions can be created, retrieved, listed, and updated", () => {
    withAppState((appState) => {
      const created = appState.missions.create({
        id: "contract-mission-1",
        title: "Contract mission",
        goal: "Prove repository contract",
        context: { plan: "023" },
        taskOrder: ["contract-task-1"]
      });

      expect(created).toEqual(expect.objectContaining({ id: "contract-mission-1", goal: "Prove repository contract" }));
      expect(appState.missions.get("contract-mission-1")).toEqual(
        expect.objectContaining({ context: { plan: "023" }, taskOrder: ["contract-task-1"] })
      );
      expect(appState.missions.list().map((mission) => mission.id)).toContain("contract-mission-1");

      const updated = appState.missions.update("contract-mission-1", { status: "completed" });
      expect(updated.status).toBe("completed");
    });
  });

  it("schedules can be created, upserted, retrieved, and listed by due window", () => {
    withAppState((appState) => {
      const created = appState.schedules.create({
        id: "contract-schedule-1",
        name: "Contract schedule",
        targetType: "task",
        targetId: "contract-task-1",
        timezone: "UTC",
        nextRunAt: "2026-06-14T01:00:00.000Z"
      });

      expect(created).toEqual(expect.objectContaining({ id: "contract-schedule-1", status: "active" }));
      expect(appState.schedules.get("contract-schedule-1")).toEqual(expect.objectContaining({ targetId: "contract-task-1" }));
      expect(appState.schedules.list({ dueAt: new Date("2026-06-14T02:00:00.000Z") }).map((schedule) => schedule.id)).toEqual([
        "contract-schedule-1"
      ]);

      const upserted = appState.schedules.upsert({
        id: "contract-schedule-1",
        name: "Updated contract schedule",
        targetType: "task",
        targetId: "contract-task-1",
        timezone: "UTC",
        status: "paused"
      });

      expect(upserted).toEqual(expect.objectContaining({ name: "Updated contract schedule", status: "paused" }));
    });
  });

  it("usage ledger upserts by run id and filters by reporting window", () => {
    withAppState((appState) => {
      appState.tasks.create({
        id: "contract-usage-task",
        title: "Usage target",
        status: "completed"
      });
      appState.runs.create({
        id: "contract-usage-run",
        targetType: "task",
        targetId: "contract-usage-task",
        status: "completed"
      });

      appState.usageLedger.upsert({
        runId: "contract-usage-run",
        taskId: "contract-usage-task",
        agentId: "agent.contract",
        provider: "openai-compatible",
        model: "gpt-fixture",
        userId: "operator@example.test",
        workspaceId: "workspace-contract",
        inputTokens: 100,
        outputTokens: 50,
        costUsd: 0.012,
        source: "run-output",
        recordedAt: "2026-06-14T03:00:00.000Z"
      });
      const updated = appState.usageLedger.upsert({
        runId: "contract-usage-run",
        inputTokens: 120,
        outputTokens: 60,
        source: "run-event",
        recordedAt: "2026-06-14T04:00:00.000Z"
      });

      expect(updated).toEqual(expect.objectContaining({ id: "usage-contract-usage-run", totalTokens: 180, source: "run-event" }));
      expect(appState.usageLedger.getByRunId("contract-usage-run")).toEqual(expect.objectContaining({ inputTokens: 120 }));
      expect(
        appState.usageLedger.list({
          windowStart: "2026-06-14T00:00:00.000Z",
          windowEnd: "2026-06-15T00:00:00.000Z"
        })
      ).toEqual([expect.objectContaining({ runId: "contract-usage-run" })]);
      expect(
        appState.usageLedger.list({
          windowStart: "2026-06-15T00:00:00.000Z",
          windowEnd: "2026-06-16T00:00:00.000Z"
        })
      ).toEqual([]);
    });
  });

  it("workspaces expose lifecycle operations through public methods", () => {
    withAppState((appState) => {
      expect(appState.workspaces.get("default")).toEqual(
        expect.objectContaining({
          id: "default",
          name: "Default Workspace",
          slug: "default"
        })
      );
      expect(appState.workspaces.list().map((workspace) => workspace.id)).toContain("default");

      const created = appState.workspaces.create({
        id: "contract-workspace",
        name: "Contract Workspace",
        slug: "contract-workspace",
        now: new Date("2026-06-14T03:00:00.000Z")
      });
      expect(created).toEqual({
        id: "contract-workspace",
        name: "Contract Workspace",
        slug: "contract-workspace",
        createdAt: "2026-06-14T03:00:00.000Z",
        updatedAt: "2026-06-14T03:00:00.000Z"
      });
      expect(appState.workspaces.getBySlug("contract-workspace")).toEqual(created);

      const updated = appState.workspaces.update("contract-workspace", {
        name: "Renamed Contract Workspace",
        slug: "renamed-contract-workspace",
        now: new Date("2026-06-14T03:01:00.000Z")
      });
      expect(updated).toEqual(
        expect.objectContaining({
          id: "contract-workspace",
          name: "Renamed Contract Workspace",
          slug: "renamed-contract-workspace",
          updatedAt: "2026-06-14T03:01:00.000Z"
        })
      );

      expect(appState.workspaces.hasLiveRecords("contract-workspace")).toBe(false);
      expect(appState.workspaces.delete("contract-workspace")).toBe(true);
      expect(appState.workspaces.get("contract-workspace")).toBeUndefined();
    });
  });
});
