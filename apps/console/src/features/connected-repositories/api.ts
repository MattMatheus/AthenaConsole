import { apiClient } from "../../services";
import type {
  ConnectedRepository,
  ConnectedRepositoryCreateRequest,
  ConnectedRepositoryDirtyState,
  ConnectedRepositoryInspection,
  ConnectedRepositoryListResult,
  ConnectedRepositorySourceType,
  ConnectedRepositoryStatus,
} from "./types";

type RecordValue = Record<string, unknown>;

function isRecord(value: unknown): value is RecordValue {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function sourceType(value: unknown): ConnectedRepositorySourceType {
  return value === "managed-clone" ? "managed-clone" : "existing-path";
}

function repositoryStatus(value: unknown): ConnectedRepositoryStatus {
  return value === "ready" ||
    value === "missing" ||
    value === "invalid" ||
    value === "auth-required" ||
    value === "error"
    ? value
    : "error";
}

function dirtyState(value: unknown): ConnectedRepositoryDirtyState {
  return value === "clean" || value === "dirty" || value === "unknown" ? value : "unknown";
}

function parseRepository(value: unknown): ConnectedRepository {
  if (!isRecord(value) || typeof value.id !== "string" || typeof value.name !== "string") {
    throw new Error("Repository payload is invalid.");
  }
  const hostPath = optionalString(value.hostPath);
  const remoteUrl = optionalString(value.remoteUrl);
  const defaultBranch = optionalString(value.defaultBranch);
  const currentBranch = optionalString(value.currentBranch);
  const headCommit = optionalString(value.headCommit);
  const statusMessage = optionalString(value.statusMessage);
  const lastInspectedAt = optionalString(value.lastInspectedAt);
  return {
    id: value.id,
    name: value.name,
    sourceType: sourceType(value.sourceType),
    workspacePath: typeof value.workspacePath === "string" ? value.workspacePath : "",
    ...(hostPath ? { hostPath } : {}),
    ...(remoteUrl ? { remoteUrl } : {}),
    ...(defaultBranch ? { defaultBranch } : {}),
    ...(currentBranch ? { currentBranch } : {}),
    ...(headCommit ? { headCommit } : {}),
    dirtyState: dirtyState(value.dirtyState),
    status: repositoryStatus(value.status),
    ...(statusMessage ? { statusMessage } : {}),
    ...(lastInspectedAt ? { lastInspectedAt } : {}),
    createdAt: typeof value.createdAt === "string" ? value.createdAt : new Date(0).toISOString(),
    updatedAt: typeof value.updatedAt === "string" ? value.updatedAt : new Date(0).toISOString(),
  };
}

function parseInspection(value: unknown): ConnectedRepositoryInspection {
  if (!isRecord(value) || typeof value.path !== "string") {
    throw new Error("Repository inspection payload is invalid.");
  }
  const statusMessage = optionalString(value.statusMessage);
  const currentBranch = optionalString(value.currentBranch);
  const headCommit = optionalString(value.headCommit);
  const remoteUrl = optionalString(value.remoteUrl);
  return {
    ...(isRecord(value.repository) ? { repository: parseRepository(value.repository) } : {}),
    path: value.path,
    status: repositoryStatus(value.status),
    dirtyState: dirtyState(value.dirtyState),
    ...(statusMessage ? { statusMessage } : {}),
    ...(currentBranch ? { currentBranch } : {}),
    ...(headCommit ? { headCommit } : {}),
    ...(remoteUrl ? { remoteUrl } : {}),
    inspectedAt: typeof value.inspectedAt === "string" ? value.inspectedAt : new Date(0).toISOString(),
  };
}

export async function fetchConnectedRepositories(): Promise<ConnectedRepositoryListResult> {
  const payload = await apiClient.get<unknown>("/v1/repositories");
  if (!isRecord(payload) || !Array.isArray(payload.repositories)) {
    throw new Error("Repository list payload is invalid.");
  }
  return {
    repositories: payload.repositories.map(parseRepository),
    total: typeof payload.total === "number" ? payload.total : payload.repositories.length,
  };
}

export async function createConnectedRepository(
  request: ConnectedRepositoryCreateRequest,
): Promise<ConnectedRepository> {
  return parseRepository(await apiClient.post<unknown>("/v1/repositories", request));
}

export async function inspectConnectedRepository(id: string): Promise<ConnectedRepositoryInspection> {
  return parseInspection(await apiClient.post<unknown>(`/v1/repositories/${encodeURIComponent(id)}/inspect`));
}
