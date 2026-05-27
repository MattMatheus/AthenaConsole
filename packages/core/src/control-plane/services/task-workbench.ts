import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { randomUUID } from "node:crypto";
import { isAbsolute, resolve } from "node:path";
import { AthenaError } from "../../runtime/errors.js";
import type { AthenaConfig } from "../../shared/config.js";
import type {
  TaskWorkbenchMetadata,
  TaskWorkbenchArtifactMetadata,
  TaskWorkbenchRunEvent,
  TaskWorkbenchTask,
  TaskWorkbenchTaskCreateRequest,
  TaskWorkbenchTaskListQuery,
  TaskWorkbenchTaskListResult,
  TaskWorkbenchTaskRun,
  TaskWorkbenchTaskRunCancelRequest,
  TaskWorkbenchTaskRunCancelResult,
  TaskWorkbenchTaskRunDetail,
  TaskWorkbenchTaskRunRequest,
  TaskWorkbenchTaskUpdateRequest
} from "../../shared/contracts.js";
import { TASK_WORKBENCH_STATUSES } from "../../shared/contracts.js";
import type {
  AgentIndexRecord,
  AppStateDatabase,
  ArtifactMetadataRecord,
  PluginIndexRecord,
  RunEventRecord,
  RunRecord,
  TaskRecord
} from "../app-state/index.js";
import { openAppStateDatabase } from "../app-state/index.js";
import type { TaskWorkbenchService } from "../interfaces.js";

export interface LocalTaskWorkbenchServiceOptions {
  appState?: AppStateDatabase;
}

interface ActiveTaskRun {
  child: ChildProcessWithoutNullStreams;
  taskId: string;
  agentId: string;
  cancellationRequested: boolean;
}

interface AgentManifestDocument {
  agent?: {
    inputs?: Record<string, unknown>;
    implementation?: {
      type?: string;
      command?: string;
      args?: unknown[];
    };
    runtime?: {
      preferredBackend?: string;
      backendPreferences?: unknown[];
      workingDirectory?: string;
    };
  };
}

interface AgentRunEnvelope {
  output: unknown;
  artifacts: AgentRunArtifact[];
}

interface AgentRunArtifact {
  id?: string;
  label: string;
  kind: string;
  format: string;
  storageUri: string;
  sizeBytes?: number;
  hash?: string;
  metadata?: unknown;
  schemaValidation?: unknown;
}

export class LocalTaskWorkbenchService implements TaskWorkbenchService {
  private readonly activeRuns = new Map<string, ActiveTaskRun>();

  constructor(
    private readonly config: AthenaConfig,
    private readonly options: LocalTaskWorkbenchServiceOptions = {}
  ) {}

  async metadata(): Promise<TaskWorkbenchMetadata> {
    return {
      statuses: TASK_WORKBENCH_STATUSES,
      defaultStatus: "draft",
      readyRequiresAssignedAgent: true
    };
  }

  async list(query: TaskWorkbenchTaskListQuery = {}): Promise<TaskWorkbenchTaskListResult> {
    return this.withAppState((appState) => {
      const tasks = appState.tasks.list(query).map(mapTaskRecord);
      return {
        tasks,
        total: tasks.length,
        filters: query
      };
    });
  }

  async get(id: string): Promise<TaskWorkbenchTask> {
    return this.withAppState((appState) => {
      const task = appState.tasks.get(id);
      if (!task) {
        throw new AthenaError("PROVIDER_NOT_FOUND", `Task not found: ${id}`);
      }
      return mapTaskRecord(task);
    });
  }

  async create(request: TaskWorkbenchTaskCreateRequest): Promise<TaskWorkbenchTask> {
    return this.withAppState((appState) => {
      validateReadyAssignment(request.status ?? "draft", request.assignedAgentId);
      validateCompatibleAssignment(appState, request.assignedAgentId, request.assignedAgentVersion, request.capabilityRequirements ?? []);
      try {
        return mapTaskRecord(
          appState.tasks.create({
            id: request.id ?? `task-${randomUUID()}`,
            title: request.title,
            ...(request.description !== undefined ? { description: request.description } : {}),
            ...(request.status !== undefined ? { status: request.status } : {}),
            ...(request.capabilityRequirements !== undefined ? { capabilityRequirements: request.capabilityRequirements } : {}),
            ...(request.assignedAgentId !== undefined ? { assignedAgentId: request.assignedAgentId } : {}),
            ...(request.assignedAgentVersion !== undefined ? { assignedAgentVersion: request.assignedAgentVersion } : {}),
            ...(request.inputs !== undefined ? { inputs: request.inputs } : {}),
            ...(request.dependsOn !== undefined ? { dependsOn: request.dependsOn } : {}),
            ...(request.missionId !== undefined ? { missionId: request.missionId } : {}),
            ...(request.sourceRunId !== undefined ? { sourceRunId: request.sourceRunId } : {}),
            ...(request.provenance !== undefined ? { provenance: request.provenance } : {}),
            ...(request.createdBy !== undefined ? { createdBy: request.createdBy } : {})
          })
        );
      } catch (error) {
        throw normalizeTaskRepositoryError(error);
      }
    });
  }

  async update(id: string, request: TaskWorkbenchTaskUpdateRequest): Promise<TaskWorkbenchTask> {
    return this.withAppState((appState) => {
      const existing = appState.tasks.get(id);
      if (!existing) {
        throw new AthenaError("PROVIDER_NOT_FOUND", `Task not found: ${id}`);
      }
      const nextStatus = request.status ?? existing.status;
      const nextAssignedAgentId = request.assignedAgentId ?? existing.assignedAgentId;
      const nextAssignedAgentVersion = request.assignedAgentVersion ?? existing.assignedAgentVersion;
      const nextCapabilities = request.capabilityRequirements ?? existing.capabilityRequirements;
      validateReadyAssignment(nextStatus, nextAssignedAgentId);
      validateCompatibleAssignment(appState, nextAssignedAgentId, nextAssignedAgentVersion, nextCapabilities);
      try {
        return mapTaskRecord(appState.tasks.update(id, request));
      } catch (error) {
        throw normalizeTaskRepositoryError(error);
      }
    });
  }

  async getRun(runId: string): Promise<TaskWorkbenchTaskRunDetail> {
    return this.withAppState((appState) => {
      const run = appState.runs.get(runId);
      if (!run || run.targetType !== "task") {
        throw new AthenaError("PROVIDER_NOT_FOUND", `Task run not found: ${runId}`);
      }
      const task = appState.tasks.get(run.targetId);
      return {
        run: mapRunRecord(run),
        ...(task ? { task: mapTaskRecord(task) } : {}),
        events: appState.runEvents.listForRun(run.id).map(mapRunEventRecord),
        artifacts: appState.artifacts.listForRun(run.id).map(mapArtifactMetadataRecord)
      };
    });
  }

  async runTask(id: string, request: TaskWorkbenchTaskRunRequest = {}): Promise<TaskWorkbenchTaskRun> {
    return this.withAppStateAsync(async (appState) => {
      const task = requireTask(appState, id);
      if (task.status !== "ready") {
        throw new AthenaError("CONFIG_ERROR", `Task ${id} must be ready before it can run.`);
      }
      if (!task.assignedAgentId) {
        throw new AthenaError("CONFIG_ERROR", "ready tasks require assignedAgentId");
      }
      const { agent, plugin } = requireAssignedAgent(appState, task.assignedAgentId, task.assignedAgentVersion);
      validateCompatibleAssignment(appState, agent.id, agent.version, task.capabilityRequirements);
      const manifest = normalizeAgentManifest(agent.manifest);
      validateTaskInputs(manifest.agent?.inputs, task.inputs);
      const command = resolveLocalCommand(manifest, plugin);
      const runId = request.runId ?? `run-${randomUUID()}`;
      const startedAt = new Date().toISOString();
      let run = appState.runs.create({
        id: runId,
        targetType: "task",
        targetId: task.id,
        status: "running",
        backend: "local-process",
        agentId: agent.id,
        agentVersion: agent.version,
        startedAt
      });
      appState.tasks.update(task.id, { status: "running" });
      appendRunEvent(appState, run.id, task, agent.id, "run.validated", "Task inputs validated.", {
        inputKeys: Object.keys(isRecord(task.inputs) ? task.inputs : {})
      });
      appendRunEvent(appState, run.id, task, agent.id, "run.started", "Local process task run started.", {
        backend: "local-process",
        command: command.command,
        args: command.args
      });

      let child: ChildProcessWithoutNullStreams;
      try {
        child = spawn(command.command, command.args, {
          cwd: command.cwd,
          env: process.env,
          stdio: ["pipe", "pipe", "pipe"]
        });
      } catch (error) {
        return failTaskRun(appState, run, task, agent.id, "Local process task run failed to start.", {
          phase: "start",
          error: error instanceof Error ? error.message : String(error)
        });
      }
      const active: ActiveTaskRun = {
        child,
        taskId: task.id,
        agentId: agent.id,
        cancellationRequested: false
      };
      this.activeRuns.set(run.id, active);
      const stdoutChunks: Buffer[] = [];
      const stderrChunks: Buffer[] = [];
      child.stdout.on("data", (chunk: Buffer) => {
        stdoutChunks.push(chunk);
        appendRunEvent(appState, run.id, task, agent.id, "run.log", chunk.toString("utf8"), {
          stream: "stdout"
        });
      });
      child.stderr.on("data", (chunk: Buffer) => {
        stderrChunks.push(chunk);
        appendRunEvent(appState, run.id, task, agent.id, "run.log", chunk.toString("utf8"), {
          stream: "stderr"
        });
      });
      child.stdin.end(JSON.stringify({ task, agent: { id: agent.id, version: agent.version }, run: { id: run.id } }));

      let exit: { code: number | null; signal: NodeJS.Signals | null };
      try {
        exit = await waitForExit(child);
      } catch (error) {
        this.activeRuns.delete(run.id);
        return failTaskRun(appState, run, task, agent.id, "Local process task run errored.", {
          phase: "process",
          error: error instanceof Error ? error.message : String(error)
        });
      }
      this.activeRuns.delete(run.id);
      const endedAt = new Date().toISOString();
      const stdout = Buffer.concat(stdoutChunks).toString("utf8");
      const stderr = Buffer.concat(stderrChunks).toString("utf8");
      if (active.cancellationRequested) {
        appState.tasks.update(task.id, { status: "cancelled" });
        run = appState.runs.update(run.id, {
          status: "cancelled",
          endedAt,
          failure: {
            reason: "cancelled",
            signal: exit.signal
          }
        });
        appendRunEvent(appState, run.id, task, agent.id, "run.cancelled", "Local process task run cancelled.", {
          signal: exit.signal
        });
        return mapRunRecord(run);
      }
      if (exit.code === 0) {
        let envelope: AgentRunEnvelope;
        try {
          envelope = parseAgentRunEnvelope(stdout);
        } catch (error) {
          return failTaskRun(appState, run, task, agent.id, "Local process task run returned invalid output.", {
            phase: "output",
            error: error instanceof Error ? error.message : String(error),
            stdout
          });
        }
        for (const artifact of envelope.artifacts) {
          try {
            const created = appState.artifacts.create({
              id: artifact.id ?? `artifact-${randomUUID()}`,
              runId: run.id,
              taskId: task.id,
              agentId: agent.id,
              label: artifact.label,
              kind: artifact.kind,
              format: artifact.format,
              storageUri: artifact.storageUri,
              ...(artifact.sizeBytes !== undefined ? { sizeBytes: artifact.sizeBytes } : {}),
              ...(artifact.hash ? { hash: artifact.hash } : {}),
              ...(artifact.metadata !== undefined ? { metadata: artifact.metadata } : {}),
              ...(artifact.schemaValidation !== undefined ? { schemaValidation: artifact.schemaValidation } : {})
            });
            appendRunEvent(appState, run.id, task, agent.id, "artifact.created", `Artifact created: ${created.label}`, {
              artifactId: created.id,
              storageUri: created.storageUri,
              format: created.format
            });
          } catch (error) {
            return failTaskRun(appState, run, task, agent.id, "Local process task run artifact persistence failed.", {
              phase: "artifact",
              error: error instanceof Error ? error.message : String(error),
              artifact
            });
          }
        }
        appState.tasks.update(task.id, { status: "completed" });
        run = appState.runs.update(run.id, {
          status: "completed",
          endedAt,
          output: envelope.output
        });
        appendRunEvent(appState, run.id, task, agent.id, "run.completed", "Local process task run completed.", {
          artifactCount: envelope.artifacts.length
        });
        return mapRunRecord(run);
      }
      appState.tasks.update(task.id, { status: "failed" });
      run = appState.runs.update(run.id, {
        status: "failed",
        endedAt,
        failure: {
          code: exit.code,
          signal: exit.signal,
          stderr
        }
      });
      appendRunEvent(appState, run.id, task, agent.id, "run.failed", "Local process task run failed.", {
        code: exit.code,
        signal: exit.signal
      });
      return mapRunRecord(run);
    });
  }

  async cancelRun(runId: string, request: TaskWorkbenchTaskRunCancelRequest = {}): Promise<TaskWorkbenchTaskRunCancelResult> {
    const active = this.activeRuns.get(runId);
    if (!active) {
      return {
        runId,
        status: "not-running"
      };
    }
    active.cancellationRequested = true;
    this.withAppState((appState) => {
      const task = appState.tasks.get(active.taskId);
      if (task) {
        appendRunEvent(appState, runId, task, active.agentId, "run.cancel.requested", request.reason ?? "Cancellation requested.", {
          ...(request.reason ? { reason: request.reason } : {})
        });
      }
    });
    active.child.kill("SIGTERM");
    return {
      runId,
      status: "cancelled"
    };
  }

  private withAppState<T>(access: (appState: AppStateDatabase) => T): T {
    if (this.options.appState) {
      return access(this.options.appState);
    }
    const appState = openAppStateDatabase(this.config);
    try {
      return access(appState);
    } finally {
      appState.close();
    }
  }

  private async withAppStateAsync<T>(access: (appState: AppStateDatabase) => Promise<T>): Promise<T> {
    if (this.options.appState) {
      return access(this.options.appState);
    }
    const appState = openAppStateDatabase(this.config);
    try {
      return await access(appState);
    } finally {
      appState.close();
    }
  }
}

function requireTask(appState: AppStateDatabase, id: string): TaskRecord {
  const task = appState.tasks.get(id);
  if (!task) {
    throw new AthenaError("PROVIDER_NOT_FOUND", `Task not found: ${id}`);
  }
  return task;
}

function requireAssignedAgent(
  appState: AppStateDatabase,
  assignedAgentId: string,
  assignedAgentVersion: string | undefined
): { agent: AgentIndexRecord; plugin: PluginIndexRecord } {
  const agent = appState.agents
    .list()
    .find((candidate) => candidate.id === assignedAgentId && (!assignedAgentVersion || candidate.version === assignedAgentVersion));
  if (!agent) {
    throw new AthenaError("CONFIG_ERROR", `assigned agent not found: ${assignedAgentId}`);
  }
  const plugin = appState.plugins.get(agent.pluginId, agent.pluginVersion);
  if (!plugin || !plugin.enabled || plugin.status !== "loaded" || agent.status !== "loaded") {
    throw new AthenaError("CONFIG_ERROR", `assigned agent is not available: ${assignedAgentId}`);
  }
  return { agent, plugin };
}

function validateReadyAssignment(status: string, assignedAgentId: string | undefined): void {
  if (status === "ready" && !assignedAgentId) {
    throw new AthenaError("CONFIG_ERROR", "ready tasks require assignedAgentId");
  }
}

function validateCompatibleAssignment(
  appState: AppStateDatabase,
  assignedAgentId: string | undefined,
  assignedAgentVersion: string | undefined,
  capabilityRequirements: string[]
): void {
  if (!assignedAgentId) {
    return;
  }
  const agent = appState.agents
    .list()
    .find((candidate) => candidate.id === assignedAgentId && (!assignedAgentVersion || candidate.version === assignedAgentVersion));
  if (!agent) {
    throw new AthenaError("CONFIG_ERROR", `assigned agent not found: ${assignedAgentId}`);
  }
  const plugin = appState.plugins.get(agent.pluginId, agent.pluginVersion);
  if (!plugin || !plugin.enabled || plugin.status !== "loaded" || agent.status !== "loaded") {
    throw new AthenaError("CONFIG_ERROR", `assigned agent is not available: ${assignedAgentId}`);
  }
  const missingCapabilities = capabilityRequirements.filter((capability) => !agent.capabilities.includes(capability));
  if (missingCapabilities.length > 0) {
    throw new AthenaError(
      "CONFIG_ERROR",
      `assigned agent ${assignedAgentId} does not satisfy capability requirements: ${missingCapabilities.join(", ")}`
    );
  }
}

function normalizeTaskRepositoryError(error: unknown): AthenaError {
  if (error instanceof AthenaError) {
    return error;
  }
  if (error instanceof Error && error.message.includes("ready tasks require assignedAgentId")) {
    return new AthenaError("CONFIG_ERROR", error.message);
  }
  return new AthenaError("PROVIDER_ERROR", error instanceof Error ? error.message : "Task repository failure", true, error);
}

function normalizeAgentManifest(manifest: unknown): AgentManifestDocument {
  return isRecord(manifest) ? (manifest as AgentManifestDocument) : {};
}

function resolveLocalCommand(
  manifest: AgentManifestDocument,
  plugin: PluginIndexRecord
): { command: string; args: string[]; cwd: string } {
  const implementation = manifest.agent?.implementation;
  if (implementation?.type !== "local-command") {
    throw new AthenaError("CONFIG_ERROR", "Task runs currently require an assigned local-command agent.");
  }
  if (!implementation.command?.trim()) {
    throw new AthenaError("CONFIG_ERROR", "local-command agents require implementation.command.");
  }
  const args = Array.isArray(implementation.args)
    ? implementation.args.map((arg, index) => {
        if (typeof arg !== "string") {
          throw new AthenaError("CONFIG_ERROR", `implementation.args[${index}] must be a string.`);
        }
        return arg;
      })
    : [];
  const backendPreferences = manifest.agent?.runtime?.backendPreferences;
  const preferredBackend = manifest.agent?.runtime?.preferredBackend;
  if (
    preferredBackend &&
    preferredBackend !== "local-process" &&
    !(Array.isArray(backendPreferences) && backendPreferences.includes("local-process"))
  ) {
    throw new AthenaError("CONFIG_ERROR", "Assigned agent does not declare local-process runtime compatibility.");
  }
  const pluginRoot = resolve(plugin.path);
  const workingDirectory = manifest.agent?.runtime?.workingDirectory ?? ".";
  const cwd = resolve(pluginRoot, workingDirectory);
  if (isAbsolute(workingDirectory) || !isPathInside(pluginRoot, cwd)) {
    throw new AthenaError("CONFIG_ERROR", "runtime.workingDirectory must stay inside the plugin directory.");
  }
  return {
    command: implementation.command,
    args,
    cwd
  };
}

function validateTaskInputs(inputContract: Record<string, unknown> | undefined, inputs: unknown): void {
  const values = isRecord(inputs) ? inputs : {};
  for (const [key, rawConfig] of Object.entries(inputContract ?? {})) {
    const config = isRecord(rawConfig) ? rawConfig : {};
    const required = config.required === true;
    const type = typeof config.type === "string" ? config.type : "string";
    const value = values[key];
    if (required && (value === undefined || value === null || value === "")) {
      throw new AthenaError("CONFIG_ERROR", `task.inputs.${key} is required.`);
    }
    if (value === undefined || value === null || value === "") {
      continue;
    }
    if ((type === "string" || type === "markdown" || type === "file") && typeof value !== "string") {
      throw new AthenaError("CONFIG_ERROR", `task.inputs.${key} must be a string.`);
    }
    if (type === "integer" && (typeof value !== "number" || !Number.isInteger(value))) {
      throw new AthenaError("CONFIG_ERROR", `task.inputs.${key} must be an integer.`);
    }
    if (type === "number" && (typeof value !== "number" || !Number.isFinite(value))) {
      throw new AthenaError("CONFIG_ERROR", `task.inputs.${key} must be a number.`);
    }
    if (type === "boolean" && typeof value !== "boolean") {
      throw new AthenaError("CONFIG_ERROR", `task.inputs.${key} must be a boolean.`);
    }
    if (type === "object" && !isRecord(value)) {
      throw new AthenaError("CONFIG_ERROR", `task.inputs.${key} must be an object.`);
    }
    if (type === "array" && !Array.isArray(value)) {
      throw new AthenaError("CONFIG_ERROR", `task.inputs.${key} must be an array.`);
    }
  }
}

function parseAgentRunEnvelope(stdout: string): AgentRunEnvelope {
  const trimmed = stdout.trim();
  if (!trimmed) {
    return {
      output: {},
      artifacts: []
    };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed) as unknown;
  } catch {
    return {
      output: { stdout },
      artifacts: []
    };
  }
  if (isRecord(parsed)) {
    return {
      output: "output" in parsed ? parsed.output : parsed,
      artifacts: Array.isArray(parsed.artifacts) ? parsed.artifacts.map(parseAgentRunArtifact) : []
    };
  }
  return {
    output: parsed,
    artifacts: []
  };
}

function parseAgentRunArtifact(value: unknown): AgentRunArtifact {
  if (!isRecord(value) || typeof value.storageUri !== "string") {
    throw new AthenaError("CONFIG_ERROR", "agent output artifacts must include storageUri.");
  }
  return {
    ...(typeof value.id === "string" ? { id: value.id } : {}),
    label: typeof value.label === "string" ? value.label : "Artifact",
    kind: typeof value.kind === "string" ? value.kind : "supporting",
    format: typeof value.format === "string" ? value.format : "text",
    storageUri: value.storageUri,
    ...(typeof value.sizeBytes === "number" ? { sizeBytes: value.sizeBytes } : {}),
    ...(typeof value.hash === "string" ? { hash: value.hash } : {}),
    ...(value.metadata !== undefined ? { metadata: value.metadata } : {}),
    ...(value.schemaValidation !== undefined ? { schemaValidation: value.schemaValidation } : {})
  };
}

function appendRunEvent(
  appState: AppStateDatabase,
  runId: string,
  task: TaskRecord,
  agentId: string,
  type: string,
  message: string,
  payload: unknown = {}
): void {
  appState.runEvents.append({
    id: `event-${randomUUID()}`,
    runId,
    taskId: task.id,
    ...(task.missionId ? { missionId: task.missionId } : {}),
    agentId,
    type,
    level: type === "run.failed" ? "error" : "info",
    message,
    payload
  });
}

function failTaskRun(
  appState: AppStateDatabase,
  run: RunRecord,
  task: TaskRecord,
  agentId: string,
  message: string,
  failure: unknown
): TaskWorkbenchTaskRun {
  appState.tasks.update(task.id, { status: "failed" });
  const failedRun = appState.runs.update(run.id, {
    status: "failed",
    endedAt: new Date().toISOString(),
    failure
  });
  appendRunEvent(appState, failedRun.id, task, agentId, "run.failed", message, failure);
  return mapRunRecord(failedRun);
}

function waitForExit(child: ChildProcessWithoutNullStreams): Promise<{ code: number | null; signal: NodeJS.Signals | null }> {
  return new Promise((resolveExit, reject) => {
    child.once("error", reject);
    child.once("close", (code, signal) => resolveExit({ code, signal }));
  });
}

function isPathInside(parent: string, child: string): boolean {
  const normalizedParent = parent.endsWith("/") ? parent : `${parent}/`;
  return child === parent || child.startsWith(normalizedParent);
}

function mapTaskRecord(record: TaskRecord): TaskWorkbenchTask {
  return {
    id: record.id,
    title: record.title,
    description: record.description,
    status: record.status,
    capabilityRequirements: record.capabilityRequirements,
    ...(record.assignedAgentId ? { assignedAgentId: record.assignedAgentId } : {}),
    ...(record.assignedAgentVersion ? { assignedAgentVersion: record.assignedAgentVersion } : {}),
    inputs: record.inputs,
    dependsOn: record.dependsOn,
    ...(record.missionId ? { missionId: record.missionId } : {}),
    ...(record.sourceRunId ? { sourceRunId: record.sourceRunId } : {}),
    ...(record.provenance !== undefined ? { provenance: record.provenance } : {}),
    ...(record.createdBy ? { createdBy: record.createdBy } : {}),
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    ...(record.archivedAt ? { archivedAt: record.archivedAt } : {})
  };
}

function mapRunRecord(record: RunRecord): TaskWorkbenchTaskRun {
  return {
    id: record.id,
    targetType: "task",
    targetId: record.targetId,
    status: record.status,
    ...(record.backend ? { backend: record.backend } : {}),
    ...(record.agentId ? { agentId: record.agentId } : {}),
    ...(record.agentVersion ? { agentVersion: record.agentVersion } : {}),
    ...(record.startedAt ? { startedAt: record.startedAt } : {}),
    ...(record.endedAt ? { endedAt: record.endedAt } : {}),
    ...(record.output !== undefined ? { output: record.output } : {}),
    ...(record.failure !== undefined ? { failure: record.failure } : {}),
    ...(record.safetyStop !== undefined ? { safetyStop: record.safetyStop } : {}),
    createdAt: record.createdAt,
    updatedAt: record.updatedAt
  };
}

function mapRunEventRecord(record: RunEventRecord): TaskWorkbenchRunEvent {
  return {
    id: record.id,
    runId: record.runId,
    ...(record.taskId ? { taskId: record.taskId } : {}),
    ...(record.missionId ? { missionId: record.missionId } : {}),
    ...(record.agentId ? { agentId: record.agentId } : {}),
    type: record.type,
    level: record.level,
    timestamp: record.timestamp,
    message: record.message,
    payload: record.payload,
    ...(record.parentEventId ? { parentEventId: record.parentEventId } : {}),
    ...(record.traceId ? { traceId: record.traceId } : {})
  };
}

function mapArtifactMetadataRecord(record: ArtifactMetadataRecord): TaskWorkbenchArtifactMetadata {
  return {
    id: record.id,
    runId: record.runId,
    ...(record.taskId ? { taskId: record.taskId } : {}),
    ...(record.agentId ? { agentId: record.agentId } : {}),
    label: record.label,
    kind: record.kind,
    format: record.format,
    storageUri: record.storageUri,
    ...(record.sizeBytes !== undefined ? { sizeBytes: record.sizeBytes } : {}),
    ...(record.hash ? { hash: record.hash } : {}),
    metadata: record.metadata,
    ...(record.schemaValidation !== undefined ? { schemaValidation: record.schemaValidation } : {}),
    createdAt: record.createdAt
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
