import { execFile } from "node:child_process";
import { existsSync, mkdirSync, statSync } from "node:fs";
import { basename, dirname, isAbsolute, resolve } from "node:path";
import { promisify } from "node:util";
import { randomUUID } from "node:crypto";
import { AthenaError } from "../../runtime/errors.js";
import type { AthenaConfig } from "../../shared/config.js";
import type {
  ConnectedRepository,
  ConnectedRepositoryCreateRequest,
  ConnectedRepositoryDeleteResult,
  ConnectedRepositoryInspection,
  ConnectedRepositoryListResult,
  ConnectedRepositoryStatus
} from "../../shared/contracts.js";
import type { AppStateDatabase, ConnectedRepositoryRecord } from "../app-state/index.js";
import { openAppStateDatabase } from "../app-state/index.js";
import type { ConnectedRepositoryService } from "../interfaces.js";

const execFileAsync = promisify(execFile);

interface GitInspectionResult {
  status: ConnectedRepositoryStatus;
  dirtyState: "clean" | "dirty" | "unknown";
  statusMessage?: string;
  currentBranch?: string;
  headCommit?: string;
  remoteUrl?: string;
}

export class LocalConnectedRepositoryService implements ConnectedRepositoryService {
  constructor(private readonly config: AthenaConfig) {}

  async list(options: { workspaceId?: string; workspaceIds?: string[] } = {}): Promise<ConnectedRepositoryListResult> {
    return this.withAppState((appState) => {
      const repositories = appState.connectedRepositories.list(options).map(mapRepositoryRecord);
      return {
        repositories,
        total: repositories.length
      };
    });
  }

  async get(id: string): Promise<ConnectedRepository> {
    return this.withAppState((appState) => {
      const repository = appState.connectedRepositories.get(id);
      if (!repository) {
        throw new AthenaError("PROVIDER_NOT_FOUND", `Connected repository not found: ${id}`);
      }
      return mapRepositoryRecord(repository);
    });
  }

  async create(request: ConnectedRepositoryCreateRequest): Promise<ConnectedRepository> {
    if (request.sourceType === "managed-clone") {
      return await this.createManagedClone(request);
    }
    if (!request.workspacePath) {
      throw new AthenaError("CONFIG_ERROR", "repositories.create.workspacePath is required for existing-path repositories.");
    }
    const workspacePath = request.workspacePath;
    assertAbsolutePath(workspacePath, "repositories.create.workspacePath");
    if (request.hostPath) {
      assertAbsolutePath(request.hostPath, "repositories.create.hostPath");
    }
    return await this.withAppStateAsync(async (appState) => {
      const inspected = await inspectGitRepositoryPath(workspacePath);
      try {
        const repository = appState.connectedRepositories.create({
          id: request.id ?? `repo-${randomUUID()}`,
          name: request.name,
          sourceType: request.sourceType,
          workspacePath,
          ...(request.hostPath ? { hostPath: request.hostPath } : {}),
          remoteUrl: request.remoteUrl ?? inspected.remoteUrl,
          ...(request.defaultBranch ? { defaultBranch: request.defaultBranch } : {}),
          ...(request.workspaceId ? { workspaceId: request.workspaceId } : {}),
          status: inspected.status,
          dirtyState: inspected.dirtyState,
          ...(inspected.statusMessage ? { statusMessage: inspected.statusMessage } : {})
        });
        return mapRepositoryRecord(applyInspection(appState, repository.id, inspected) ?? repository);
      } catch (error) {
        throw normalizeRepositoryError(error);
      }
    });
  }

  private async createManagedClone(request: ConnectedRepositoryCreateRequest): Promise<ConnectedRepository> {
    if (!request.remoteUrl) {
      throw new AthenaError("CONFIG_ERROR", "repositories.create.remoteUrl is required for managed-clone repositories.");
    }
    const source = normalizeCloneSource(request.remoteUrl);
    const repositoryId = request.id ?? `repo-${randomUUID()}`;
    const workspacePath = resolveManagedClonePath(this.config, repositoryId, request.name);
    if (existsSync(workspacePath)) {
      throw new AthenaError("CONFIG_ERROR", `Managed repository destination already exists: ${workspacePath}`);
    }

    return await this.withAppStateAsync(async (appState) => {
      try {
        await cloneRepository(source, workspacePath);
      } catch (error) {
        const statusMessage = cloneErrorMessage(error);
        try {
          const failed = appState.connectedRepositories.create({
            id: repositoryId,
            name: request.name,
            sourceType: "managed-clone",
            workspacePath,
            remoteUrl: request.remoteUrl,
            ...(request.defaultBranch ? { defaultBranch: request.defaultBranch } : {}),
            ...(request.workspaceId ? { workspaceId: request.workspaceId } : {}),
            status: "error",
            dirtyState: "unknown",
            statusMessage
          });
          return mapRepositoryRecord(failed);
        } catch (repositoryError) {
          throw normalizeRepositoryError(repositoryError);
        }
      }

      const inspected = await inspectGitRepositoryPath(workspacePath);
      try {
        const repository = appState.connectedRepositories.create({
          id: repositoryId,
          name: request.name,
          sourceType: "managed-clone",
          workspacePath,
          remoteUrl: request.remoteUrl,
          ...(request.defaultBranch ? { defaultBranch: request.defaultBranch } : {}),
          ...(request.workspaceId ? { workspaceId: request.workspaceId } : {}),
          status: inspected.status,
          dirtyState: inspected.dirtyState,
          ...(inspected.statusMessage ? { statusMessage: inspected.statusMessage } : {})
        });
        return mapRepositoryRecord(applyInspection(appState, repository.id, inspected) ?? repository);
      } catch (error) {
        throw normalizeRepositoryError(error);
      }
    });
  }

  async delete(id: string): Promise<ConnectedRepositoryDeleteResult> {
    return this.withAppState((appState) => ({
      id,
      deleted: appState.connectedRepositories.delete(id)
    }));
  }

  async inspectPath(workspacePath: string): Promise<ConnectedRepositoryInspection> {
    assertAbsolutePath(workspacePath, "repositories.inspect.workspacePath");
    const inspectedAt = new Date().toISOString();
    const inspected = await inspectGitRepositoryPath(workspacePath);
    return {
      path: workspacePath,
      status: inspected.status,
      dirtyState: inspected.dirtyState,
      ...(inspected.statusMessage ? { statusMessage: inspected.statusMessage } : {}),
      ...(inspected.currentBranch ? { currentBranch: inspected.currentBranch } : {}),
      ...(inspected.headCommit ? { headCommit: inspected.headCommit } : {}),
      ...(inspected.remoteUrl ? { remoteUrl: inspected.remoteUrl } : {}),
      inspectedAt
    };
  }

  async inspect(id: string): Promise<ConnectedRepositoryInspection> {
    return await this.withAppStateAsync(async (appState) => {
      const repository = appState.connectedRepositories.get(id);
      if (!repository) {
        throw new AthenaError("PROVIDER_NOT_FOUND", `Connected repository not found: ${id}`);
      }
      const inspectedAt = new Date().toISOString();
      const inspected = await inspectGitRepositoryPath(repository.workspacePath);
      const updated = applyInspection(appState, repository.id, inspected, inspectedAt) ?? repository;
      return {
        repository: mapRepositoryRecord(updated),
        path: repository.workspacePath,
        status: inspected.status,
        dirtyState: inspected.dirtyState,
        ...(inspected.statusMessage ? { statusMessage: inspected.statusMessage } : {}),
        ...(inspected.currentBranch ? { currentBranch: inspected.currentBranch } : {}),
        ...(inspected.headCommit ? { headCommit: inspected.headCommit } : {}),
        ...(inspected.remoteUrl ? { remoteUrl: inspected.remoteUrl } : {}),
        inspectedAt
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

  private async withAppStateAsync<T>(callback: (appState: AppStateDatabase) => Promise<T>): Promise<T> {
    const appState = openAppStateDatabase(this.config);
    try {
      return await callback(appState);
    } finally {
      appState.close();
    }
  }
}

function applyInspection(
  appState: AppStateDatabase,
  id: string,
  inspected: GitInspectionResult,
  inspectedAt = new Date().toISOString()
): ConnectedRepositoryRecord | undefined {
  return appState.connectedRepositories.update(id, {
    status: inspected.status,
    dirtyState: inspected.dirtyState,
    currentBranch: inspected.currentBranch,
    headCommit: inspected.headCommit,
    remoteUrl: inspected.remoteUrl,
    statusMessage: inspected.statusMessage,
    lastInspectedAt: inspectedAt
  });
}

async function inspectGitRepositoryPath(workspacePath: string): Promise<GitInspectionResult> {
  if (!existsSync(workspacePath)) {
    return {
      status: "missing",
      dirtyState: "unknown",
      statusMessage: "Path does not exist."
    };
  }
  try {
    if (!statSync(workspacePath).isDirectory()) {
      return {
        status: "invalid",
        dirtyState: "unknown",
        statusMessage: "Path is not a directory."
      };
    }
  } catch (error) {
    return {
      status: "error",
      dirtyState: "unknown",
      statusMessage: error instanceof Error ? error.message : "Unable to inspect path."
    };
  }

  const inside = await git(workspacePath, ["rev-parse", "--is-inside-work-tree"]);
  if (inside.status !== "ok" || inside.stdout.trim() !== "true") {
    return {
      status: "invalid",
      dirtyState: "unknown",
      statusMessage: "Path is not a Git work tree."
    };
  }

  const branch = await git(workspacePath, ["rev-parse", "--abbrev-ref", "HEAD"]);
  const head = await git(workspacePath, ["rev-parse", "HEAD"]);
  const status = await git(workspacePath, ["status", "--porcelain"]);
  const remote = await git(workspacePath, ["remote", "get-url", "origin"]);

  return {
    status: "ready",
    dirtyState: status.status === "ok" ? (status.stdout.trim().length > 0 ? "dirty" : "clean") : "unknown",
    ...(branch.status === "ok" ? { currentBranch: branch.stdout.trim() } : {}),
    ...(head.status === "ok" ? { headCommit: head.stdout.trim() } : {}),
    ...(remote.status === "ok" ? { remoteUrl: remote.stdout.trim() } : {})
  };
}

async function git(cwd: string, args: string[]): Promise<{ status: "ok" | "failed"; stdout: string; stderr: string }> {
  try {
    const result = await execFileAsync("git", args, {
      cwd,
      timeout: 5000,
      maxBuffer: 1024 * 1024
    });
    return {
      status: "ok",
      stdout: result.stdout,
      stderr: result.stderr
    };
  } catch (error) {
    const failure = error as { stdout?: string; stderr?: string };
    return {
      status: "failed",
      stdout: typeof failure.stdout === "string" ? failure.stdout : "",
      stderr: typeof failure.stderr === "string" ? failure.stderr : ""
    };
  }
}

async function cloneRepository(source: string, destination: string): Promise<void> {
  mkdirSync(dirname(destination), { recursive: true });
  await execFileAsync("git", ["clone", "--", source, destination], {
    timeout: 30_000,
    maxBuffer: 1024 * 1024
  });
}

function resolveManagedClonePath(config: AthenaConfig, id: string, name: string): string {
  const root = resolve(config.workspaceRoot, "repos", "managed");
  const slug = slugify(id || name);
  const destination = resolve(root, slug);
  const rootWithSeparator = root.endsWith("/") ? root : `${root}/`;
  if (destination !== root && !destination.startsWith(rootWithSeparator)) {
    throw new AthenaError("CONFIG_ERROR", "Managed repository destination escaped the managed repo root.");
  }
  return destination;
}

function slugify(value: string): string {
  const candidate = basename(value)
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return candidate || `repo-${randomUUID()}`;
}

function normalizeCloneSource(source: string): string {
  const trimmed = source.trim();
  if (isAbsolute(trimmed)) {
    return trimmed;
  }
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === "https:" || parsed.protocol === "http:") {
      return trimmed;
    }
  } catch {
    // Fall through to the unsupported-source error below.
  }
  throw new AthenaError(
    "CONFIG_ERROR",
    "repositories.create.remoteUrl for managed-clone must be a public HTTP(S) Git URL or an absolute local path."
  );
}

function cloneErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return `Git clone failed: ${error.message}`;
  }
  return "Git clone failed.";
}

function assertAbsolutePath(path: string, context: string): void {
  if (!isAbsolute(path)) {
    throw new AthenaError("CONFIG_ERROR", `${context} must be an absolute path.`);
  }
}

function mapRepositoryRecord(record: ConnectedRepositoryRecord): ConnectedRepository {
  return {
    id: record.id,
    name: record.name,
    sourceType: record.sourceType,
    workspacePath: record.workspacePath,
    ...(record.hostPath ? { hostPath: record.hostPath } : {}),
    ...(record.remoteUrl ? { remoteUrl: record.remoteUrl } : {}),
    ...(record.defaultBranch ? { defaultBranch: record.defaultBranch } : {}),
    ...(record.currentBranch ? { currentBranch: record.currentBranch } : {}),
    ...(record.headCommit ? { headCommit: record.headCommit } : {}),
    workspaceId: record.workspaceId,
    dirtyState: record.dirtyState,
    status: record.status,
    ...(record.statusMessage ? { statusMessage: record.statusMessage } : {}),
    ...(record.lastInspectedAt ? { lastInspectedAt: record.lastInspectedAt } : {}),
    createdAt: record.createdAt,
    updatedAt: record.updatedAt
  };
}

function normalizeRepositoryError(error: unknown): AthenaError {
  if (error instanceof AthenaError) {
    return error;
  }
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes("UNIQUE constraint failed")) {
    return new AthenaError("CONFIG_ERROR", "Connected repository id already exists.");
  }
  return new AthenaError("PROVIDER_ERROR", message, true, error);
}
