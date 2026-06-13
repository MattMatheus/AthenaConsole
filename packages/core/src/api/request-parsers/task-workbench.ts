import type { URL } from "node:url";
import { AthenaError } from "../../runtime/errors.js";
import {
  TASK_WORKBENCH_STATUSES,
  type TaskWorkbenchTaskCreateRequest,
  type TaskWorkbenchTaskListQuery,
  type TaskWorkbenchTaskRunCancelRequest,
  type TaskWorkbenchTaskRunRequest,
  type TaskWorkbenchTaskStatus,
  type TaskWorkbenchTaskUpdateRequest
} from "../../shared/contracts.js";
import { optionalString, requireString } from "../validation.js";

export function parseTaskWorkbenchListQuery(requestUrl: URL): TaskWorkbenchTaskListQuery {
  const status = parseOptionalTaskStatus(requestUrl.searchParams.get("status"), "tasks.list.status");
  const missionId = requestUrl.searchParams.get("missionId")?.trim();
  const workspaceId = requestUrl.searchParams.get("workspaceId")?.trim();
  const includeArchived = parseOptionalBooleanQuery(
    requestUrl.searchParams.get("includeArchived"),
    "tasks.list.includeArchived"
  );
  return {
    ...(status ? { status } : {}),
    ...(missionId ? { missionId } : {}),
    ...(workspaceId ? { workspaceId } : {}),
    ...(includeArchived !== undefined ? { includeArchived } : {})
  };
}

export function parseTaskWorkbenchCreateRequest(body: Record<string, unknown>): TaskWorkbenchTaskCreateRequest {
  const status = parseOptionalTaskStatusValue(body.status, "tasks.create.status");
  const id = optionalString(body, "id", "tasks.create");
  return {
    ...(id ? { id } : {}),
    title: requireString(body, "title", "tasks.create"),
    ...parseTaskWorkbenchMutationFields(body, "tasks.create"),
    ...(status ? { status } : {})
  };
}

export function parseTaskWorkbenchUpdateRequest(body: Record<string, unknown>): TaskWorkbenchTaskUpdateRequest {
  const status = parseOptionalTaskStatusValue(body.status, "tasks.update.status");
  return {
    ...parseTaskWorkbenchMutationFields(body, "tasks.update"),
    ...(status ? { status } : {})
  };
}

export function parseTaskWorkbenchRunRequest(body: Record<string, unknown>): TaskWorkbenchTaskRunRequest {
  const runId = optionalString(body, "runId", "tasks.run");
  return {
    ...(runId ? { runId } : {})
  };
}

export function parseTaskWorkbenchCancelRunRequest(body: Record<string, unknown>): TaskWorkbenchTaskRunCancelRequest {
  const reason = optionalString(body, "reason", "taskRuns.cancel");
  return {
    ...(reason ? { reason } : {})
  };
}

function parseTaskWorkbenchMutationFields(
  body: Record<string, unknown>,
  context: string
): Omit<TaskWorkbenchTaskUpdateRequest, "status"> {
  const title = optionalString(body, "title", context);
  const description = optionalString(body, "description", context);
  const capabilityRequirements = parseOptionalStringArray(
    body.capabilityRequirements,
    `${context}.capabilityRequirements`
  );
  const assignedAgentId = optionalString(body, "assignedAgentId", context);
  const assignedAgentVersion = optionalString(body, "assignedAgentVersion", context);
  const dependsOn = parseOptionalStringArray(body.dependsOn, `${context}.dependsOn`);
  const missionId = optionalString(body, "missionId", context);
  const sourceRunId = optionalString(body, "sourceRunId", context);
  const createdBy = optionalString(body, "createdBy", context);
  const workspaceId = optionalString(body, "workspaceId", context);
  return {
    ...(title ? { title } : {}),
    ...(description ? { description } : {}),
    ...(capabilityRequirements ? { capabilityRequirements } : {}),
    ...(assignedAgentId ? { assignedAgentId } : {}),
    ...(assignedAgentVersion ? { assignedAgentVersion } : {}),
    ...(body.inputs !== undefined ? { inputs: body.inputs } : {}),
    ...(dependsOn ? { dependsOn } : {}),
    ...(missionId ? { missionId } : {}),
    ...(sourceRunId ? { sourceRunId } : {}),
    ...(workspaceId ? { workspaceId } : {}),
    ...(body.provenance !== undefined ? { provenance: body.provenance } : {}),
    ...(createdBy ? { createdBy } : {})
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

function parseOptionalTaskStatus(value: string | null, context: string): TaskWorkbenchTaskStatus | undefined {
  if (!value) {
    return undefined;
  }
  return parseTaskStatus(value, context);
}

function parseOptionalTaskStatusValue(value: unknown, context: string): TaskWorkbenchTaskStatus | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value !== "string") {
    throw new AthenaError("CONFIG_ERROR", `${context} must be a string when provided.`);
  }
  return parseTaskStatus(value, context);
}

function parseTaskStatus(value: string, context: string): TaskWorkbenchTaskStatus {
  const trimmed = value.trim();
  if (!TASK_WORKBENCH_STATUSES.includes(trimmed as TaskWorkbenchTaskStatus)) {
    throw new AthenaError("CONFIG_ERROR", `${context} must be one of: ${TASK_WORKBENCH_STATUSES.join(", ")}.`);
  }
  return trimmed as TaskWorkbenchTaskStatus;
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
