import { randomUUID } from "node:crypto";
import type { AppStateDatabase, RunRecord } from "../app-state/index.js";

export const STALE_RUNNING_RUN_CODE = "STALE_RUNNING_RUN";
export const STALE_RUNNING_RUN_EVENT_TYPE = "run.recovered_stale";

export interface StaleRunRecoveryResult {
  taskRunsRecovered: number;
  missionRunsRecovered: number;
  recoveredRunIds: string[];
}

export function recoverStaleTaskAndMissionRuns(appState: AppStateDatabase, now: Date = new Date()): StaleRunRecoveryResult {
  const recoveredAt = now.toISOString();
  const runningRuns = appState.runs
    .list()
    .filter((run) => run.status === "running" && (run.targetType === "task" || run.targetType === "mission"));

  let taskRunsRecovered = 0;
  let missionRunsRecovered = 0;
  const recoveredRunIds: string[] = [];

  const recover = appState.db.transaction((runs: RunRecord[]) => {
    for (const run of runs) {
      const current = appState.runs.get(run.id);
      if (!current || current.status !== "running") {
        continue;
      }

      const message =
        current.targetType === "task"
          ? "Recovered stale running task run after process startup."
          : "Recovered stale running mission run after process startup.";
      const failure = {
        code: STALE_RUNNING_RUN_CODE,
        message,
        recoveredAt,
        previousStatus: current.status,
        targetType: current.targetType,
        targetId: current.targetId
      };
      const updatedRun = appState.runs.update(current.id, {
        status: "failed",
        endedAt: recoveredAt,
        failure,
        now
      });

      if (updatedRun.targetType === "task") {
        const task = appState.tasks.get(updatedRun.targetId);
        if (task?.status === "running") {
          appState.tasks.update(task.id, { status: "failed", now });
        }
        taskRunsRecovered += 1;
        appState.runEvents.append({
          id: `event-${randomUUID()}`,
          runId: updatedRun.id,
          ...(task ? { taskId: task.id } : {}),
          ...(updatedRun.agentId ? { agentId: updatedRun.agentId } : {}),
          type: STALE_RUNNING_RUN_EVENT_TYPE,
          level: "warning",
          timestamp: recoveredAt,
          message,
          payload: failure
        });
      } else {
        const mission = appState.missions.get(updatedRun.targetId);
        if (mission?.status === "running") {
          appState.missions.update(mission.id, { status: "failed", now });
        }
        missionRunsRecovered += 1;
        appState.runEvents.append({
          id: `event-${randomUUID()}`,
          runId: updatedRun.id,
          ...(mission ? { missionId: mission.id } : {}),
          type: STALE_RUNNING_RUN_EVENT_TYPE,
          level: "warning",
          timestamp: recoveredAt,
          message,
          payload: failure
        });
      }

      recoveredRunIds.push(updatedRun.id);
    }
  });

  recover(runningRuns);

  return {
    taskRunsRecovered,
    missionRunsRecovered,
    recoveredRunIds
  };
}
