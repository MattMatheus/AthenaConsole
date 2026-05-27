import type {
  TaskWorkbenchTask,
  TaskWorkbenchTaskCreateRequest,
  TaskWorkbenchTaskRun,
  TaskWorkbenchRunEvent,
  TaskWorkbenchRunStatus
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

export interface MissionWorkbenchMissionRunRequest {
  runId?: string;
}

export interface MissionWorkbenchMissionRunChild {
  taskId: string;
  runId: string;
  status: TaskWorkbenchRunStatus;
}

export interface MissionWorkbenchMissionRun {
  id: string;
  targetType: "mission";
  targetId: string;
  status: TaskWorkbenchRunStatus;
  backend?: string;
  startedAt?: string;
  endedAt?: string;
  output?: unknown;
  failure?: unknown;
  safetyStop?: unknown;
  createdAt: string;
  updatedAt: string;
}

export interface MissionWorkbenchMissionRunDetail {
  run: MissionWorkbenchMissionRun;
  mission?: MissionWorkbenchMission;
  childRuns: TaskWorkbenchTaskRun[];
  events: TaskWorkbenchRunEvent[];
}
