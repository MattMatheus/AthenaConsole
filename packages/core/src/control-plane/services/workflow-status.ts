import { createHash } from "node:crypto";
import { AthenaError } from "../../runtime/errors.js";
import type { AthenaConfig } from "../../shared/config.js";
import type { WorkflowRunGraphStatus, WorkflowRunStatusNode, WorkflowRunStatusTaskRunEvidence } from "../../shared/contracts.js";
import { resolveAppStateProvider, type AppStateDatabase, type AppStateProvider, type AppStateProviderOptions, type WorkflowDagRunSnapshot } from "../app-state/index.js";

export interface LocalWorkflowStatusServiceOptions extends AppStateProviderOptions {}

export class LocalWorkflowStatusService {
  private readonly appStateProvider: AppStateProvider;

  constructor(
    private readonly config: AthenaConfig,
    private readonly options: LocalWorkflowStatusServiceOptions = {}
  ) {
    this.appStateProvider = resolveAppStateProvider(config, options);
  }

  async getStatus(runId: string): Promise<WorkflowRunGraphStatus> {
    return this.withAppState((appState) => {
      const snapshot = appState.workflowDagRuns.getSnapshot(runId);
      if (!snapshot) {
        throw new AthenaError("CONFIG_ERROR", `workflowRuns.status.runId must reference an existing workflow run. Received: ${runId}.`);
      }
      return buildWorkflowRunGraphStatus(snapshot, appState);
    });
  }

  async getRunWorkspaceId(runId: string): Promise<string> {
    return this.withAppState((appState) => {
      const run = appState.workflowDagRuns.get(runId);
      if (!run) {
        throw new AthenaError("CONFIG_ERROR", `workflowRuns.status.runId must reference an existing workflow run. Received: ${runId}.`);
      }
      return run.workspaceId;
    });
  }

  private withAppState<T>(read: (appState: AppStateDatabase) => T): T {
    return this.appStateProvider.withAppState(read);
  }
}

export function buildWorkflowRunGraphStatus(snapshot: WorkflowDagRunSnapshot, appState?: AppStateDatabase): WorkflowRunGraphStatus {
  const dependentsByStepId = buildDependentsByStepId(snapshot);
  const nodes: WorkflowRunStatusNode[] = snapshot.run.stepOrder.map((stepId) => {
    const step = snapshot.steps.find((candidate) => candidate.stepId === stepId);
    if (!step) {
      throw new AthenaError("SESSION_IO_ERROR", `Workflow status snapshot is missing step state: ${stepId}.`);
    }
    const readyDependencies = step.dependencies.length - step.blockingStepIds.length;
    return {
      id: step.stepId,
      status: step.status,
      ready: step.ready,
      attempt: step.attempt,
      attemptHistory: snapshot.attempts
        .filter((attempt) => attempt.stepId === step.stepId)
        .map((attempt) => ({
          attempt: attempt.attempt,
          status: attempt.status,
          startedAt: attempt.startedAt,
          ...(attempt.finishedAt ? { finishedAt: attempt.finishedAt } : {}),
          ...(attempt.failure !== undefined ? { failure: attempt.failure } : {}),
          ...(attempt.output !== undefined ? { output: attempt.output } : {})
        })),
      dependencies: [...step.dependencies],
      dependents: dependentsByStepId.get(step.stepId) ?? [],
      blockingStepIds: [...step.blockingStepIds],
      readiness: {
        totalDependencies: step.dependencies.length,
        readyDependencies,
        blocked: step.status === "pending" && step.blockingStepIds.length > 0
      },
      timestamps: {
        updatedAt: step.updatedAt,
        ...(step.startedAt ? { startedAt: step.startedAt } : {}),
        ...(step.finishedAt ? { finishedAt: step.finishedAt } : {})
      },
      ...(step.failure !== undefined ? { failure: step.failure } : {}),
      ...(step.failure !== undefined
        ? {
            recovery: {
              resumable: true,
              reason: isStaleRunningStepFailure(step.failure) ? "stale-running-step" : "failed"
            }
          }
        : {}),
      ...(appState ? taskRunEvidenceForStep(appState, step.output) : {}),
      ...(step.output !== undefined ? { output: step.output } : {})
    };
  });

  const completedSteps = nodes.filter((node) => node.status === "completed").length;
  const runningSteps = nodes.filter((node) => node.status === "running").length;
  const failedSteps = nodes.filter((node) => node.status === "failed").length;
  const pendingSteps = nodes.filter((node) => node.status === "pending").length;
  const readySteps = nodes.filter((node) => node.ready).length;
  const blockedSteps = nodes.filter((node) => node.readiness.blocked).length;
  const staleRecoveredStepIds = nodes
    .filter((node) => node.recovery?.reason === "stale-running-step")
    .map((node) => node.id);
  const failedStepIds = nodes.filter((node) => node.status === "failed").map((node) => node.id);

  const status: WorkflowRunGraphStatus = {
    run: {
      id: snapshot.run.id,
      workspaceId: snapshot.run.workspaceId,
      status: snapshot.run.status,
      workflowTemplate: {
        id: snapshot.run.workflowTemplateId,
        ...(snapshot.run.workflowTemplateVersion ? { version: snapshot.run.workflowTemplateVersion } : {}),
        ...(snapshot.run.pluginId ? { pluginId: snapshot.run.pluginId } : {}),
        ...(snapshot.run.pluginVersion ? { pluginVersion: snapshot.run.pluginVersion } : {})
      },
      createdAt: snapshot.run.createdAt,
      updatedAt: snapshot.run.updatedAt,
      ...(snapshot.run.startedAt ? { startedAt: snapshot.run.startedAt } : {}),
      ...(snapshot.run.finishedAt ? { finishedAt: snapshot.run.finishedAt } : {}),
      ...(snapshot.run.failure !== undefined ? { failure: snapshot.run.failure } : {})
    },
    progress: {
      totalSteps: nodes.length,
      completedSteps,
      runningSteps,
      failedSteps,
      pendingSteps,
      readySteps,
      blockedSteps,
      percentComplete: nodes.length === 0 ? 0 : Math.round((completedSteps / nodes.length) * 100)
    },
    nodes,
    edges: Object.entries(snapshot.run.dependencies).flatMap(([to, dependencies]) =>
      dependencies.map((from) => ({
        from,
        to
      }))
    ),
    events: snapshot.events.map((event) => ({
      id: event.id,
      ...(event.stepId ? { stepId: event.stepId } : {}),
      type: event.type,
      level: event.level,
      message: event.message,
      timestamp: event.timestamp,
      ...(event.payload !== undefined ? { payload: event.payload } : {})
    })),
    recovery: {
      resumable: failedStepIds.length > 0 || snapshot.run.status === "resumable",
      failedStepIds,
      staleRecoveredStepIds
    },
    polling: {
      recommendedIntervalMs: snapshot.run.status === "running" ? 1_000 : 5_000,
      etag: createHash("sha256").update(`${snapshot.run.id}:${snapshot.run.updatedAt}:${snapshot.events.length}`).digest("hex")
    }
  };
  return status;
}

function taskRunEvidenceForStep(appState: AppStateDatabase, output: unknown): { taskRunEvidence?: WorkflowRunStatusTaskRunEvidence } {
  const taskRunId = taskRunIdFromStepOutput(output);
  if (!taskRunId) {
    return {};
  }
  const run = appState.runs.get(taskRunId);
  if (!run) {
    return {};
  }
  const artifacts = appState.artifacts.listForRun(taskRunId).map((artifact) => ({
    id: artifact.id,
    label: artifact.label,
    kind: artifact.kind,
    format: artifact.format
  }));
  return {
    taskRunEvidence: {
      id: run.id,
      status: run.status,
      ...(run.output !== undefined ? { outputSummary: summarizeTaskRunOutput(run.output) } : {}),
      artifactCount: artifacts.length,
      artifacts
    }
  };
}

function taskRunIdFromStepOutput(output: unknown): string | undefined {
  if (!output || typeof output !== "object" || Array.isArray(output)) {
    return undefined;
  }
  const taskRunId = (output as { taskRunId?: unknown }).taskRunId;
  return typeof taskRunId === "string" && taskRunId.trim().length > 0 ? taskRunId : undefined;
}

function summarizeTaskRunOutput(output: unknown): string {
  if (typeof output === "string") {
    return truncateSummary(output);
  }
  if (typeof output === "number" || typeof output === "boolean") {
    return String(output);
  }
  if (!output || typeof output !== "object" || Array.isArray(output)) {
    return truncateSummary(JSON.stringify(output));
  }
  const record = output as Record<string, unknown>;
  for (const key of ["summary", "message", "result", "stepPurpose", "objective"]) {
    const value = record[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return truncateSummary(value);
    }
  }
  return truncateSummary(JSON.stringify(output));
}

function truncateSummary(value: string): string {
  const trimmed = value.trim();
  return trimmed.length > 220 ? `${trimmed.slice(0, 217)}...` : trimmed;
}

function buildDependentsByStepId(snapshot: WorkflowDagRunSnapshot): Map<string, string[]> {
  const dependentsByStepId = new Map(snapshot.run.stepOrder.map((stepId) => [stepId, [] as string[]]));
  for (const [to, dependencies] of Object.entries(snapshot.run.dependencies)) {
    for (const from of dependencies) {
      const dependents = dependentsByStepId.get(from) ?? [];
      dependents.push(to);
      dependentsByStepId.set(from, dependents);
    }
  }
  for (const [stepId, dependents] of dependentsByStepId.entries()) {
    dependentsByStepId.set(stepId, dependents.sort((left, right) => left.localeCompare(right)));
  }
  return dependentsByStepId;
}

function isStaleRunningStepFailure(failure: unknown): boolean {
  return !!failure && typeof failure === "object" && !Array.isArray(failure) && (failure as { code?: unknown }).code === "STALE_RUNNING_STEP";
}
