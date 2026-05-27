import { describe, expect, it } from "vitest";
import { missionStatusTone, orderedMissionTasks, sortMissions } from "./missionModel";
import type { MissionWorkbenchMission } from "./types";
import type { TaskWorkbenchTask } from "../task-workbench";

describe("mission workbench model", () => {
  it("orders missions by recent updates and mission tasks by task order", () => {
    expect(sortMissions([mission("old", "2026-01-01T00:00:00.000Z"), mission("new", "2026-01-02T00:00:00.000Z")]).map((item) => item.id)).toEqual([
      "new",
      "old",
    ]);
    expect(orderedMissionTasks(mission("m", "2026-01-01T00:00:00.000Z", ["task-b", "task-a"]), [task("task-a"), task("task-c"), task("task-b")]).map((item) => item.id)).toEqual([
      "task-b",
      "task-a",
      "task-c",
    ]);
  });

  it("maps mission statuses to display tones", () => {
    expect(missionStatusTone("ready")).toBe("success");
    expect(missionStatusTone("running")).toBe("warning");
    expect(missionStatusTone("failed")).toBe("danger");
    expect(missionStatusTone("draft")).toBe("muted");
  });
});

function mission(id: string, updatedAt: string, taskOrder: string[] = []): MissionWorkbenchMission {
  return {
    id,
    title: id,
    goal: "",
    context: {},
    status: "draft",
    taskOrder,
    createdAt: updatedAt,
    updatedAt,
  };
}

function task(id: string): TaskWorkbenchTask {
  return {
    id,
    title: id,
    description: "",
    status: "draft",
    capabilityRequirements: [],
    inputs: {},
    dependsOn: [],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}
