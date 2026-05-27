import type {
  TaskWorkbenchRunEvent,
  TaskWorkbenchTask,
  TaskWorkbenchTaskRun,
  TaskWorkbenchRunStatus,
} from "../task-workbench";

export type MissionWorkbenchMissionStatus =
  | "draft"
  | "ready"
  | "running"
  | "blocked"
  | "completed"
  | "failed"
  | "cancelled"
  | "archived";

export type MissionWorkbenchMission = {
  id: string;
  title: string;
  goal: string;
  context: unknown;
  status: MissionWorkbenchMissionStatus;
  taskOrder: string[];
  createdAt: string;
  updatedAt: string;
  archivedAt?: string;
};

export type MissionWorkbenchMissionListQuery = {
  includeArchived?: boolean;
};

export type MissionWorkbenchMissionListResult = {
  missions: MissionWorkbenchMission[];
  total: number;
  filters: MissionWorkbenchMissionListQuery;
};

export type MissionWorkbenchMissionTaskListResult = {
  mission: MissionWorkbenchMission;
  tasks: TaskWorkbenchTask[];
  total: number;
};

export type MissionWorkbenchMissionRun = {
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
};

export type MissionWorkbenchMissionRunSummary = {
  id: string;
  targetType: "mission";
  targetId: string;
  status: TaskWorkbenchRunStatus;
  backend?: string;
  startedAt?: string;
  endedAt?: string;
  childRunCount: number;
  createdAt: string;
  updatedAt: string;
};

export type MissionWorkbenchMissionRunListResult = {
  mission: MissionWorkbenchMission;
  runs: MissionWorkbenchMissionRunSummary[];
  total: number;
};

export type MissionWorkbenchMissionRunDetail = {
  run: MissionWorkbenchMissionRun;
  mission?: MissionWorkbenchMission;
  childRuns: TaskWorkbenchTaskRun[];
  events: TaskWorkbenchRunEvent[];
};
