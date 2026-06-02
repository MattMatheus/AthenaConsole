import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { AthenaError } from "../../runtime/errors.js";
import type { AthenaConfig } from "../../shared/config.js";
import { validateDurableMemoryEventPayload } from "../../shared/contracts/durable-memory.js";
import type { VerificationPolicyFailure } from "../../shared/contracts/harness.js";
import type {
  ModelProviderRequirement,
  ProviderReadiness,
  TaskWorkbenchRunMode,
  TaskWorkbenchMetadata,
  TaskWorkbenchArtifactContent,
  TaskWorkbenchArtifactMetadata,
  TaskWorkbenchArtifactRecord,
  TaskWorkbenchRunEvent,
  TaskWorkbenchRunReadiness,
  TaskWorkbenchRunReadinessCheck,
  TaskWorkbenchTask,
  TaskWorkbenchTaskCreateRequest,
  TaskWorkbenchTaskListQuery,
  TaskWorkbenchTaskListResult,
  TaskWorkbenchTaskRun,
  TaskWorkbenchTaskRunSummary,
  TaskWorkbenchTaskRunCancelRequest,
  TaskWorkbenchTaskRunCancelResult,
  TaskWorkbenchTaskRunDetail,
  TaskWorkbenchTaskRunRequest,
  TaskWorkbenchTaskUpdateRequest
} from "../../shared/contracts.js";
import { DEFAULT_TASK_WORKBENCH_RUN_MODE, TASK_WORKBENCH_RUN_MODES, TASK_WORKBENCH_STATUSES } from "../../shared/contracts.js";
import type { ModelProviderRuntimeConfig } from "../../shared/contracts/model-providers.js";
import type {
  DurableMemoryGetRequest,
  DurableMemoryNamespaceRef,
  DurableMemoryProposalCreateRequest,
  DurableMemorySearchRequest,
  DurableMemorySensitivity
} from "../../shared/contracts/durable-memory.js";
import type {
  AgentIndexRecord,
  AppStateDatabase,
  ArtifactMetadataRecord,
  PluginIndexRecord,
  RunVerificationStatus,
  RunEventLevel,
  RunEventRecord,
  RunRecord,
  TaskRecord
} from "../app-state/index.js";
import { openAppStateDatabase } from "../app-state/index.js";
import type { TaskWorkbenchService } from "../interfaces.js";
import { LocalModelProviderConfigService } from "./model-providers.js";
import type { DurableMemoryService } from "./durable-memory.js";
import { evaluateProviderReadiness, normalizeModelProviderRequirement } from "./provider-readiness.js";
import { LocalWorkflowStateService } from "./workflow-state.js";

export interface LocalTaskWorkbenchServiceOptions {
  appState?: AppStateDatabase;
  durableMemoryService?: DurableMemoryService;
}

interface ActiveTaskRun {
  child?: ChildProcessWithoutNullStreams;
  taskId: string;
  agentId: string;
  backend: TaskExecutionBackend;
  cancellationRequested: boolean;
}

type TaskExecutionBackend = "local-process" | "container-command" | "http-api";
type RuntimePolicyPackId = "standard-local" | "cautious-local" | "container-isolated";

const DEFAULT_TASK_RUN_LIMITS = {
  maxRuntimeSeconds: 900,
  maxToolCalls: 80,
  maxRepeatedActions: 3,
  maxRetries: 2,
  maxFollowUpTasks: 5
} as const;

const RUNTIME_POLICY_PACKS: Record<RuntimePolicyPackId, RuntimePolicyPack> = {
  "standard-local": {
    id: "standard-local",
    allowedBackends: ["local-process", "container-command", "http-api"],
    requiredApprovals: []
  },
  "cautious-local": {
    id: "cautious-local",
    allowedBackends: ["local-process", "container-command"],
    limitMaximums: {
      maxRuntimeSeconds: 300,
      maxToolCalls: 40,
      maxRepeatedActions: 2,
      maxRetries: 1,
      maxFollowUpTasks: 2,
      maxOutputBytes: 65536,
      maxArtifacts: 5
    },
    requiredApprovals: ["shell-command", "network-write", "credential-access"]
  },
  "container-isolated": {
    id: "container-isolated",
    allowedBackends: ["container-command"],
    requiredApprovals: ["container-control"]
  }
};

interface AgentManifestDocument {
  agent?: {
    inputs?: Record<string, unknown>;
    implementation?: {
      type?: string;
      command?: string;
      args?: unknown[];
      cwd?: string;
      env?: Record<string, unknown>;
      image?: string;
      entrypoint?: unknown[];
      url?: string;
      method?: string;
      headers?: Record<string, unknown>;
    };
    runtime?: {
      preferredBackend?: string;
      backendPreferences?: unknown[];
      workingDirectory?: string;
      environment?: Record<string, unknown>;
      policyPackId?: unknown;
      modelProvider?: unknown;
    };
    permissions?: {
      containers?: string;
      approvalRequiredFor?: unknown[];
      durableMemory?: DurableMemoryPermissionDeclaration;
    };
    limits?: {
      maxRuntimeSeconds?: unknown;
      maxToolCalls?: unknown;
      maxRepeatedActions?: unknown;
      maxRetries?: unknown;
      maxFollowUpTasks?: unknown;
      maxOutputBytes?: unknown;
      maxArtifacts?: unknown;
    };
  };
}

interface ResolvedTaskCommand {
  backend: "local-process" | "container-command";
  command: string;
  args: string[];
  cwd: string;
  env?: Record<string, string>;
  image?: string;
}

interface ResolvedHttpApiRequest {
  backend: "http-api";
  url: string;
  method: "POST" | "PUT" | "PATCH";
  headers: Record<string, string>;
}

type ResolvedTaskExecution = ResolvedTaskCommand | ResolvedHttpApiRequest;

interface RuntimePolicyPack {
  id: RuntimePolicyPackId;
  allowedBackends: TaskExecutionBackend[];
  limitMaximums?: Partial<ResolvedTaskRunSafety["limits"]>;
  requiredApprovals: string[];
}

interface ResolvedTaskRunSafety {
  policyPackId: RuntimePolicyPackId;
  limits: {
    maxRuntimeSeconds: number;
    maxToolCalls: number;
    maxRepeatedActions: number;
    maxRetries: number;
    maxFollowUpTasks: number;
    maxOutputBytes?: number;
    maxArtifacts?: number;
  };
  approvalRequiredFor: string[];
}

interface TaskRunSafetyStop {
  limitType: "maxRuntimeSeconds" | "maxOutputBytes" | "maxArtifacts";
  threshold: number;
  observed?: number;
  reason: string;
  backend: TaskExecutionBackend;
}

interface AgentRunEnvelope {
  output: unknown;
  artifacts: AgentRunArtifact[];
  memoryRequests: RuntimeMemoryRequest[];
  verificationStatus?: RunVerificationStatus;
  verificationFailures?: VerificationPolicyFailure[];
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

interface DurableMemoryPermissionDeclaration {
  read?: DurableMemoryAccessDeclaration;
  propose?: DurableMemoryAccessDeclaration;
  writeReviewed?: DurableMemoryAccessDeclaration;
}

interface DurableMemoryAccessDeclaration {
  namespaces?: unknown[];
  maxSensitivity?: unknown;
  reason?: unknown;
}

interface ResolvedRuntimeMemoryAccess {
  namespaces: string[];
  maxSensitivity: DurableMemorySensitivity;
  reason?: string;
}

interface ResolvedRuntimeMemoryContext {
  status: "unavailable" | "denied" | "permitted";
  message: string;
  operations: {
    read?: ResolvedRuntimeMemoryAccess;
    propose?: ResolvedRuntimeMemoryAccess;
    writeReviewed?: ResolvedRuntimeMemoryAccess;
  };
}

type RuntimeMemoryRequest = RuntimeMemorySearchRequest | RuntimeMemoryGetRuntimeRequest | RuntimeMemoryProposeRequest;

interface RuntimeMemorySearchRequest {
  operation: "search";
  namespace: DurableMemoryNamespaceRef;
  query: string;
  limit?: number;
}

interface RuntimeMemoryGetRuntimeRequest {
  operation: "get";
  id: string;
  namespace?: DurableMemoryNamespaceRef;
}

interface RuntimeMemoryProposeRequest {
  operation: "propose";
  targetNamespace: DurableMemoryNamespaceRef;
  memoryType: string;
  proposedBody: string;
  reason: string;
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
      readyRequiresAssignedAgent: true,
      runModes: TASK_WORKBENCH_RUN_MODES,
      defaultRunMode: DEFAULT_TASK_WORKBENCH_RUN_MODE
    };
  }

  async list(query: TaskWorkbenchTaskListQuery = {}): Promise<TaskWorkbenchTaskListResult> {
    return this.withAppState((appState) => {
      const tasks = appState.tasks.list(query).map((task) => mapTaskRecord(task, appState));
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
      return mapTaskRecord(task, appState);
    });
  }

  async create(request: TaskWorkbenchTaskCreateRequest): Promise<TaskWorkbenchTask> {
    return this.withAppState((appState) => {
      validateReadyAssignment(request.status ?? "draft", request.assignedAgentId);
      validateCompatibleAssignment(appState, request.assignedAgentId, request.assignedAgentVersion, request.capabilityRequirements ?? []);
      try {
        const created = appState.tasks.create({
          id: request.id ?? `task-${randomUUID()}`,
          title: request.title,
          ...(request.description !== undefined ? { description: request.description } : {}),
          ...(request.status !== undefined ? { status: request.status } : {}),
          ...(request.capabilityRequirements !== undefined ? { capabilityRequirements: request.capabilityRequirements } : {}),
          ...(request.assignedAgentId !== undefined ? { assignedAgentId: request.assignedAgentId } : {}),
          ...(request.assignedAgentVersion !== undefined ? { assignedAgentVersion: request.assignedAgentVersion } : {}),
          inputs: normalizeTaskInputsWithRunMode(request.inputs),
          ...(request.dependsOn !== undefined ? { dependsOn: request.dependsOn } : {}),
          ...(request.missionId !== undefined ? { missionId: request.missionId } : {}),
          ...(request.sourceRunId !== undefined ? { sourceRunId: request.sourceRunId } : {}),
          ...(request.provenance !== undefined ? { provenance: request.provenance } : {}),
          ...(request.createdBy !== undefined ? { createdBy: request.createdBy } : {})
        });
        return mapTaskRecord(created, appState);
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
        const updateRequest = {
          ...request,
          ...(request.inputs !== undefined ? { inputs: normalizeTaskInputsWithRunMode(request.inputs) } : {})
        };
        return mapTaskRecord(appState.tasks.update(id, updateRequest), appState);
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
        ...(task ? { task: mapTaskRecord(task, appState) } : {}),
        events: appState.runEvents.listForRun(run.id).map(mapRunEventRecord),
        artifacts: appState.artifacts.listForRun(run.id).map(mapArtifactMetadataRecord)
      };
    });
  }

  async getRunArtifact(runId: string, artifactId: string): Promise<TaskWorkbenchArtifactRecord> {
    return this.withAppState((appState) => {
      const run = appState.runs.get(runId);
      if (!run || run.targetType !== "task") {
        throw new AthenaError("PROVIDER_NOT_FOUND", `Task run not found: ${runId}`);
      }
      const artifact = appState.artifacts.listForRun(run.id).find((item) => item.id === artifactId);
      if (!artifact) {
        throw new AthenaError("PROVIDER_NOT_FOUND", `Task run artifact not found: ${artifactId}`);
      }
      return {
        ...mapArtifactMetadataRecord(artifact),
        content: resolveTaskRunArtifactContent(appState, run, artifact)
      };
    });
  }

  async runTask(id: string, request: TaskWorkbenchTaskRunRequest = {}): Promise<TaskWorkbenchTaskRun> {
    return this.withAppStateAsync(async (appState) => {
      const task = normalizeTaskRecordRepoInputs(requireTask(appState, id));
      const readiness = evaluateTaskRunReadiness(appState, task);
      if (!readiness.ready) {
        throw new AthenaError("CONFIG_ERROR", readiness.summary);
      }
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
      const execution = resolveTaskExecution(manifest, plugin);
      const safety = resolveTaskRunSafety(manifest, execution.backend);
      const modelProviderRequirement = normalizeModelProviderRequirement(manifest.agent?.runtime?.modelProvider);
      const modelProvider = modelProviderRequirement
        ? await resolveTaskModelProvider(this.config, appState, modelProviderRequirement)
        : undefined;
      const memoryContext = resolveRuntimeMemoryContext(manifest, this.options.durableMemoryService);
      const runId = request.runId ?? `run-${randomUUID()}`;
      const startedAt = new Date().toISOString();
      let run = appState.runs.create({
        id: runId,
        targetType: "task",
        targetId: task.id,
        status: "running",
        backend: execution.backend,
        agentId: agent.id,
        agentVersion: agent.version,
        startedAt
      });
      appState.tasks.update(task.id, { status: "running" });
      startLinkedWorkflowDagStep(appState, task);
      appendRunEvent(appState, run.id, task, agent.id, "run.validated", "Task inputs validated.", {
        inputKeys: Object.keys(isRecord(task.inputs) ? task.inputs : {})
      });
      appendRunEvent(appState, run.id, task, agent.id, "run.mode", `Task run mode: ${resolveTaskRunMode(task.inputs)}.`, {
        runMode: resolveTaskRunMode(task.inputs),
        applyAvailable: false
      });
      appendRunEvent(appState, run.id, task, agent.id, "run.safety.limits", "Task run safety limits resolved.", {
        policyPackId: safety.policyPackId,
        limits: safety.limits,
        approvalRequiredFor: safety.approvalRequiredFor
      });
      if (modelProvider) {
        appendRunEvent(appState, run.id, task, agent.id, "run.model_provider", "Model provider resolved for task run.", {
          providerId: modelProvider.id,
          providerKind: modelProvider.providerKind,
          baseUrl: modelProvider.baseUrl,
          model: modelProvider.defaultModel
        });
      }
      appendDurableMemoryRunEvent(appState, run.id, task, agent.id, "memory.context", memoryContext.message, {
        ...sanitizeRuntimeMemoryContext(memoryContext),
        taskId: task.id,
        runId: run.id,
        agentId: agent.id
      });
      appendApprovalRequiredEvents(appState, run, task, agent.id, execution.backend, safety);
      appendRunEvent(appState, run.id, task, agent.id, "run.started", `${backendLabel(execution.backend)} task run started.`, {
        backend: execution.backend,
        ...executionStartPayload(execution)
      });

      if (execution.backend === "http-api") {
        return await this.runHttpApiTask(appState, run, task, agent, execution, safety, memoryContext);
      }
      const command = execution;
      let child: ChildProcessWithoutNullStreams;
      try {
        child = spawn(command.command, command.args, {
          cwd: command.cwd,
          env: command.env ?? process.env,
          stdio: ["pipe", "pipe", "pipe"]
        });
      } catch (error) {
        return failTaskRun(appState, run, task, agent.id, `${backendLabel(command.backend)} task run failed to start.`, {
          phase: "start",
          error: error instanceof Error ? error.message : String(error)
        });
      }
      const active: ActiveTaskRun = {
        child,
        taskId: task.id,
        agentId: agent.id,
        backend: command.backend,
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
      child.stdin.end(JSON.stringify(createAgentTaskRunEnvelope(task, agent, run, modelProvider, memoryContext)));

      let exit: { code: number | null; signal: NodeJS.Signals | null; safetyStop?: TaskRunSafetyStop };
      try {
        exit = await waitForExit(child, command.backend, safety);
      } catch (error) {
        this.activeRuns.delete(run.id);
        return failTaskRun(appState, run, task, agent.id, `${backendLabel(command.backend)} task run errored.`, {
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
        appendRunEvent(appState, run.id, task, agent.id, "run.cancelled", `${backendLabel(command.backend)} task run cancelled.`, {
          signal: exit.signal
        });
        failLinkedWorkflowDagStep(appState, task, run, {
          reason: "cancelled",
          signal: exit.signal
        });
        return mapRunRecord(run);
      }
      if (exit.safetyStop) {
        return stopTaskRunByLimit(appState, run, task, agent.id, exit.safetyStop);
      }
      if (exit.code === 0) {
        let envelope: AgentRunEnvelope;
        try {
          envelope = parseAgentRunEnvelope(stdout);
        } catch (error) {
          return failTaskRun(appState, run, task, agent.id, `${backendLabel(command.backend)} task run returned invalid output.`, {
            phase: "output",
            error: error instanceof Error ? error.message : String(error),
            stdout
          });
        }
        const envelopeSafetyStop = validateEnvelopeLimits(envelope, command.backend, safety);
        if (envelopeSafetyStop) {
          return stopTaskRunByLimit(appState, run, task, agent.id, envelopeSafetyStop);
        }
        try {
          await processRuntimeMemoryRequests(appState, this.options.durableMemoryService, memoryContext, run, task, agent.id, envelope.memoryRequests);
        } catch (error) {
          return failTaskRun(appState, run, task, agent.id, "Runtime memory request failed.", {
            phase: "memory",
            error: error instanceof Error ? error.message : String(error)
          });
        }
        for (const artifact of envelope.artifacts) {
          try {
            validateArtifactBoundary(command, artifact);
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
          output: envelope.output,
          ...(envelope.verificationStatus ? { verificationStatus: envelope.verificationStatus } : {}),
          ...(envelope.verificationFailures ? { verificationFailures: envelope.verificationFailures } : {})
        });
        appendRunEvent(appState, run.id, task, agent.id, "run.completed", `${backendLabel(command.backend)} task run completed.`, {
          artifactCount: envelope.artifacts.length
        });
        completeLinkedWorkflowDagStep(appState, task, run, envelope.output, {
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
      appendRunEvent(appState, run.id, task, agent.id, "run.failed", `${backendLabel(command.backend)} task run failed.`, {
        code: exit.code,
        signal: exit.signal
      });
      failLinkedWorkflowDagStep(appState, task, run, {
        code: exit.code,
        signal: exit.signal,
        stderr
      });
      return mapRunRecord(run);
    });
  }

  async getRunReadiness(id: string): Promise<TaskWorkbenchRunReadiness> {
    return this.withAppState((appState) => evaluateTaskRunReadiness(appState, requireTask(appState, id)));
  }

  private async runHttpApiTask(
    appState: AppStateDatabase,
    initialRun: RunRecord,
    task: TaskRecord,
    agent: AgentIndexRecord,
    request: ResolvedHttpApiRequest,
    safety: ResolvedTaskRunSafety,
    memoryContext: ResolvedRuntimeMemoryContext
  ): Promise<TaskWorkbenchTaskRun> {
    let run = initialRun;
    const active: ActiveTaskRun = {
      taskId: task.id,
      agentId: agent.id,
      backend: request.backend,
      cancellationRequested: false
    };
    this.activeRuns.set(run.id, active);
    let response: Response;
    let responseText = "";
    let runtimeSafetyStop: TaskRunSafetyStop | undefined;
    const abortController = new AbortController();
    const timeout = setTimeout(() => {
      runtimeSafetyStop = createRuntimeSafetyStop(request.backend, safety);
      abortController.abort();
    }, safety.limits.maxRuntimeSeconds * 1000);
    timeout.unref();
    try {
      response = await fetch(request.url, {
        method: request.method,
        headers: {
          "content-type": "application/json",
          accept: "application/json, text/plain",
          ...request.headers
        },
        body: JSON.stringify(createAgentTaskRunEnvelope(task, agent, run, undefined, memoryContext)),
        signal: abortController.signal
      });
      responseText = await response.text();
    } catch (error) {
      clearTimeout(timeout);
      this.activeRuns.delete(run.id);
      if (runtimeSafetyStop) {
        return stopTaskRunByLimit(appState, run, task, agent.id, runtimeSafetyStop);
      }
      return failTaskRun(appState, run, task, agent.id, "HTTP/API task run failed to reach endpoint.", {
        phase: "request",
        error: error instanceof Error ? error.message : String(error)
      });
    }
    clearTimeout(timeout);
    this.activeRuns.delete(run.id);
    appendRunEvent(appState, run.id, task, agent.id, "run.response", "HTTP/API task run received response.", {
      status: response.status,
      statusText: response.statusText,
      ok: response.ok
    });
    const endedAt = new Date().toISOString();
    if (!response.ok) {
      appState.tasks.update(task.id, { status: "failed" });
      run = appState.runs.update(run.id, {
        status: "failed",
        endedAt,
        failure: {
          status: response.status,
          statusText: response.statusText,
          body: responseText
        }
      });
      appendRunEvent(appState, run.id, task, agent.id, "run.failed", "HTTP/API task run failed.", {
        status: response.status,
        statusText: response.statusText
      });
      failLinkedWorkflowDagStep(appState, task, run, {
        status: response.status,
        statusText: response.statusText,
        body: responseText
      });
      return mapRunRecord(run);
    }
    let envelope: AgentRunEnvelope;
    try {
      envelope = parseAgentRunEnvelope(responseText);
    } catch (error) {
      return failTaskRun(appState, run, task, agent.id, "HTTP/API task run returned invalid output.", {
        phase: "output",
        error: error instanceof Error ? error.message : String(error),
        body: responseText
      });
    }
    const envelopeSafetyStop = validateEnvelopeLimits(envelope, request.backend, safety);
    if (envelopeSafetyStop) {
      return stopTaskRunByLimit(appState, run, task, agent.id, envelopeSafetyStop);
    }
    try {
      await processRuntimeMemoryRequests(appState, this.options.durableMemoryService, memoryContext, run, task, agent.id, envelope.memoryRequests);
    } catch (error) {
      return failTaskRun(appState, run, task, agent.id, "Runtime memory request failed.", {
        phase: "memory",
        error: error instanceof Error ? error.message : String(error)
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
        return failTaskRun(appState, run, task, agent.id, "HTTP/API task run artifact persistence failed.", {
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
      output: envelope.output,
      ...(envelope.verificationStatus ? { verificationStatus: envelope.verificationStatus } : {}),
      ...(envelope.verificationFailures ? { verificationFailures: envelope.verificationFailures } : {})
    });
    appendRunEvent(appState, run.id, task, agent.id, "run.completed", "HTTP/API task run completed.", {
      artifactCount: envelope.artifacts.length
    });
    completeLinkedWorkflowDagStep(appState, task, run, envelope.output, {
      artifactCount: envelope.artifacts.length
    });
    return mapRunRecord(run);
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
        if (!active.child) {
          appendRunEvent(appState, runId, task, active.agentId, "run.cancel.unsupported", "Cancellation is unsupported for this active backend.", {
            backend: active.backend
          });
        }
      }
    });
    if (!active.child) {
      return {
        runId,
        status: "unsupported"
      };
    }
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

function resolveTaskRunSafety(manifest: AgentManifestDocument, backend: TaskExecutionBackend): ResolvedTaskRunSafety {
  const policyPack = resolveRuntimePolicyPack(manifest);
  if (!policyPack.allowedBackends.includes(backend)) {
    throw new AthenaError("CONFIG_ERROR", `Runtime policy pack ${policyPack.id} does not allow ${backend} backend.`);
  }
  const limits = manifest.agent?.limits ?? {};
  const manifestLimits = {
    maxRuntimeSeconds: normalizePositiveIntegerLimit(
      limits.maxRuntimeSeconds,
      "limits.maxRuntimeSeconds",
      DEFAULT_TASK_RUN_LIMITS.maxRuntimeSeconds
    ),
    maxToolCalls: normalizeNonNegativeIntegerLimit(limits.maxToolCalls, "limits.maxToolCalls", DEFAULT_TASK_RUN_LIMITS.maxToolCalls),
    maxRepeatedActions: normalizePositiveIntegerLimit(
      limits.maxRepeatedActions,
      "limits.maxRepeatedActions",
      DEFAULT_TASK_RUN_LIMITS.maxRepeatedActions
    ),
    maxRetries: normalizeNonNegativeIntegerLimit(limits.maxRetries, "limits.maxRetries", DEFAULT_TASK_RUN_LIMITS.maxRetries),
    maxFollowUpTasks: normalizeNonNegativeIntegerLimit(
      limits.maxFollowUpTasks,
      "limits.maxFollowUpTasks",
      DEFAULT_TASK_RUN_LIMITS.maxFollowUpTasks
    ),
    ...(limits.maxOutputBytes !== undefined
      ? { maxOutputBytes: normalizePositiveIntegerLimit(limits.maxOutputBytes, "limits.maxOutputBytes") }
      : {}),
    ...(limits.maxArtifacts !== undefined ? { maxArtifacts: normalizeNonNegativeIntegerLimit(limits.maxArtifacts, "limits.maxArtifacts") } : {})
  };
  return {
    policyPackId: policyPack.id,
    limits: composePolicyPackLimits(manifestLimits, policyPack.limitMaximums),
    approvalRequiredFor: uniqueSortedStrings([
      ...normalizeStringArray(manifest.agent?.permissions?.approvalRequiredFor, "permissions.approvalRequiredFor"),
      ...policyPack.requiredApprovals
    ])
  };
}

function resolveRuntimePolicyPack(manifest: AgentManifestDocument): RuntimePolicyPack {
  const rawPolicyPackId = manifest.agent?.runtime?.policyPackId ?? "standard-local";
  if (rawPolicyPackId === "standard-local" || rawPolicyPackId === "cautious-local" || rawPolicyPackId === "container-isolated") {
    return RUNTIME_POLICY_PACKS[rawPolicyPackId];
  }
  if (typeof rawPolicyPackId === "string") {
    throw new AthenaError("CONFIG_ERROR", `Unknown runtime policy pack: ${rawPolicyPackId}`);
  }
  throw new AthenaError("CONFIG_ERROR", "runtime.policyPackId must be a string.");
}

function composePolicyPackLimits(
  manifestLimits: ResolvedTaskRunSafety["limits"],
  packMaximums: Partial<ResolvedTaskRunSafety["limits"]> | undefined
): ResolvedTaskRunSafety["limits"] {
  if (!packMaximums) {
    return manifestLimits;
  }
  return {
    maxRuntimeSeconds: stricterRequiredLimit(manifestLimits.maxRuntimeSeconds, packMaximums.maxRuntimeSeconds),
    maxToolCalls: stricterRequiredLimit(manifestLimits.maxToolCalls, packMaximums.maxToolCalls),
    maxRepeatedActions: stricterRequiredLimit(manifestLimits.maxRepeatedActions, packMaximums.maxRepeatedActions),
    maxRetries: stricterRequiredLimit(manifestLimits.maxRetries, packMaximums.maxRetries),
    maxFollowUpTasks: stricterRequiredLimit(manifestLimits.maxFollowUpTasks, packMaximums.maxFollowUpTasks),
    ...composeOptionalLimit("maxOutputBytes", manifestLimits, packMaximums),
    ...composeOptionalLimit("maxArtifacts", manifestLimits, packMaximums)
  };
}

function stricterRequiredLimit(manifestValue: number, packMaximum: number | undefined): number {
  return packMaximum === undefined ? manifestValue : Math.min(manifestValue, packMaximum);
}

function composeOptionalLimit<TLimit extends "maxOutputBytes" | "maxArtifacts">(
  limit: TLimit,
  manifestLimits: ResolvedTaskRunSafety["limits"],
  packMaximums: Partial<ResolvedTaskRunSafety["limits"]>
): Pick<ResolvedTaskRunSafety["limits"], TLimit> | Record<string, never> {
  const manifestValue = manifestLimits[limit];
  const packValue = packMaximums[limit];
  if (manifestValue === undefined && packValue === undefined) {
    return {};
  }
  return {
    [limit]: manifestValue === undefined ? packValue : stricterRequiredLimit(manifestValue, packValue)
  } as Pick<ResolvedTaskRunSafety["limits"], TLimit>;
}

function uniqueSortedStrings(values: string[]): string[] {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));
}

function normalizePositiveIntegerLimit(value: unknown, path: string, fallback?: number): number {
  if (value === undefined) {
    if (fallback === undefined) {
      throw new AthenaError("CONFIG_ERROR", `${path} is required.`);
    }
    return fallback;
  }
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1) {
    throw new AthenaError("CONFIG_ERROR", `${path} must be a positive integer.`);
  }
  return value;
}

function normalizeNonNegativeIntegerLimit(value: unknown, path: string, fallback?: number): number {
  if (value === undefined) {
    if (fallback === undefined) {
      throw new AthenaError("CONFIG_ERROR", `${path} is required.`);
    }
    return fallback;
  }
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    throw new AthenaError("CONFIG_ERROR", `${path} must be a non-negative integer.`);
  }
  return value;
}

function resolveTaskExecution(manifest: AgentManifestDocument, plugin: PluginIndexRecord): ResolvedTaskExecution {
  const implementation = manifest.agent?.implementation;
  if (implementation?.type === "local-command") {
    return resolveLocalCommand(manifest, plugin);
  }
  if (implementation?.type === "container-command") {
    return resolveContainerCommand(manifest, plugin);
  }
  if (implementation?.type === "http" || implementation?.type === "http-api") {
    return resolveHttpApiRequest(manifest);
  }
  throw new AthenaError("CONFIG_ERROR", "Task runs currently require an assigned local-command, container-command, or HTTP/API agent.");
}

function resolveLocalCommand(manifest: AgentManifestDocument, plugin: PluginIndexRecord): ResolvedTaskCommand {
  const implementation = manifest.agent?.implementation;
  if (!implementation?.command?.trim()) {
    throw new AthenaError("CONFIG_ERROR", "local-command agents require implementation.command.");
  }
  validateBackendCompatibility(manifest, "local-process", ["local-process"]);
  return {
    backend: "local-process",
    command: implementation.command,
    args: normalizeStringArray(implementation.args, "implementation.args"),
    cwd: resolveBoundedWorkingDirectory(manifest, plugin)
  };
}

function resolveContainerCommand(manifest: AgentManifestDocument, plugin: PluginIndexRecord): ResolvedTaskCommand {
  const implementation = manifest.agent?.implementation;
  if (!implementation?.image?.trim()) {
    throw new AthenaError("CONFIG_ERROR", "container-command agents require implementation.image.");
  }
  if (!implementation.command?.trim()) {
    throw new AthenaError("CONFIG_ERROR", "container-command agents require implementation.command in the local runtime.");
  }
  if (manifest.agent?.permissions?.containers !== "allow") {
    throw new AthenaError("CONFIG_ERROR", "container-command agents require permissions.containers: allow.");
  }
  validateBackendCompatibility(manifest, "container-command", ["container-command", "container"]);
  const env = normalizeStringMap(
    {
      ...(manifest.agent?.runtime?.environment ?? {}),
      ...(implementation.env ?? {})
    },
    "container-command environment"
  );
  return {
    backend: "container-command",
    command: implementation.command,
    args: [...normalizeStringArray(implementation.entrypoint, "implementation.entrypoint"), ...normalizeStringArray(implementation.args, "implementation.args")],
    cwd: resolveBoundedWorkingDirectory(manifest, plugin),
    ...(Object.keys(env).length > 0 ? { env } : { env: {} }),
    image: implementation.image
  };
}

function resolveHttpApiRequest(manifest: AgentManifestDocument): ResolvedHttpApiRequest {
  const implementation = manifest.agent?.implementation;
  if (!implementation?.url?.trim()) {
    throw new AthenaError("CONFIG_ERROR", "HTTP/API agents require implementation.url.");
  }
  let url: URL;
  try {
    url = new URL(implementation.url);
  } catch {
    throw new AthenaError("CONFIG_ERROR", "HTTP/API implementation.url must be an absolute HTTP(S) URL.");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new AthenaError("CONFIG_ERROR", "HTTP/API implementation.url must use http or https.");
  }
  const method = normalizeHttpMethod(implementation.method);
  const headers = normalizeHttpHeaders(implementation.headers ?? {}, "implementation.headers");
  normalizeStringMap(
    {
      ...(manifest.agent?.runtime?.environment ?? {}),
      ...(implementation.env ?? {})
    },
    "HTTP/API environment"
  );
  validateBackendCompatibility(manifest, "http-api", ["http-api", "api"]);
  return {
    backend: "http-api",
    url: url.toString(),
    method,
    headers
  };
}

function normalizeHttpMethod(value: unknown): "POST" | "PUT" | "PATCH" {
  const method = typeof value === "string" && value.trim() ? value.trim().toUpperCase() : "POST";
  if (method === "POST" || method === "PUT" || method === "PATCH") {
    return method;
  }
  throw new AthenaError("CONFIG_ERROR", "HTTP/API implementation.method must be POST, PUT, or PATCH.");
}

function normalizeHttpHeaders(value: Record<string, unknown>, path: string): Record<string, string> {
  const headers = normalizeStringMap(value, path);
  for (const key of Object.keys(headers)) {
    const normalized = key.toLowerCase();
    if (normalized === "content-length" || normalized === "host" || normalized === "connection") {
      throw new AthenaError("CONFIG_ERROR", `HTTP/API ${path}.${key} is not allowed.`);
    }
  }
  return headers;
}

function validateBackendCompatibility(
  manifest: AgentManifestDocument,
  backend: TaskExecutionBackend,
  compatibleBackendNames: string[]
): void {
  const backendPreferences = manifest.agent?.runtime?.backendPreferences;
  const preferredBackend = manifest.agent?.runtime?.preferredBackend;
  if (preferredBackend === "any") {
    return;
  }
  if (preferredBackend && !compatibleBackendNames.includes(preferredBackend)) {
    if (!(Array.isArray(backendPreferences) && backendPreferences.some((candidate) => compatibleBackendNames.includes(String(candidate))))) {
      throw new AthenaError("CONFIG_ERROR", `Assigned agent does not declare ${backend} runtime compatibility.`);
    }
  }
}

function normalizeStringArray(value: unknown, path: string): string[] {
  return Array.isArray(value)
    ? value.map((arg, index) => {
        if (typeof arg !== "string") {
          throw new AthenaError("CONFIG_ERROR", `${path}[${index}] must be a string.`);
        }
        return arg;
      })
    : [];
}

function normalizeStringMap(value: Record<string, unknown>, path: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, rawValue] of Object.entries(value)) {
    if (typeof rawValue !== "string") {
      throw new AthenaError("CONFIG_ERROR", `${path}.${key} must be a string.`);
    }
    result[key] = rawValue;
  }
  return result;
}

function resolveBoundedWorkingDirectory(manifest: AgentManifestDocument, plugin: PluginIndexRecord): string {
  const implementation = manifest.agent?.implementation;
  const workingDirectory = manifest.agent?.runtime?.workingDirectory ?? implementation?.cwd ?? ".";
  const pluginRoot = resolve(plugin.path);
  const cwd = resolve(pluginRoot, workingDirectory);
  if (isAbsolute(workingDirectory) || !isPathInside(pluginRoot, cwd)) {
    throw new AthenaError("CONFIG_ERROR", "runtime.workingDirectory must stay inside the plugin directory.");
  }
  return cwd;
}

function validateArtifactBoundary(command: ResolvedTaskCommand, artifact: AgentRunArtifact): void {
  if (command.backend !== "container-command") {
    return;
  }
  const artifactRoot = resolve("/", "artifacts");
  const artifactPath = resolve("/", artifact.storageUri);
  if (isAbsolute(artifact.storageUri) || !isPathInside(artifactRoot, artifactPath)) {
    throw new AthenaError("CONFIG_ERROR", "container-command artifact storageUri must stay inside artifacts/.");
  }
}

function backendLabel(backend: TaskExecutionBackend): string {
  if (backend === "container-command") {
    return "Container command";
  }
  if (backend === "http-api") {
    return "HTTP/API";
  }
  return "Local process";
}

function executionStartPayload(execution: ResolvedTaskExecution): Record<string, unknown> {
  if (execution.backend === "http-api") {
    return {
      url: execution.url,
      method: execution.method,
      headerNames: Object.keys(execution.headers).sort((left, right) => left.localeCompare(right))
    };
  }
  return {
    command: execution.command,
    args: execution.args,
    ...(execution.image ? { image: execution.image } : {})
  };
}

function appendApprovalRequiredEvents(
  appState: AppStateDatabase,
  run: RunRecord,
  task: TaskRecord,
  agentId: string,
  backend: TaskExecutionBackend,
  safety: ResolvedTaskRunSafety
): void {
  for (const riskClass of safety.approvalRequiredFor) {
    appendRunEvent(
      appState,
      run.id,
      task,
      agentId,
      "run.approval.required",
      `Approval requirement recorded for ${riskClass}.`,
      {
        action: "task.run",
        riskClass,
        decision: "pending",
        scope: {
          taskId: task.id,
          runId: run.id,
          backend
        },
        expires: "run-end"
      },
      "warning"
    );
  }
}

function validateEnvelopeLimits(
  envelope: AgentRunEnvelope,
  backend: TaskExecutionBackend,
  safety: ResolvedTaskRunSafety
): TaskRunSafetyStop | undefined {
  const maxOutputBytes = safety.limits.maxOutputBytes;
  if (maxOutputBytes !== undefined) {
    const observed = measureOutputBytes(envelope.output);
    if (observed > maxOutputBytes) {
      return {
        limitType: "maxOutputBytes",
        threshold: maxOutputBytes,
        observed,
        reason: `Run output exceeded maxOutputBytes (${observed} > ${maxOutputBytes}).`,
        backend
      };
    }
  }
  const maxArtifacts = safety.limits.maxArtifacts;
  if (maxArtifacts !== undefined && envelope.artifacts.length > maxArtifacts) {
    return {
      limitType: "maxArtifacts",
      threshold: maxArtifacts,
      observed: envelope.artifacts.length,
      reason: `Run produced too many artifacts (${envelope.artifacts.length} > ${maxArtifacts}).`,
      backend
    };
  }
  return undefined;
}

function measureOutputBytes(output: unknown): number {
  const serialized = typeof output === "string" ? output : JSON.stringify(output) ?? "";
  return Buffer.byteLength(serialized, "utf8");
}

function createRuntimeSafetyStop(backend: TaskExecutionBackend, safety: ResolvedTaskRunSafety): TaskRunSafetyStop {
  return {
    limitType: "maxRuntimeSeconds",
    threshold: safety.limits.maxRuntimeSeconds,
    reason: `Run exceeded maxRuntimeSeconds (${safety.limits.maxRuntimeSeconds}).`,
    backend
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
      artifacts: [],
      memoryRequests: []
    };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed) as unknown;
  } catch {
    return {
      output: { stdout },
      artifacts: [],
      memoryRequests: []
    };
  }
  if (isRecord(parsed)) {
    return {
      output: "output" in parsed ? parsed.output : parsed,
      artifacts: Array.isArray(parsed.artifacts) ? parsed.artifacts.map(parseAgentRunArtifact) : [],
      memoryRequests: Array.isArray(parsed.memoryRequests) ? parsed.memoryRequests.map(parseRuntimeMemoryRequest) : [],
      ...(isRunVerificationStatus(parsed.verificationStatus) ? { verificationStatus: parsed.verificationStatus } : {}),
      ...(Array.isArray(parsed.verificationFailures)
        ? {
            verificationFailures: parsed.verificationFailures
              .map(parseVerificationPolicyFailure)
              .filter((failure): failure is VerificationPolicyFailure => failure !== undefined)
          }
        : {})
    };
  }
  return {
    output: parsed,
    artifacts: [],
    memoryRequests: []
  };
}

function parseRuntimeMemoryRequest(value: unknown): RuntimeMemoryRequest {
  if (!isRecord(value) || typeof value.operation !== "string") {
    throw new AthenaError("CONFIG_ERROR", "memoryRequests items must include an operation.");
  }
  if (value.operation === "search") {
    if (!isDurableMemoryNamespaceRef(value.namespace) || typeof value.query !== "string") {
      throw new AthenaError("CONFIG_ERROR", "memory search requests require namespace and query.");
    }
    return {
      operation: "search",
      namespace: value.namespace,
      query: value.query,
      ...(typeof value.limit === "number" && Number.isInteger(value.limit) && value.limit > 0 ? { limit: value.limit } : {})
    };
  }
  if (value.operation === "get") {
    if (typeof value.id !== "string") {
      throw new AthenaError("CONFIG_ERROR", "memory get requests require id.");
    }
    return {
      operation: "get",
      id: value.id,
      ...(isDurableMemoryNamespaceRef(value.namespace) ? { namespace: value.namespace } : {})
    };
  }
  if (value.operation === "propose") {
    if (
      !isDurableMemoryNamespaceRef(value.targetNamespace) ||
      typeof value.memoryType !== "string" ||
      typeof value.proposedBody !== "string" ||
      typeof value.reason !== "string"
    ) {
      throw new AthenaError("CONFIG_ERROR", "memory propose requests require targetNamespace, memoryType, proposedBody, and reason.");
    }
    return {
      operation: "propose",
      targetNamespace: value.targetNamespace,
      memoryType: value.memoryType,
      proposedBody: value.proposedBody,
      reason: value.reason
    };
  }
  throw new AthenaError("CONFIG_ERROR", `Unsupported memory request operation: ${value.operation}`);
}

async function processRuntimeMemoryRequests(
  appState: AppStateDatabase,
  durableMemoryService: DurableMemoryService | undefined,
  context: ResolvedRuntimeMemoryContext,
  run: RunRecord,
  task: TaskRecord,
  agentId: string,
  requests: RuntimeMemoryRequest[]
): Promise<void> {
  for (const request of requests) {
    if (!durableMemoryService) {
      throw new AthenaError("CONFIG_ERROR", "Durable memory is unavailable for this runtime.");
    }
    if (request.operation === "search") {
      requireRuntimeMemoryAccess(context, "read", request.namespace);
      const serviceRequest: DurableMemorySearchRequest = {
        namespace: request.namespace,
        query: request.query,
        ...(request.limit ? { limit: request.limit } : {})
      };
      const result = await durableMemoryService.search(serviceRequest);
      appendDurableMemoryRunEvent(appState, run.id, task, agentId, "memory.search", "Runtime durable-memory search completed.", {
        namespace: request.namespace,
        operatorStatus: result.operatorStatus,
        resultCount: result.records.length,
        total: result.total,
        taskId: task.id,
        runId: run.id,
        agentId
      });
      if (result.records.length > 0) {
        appendDurableMemoryRunEvent(appState, run.id, task, agentId, "memory.records.selected", "Runtime durable-memory records selected.", {
          namespace: request.namespace,
          recordIds: result.records.map((record) => record.id),
          records: result.records.map((record) => ({
            recordId: record.id,
            namespace: record.namespace,
            sensitivity: record.sensitivity,
            status: record.status
          })),
          taskId: task.id,
          runId: run.id,
          agentId
        });
      }
      continue;
    }
    if (request.operation === "get") {
      if (request.namespace) {
        requireRuntimeMemoryAccess(context, "read", request.namespace);
      } else {
        requireRuntimeMemoryAccess(context, "read");
      }
      const serviceRequest: DurableMemoryGetRequest = {
        id: request.id,
        ...(request.namespace ? { namespace: request.namespace } : {})
      };
      const record = await durableMemoryService.get(serviceRequest);
      appendDurableMemoryRunEvent(appState, run.id, task, agentId, "memory.record.selected", "Runtime durable-memory record selected.", {
        recordId: record.id,
        namespace: record.namespace,
        sensitivity: record.sensitivity,
        status: record.status,
        taskId: task.id,
        runId: run.id,
        agentId
      });
      continue;
    }
    requireRuntimeMemoryAccess(context, "propose", request.targetNamespace);
    const serviceRequest: DurableMemoryProposalCreateRequest = {
      targetNamespace: request.targetNamespace,
      memoryType: request.memoryType,
      proposedBody: request.proposedBody,
      reason: request.reason,
      provenance: {
        sourceKind: "task-run",
        actorType: "agent",
        actorId: agentId,
        agentId,
        taskId: task.id,
        runId: run.id,
        createdByAction: "runtime-memory-proposal"
      }
    };
    const proposal = await durableMemoryService.createProposal(serviceRequest);
    appendDurableMemoryRunEvent(appState, run.id, task, agentId, "memory.proposal.created", "Runtime durable-memory proposal created.", {
      proposalId: proposal.id,
      namespace: proposal.targetNamespace,
      memoryType: proposal.memoryType,
      status: proposal.status,
      reason: proposal.reason,
      provenance: {
        sourceKind: proposal.provenance.sourceKind,
        taskId: proposal.provenance.taskId,
        runId: proposal.provenance.runId,
        agentId: proposal.provenance.agentId,
        createdByAction: proposal.provenance.createdByAction
      },
      taskId: task.id,
      runId: run.id,
      agentId
    });
  }
}

function resolveRuntimeMemoryContext(
  manifest: AgentManifestDocument,
  durableMemoryService: DurableMemoryService | undefined
): ResolvedRuntimeMemoryContext {
  if (!durableMemoryService) {
    return {
      status: "unavailable",
      message: "Durable memory is unavailable for this runtime.",
      operations: {}
    };
  }
  const declaration = manifest.agent?.permissions?.durableMemory;
  const operations = {
    ...resolveRuntimeMemoryOperation("read", declaration?.read),
    ...resolveRuntimeMemoryOperation("propose", declaration?.propose),
    ...resolveRuntimeMemoryOperation("writeReviewed", declaration?.writeReviewed)
  };
  if (!operations.read && !operations.propose && !operations.writeReviewed) {
    return {
      status: "denied",
      message: "Assigned agent does not declare durable-memory access.",
      operations: {}
    };
  }
  return {
    status: "permitted",
    message: "Assigned agent declares durable-memory access.",
    operations
  };
}

function resolveRuntimeMemoryOperation(
  operation: keyof ResolvedRuntimeMemoryContext["operations"],
  declaration: DurableMemoryAccessDeclaration | undefined
): Partial<ResolvedRuntimeMemoryContext["operations"]> {
  if (!declaration) {
    return {};
  }
  const namespaces = Array.isArray(declaration.namespaces)
    ? declaration.namespaces.filter((namespace): namespace is string => typeof namespace === "string" && namespace.length > 0)
    : [];
  if (namespaces.length === 0 || !isDurableMemorySensitivity(declaration.maxSensitivity)) {
    return {};
  }
  return {
    [operation]: {
      namespaces,
      maxSensitivity: declaration.maxSensitivity,
      ...(typeof declaration.reason === "string" ? { reason: declaration.reason } : {})
    }
  };
}

function sanitizeRuntimeMemoryContext(context: ResolvedRuntimeMemoryContext): Record<string, unknown> {
  return {
    status: context.status,
    message: context.message,
    operations: context.operations
  };
}

function requireRuntimeMemoryAccess(
  context: ResolvedRuntimeMemoryContext,
  operation: "read" | "propose" | "writeReviewed",
  namespace?: DurableMemoryNamespaceRef
): void {
  if (context.status !== "permitted") {
    throw new AthenaError("CONFIG_ERROR", context.message);
  }
  const access = context.operations[operation];
  if (!access) {
    throw new AthenaError("CONFIG_ERROR", `Assigned agent does not declare durable-memory ${operation} access.`);
  }
  if (namespace && !access.namespaces.some((scope) => durableMemoryNamespaceMatches(scope, namespace))) {
    throw new AthenaError("CONFIG_ERROR", `Assigned agent durable-memory ${operation} access does not include namespace ${namespace.scope}:${namespace.id}.`);
  }
}

function durableMemoryNamespaceMatches(scope: string, namespace: DurableMemoryNamespaceRef): boolean {
  const normalized = `${namespace.scope}:${namespace.id}`;
  if (scope.endsWith("/*")) {
    return normalized.startsWith(scope.slice(0, -1)) || namespace.id.startsWith(scope.slice(0, -1));
  }
  return scope === normalized || scope === namespace.id;
}

function isDurableMemoryNamespaceRef(value: unknown): value is DurableMemoryNamespaceRef {
  return isRecord(value) && typeof value.scope === "string" && typeof value.id === "string";
}

function isDurableMemorySensitivity(value: unknown): value is DurableMemorySensitivity {
  return value === "public" || value === "internal" || value === "sensitive" || value === "secret-adjacent";
}

function isRunVerificationStatus(value: unknown): value is RunVerificationStatus {
  return value === "passed" || value === "verification-failed";
}

function parseVerificationPolicyFailure(value: unknown): VerificationPolicyFailure | undefined {
  if (
    !isRecord(value) ||
    typeof value.policyId !== "string" ||
    value.kind !== "require-evidence" ||
    typeof value.message !== "string"
  ) {
    return undefined;
  }
  return {
    policyId: value.policyId,
    kind: value.kind,
    message: value.message,
    ...(isStringRecord(value.details) ? { details: value.details } : {})
  };
}

function isStringRecord(value: unknown): value is Record<string, string> {
  return isRecord(value) && Object.values(value).every((item) => typeof item === "string");
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
  payload: unknown = {},
  level: RunEventLevel = type === "run.failed" ? "error" : type === "run.stopped-by-limit" ? "warning" : "info"
): void {
  appState.runEvents.append({
    id: `event-${randomUUID()}`,
    runId,
    taskId: task.id,
    ...(task.missionId ? { missionId: task.missionId } : {}),
    agentId,
    type,
    level,
    message,
    payload
  });
}

function appendDurableMemoryRunEvent(
  appState: AppStateDatabase,
  runId: string,
  task: TaskRecord,
  agentId: string,
  type: string,
  message: string,
  payload: Record<string, unknown>
): void {
  const validation = validateDurableMemoryEventPayload(payload);
  if (!validation.ok) {
    throw new AthenaError("CONFIG_ERROR", `Invalid durable-memory event payload: ${validation.errors.join("; ")}`);
  }
  appendRunEvent(appState, runId, task, agentId, type, message, payload);
}

function stopTaskRunByLimit(
  appState: AppStateDatabase,
  run: RunRecord,
  task: TaskRecord,
  agentId: string,
  safetyStop: TaskRunSafetyStop
): TaskWorkbenchTaskRun {
  const endedAt = new Date().toISOString();
  appState.tasks.update(task.id, { status: "failed" });
  const stoppedRun = appState.runs.update(run.id, {
    status: "stopped-by-limit",
    endedAt,
    failure: safetyStop,
    safetyStop: {
      ...safetyStop,
      stoppedAt: endedAt
    }
  });
  appendRunEvent(appState, stoppedRun.id, task, agentId, "run.stopped-by-limit", safetyStop.reason, safetyStop);
  failLinkedWorkflowDagStep(appState, task, stoppedRun, safetyStop);
  return mapRunRecord(stoppedRun);
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
  failLinkedWorkflowDagStep(appState, task, failedRun, failure);
  return mapRunRecord(failedRun);
}

function startLinkedWorkflowDagStep(appState: AppStateDatabase, task: TaskRecord): void {
  const link = resolveWorkflowDagStepLink(task);
  if (!link) {
    return;
  }
  new LocalWorkflowStateService(appState).startStep(link.runId, link.stepId);
}

function completeLinkedWorkflowDagStep(
  appState: AppStateDatabase,
  task: TaskRecord,
  run: RunRecord,
  output: unknown,
  detail: Record<string, unknown> = {}
): void {
  const link = resolveWorkflowDagStepLink(task);
  if (!link) {
    return;
  }
  new LocalWorkflowStateService(appState).completeStep(link.runId, link.stepId, {
    taskRunId: run.id,
    taskId: task.id,
    status: run.status,
    output,
    execution: taskRunExecutionDetail(run),
    ...detail
  });
}

function failLinkedWorkflowDagStep(appState: AppStateDatabase, task: TaskRecord, run: RunRecord, failure: unknown): void {
  const link = resolveWorkflowDagStepLink(task);
  if (!link) {
    return;
  }
  new LocalWorkflowStateService(appState).failStep(link.runId, link.stepId, {
    taskRunId: run.id,
    taskId: task.id,
    status: run.status,
    failure,
    execution: taskRunExecutionDetail(run)
  });
}

function resolveWorkflowDagStepLink(task: TaskRecord): { runId: string; stepId: string } | undefined {
  if (!isRecord(task.provenance) || task.provenance.source !== "workflow-template") {
    return undefined;
  }
  const runId = task.provenance.workflowDagRunId;
  const stepId = task.provenance.workflowDagStepId;
  if (typeof runId !== "string" || !runId.trim() || typeof stepId !== "string" || !stepId.trim()) {
    return undefined;
  }
  return { runId, stepId };
}

function taskRunExecutionDetail(run: RunRecord): Record<string, unknown> {
  return {
    ...(run.backend ? { backend: run.backend } : {}),
    ...(run.agentId ? { agentId: run.agentId } : {}),
    ...(run.agentVersion ? { agentVersion: run.agentVersion } : {}),
    ...(run.startedAt ? { startedAt: run.startedAt } : {}),
    ...(run.endedAt ? { endedAt: run.endedAt } : {})
  };
}

function waitForExit(
  child: ChildProcessWithoutNullStreams,
  backend: TaskExecutionBackend,
  safety: ResolvedTaskRunSafety
): Promise<{ code: number | null; signal: NodeJS.Signals | null; safetyStop?: TaskRunSafetyStop }> {
  return new Promise((resolveExit, reject) => {
    let safetyStop: TaskRunSafetyStop | undefined;
    let forceKillTimeout: NodeJS.Timeout | undefined;
    const runtimeTimeout = setTimeout(() => {
      safetyStop = createRuntimeSafetyStop(backend, safety);
      child.kill("SIGTERM");
      forceKillTimeout = setTimeout(() => {
        child.kill("SIGKILL");
      }, 1000);
      forceKillTimeout.unref();
    }, safety.limits.maxRuntimeSeconds * 1000);
    runtimeTimeout.unref();
    child.once("error", (error) => {
      clearTimeout(runtimeTimeout);
      if (forceKillTimeout) {
        clearTimeout(forceKillTimeout);
      }
      reject(error);
    });
    child.once("close", (code, signal) => {
      clearTimeout(runtimeTimeout);
      if (forceKillTimeout) {
        clearTimeout(forceKillTimeout);
      }
      resolveExit({ code, signal, ...(safetyStop ? { safetyStop } : {}) });
    });
  });
}

function isPathInside(parent: string, child: string): boolean {
  const normalizedParent = parent.endsWith("/") ? parent : `${parent}/`;
  return child === parent || child.startsWith(normalizedParent);
}

export function evaluateTaskRunReadiness(appState: AppStateDatabase, task: TaskRecord): TaskWorkbenchRunReadiness {
  task = normalizeTaskRecordRepoInputs(task);
  const checks: TaskWorkbenchRunReadinessCheck[] = [];
  const addCheck = (check: TaskWorkbenchRunReadinessCheck) => checks.push(check);
  addRunModeReadinessCheck(task, addCheck);

  if (task.status !== "ready") {
    addCheck({
      id: "task-status",
      category: "agent",
      status: "blocked",
      label: "Task Status",
      message: `Task is ${task.status}.`,
      nextStep: "Move the task to ready before starting a run."
    });
  }

  if (!task.assignedAgentId) {
    addCheck({
      id: "assigned-agent",
      category: "agent",
      status: "blocked",
      label: "Assigned Agent",
      message: "No agent is assigned.",
      nextStep: "Assign a loaded agent that satisfies the task capability requirements."
    });
    addRepoReadinessChecks(appState, task, addCheck);
    return summarizeRunReadiness(checks);
  }

  const assignment = resolveAssignedAgentForReadiness(appState, task.assignedAgentId, task.assignedAgentVersion);
  if (!assignment) {
    addCheck({
      id: "assigned-agent",
      category: "agent",
      status: "blocked",
      label: "Assigned Agent",
      message: `Assigned agent is unavailable: ${task.assignedAgentId}.`,
      nextStep: "Reload plugins or assign a loaded agent before starting the run."
    });
    addRepoReadinessChecks(appState, task, addCheck);
    return summarizeRunReadiness(checks);
  }

  const { agent, plugin } = assignment;
  const missingCapabilities = task.capabilityRequirements.filter((capability) => !agent.capabilities.includes(capability));
  addCheck({
    id: "assigned-agent",
    category: "agent",
    status: missingCapabilities.length > 0 ? "blocked" : "ok",
    label: "Assigned Agent",
    message:
      missingCapabilities.length > 0
        ? `Assigned agent does not satisfy: ${missingCapabilities.join(", ")}.`
        : `Assigned agent is loaded: ${agent.name}.`,
    nextStep:
      missingCapabilities.length > 0
        ? "Assign an agent with the required capabilities."
        : "No action needed."
  });

  const manifest = normalizeAgentManifest(agent.manifest);
  addProviderReadinessCheck(evaluateAgentProviderReadiness(appState, manifest), addCheck);
  addInputReadinessCheck(manifest, task, addCheck);
  addRepoReadinessChecks(appState, task, addCheck);
  addRuntimeReadinessCheck(manifest, plugin, addCheck);
  addPermissionReadinessCheck(manifest, addCheck);

  return summarizeRunReadiness(checks);
}

function normalizeTaskInputsWithRunMode(inputs: unknown): Record<string, unknown> {
  let values = isRecord(inputs) ? { ...inputs } : {};
  values = normalizeRepositoryInputShape(values);
  if (!Object.prototype.hasOwnProperty.call(values, "runMode")) {
    values.runMode = DEFAULT_TASK_WORKBENCH_RUN_MODE;
  }
  return values;
}

function resolveTaskRunMode(inputs: unknown): TaskWorkbenchRunMode {
  const values = isRecord(inputs) ? inputs : {};
  return isTaskRunMode(values.runMode) ? values.runMode : DEFAULT_TASK_WORKBENCH_RUN_MODE;
}

function isTaskRunMode(value: unknown): value is TaskWorkbenchRunMode {
  return typeof value === "string" && TASK_WORKBENCH_RUN_MODES.includes(value as TaskWorkbenchRunMode);
}

function resolveAssignedAgentForReadiness(
  appState: AppStateDatabase,
  assignedAgentId: string,
  assignedAgentVersion: string | undefined
): { agent: AgentIndexRecord; plugin: PluginIndexRecord } | undefined {
  const agent = appState.agents
    .list()
    .find((candidate) => candidate.id === assignedAgentId && (!assignedAgentVersion || candidate.version === assignedAgentVersion));
  if (!agent) {
    return undefined;
  }
  const plugin = appState.plugins.get(agent.pluginId, agent.pluginVersion);
  if (!plugin || !plugin.enabled || plugin.status !== "loaded" || agent.status !== "loaded") {
    return undefined;
  }
  return { agent, plugin };
}

function evaluateAgentProviderReadiness(appState: AppStateDatabase, manifest: AgentManifestDocument): ProviderReadiness {
  const requirement = normalizeModelProviderRequirement(manifest.agent?.runtime?.modelProvider);
  return evaluateProviderReadiness(requirement ? [requirement] : [], appState.modelProviderConfigs.list());
}

async function resolveTaskModelProvider(
  config: AthenaConfig,
  appState: AppStateDatabase,
  requirement: ModelProviderRequirement
): Promise<ModelProviderRuntimeConfig | undefined> {
  const readiness = evaluateProviderReadiness([requirement], appState.modelProviderConfigs.list());
  if (readiness.status !== "configured" || !readiness.providerId) {
    return undefined;
  }
  const runtimeConfig = await new LocalModelProviderConfigService(config).resolveRuntimeConfig(readiness.providerId);
  return {
    ...runtimeConfig,
    defaultModel: readiness.model ?? runtimeConfig.defaultModel
  };
}

function createAgentTaskRunEnvelope(
  task: TaskRecord,
  agent: AgentIndexRecord,
  run: RunRecord,
  modelProvider?: ModelProviderRuntimeConfig,
  memoryContext?: ResolvedRuntimeMemoryContext
): Record<string, unknown> {
  return {
    task,
    agent: { id: agent.id, version: agent.version },
    run: { id: run.id },
    durableMemory: memoryContext ? sanitizeRuntimeMemoryContext(memoryContext) : { status: "unavailable", operations: {} },
    ...(modelProvider ? { modelProvider } : {})
  };
}

function normalizeTaskRecordRepoInputs(task: TaskRecord): TaskRecord {
  const inputs = isRecord(task.inputs) ? normalizeRepositoryInputShape({ ...task.inputs }) : task.inputs;
  return {
    ...task,
    inputs
  };
}

function normalizeRepositoryInputShape(inputs: Record<string, unknown>): Record<string, unknown> {
  const repo = isRecord(inputs.repo) ? inputs.repo : undefined;
  if (!repo) {
    return inputs;
  }

  const repoPath =
    readNonEmptyString(repo.path) ??
    readNonEmptyString(inputs.repoPath) ??
    readNonEmptyString(repo.workspacePath);

  if (!repoPath) {
    return inputs;
  }

  return {
    ...inputs,
    repo: {
      ...repo,
      path: repoPath
    },
    ...(readNonEmptyString(inputs.repoPath) ? {} : { repoPath })
  };
}

function readNonEmptyString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

function addProviderReadinessCheck(
  readiness: ProviderReadiness,
  addCheck: (check: TaskWorkbenchRunReadinessCheck) => void
): void {
  const blocking = readiness.required && (readiness.status === "missing" || readiness.status === "invalid");
  addCheck({
    id: "model-provider",
    category: "provider",
    status: blocking ? "blocked" : readiness.status === "configured" || readiness.status === "untested" ? "ok" : "warning",
    label: "Model Provider",
    message: readiness.message,
    nextStep: blocking ? "Configure a valid model provider in Settings before starting the run." : "No action needed."
  });
}

function addInputReadinessCheck(
  manifest: AgentManifestDocument,
  task: TaskRecord,
  addCheck: (check: TaskWorkbenchRunReadinessCheck) => void
): void {
  try {
    validateTaskInputs(manifest.agent?.inputs, task.inputs);
    addCheck({
      id: "task-inputs",
      category: "agent",
      status: "ok",
      label: "Task Inputs",
      message: "Task inputs satisfy the assigned agent manifest.",
      nextStep: "No action needed."
    });
  } catch (error) {
    addCheck({
      id: "task-inputs",
      category: "agent",
      status: "blocked",
      label: "Task Inputs",
      message: error instanceof Error ? error.message : "Task inputs are invalid.",
      nextStep: "Update task inputs so every required manifest input is present and correctly typed."
    });
  }
}

function addRepoReadinessChecks(
  appState: AppStateDatabase,
  task: TaskRecord,
  addCheck: (check: TaskWorkbenchRunReadinessCheck) => void
): void {
  const inputs = isRecord(task.inputs) ? task.inputs : {};
  const repo = isRecord(inputs.repo) ? inputs.repo : undefined;
  const repoId = typeof repo?.id === "string" ? repo.id : undefined;
  const repoPath =
    readNonEmptyString(repo?.path) ??
    readNonEmptyString(inputs.repoPath) ??
    readNonEmptyString(repo?.workspacePath);
  if (!repoId && !repoPath) {
    addCheck({
      id: "repo-context",
      category: "repo",
      status: "warning",
      label: "Repository Context",
      message: "No connected repository context is attached to this task.",
      nextStep: "Attach a connected repository when the agent needs local repo files."
    });
    return;
  }

  const record = repoId
    ? appState.connectedRepositories.get(repoId)
    : appState.connectedRepositories.list().find((candidate) => candidate.workspacePath === repoPath);
  const status = record?.status ?? (typeof repo?.status === "string" ? repo.status : undefined);
  if (!record && repoId) {
    addCheck({
      id: "repo-context",
      category: "repo",
      status: "blocked",
      label: "Repository Context",
      message: `Connected repository is missing: ${repoId}.`,
      nextStep: "Reconnect the repository or update the task repo context before starting the run."
    });
    return;
  }
  if (status && status !== "ready") {
    addCheck({
      id: "repo-context",
      category: "repo",
      status: "blocked",
      label: "Repository Context",
      message: `Connected repository is ${status}.`,
      nextStep: "Inspect or fix the repository connection before starting the run."
    });
    return;
  }
  if (repoPath && !existsSync(repoPath)) {
    addCheck({
      id: "repo-context",
      category: "repo",
      status: "blocked",
      label: "Repository Context",
      message: `Repository path is not accessible to this runtime: ${repoPath}.`,
      nextStep: "Inspect or reconnect the repository using a workspace path visible to the API/runtime."
    });
    return;
  }
  if (repoPath) {
    try {
      if (!statSync(repoPath).isDirectory()) {
        addCheck({
          id: "repo-context",
          category: "repo",
          status: "blocked",
          label: "Repository Context",
          message: `Repository path is not a directory: ${repoPath}.`,
          nextStep: "Reconnect the repository using a directory path visible to the API/runtime."
        });
        return;
      }
    } catch (error) {
      addCheck({
        id: "repo-context",
        category: "repo",
        status: "blocked",
        label: "Repository Context",
        message: error instanceof Error ? error.message : `Unable to inspect repository path: ${repoPath}.`,
        nextStep: "Inspect or reconnect the repository using a workspace path visible to the API/runtime."
      });
      return;
    }
  }
  addCheck({
    id: "repo-context",
    category: "repo",
    status: "ok",
    label: "Repository Context",
    message: record ? `Repository is ready: ${record.name}.` : `Repository path is supplied: ${repoPath}.`,
    nextStep: "No action needed."
  });
}

function addRuntimeReadinessCheck(
  manifest: AgentManifestDocument,
  plugin: PluginIndexRecord,
  addCheck: (check: TaskWorkbenchRunReadinessCheck) => void
): void {
  try {
    const execution = resolveTaskExecution(manifest, plugin);
    resolveTaskRunSafety(manifest, execution.backend);
    addCheck({
      id: "runtime",
      category: "runtime",
      status: "ok",
      label: "Runtime",
      message: `${backendLabel(execution.backend)} runtime can start this agent.`,
      nextStep: "No action needed."
    });
  } catch (error) {
    addCheck({
      id: "runtime",
      category: "runtime",
      status: "blocked",
      label: "Runtime",
      message: error instanceof Error ? error.message : "Runtime requirements are invalid.",
      nextStep: "Fix the agent implementation/runtime manifest before starting the run."
    });
  }
}

function addRunModeReadinessCheck(
  task: TaskRecord,
  addCheck: (check: TaskWorkbenchRunReadinessCheck) => void
): void {
  const inputs = isRecord(task.inputs) ? task.inputs : {};
  const rawRunMode = inputs.runMode;
  if (rawRunMode !== undefined && !isTaskRunMode(rawRunMode)) {
    addCheck({
      id: "run-mode",
      category: "permissions",
      status: "blocked",
      label: "Run Mode",
      message: `Unsupported run mode: ${String(rawRunMode)}.`,
      nextStep: `Use one of: ${TASK_WORKBENCH_RUN_MODES.join(", ")}.`
    });
    return;
  }

  const runMode = resolveTaskRunMode(task.inputs);
  if (runMode === "approved-write") {
    addCheck({
      id: "run-mode",
      category: "permissions",
      status: "blocked",
      label: "Run Mode",
      message: "Approved write mode is not available until approval implementation exists.",
      nextStep: "Use read-only or propose-changes mode. Proposed changes must be returned as artifacts."
    });
    return;
  }

  addCheck({
    id: "run-mode",
    category: "permissions",
    status: runMode === "propose-changes" ? "warning" : "ok",
    label: "Run Mode",
    message:
      runMode === "propose-changes"
        ? "Agent may propose file changes as artifacts, but changes are not applied automatically."
        : "Run mode defaults to read-only; file mutations are not applied automatically.",
    nextStep:
      runMode === "propose-changes"
        ? "Review proposed-change artifacts after the run."
        : "Switch to propose-changes when you want diff artifacts for operator review."
  });
}

function addPermissionReadinessCheck(
  manifest: AgentManifestDocument,
  addCheck: (check: TaskWorkbenchRunReadinessCheck) => void
): void {
  const safety = (() => {
    try {
      return resolveTaskRunSafety(manifest, resolveDeclaredBackend(manifest));
    } catch {
      return undefined;
    }
  })();
  const required = safety?.approvalRequiredFor ?? normalizeStringArray(manifest.agent?.permissions?.approvalRequiredFor, "permissions.approvalRequiredFor");
  addCheck({
    id: "permissions",
    category: "permissions",
    status: required.length > 0 ? "warning" : "ok",
    label: "Permissions",
    message: required.length > 0 ? `Run may require approval for: ${required.join(", ")}.` : "No approval-gated permissions declared.",
    nextStep: required.length > 0 ? "Review the agent permission requirements before starting the run." : "No action needed."
  });
}

function resolveDeclaredBackend(manifest: AgentManifestDocument): TaskExecutionBackend {
  const type = manifest.agent?.implementation?.type;
  if (type === "container-command") {
    return "container-command";
  }
  if (type === "http" || type === "http-api") {
    return "http-api";
  }
  return "local-process";
}

function summarizeRunReadiness(checks: TaskWorkbenchRunReadinessCheck[]): TaskWorkbenchRunReadiness {
  const blocked = checks.filter((check) => check.status === "blocked");
  const warnings = checks.filter((check) => check.status === "warning");
  if (blocked.length > 0) {
    return {
      status: "blocked",
      ready: false,
      summary: `Run readiness blocked: ${blocked.map((check) => check.message).join(" ")}`,
      checks
    };
  }
  if (warnings.length > 0) {
    return {
      status: "ready-with-warnings",
      ready: true,
      summary: `Run readiness has ${warnings.length} warning${warnings.length === 1 ? "" : "s"}.`,
      checks
    };
  }
  return {
    status: "ready",
    ready: true,
    summary: "Run readiness checks passed.",
    checks
  };
}

function mapTaskRecord(record: TaskRecord, appState?: AppStateDatabase): TaskWorkbenchTask {
  const latestRun = appState?.runs.list({ targetType: "task", targetId: record.id, limit: 1 })[0];
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
    ...(record.archivedAt ? { archivedAt: record.archivedAt } : {}),
    ...(appState ? { runReadiness: evaluateTaskRunReadiness(appState, record) } : {}),
    ...(latestRun ? { latestRun: mapRunSummaryRecord(latestRun) } : {})
  };
}

function mapRunSummaryRecord(record: RunRecord): TaskWorkbenchTaskRunSummary {
  return {
    id: record.id,
    status: record.status,
    ...(record.backend ? { backend: record.backend } : {}),
    ...(record.agentId ? { agentId: record.agentId } : {}),
    ...(record.agentVersion ? { agentVersion: record.agentVersion } : {}),
    ...(record.startedAt ? { startedAt: record.startedAt } : {}),
    ...(record.endedAt ? { endedAt: record.endedAt } : {}),
    createdAt: record.createdAt,
    updatedAt: record.updatedAt
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
    ...(record.verificationStatus ? { verificationStatus: record.verificationStatus } : {}),
    ...(record.verificationFailures ? { verificationFailures: record.verificationFailures } : {}),
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

function resolveTaskRunArtifactContent(
  appState: AppStateDatabase,
  run: RunRecord,
  artifact: ArtifactMetadataRecord
): TaskWorkbenchArtifactContent {
  if (!artifact.storageUri.startsWith("memory://")) {
    return resolveLocalFileArtifactContent(appState, run, artifact);
  }
  if (!isSafeMemoryArtifactUri(artifact.storageUri)) {
    throw new AthenaError("CONFIG_ERROR", "Artifact storageUri is not a supported memory artifact URI.");
  }
  return mapArtifactContent(selectMemoryArtifactContent(isRecord(run.output) ? run.output : {}, artifact), artifact);
}

function resolveLocalFileArtifactContent(
  appState: AppStateDatabase,
  run: RunRecord,
  artifact: ArtifactMetadataRecord
): TaskWorkbenchArtifactContent {
  if (!isLocalFileArtifactUri(artifact.storageUri)) {
    const scheme = artifact.storageUri.includes(":") ? artifact.storageUri.split(":", 1)[0] : "unknown";
    throw new AthenaError("CONFIG_ERROR", `Artifact content is not available for storage URI scheme '${scheme}'.`);
  }
  if (!run.agentId) {
    throw new AthenaError("CONFIG_ERROR", "Artifact content cannot be resolved without a producing agent.");
  }
  const agent = appState.agents
    .list()
    .find((candidate) => candidate.id === run.agentId && (!run.agentVersion || candidate.version === run.agentVersion));
  if (!agent) {
    throw new AthenaError("CONFIG_ERROR", `producing agent not found: ${run.agentId}`);
  }
  const plugin = appState.plugins.get(agent.pluginId, agent.pluginVersion);
  if (!plugin) {
    throw new AthenaError("CONFIG_ERROR", `producing plugin not found: ${agent.pluginId}@${agent.pluginVersion}`);
  }
  const artifactPath = resolveLocalArtifactPath(plugin, artifact.storageUri);
  if (!existsSync(artifactPath)) {
    throw new AthenaError("PROVIDER_NOT_FOUND", `Artifact file content not found for ${artifact.id}.`);
  }
  const content = readFileSync(artifactPath, "utf8");
  return mapArtifactContent(content, artifact);
}

function mapArtifactContent(content: unknown, artifact: ArtifactMetadataRecord): TaskWorkbenchArtifactContent {
  if (content === undefined) {
    throw new AthenaError("PROVIDER_NOT_FOUND", `Artifact ${artifact.id} is metadata-only; no preview content was recorded.`);
  }
  if (artifact.format === "json" || isJsonLike(content)) {
    return {
      kind: "json",
      value: typeof content === "string" ? JSON.parse(content) as unknown : content,
      mediaType: "application/json"
    };
  }
  return {
    kind: "text",
    text: typeof content === "string" ? content : JSON.stringify(content, null, 2),
    mediaType: mediaTypeForArtifactFormat(artifact.format)
  };
}

function isLocalFileArtifactUri(value: string): boolean {
  return value.startsWith("file://") || (!value.includes(":") && !isAbsolute(value));
}

function resolveLocalArtifactPath(plugin: PluginIndexRecord, storageUri: string): string {
  const pluginRoot = resolve(plugin.path);
  const relativeArtifactPath = storageUri.startsWith("file://") ? fileURLToPath(storageUri) : storageUri;
  if (isAbsolute(relativeArtifactPath)) {
    const resolvedFilePath = resolve(relativeArtifactPath);
    if (!isPathInside(pluginRoot, resolvedFilePath)) {
      throw new AthenaError("CONFIG_ERROR", "Artifact file URI must stay inside the producing plugin directory.");
    }
    return resolvedFilePath;
  }
  const resolvedRelativePath = resolve(pluginRoot, relativeArtifactPath);
  const boundedArtifactRoot = resolve(pluginRoot, "artifacts");
  if (!isPathInside(boundedArtifactRoot, resolvedRelativePath)) {
    throw new AthenaError("CONFIG_ERROR", "Artifact storageUri must stay inside the producing plugin artifacts directory.");
  }
  return resolvedRelativePath;
}

function selectMemoryArtifactContent(output: Record<string, unknown>, artifact: ArtifactMetadataRecord): unknown {
  const metadata = isRecord(artifact.metadata) ? artifact.metadata : {};
  if (metadata.metadataOnly === true || metadata.contentAvailable === false || metadata.previewAvailable === false) {
    return undefined;
  }
  const contentKey = typeof metadata.contentKey === "string" ? metadata.contentKey : undefined;
  if (contentKey && output[contentKey] !== undefined) {
    return output[contentKey];
  }
  if (artifact.format === "markdown") {
    for (const key of ["responseMarkdown", "summaryMarkdown", "markdown"]) {
      if (typeof output[key] === "string") {
        return output[key];
      }
    }
  }
  if (artifact.format === "json" && output.artifact !== undefined) {
    return output.artifact;
  }
  if (artifact.format === "json" && Object.keys(output).length > 0) {
    return output;
  }
  return undefined;
}

function isSafeMemoryArtifactUri(value: string): boolean {
  if (value.includes("/../") || value.endsWith("/..")) {
    return false;
  }
  try {
    const parsed = new URL(value);
    return parsed.protocol === "memory:" && parsed.hostname.length > 0 && !parsed.pathname.split("/").some((part) => part === "..");
  } catch {
    return false;
  }
}

function isJsonLike(value: unknown): boolean {
  return typeof value === "object" && value !== null;
}

function mediaTypeForArtifactFormat(format: string): string {
  if (format === "markdown") {
    return "text/markdown";
  }
  if (format === "diff" || format === "patch") {
    return "text/x-diff";
  }
  return "text/plain";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
