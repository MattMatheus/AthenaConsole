import type {
  TaskWorkbenchTask,
  TaskWorkbenchTaskCreateRequest
} from "./task-workbench.js";

export type MissionWorkbenchMissionStatus = "draft" | "ready" | "running" | "blocked" | "completed" | "failed" | "cancelled" | "archived";

export const MISSION_WORKBENCH_STATUSES: MissionWorkbenchMissionStatus[] = [
  "draft",
  "ready",
  "running",
  "blocked",
  "completed",
  "failed",
  "cancelled",
  "archived"
];

export interface MissionWorkbenchMission {
  id: string;
  title: string;
  goal: string;
  context: unknown;
  status: MissionWorkbenchMissionStatus;
  taskOrder: string[];
  createdAt: string;
  updatedAt: string;
  archivedAt?: string;
}

export interface MissionWorkbenchMissionListQuery {
  includeArchived?: boolean;
}

export interface MissionWorkbenchMissionListResult {
  missions: MissionWorkbenchMission[];
  total: number;
  filters: MissionWorkbenchMissionListQuery;
}

export interface MissionWorkbenchMissionCreateRequest {
  id?: string;
  title: string;
  goal?: string;
  context?: unknown;
  status?: MissionWorkbenchMissionStatus;
  taskOrder?: string[];
}

export interface MissionWorkbenchMissionUpdateRequest {
  title?: string;
  goal?: string;
  context?: unknown;
  status?: MissionWorkbenchMissionStatus;
  taskOrder?: string[];
}

export interface MissionWorkbenchMissionTaskListResult {
  mission: MissionWorkbenchMission;
  tasks: TaskWorkbenchTask[];
  total: number;
}

export interface MissionWorkbenchMissionTaskAttachRequest {
  taskId: string;
  dependsOn?: string[];
  position?: number;
}

export type MissionWorkbenchMissionTaskCreateRequest = Omit<TaskWorkbenchTaskCreateRequest, "missionId"> & {
  position?: number;
};
