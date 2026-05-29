import { apiClient } from "../../services";
import type {
  MissionWorkbenchMission,
  MissionWorkbenchMissionListQuery,
  MissionWorkbenchMissionListResult,
  MissionWorkbenchMissionRun,
  MissionWorkbenchMissionRunDetail,
  MissionWorkbenchMissionRunListResult,
  MissionWorkbenchMissionRunSummary,
  MissionWorkbenchMissionStatus,
  MissionWorkbenchMissionTaskListResult,
} from "./types";
import type {
  TaskWorkbenchRunEvent,
  TaskWorkbenchTask,
  TaskWorkbenchTaskRun,
  TaskWorkbenchTaskStatus,
  TaskWorkbenchRunStatus,
} from "../task-workbench";
import { parseRunReadiness } from "../task-workbench/api";

type RecordValue = Record<string, unknown>;

function isRecord(value: unknown): value is RecordValue {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.length > 0)
    : [];
}

function parseTaskStatus(value: unknown): TaskWorkbenchTaskStatus {
  return typeof value === "string" ? (value as TaskWorkbenchTaskStatus) : "draft";
}

function parseRunStatus(value: unknown): TaskWorkbenchRunStatus {
  return typeof value === "string" ? (value as TaskWorkbenchRunStatus) : "queued";
}

function parseMission(value: unknown): MissionWorkbenchMission {
  if (!isRecord(value) || typeof value.id !== "string" || typeof value.title !== "string") {
    throw new Error("Mission payload is invalid.");
  }
  return {
    id: value.id,
    title: value.title,
    goal: typeof value.goal === "string" ? value.goal : "",
    context: value.context ?? {},
    status: typeof value.status === "string" ? (value.status as MissionWorkbenchMissionStatus) : "draft",
    taskOrder: toStringArray(value.taskOrder),
    createdAt: typeof value.createdAt === "string" ? value.createdAt : new Date(0).toISOString(),
    updatedAt: typeof value.updatedAt === "string" ? value.updatedAt : new Date(0).toISOString(),
    ...(typeof value.archivedAt === "string" ? { archivedAt: value.archivedAt } : {}),
    ...(isRecord(value.runReadiness) ? { runReadiness: parseRunReadiness(value.runReadiness) } : {}),
  };
}

function parseTask(value: unknown): TaskWorkbenchTask {
  if (!isRecord(value) || typeof value.id !== "string" || typeof value.title !== "string") {
    throw new Error("Mission task payload is invalid.");
  }
  return {
    id: value.id,
    title: value.title,
    description: typeof value.description === "string" ? value.description : "",
    status: parseTaskStatus(value.status),
    capabilityRequirements: toStringArray(value.capabilityRequirements),
    ...(typeof value.assignedAgentId === "string" ? { assignedAgentId: value.assignedAgentId } : {}),
    ...(typeof value.assignedAgentVersion === "string" ? { assignedAgentVersion: value.assignedAgentVersion } : {}),
    inputs: value.inputs ?? {},
    dependsOn: toStringArray(value.dependsOn),
    ...(typeof value.missionId === "string" ? { missionId: value.missionId } : {}),
    ...(typeof value.sourceRunId === "string" ? { sourceRunId: value.sourceRunId } : {}),
    ...(value.provenance !== undefined ? { provenance: value.provenance } : {}),
    ...(typeof value.createdBy === "string" ? { createdBy: value.createdBy } : {}),
    createdAt: typeof value.createdAt === "string" ? value.createdAt : new Date(0).toISOString(),
    updatedAt: typeof value.updatedAt === "string" ? value.updatedAt : new Date(0).toISOString(),
    ...(typeof value.archivedAt === "string" ? { archivedAt: value.archivedAt } : {}),
  };
}

function parseRun(value: unknown): TaskWorkbenchTaskRun {
  if (!isRecord(value) || typeof value.id !== "string" || typeof value.targetId !== "string") {
    throw new Error("Mission child run payload is invalid.");
  }
  return {
    id: value.id,
    targetType: "task",
    targetId: value.targetId,
    status: parseRunStatus(value.status),
    ...(typeof value.backend === "string" ? { backend: value.backend } : {}),
    ...(typeof value.agentId === "string" ? { agentId: value.agentId } : {}),
    ...(typeof value.agentVersion === "string" ? { agentVersion: value.agentVersion } : {}),
    ...(typeof value.startedAt === "string" ? { startedAt: value.startedAt } : {}),
    ...(typeof value.endedAt === "string" ? { endedAt: value.endedAt } : {}),
    ...(value.output !== undefined ? { output: value.output } : {}),
    ...(value.failure !== undefined ? { failure: value.failure } : {}),
    ...(value.safetyStop !== undefined ? { safetyStop: value.safetyStop } : {}),
    createdAt: typeof value.createdAt === "string" ? value.createdAt : new Date(0).toISOString(),
    updatedAt: typeof value.updatedAt === "string" ? value.updatedAt : new Date(0).toISOString(),
  };
}

function parseMissionRun(value: unknown): MissionWorkbenchMissionRun {
  if (!isRecord(value) || typeof value.id !== "string" || typeof value.targetId !== "string") {
    throw new Error("Mission run payload is invalid.");
  }
  return {
    id: value.id,
    targetType: "mission",
    targetId: value.targetId,
    status: parseRunStatus(value.status),
    ...(typeof value.backend === "string" ? { backend: value.backend } : {}),
    ...(typeof value.startedAt === "string" ? { startedAt: value.startedAt } : {}),
    ...(typeof value.endedAt === "string" ? { endedAt: value.endedAt } : {}),
    ...(value.output !== undefined ? { output: value.output } : {}),
    ...(value.failure !== undefined ? { failure: value.failure } : {}),
    ...(value.safetyStop !== undefined ? { safetyStop: value.safetyStop } : {}),
    createdAt: typeof value.createdAt === "string" ? value.createdAt : new Date(0).toISOString(),
    updatedAt: typeof value.updatedAt === "string" ? value.updatedAt : new Date(0).toISOString(),
  };
}

function parseMissionRunSummary(value: unknown): MissionWorkbenchMissionRunSummary {
  if (!isRecord(value) || typeof value.id !== "string" || typeof value.targetId !== "string") {
    throw new Error("Mission run summary payload is invalid.");
  }
  return {
    id: value.id,
    targetType: "mission",
    targetId: value.targetId,
    status: parseRunStatus(value.status),
    ...(typeof value.backend === "string" ? { backend: value.backend } : {}),
    ...(typeof value.startedAt === "string" ? { startedAt: value.startedAt } : {}),
    ...(typeof value.endedAt === "string" ? { endedAt: value.endedAt } : {}),
    childRunCount: typeof value.childRunCount === "number" ? value.childRunCount : 0,
    createdAt: typeof value.createdAt === "string" ? value.createdAt : new Date(0).toISOString(),
    updatedAt: typeof value.updatedAt === "string" ? value.updatedAt : new Date(0).toISOString(),
  };
}

function parseEvent(value: unknown): TaskWorkbenchRunEvent | undefined {
  if (!isRecord(value) || typeof value.id !== "string" || typeof value.runId !== "string" || typeof value.type !== "string") {
    return undefined;
  }
  return {
    id: value.id,
    runId: value.runId,
    ...(typeof value.taskId === "string" ? { taskId: value.taskId } : {}),
    ...(typeof value.missionId === "string" ? { missionId: value.missionId } : {}),
    ...(typeof value.agentId === "string" ? { agentId: value.agentId } : {}),
    type: value.type,
    level: value.level === "debug" || value.level === "warning" || value.level === "error" ? value.level : "info",
    timestamp: typeof value.timestamp === "string" ? value.timestamp : new Date(0).toISOString(),
    message: typeof value.message === "string" ? value.message : "",
    payload: value.payload ?? {},
    ...(typeof value.parentEventId === "string" ? { parentEventId: value.parentEventId } : {}),
    ...(typeof value.traceId === "string" ? { traceId: value.traceId } : {}),
  };
}

function parseRunDetail(value: unknown): MissionWorkbenchMissionRunDetail {
  if (!isRecord(value) || !isRecord(value.run)) {
    throw new Error("Mission run detail payload is invalid.");
  }
  return {
    run: parseMissionRun(value.run),
    ...(isRecord(value.mission) ? { mission: parseMission(value.mission) } : {}),
    childRuns: Array.isArray(value.childRuns) ? value.childRuns.map(parseRun) : [],
    events: Array.isArray(value.events)
      ? value.events.map(parseEvent).filter((event): event is TaskWorkbenchRunEvent => event !== undefined)
      : [],
  };
}

function toQueryString(query: MissionWorkbenchMissionListQuery = {}): string {
  const params = new URLSearchParams();
  if (query.includeArchived !== undefined) {
    params.set("includeArchived", String(query.includeArchived));
  }
  const suffix = params.toString();
  return suffix ? `?${suffix}` : "";
}

export async function fetchMissions(query: MissionWorkbenchMissionListQuery = {}): Promise<MissionWorkbenchMissionListResult> {
  const payload = await apiClient.get<unknown>(`/v1/missions${toQueryString(query)}`);
  if (!isRecord(payload) || !Array.isArray(payload.missions)) {
    throw new Error("Mission list payload is invalid.");
  }
  return {
    missions: payload.missions.map(parseMission),
    total: typeof payload.total === "number" ? payload.total : payload.missions.length,
    filters: isRecord(payload.filters) ? (payload.filters as MissionWorkbenchMissionListQuery) : {},
  };
}

export async function fetchMissionTasks(id: string): Promise<MissionWorkbenchMissionTaskListResult> {
  const payload = await apiClient.get<unknown>(`/v1/missions/${encodeURIComponent(id)}/tasks`);
  if (!isRecord(payload) || !Array.isArray(payload.tasks)) {
    throw new Error("Mission task list payload is invalid.");
  }
  return {
    mission: parseMission(payload.mission),
    tasks: payload.tasks.map(parseTask),
    total: typeof payload.total === "number" ? payload.total : payload.tasks.length,
  };
}

export async function fetchMissionRuns(id: string): Promise<MissionWorkbenchMissionRunListResult> {
  const payload = await apiClient.get<unknown>(`/v1/missions/${encodeURIComponent(id)}/runs`);
  if (!isRecord(payload) || !Array.isArray(payload.runs)) {
    throw new Error("Mission run list payload is invalid.");
  }
  return {
    mission: parseMission(payload.mission),
    runs: payload.runs.map(parseMissionRunSummary),
    total: typeof payload.total === "number" ? payload.total : payload.runs.length,
  };
}

export async function fetchMissionRunDetail(runId: string): Promise<MissionWorkbenchMissionRunDetail> {
  return parseRunDetail(await apiClient.get<unknown>(`/v1/mission-runs/${encodeURIComponent(runId)}`));
}

export async function runMission(id: string): Promise<MissionWorkbenchMissionRunDetail> {
  return parseRunDetail(await apiClient.post<unknown>(`/v1/missions/${encodeURIComponent(id)}/run`, {}));
}
