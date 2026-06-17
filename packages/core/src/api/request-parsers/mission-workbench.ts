import { AthenaError } from "../../runtime/errors.js";
import {
  MISSION_WORKBENCH_STATUSES,
  type MissionWorkbenchMissionCreateRequest,
  type MissionWorkbenchMissionListQuery,
  type MissionWorkbenchMissionRunRequest,
  type MissionWorkbenchMissionStatus,
  type MissionWorkbenchMissionTaskAttachRequest,
  type MissionWorkbenchMissionTaskCreateRequest,
  type MissionWorkbenchMissionUpdateRequest,
  type TaskWorkbenchTaskStatus,
  TASK_WORKBENCH_STATUSES
} from "../../shared/contracts.js";
import { optionalString, requireString } from "../validation.js";

export function parseMissionWorkbenchListQuery(requestUrl: URL): MissionWorkbenchMissionListQuery {
  const includeArchived = parseOptionalBooleanQuery(
    requestUrl.searchParams.get("includeArchived"),
    "missions.list.includeArchived"
  );
  return {
    ...(includeArchived !== undefined ? { includeArchived } : {})
  };
}

export function parseMissionWorkbenchCreateRequest(body: Record<string, unknown>): MissionWorkbenchMissionCreateRequest {
  const id = optionalString(body, "id", "missions.create");
  const goal = optionalString(body, "goal", "missions.create");
  const status = parseOptionalMissionStatusValue(body.status, "missions.create.status");
  const taskOrder = parseOptionalStringArray(body.taskOrder, "missions.create.taskOrder");
  return {
    ...(id ? { id } : {}),
    title: requireString(body, "title", "missions.create"),
    ...(goal !== undefined ? { goal } : {}),
    ...(body.context !== undefined ? { context: body.context } : {}),
    ...(status ? { status } : {}),
    ...(taskOrder ? { taskOrder } : {})
  };
}

export function parseMissionWorkbenchUpdateRequest(body: Record<string, unknown>): MissionWorkbenchMissionUpdateRequest {
  const title = optionalString(body, "title", "missions.update");
  const goal = optionalString(body, "goal", "missions.update");
  const status = parseOptionalMissionStatusValue(body.status, "missions.update.status");
  const taskOrder = parseOptionalStringArray(body.taskOrder, "missions.update.taskOrder");
  return {
    ...(title !== undefined ? { title } : {}),
    ...(goal !== undefined ? { goal } : {}),
    ...(body.context !== undefined ? { context: body.context } : {}),
    ...(status ? { status } : {}),
    ...(taskOrder ? { taskOrder } : {})
  };
}

export function parseMissionWorkbenchAttachTaskRequest(body: Record<string, unknown>): MissionWorkbenchMissionTaskAttachRequest {
  const dependsOn = parseOptionalStringArray(body.dependsOn, "missions.attachTask.dependsOn");
  const position = parseOptionalPosition(body.position, "missions.attachTask.position");
  return {
    taskId: requireString(body, "taskId", "missions.attachTask"),
    ...(dependsOn ? { dependsOn } : {}),
    ...(position !== undefined ? { position } : {})
  };
}

export function parseMissionWorkbenchCreateTaskRequest(body: Record<string, unknown>): MissionWorkbenchMissionTaskCreateRequest {
  const id = optionalString(body, "id", "missions.createTask");
  const description = optionalString(body, "description", "missions.createTask");
  const status = parseOptionalTaskStatusValue(body.status, "missions.createTask.status");
  const capabilityRequirements = parseOptionalStringArray(
    body.capabilityRequirements,
    "missions.createTask.capabilityRequirements"
  );
  const assignedAgentId = optionalString(body, "assignedAgentId", "missions.createTask");
  const assignedAgentVersion = optionalString(body, "assignedAgentVersion", "missions.createTask");
  const dependsOn = parseOptionalStringArray(body.dependsOn, "missions.createTask.dependsOn");
  const sourceRunId = optionalString(body, "sourceRunId", "missions.createTask");
  const createdBy = optionalString(body, "createdBy", "missions.createTask");
  const workspaceId = optionalString(body, "workspaceId", "missions.createTask");
  const position = parseOptionalPosition(body.position, "missions.createTask.position");
  return {
    ...(id ? { id } : {}),
    title: requireString(body, "title", "missions.createTask"),
    ...(description !== undefined ? { description } : {}),
    ...(status ? { status } : {}),
    ...(capabilityRequirements ? { capabilityRequirements } : {}),
    ...(assignedAgentId ? { assignedAgentId } : {}),
    ...(assignedAgentVersion ? { assignedAgentVersion } : {}),
    ...(body.inputs !== undefined ? { inputs: body.inputs } : {}),
    ...(dependsOn ? { dependsOn } : {}),
    ...(sourceRunId ? { sourceRunId } : {}),
    ...(workspaceId ? { workspaceId } : {}),
    ...(body.provenance !== undefined ? { provenance: body.provenance } : {}),
    ...(createdBy ? { createdBy } : {}),
    ...(position !== undefined ? { position } : {})
  };
}

export function parseMissionWorkbenchRunRequest(body: Record<string, unknown>): MissionWorkbenchMissionRunRequest {
  const runId = optionalString(body, "runId", "missions.run");
  return {
    ...(runId ? { runId } : {})
  };
}

function parseOptionalStringArray(value: unknown, context: string): string[] | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (!Array.isArray(value)) {
    throw new AthenaError("CONFIG_ERROR", `${context} must be an array when provided.`);
  }
  const values = value.map((item, index) => {
    if (typeof item !== "string" || item.trim().length === 0) {
      throw new AthenaError("CONFIG_ERROR", `${context}[${index}] must be a non-empty string.`);
    }
    return item.trim();
  });
  return Array.from(new Set(values));
}

function parseOptionalMissionStatusValue(value: unknown, context: string): MissionWorkbenchMissionStatus | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value !== "string") {
    throw new AthenaError("CONFIG_ERROR", `${context} must be a string when provided.`);
  }
  const trimmed = value.trim();
  if (!MISSION_WORKBENCH_STATUSES.includes(trimmed as MissionWorkbenchMissionStatus)) {
    throw new AthenaError("CONFIG_ERROR", `${context} must be one of: ${MISSION_WORKBENCH_STATUSES.join(", ")}.`);
  }
  return trimmed as MissionWorkbenchMissionStatus;
}

function parseOptionalTaskStatusValue(value: unknown, context: string): TaskWorkbenchTaskStatus | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value !== "string") {
    throw new AthenaError("CONFIG_ERROR", `${context} must be a string when provided.`);
  }
  const trimmed = value.trim();
  if (!TASK_WORKBENCH_STATUSES.includes(trimmed as TaskWorkbenchTaskStatus)) {
    throw new AthenaError("CONFIG_ERROR", `${context} must be one of: ${TASK_WORKBENCH_STATUSES.join(", ")}.`);
  }
  return trimmed as TaskWorkbenchTaskStatus;
}

function parseOptionalPosition(value: unknown, context: string): number | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    throw new AthenaError("CONFIG_ERROR", `${context} must be a non-negative integer when provided.`);
  }
  return value;
}

function parseOptionalBooleanQuery(value: string | null, context: string): boolean | undefined {
  if (!value) {
    return undefined;
  }
  const normalized = value.trim().toLowerCase();
  if (normalized === "true" || normalized === "1") {
    return true;
  }
  if (normalized === "false" || normalized === "0") {
    return false;
  }
  throw new AthenaError("CONFIG_ERROR", `${context} must be true or false when provided.`);
}
