import { apiClient } from "../../services";
import type {
  Workspace,
  WorkspaceCreateRequest,
  WorkspaceDeleteResult,
  WorkspaceListResult,
  WorkspaceUpdateRequest,
} from "./types";

type RecordValue = Record<string, unknown>;

function isRecord(value: unknown): value is RecordValue {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseWorkspace(value: unknown): Workspace {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    typeof value.name !== "string" ||
    typeof value.slug !== "string"
  ) {
    throw new Error("Workspace payload is invalid.");
  }
  return {
    id: value.id,
    name: value.name,
    slug: value.slug,
    createdAt: typeof value.createdAt === "string" ? value.createdAt : new Date(0).toISOString(),
    updatedAt: typeof value.updatedAt === "string" ? value.updatedAt : new Date(0).toISOString(),
  };
}

export async function fetchWorkspaces(): Promise<WorkspaceListResult> {
  const payload = await apiClient.get<unknown>("/v1/workspaces");
  if (!isRecord(payload) || !Array.isArray(payload.workspaces)) {
    throw new Error("Workspace list payload is invalid.");
  }
  return {
    workspaces: payload.workspaces.map(parseWorkspace),
    total: typeof payload.total === "number" ? payload.total : payload.workspaces.length,
  };
}

export async function createWorkspace(request: WorkspaceCreateRequest): Promise<Workspace> {
  return parseWorkspace(await apiClient.post<unknown>("/v1/workspaces", request));
}

export async function updateWorkspace(id: string, request: WorkspaceUpdateRequest): Promise<Workspace> {
  return parseWorkspace(await apiClient.put<unknown>(`/v1/workspaces/${encodeURIComponent(id)}`, request));
}

export async function deleteWorkspace(id: string): Promise<WorkspaceDeleteResult> {
  return apiClient.delete<WorkspaceDeleteResult>(`/v1/workspaces/${encodeURIComponent(id)}`);
}
