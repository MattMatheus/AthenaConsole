import type { MissionWorkbenchMission } from "./types";
import type { TaskWorkbenchTask } from "../task-workbench";

export function missionStatusTone(status: MissionWorkbenchMission["status"]): "success" | "warning" | "danger" | "muted" {
  if (status === "completed" || status === "ready") {
    return "success";
  }
  if (status === "failed" || status === "cancelled") {
    return "danger";
  }
  if (status === "running" || status === "blocked") {
    return "warning";
  }
  return "muted";
}

export function sortMissions(missions: MissionWorkbenchMission[]): MissionWorkbenchMission[] {
  return [...missions].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt) || left.title.localeCompare(right.title));
}

export function orderedMissionTasks(mission: MissionWorkbenchMission | undefined, tasks: TaskWorkbenchTask[]): TaskWorkbenchTask[] {
  if (!mission) {
    return tasks;
  }
  const byId = new Map(tasks.map((task) => [task.id, task]));
  const ordered = mission.taskOrder.flatMap((id) => {
    const task = byId.get(id);
    return task ? [task] : [];
  });
  const orderedIds = new Set(ordered.map((task) => task.id));
  return [...ordered, ...tasks.filter((task) => !orderedIds.has(task.id)).sort((left, right) => left.id.localeCompare(right.id))];
}
