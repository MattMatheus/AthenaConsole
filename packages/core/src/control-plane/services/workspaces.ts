import { randomUUID } from "node:crypto";
import { AthenaError } from "../../runtime/errors.js";
import type { AthenaConfig } from "../../shared/config.js";
import type {
  Workspace,
  WorkspaceCreateRequest,
  WorkspaceDeleteResult,
  WorkspaceListResult,
  WorkspaceUpdateRequest
} from "../../shared/contracts.js";
import type { AppStateDatabase, WorkspaceRecord } from "../app-state/index.js";
import { openAppStateDatabase } from "../app-state/index.js";
import type { WorkspaceService } from "../interfaces.js";

const DEFAULT_WORKSPACE_ID = "default";

export class LocalWorkspaceService implements WorkspaceService {
  constructor(private readonly config: AthenaConfig) {}

  async list(): Promise<WorkspaceListResult> {
    return this.withAppState((appState) => {
      const workspaces = appState.workspaces.list().map(mapWorkspaceRecord);
      return {
        workspaces,
        total: workspaces.length
      };
    });
  }

  async get(id: string): Promise<Workspace> {
    return this.withAppState((appState) => {
      const workspace = appState.workspaces.get(id);
      if (!workspace) {
        throw new AthenaError("PROVIDER_NOT_FOUND", `Workspace not found: ${id}`);
      }
      return mapWorkspaceRecord(workspace);
    });
  }

  async create(request: WorkspaceCreateRequest): Promise<Workspace> {
    return this.withAppState((appState) => {
      const id = request.id ?? `workspace-${randomUUID()}`;
      const slug = request.slug ?? slugFromName(request.name);
      try {
        return mapWorkspaceRecord(
          appState.workspaces.create({
            id,
            name: request.name,
            slug
          })
        );
      } catch (error) {
        throw normalizeWorkspaceError(error);
      }
    });
  }

  async update(id: string, request: WorkspaceUpdateRequest): Promise<Workspace> {
    if (id === DEFAULT_WORKSPACE_ID && request.slug && request.slug !== DEFAULT_WORKSPACE_ID) {
      throw new AthenaError("CONFIG_ERROR", "The default workspace slug cannot be changed.");
    }
    return this.withAppState((appState) => {
      try {
        const updated = appState.workspaces.update(id, request);
        if (!updated) {
          throw new AthenaError("PROVIDER_NOT_FOUND", `Workspace not found: ${id}`);
        }
        return mapWorkspaceRecord(updated);
      } catch (error) {
        throw normalizeWorkspaceError(error);
      }
    });
  }

  async delete(id: string): Promise<WorkspaceDeleteResult> {
    if (id === DEFAULT_WORKSPACE_ID) {
      throw new AthenaError("CONFIG_ERROR", "The default workspace cannot be deleted.");
    }
    return this.withAppState((appState) => {
      const existing = appState.workspaces.get(id);
      if (!existing) {
        return { id, deleted: false };
      }
      if (appState.workspaces.hasLiveRecords(id)) {
        throw new AthenaError("CONFIG_ERROR", `Workspace '${id}' has live records and cannot be deleted.`);
      }
      return {
        id,
        deleted: appState.workspaces.delete(id)
      };
    });
  }

  private withAppState<T>(callback: (appState: AppStateDatabase) => T): T {
    const appState = openAppStateDatabase(this.config);
    try {
      return callback(appState);
    } finally {
      appState.close();
    }
  }
}

function mapWorkspaceRecord(record: WorkspaceRecord): Workspace {
  return {
    id: record.id,
    name: record.name,
    slug: record.slug,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt
  };
}

function slugFromName(name: string): string {
  const normalized = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return normalized.length >= 2 ? normalized : `workspace-${randomUUID().slice(0, 8)}`;
}

function normalizeWorkspaceError(error: unknown): AthenaError {
  if (error instanceof AthenaError) {
    return error;
  }
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes("UNIQUE constraint failed: workspaces.slug")) {
    return new AthenaError("CONFIG_ERROR", "Workspace slug already exists.");
  }
  if (message.includes("UNIQUE constraint failed: workspaces.id")) {
    return new AthenaError("CONFIG_ERROR", "Workspace id already exists.");
  }
  return new AthenaError("PROVIDER_ERROR", message, true, error);
}
