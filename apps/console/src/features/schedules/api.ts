import { apiClient } from "../../services";
import type {
  CreateScheduleRequest,
  ScheduleListResult,
  ScheduleMutationResult,
  ScheduleRunResult,
  ScheduleRunStatus,
  ScheduleStatus,
  ScheduleTargetType,
  ScheduleTickResult,
  ScheduledTask,
} from "./types";

type RecordValue = Record<string, unknown>;

function isRecord(value: unknown): value is RecordValue {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseScheduleStatus(value: unknown): ScheduleStatus | undefined {
  return value === "active" || value === "paused" || value === "disabled" || value === "error" ? value : undefined;
}

function parseTargetType(value: unknown): ScheduleTargetType | undefined {
  return value === "task" || value === "mission" || value === "workflow-template" ? value : undefined;
}

function parseRunStatus(value: unknown): ScheduleRunStatus {
  return value === "failed" || value === "already-running" ? value : "ok";
}

function parseSchedule(value: unknown): ScheduledTask {
  if (!isRecord(value) || typeof value.id !== "string" || typeof value.sessionId !== "string") {
    throw new Error("Schedule payload is invalid.");
  }
  const targetType = parseTargetType(value.targetType);
  const status = parseScheduleStatus(value.status);
  return {
    ...(typeof value.schemaVersion === "number" ? { schemaVersion: value.schemaVersion } : {}),
    id: value.id,
    ...(typeof value.name === "string" ? { name: value.name } : {}),
    ...(targetType ? { targetType } : {}),
    ...(typeof value.targetId === "string" ? { targetId: value.targetId } : {}),
    ...(value.inputBindings !== undefined ? { inputBindings: value.inputBindings } : {}),
    ...(typeof value.rrule === "string" ? { rrule: value.rrule } : {}),
    ...(typeof value.timezone === "string" ? { timezone: value.timezone } : {}),
    ...(status ? { status } : {}),
    ...(value.failurePolicy !== undefined ? { failurePolicy: value.failurePolicy } : {}),
    ...(typeof value.lastRunId === "string" ? { lastRunId: value.lastRunId } : {}),
    sessionId: value.sessionId,
    input: typeof value.input === "string" ? value.input : "",
    everyMinutes: typeof value.everyMinutes === "number" ? value.everyMinutes : 1,
    enabled: Boolean(value.enabled),
    running: Boolean(value.running),
    createdAt: typeof value.createdAt === "string" ? value.createdAt : new Date(0).toISOString(),
    updatedAt: typeof value.updatedAt === "string" ? value.updatedAt : new Date(0).toISOString(),
    ...(typeof value.lastRunAt === "string" ? { lastRunAt: value.lastRunAt } : {}),
    nextRunAt: typeof value.nextRunAt === "string" ? value.nextRunAt : "",
  };
}

function parseScheduleRunResult(value: unknown): ScheduleRunResult {
  if (!isRecord(value) || typeof value.id !== "string" || typeof value.sessionId !== "string") {
    throw new Error("Schedule run payload is invalid.");
  }
  const targetType = parseTargetType(value.targetType);
  return {
    id: value.id,
    sessionId: value.sessionId,
    status: parseRunStatus(value.status),
    startedAt: typeof value.startedAt === "string" ? value.startedAt : new Date(0).toISOString(),
    finishedAt: typeof value.finishedAt === "string" ? value.finishedAt : new Date(0).toISOString(),
    ...(targetType ? { targetType } : {}),
    ...(typeof value.targetId === "string" ? { targetId: value.targetId } : {}),
    ...(typeof value.runId === "string" ? { runId: value.runId } : {}),
    ...(typeof value.nextRunAt === "string" ? { nextRunAt: value.nextRunAt } : {}),
    ...(typeof value.missedRunAt === "string" ? { missedRunAt: value.missedRunAt } : {}),
    ...(typeof value.reason === "string" ? { reason: value.reason } : {}),
    ...(typeof value.error === "string" ? { error: value.error } : {}),
    ...(typeof value.errorCode === "string" ? { errorCode: value.errorCode } : {}),
  };
}

export async function fetchSchedules(): Promise<ScheduleListResult> {
  const value = await apiClient.get<unknown>("/v1/schedules");
  if (!isRecord(value) || !Array.isArray(value.items)) {
    throw new Error("Schedule list payload is invalid.");
  }
  return {
    items: value.items.map(parseSchedule),
    ...(typeof value.nextCursor === "string" ? { nextCursor: value.nextCursor } : {}),
  };
}

export async function createSchedule(request: CreateScheduleRequest): Promise<ScheduledTask> {
  return parseSchedule(await apiClient.post<unknown>("/v1/schedules", request));
}

export async function enableSchedule(id: string): Promise<ScheduleMutationResult> {
  return apiClient.post<ScheduleMutationResult>(`/v1/schedules/${encodeURIComponent(id)}/enable`, {});
}

export async function disableSchedule(id: string): Promise<ScheduleMutationResult> {
  return apiClient.post<ScheduleMutationResult>(`/v1/schedules/${encodeURIComponent(id)}/disable`, {});
}

export async function deleteSchedule(id: string): Promise<ScheduleMutationResult> {
  return apiClient.delete<ScheduleMutationResult>(`/v1/schedules/${encodeURIComponent(id)}`);
}

export async function runSchedule(id: string): Promise<ScheduleRunResult> {
  return parseScheduleRunResult(await apiClient.post<unknown>(`/v1/schedules/${encodeURIComponent(id)}/run`, {}));
}

export async function tickSchedules(at: Date = new Date()): Promise<ScheduleTickResult> {
  const value = await apiClient.post<unknown>("/v1/schedules/tick", { at: at.toISOString() });
  if (!isRecord(value) || !Array.isArray(value.run)) {
    throw new Error("Schedule tick payload is invalid.");
  }
  return {
    at: typeof value.at === "string" ? value.at : at.toISOString(),
    run: value.run.map(parseScheduleRunResult),
    skipped: typeof value.skipped === "number" ? value.skipped : 0,
  };
}
