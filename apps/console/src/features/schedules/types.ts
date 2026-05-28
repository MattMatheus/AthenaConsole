export type ScheduleTargetType = "task" | "mission" | "workflow-template";
export type ScheduleStatus = "active" | "paused" | "disabled" | "error";
export type ScheduleRunStatus = "ok" | "failed" | "already-running";
export type ScheduleFrequency = "HOURLY" | "DAILY" | "WEEKLY";
export type ScheduleMode = "one-shot" | "recurring";

export type ScheduledTask = {
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
};

export type ScheduleListResult = {
  items: ScheduledTask[];
  nextCursor?: string;
};

export type ScheduleRunResult = {
  id: string;
  sessionId: string;
  status: ScheduleRunStatus;
  startedAt: string;
  finishedAt: string;
  targetType?: ScheduleTargetType;
  targetId?: string;
  runId?: string;
  workflowDagRunId?: string;
  missionId?: string;
  taskIds?: string[];
  nextRunAt?: string;
  missedRunAt?: string;
  reason?: string;
  error?: string;
  errorCode?: string;
};

export type ScheduleRunLog = Omit<ScheduleRunResult, "id" | "finishedAt"> & {
  id: string;
  scheduleId: string;
  finishedAt?: string;
};

export type ScheduleTickResult = {
  at: string;
  run: ScheduleRunResult[];
  skipped: number;
};

export type ScheduleMutationResult = {
  id: string;
  removed?: boolean;
  updated?: boolean;
  schedule?: ScheduledTask;
};

export type CreateScheduleRequest = {
  id: string;
  name?: string;
  targetType: "task" | "workflow-template";
  targetId: string;
  inputBindings?: unknown;
  runAt?: string;
  rrule?: string;
  timezone: string;
  status?: ScheduleStatus;
  failurePolicy?: unknown;
};

export type ScheduleFormDraft = {
  id: string;
  name: string;
  targetType: "task" | "workflow-template";
  targetId: string;
  mode: ScheduleMode;
  runAtLocal: string;
  frequency: ScheduleFrequency;
  interval: string;
  timezone: string;
};

export type ScheduleFormValidation = {
  id?: string;
  targetId?: string;
  runAtLocal?: string;
  interval?: string;
};
