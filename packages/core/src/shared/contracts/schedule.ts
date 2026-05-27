import type { AthenaErrorCode } from "./base.js";

export type ScheduleTargetType = "task" | "mission" | "workflow-template";
export type ScheduleStatus = "active" | "paused" | "disabled" | "error";

export interface ScheduledTask {
  schemaVersion?: number;
  id: string;
  name?: string;
  targetType?: ScheduleTargetType;
  targetId?: string;
  inputBindings?: unknown;
  rrule?: string;
  timezone?: string;
  status?: ScheduleStatus;
  failurePolicy?: unknown;
  lastRunId?: string;
  lastMissionId?: string;
  sessionId: string;
  input: string;
  everyMinutes: number;
  enabled: boolean;
  running: boolean;
  createdAt: string;
  updatedAt: string;
  lastRunAt?: string;
  nextRunAt: string;
}

export interface ScheduledTasksStateFile {
  schemaVersion: number;
  tasks: ScheduledTask[];
}

export interface ScheduleRunLog {
  id: string;
  scheduleId: string;
  sessionId: string;
  startedAt: string;
  finishedAt?: string;
  status: "ok" | "failed" | "already-running";
  targetType?: ScheduleTargetType;
  targetId?: string;
  runId?: string;
  missionId?: string;
  taskIds?: string[];
  nextRunAt?: string;
  missedRunAt?: string;
  reason?: string;
  error?: string;
  errorCode?: AthenaErrorCode;
}
