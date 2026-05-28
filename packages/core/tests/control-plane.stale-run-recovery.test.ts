import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { openAppStateDatabase } from "../src/control-plane/app-state/index.js";
import { createLocalControlPlaneServices } from "../src/control-plane/services.js";
import {
  recoverStaleTaskAndMissionRuns,
  STALE_RUNNING_RUN_CODE,
  STALE_RUNNING_RUN_EVENT_TYPE
} from "../src/control-plane/services/stale-run-recovery.js";
import { loadConfig } from "../src/shared/config.js";

describe("stale task and mission run recovery", () => {
  it("recovers stale running task and mission runs with warning events", () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-stale-run-recovery-"));
    try {
      const config = loadConfig(dir);
      const appState = openAppStateDatabase(config);
      try {
        appState.tasks.create({
          id: "task-stale",
          title: "Stale task",
          status: "running"
        });
        appState.runs.create({
          id: "run-task-stale",
          targetType: "task",
          targetId: "task-stale",
          status: "running",
          backend: "local-process",
          startedAt: "2026-05-28T10:00:00.000Z"
        });
        appState.missions.create({
          id: "mission-stale",
          title: "Stale mission",
          status: "running"
        });
        appState.runs.create({
          id: "run-mission-stale",
          targetType: "mission",
          targetId: "mission-stale",
          status: "running",
          backend: "sequential-mission",
          startedAt: "2026-05-28T10:05:00.000Z"
        });

        const result = recoverStaleTaskAndMissionRuns(appState, new Date("2026-05-28T11:00:00.000Z"));

        expect(result).toEqual({
          taskRunsRecovered: 1,
          missionRunsRecovered: 1,
          recoveredRunIds: ["run-task-stale", "run-mission-stale"]
        });
        expect(appState.runs.require("run-task-stale")).toMatchObject({
          status: "failed",
          endedAt: "2026-05-28T11:00:00.000Z",
          failure: {
            code: STALE_RUNNING_RUN_CODE,
            recoveredAt: "2026-05-28T11:00:00.000Z",
            targetType: "task",
            targetId: "task-stale"
          }
        });
        expect(appState.tasks.require("task-stale")).toMatchObject({ status: "failed" });
        expect(appState.runs.require("run-mission-stale")).toMatchObject({
          status: "failed",
          endedAt: "2026-05-28T11:00:00.000Z",
          failure: {
            code: STALE_RUNNING_RUN_CODE,
            recoveredAt: "2026-05-28T11:00:00.000Z",
            targetType: "mission",
            targetId: "mission-stale"
          }
        });
        expect(appState.missions.require("mission-stale")).toMatchObject({ status: "failed" });

        expect(appState.runEvents.listForRun("run-task-stale")).toEqual([
          expect.objectContaining({
            type: STALE_RUNNING_RUN_EVENT_TYPE,
            level: "warning",
            taskId: "task-stale",
            message: "Recovered stale running task run after process startup."
          })
        ]);
        expect(appState.runEvents.listForRun("run-mission-stale")).toEqual([
          expect.objectContaining({
            type: STALE_RUNNING_RUN_EVENT_TYPE,
            level: "warning",
            missionId: "mission-stale",
            message: "Recovered stale running mission run after process startup."
          })
        ]);
      } finally {
        appState.close();
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("is idempotent after the first recovery pass", () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-stale-run-recovery-idempotent-"));
    try {
      const config = loadConfig(dir);
      const appState = openAppStateDatabase(config);
      try {
        appState.tasks.create({
          id: "task-stale",
          title: "Stale task",
          status: "running"
        });
        appState.runs.create({
          id: "run-task-stale",
          targetType: "task",
          targetId: "task-stale",
          status: "running",
          startedAt: "2026-05-28T10:00:00.000Z"
        });

        const first = recoverStaleTaskAndMissionRuns(appState, new Date("2026-05-28T11:00:00.000Z"));
        const second = recoverStaleTaskAndMissionRuns(appState, new Date("2026-05-28T12:00:00.000Z"));

        expect(first.taskRunsRecovered).toBe(1);
        expect(second).toEqual({
          taskRunsRecovered: 0,
          missionRunsRecovered: 0,
          recoveredRunIds: []
        });
        expect(appState.runEvents.listForRun("run-task-stale").filter((event) => event.type === STALE_RUNNING_RUN_EVENT_TYPE)).toHaveLength(1);
        expect(appState.runs.require("run-task-stale")).toMatchObject({
          status: "failed",
          endedAt: "2026-05-28T11:00:00.000Z"
        });
      } finally {
        appState.close();
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("recovers more than one bounded run-list page", () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-stale-run-recovery-pages-"));
    try {
      const config = loadConfig(dir);
      const appState = openAppStateDatabase(config);
      try {
        for (let index = 0; index < 1005; index += 1) {
          const taskId = `task-stale-${index.toString().padStart(4, "0")}`;
          appState.tasks.create({
            id: taskId,
            title: `Stale task ${index}`,
            status: "running"
          });
          appState.runs.create({
            id: `run-stale-${index.toString().padStart(4, "0")}`,
            targetType: "task",
            targetId: taskId,
            status: "running",
            startedAt: "2026-05-28T10:00:00.000Z"
          });
        }

        const result = recoverStaleTaskAndMissionRuns(appState, new Date("2026-05-28T11:00:00.000Z"));

        expect(result.taskRunsRecovered).toBe(1005);
        expect(appState.runs.list({ status: "running", limit: 1000 })).toEqual([]);
        expect(appState.runs.list({ status: "failed", limit: 1000 })).toHaveLength(1000);
        expect(appState.runs.require("run-stale-1004")).toMatchObject({
          status: "failed",
          failure: { code: STALE_RUNNING_RUN_CODE }
        });
      } finally {
        appState.close();
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("runs during local control-plane service startup", async () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-stale-run-recovery-startup-"));
    try {
      const config = loadConfig(dir);
      let appState = openAppStateDatabase(config);
      try {
        appState.tasks.create({
          id: "task-startup-stale",
          title: "Startup stale task",
          status: "running"
        });
        appState.runs.create({
          id: "run-startup-stale",
          targetType: "task",
          targetId: "task-startup-stale",
          status: "running",
          startedAt: "2026-05-28T10:00:00.000Z"
        });
        appState.schedules.create({
          id: "schedule-startup-stale",
          name: "Retry startup stale task",
          targetType: "task",
          targetId: "task-startup-stale",
          timezone: "UTC",
          status: "active",
          nextRunAt: "2026-05-28T12:00:00.000Z"
        });
      } finally {
        appState.close();
      }

      const services = createLocalControlPlaneServices({ config });
      const scheduleResult = await services.scheduleService.runDue(new Date("2026-05-28T12:00:00.000Z"));
      await services.shutdown?.();

      expect(scheduleResult.run).toEqual([
        expect.objectContaining({
          id: "schedule-startup-stale",
          status: "failed",
          targetType: "task",
          targetId: "task-startup-stale",
          errorCode: "CONFIG_ERROR"
        })
      ]);
      expect(scheduleResult.run[0]?.status).not.toBe("already-running");

      appState = openAppStateDatabase(config);
      try {
        expect(appState.runs.require("run-startup-stale")).toMatchObject({
          status: "failed",
          failure: { code: STALE_RUNNING_RUN_CODE }
        });
        expect(appState.tasks.require("task-startup-stale")).toMatchObject({ status: "failed" });
        expect(appState.runEvents.listForRun("run-startup-stale").map((event) => event.type)).toContain(STALE_RUNNING_RUN_EVENT_TYPE);
        expect(appState.scheduleRunHistory.listForSchedule("schedule-startup-stale")).toEqual([
          expect.objectContaining({
            status: "failed",
            targetType: "task",
            targetId: "task-startup-stale",
            errorCode: "CONFIG_ERROR"
          })
        ]);
      } finally {
        appState.close();
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
