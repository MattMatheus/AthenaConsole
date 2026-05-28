import { createHash } from "node:crypto";
import { AthenaError } from "../../runtime/errors.js";
import type { AthenaConfig } from "../../shared/config.js";
import type { WorkflowRunGraphStatus, WorkflowRunStatusNode } from "../../shared/contracts.js";
import { openAppStateDatabase, type AppStateDatabase, type WorkflowDagRunSnapshot } from "../app-state/index.js";

export interface LocalWorkflowStatusServiceOptions {
  appState?: AppStateDatabase;
}

export class LocalWorkflowStatusService {
  constructor(
    private readonly config: AthenaConfig,
    private readonly options: LocalWorkflowStatusServiceOptions = {}
  ) {}

  async getStatus(runId: string): Promise<WorkflowRunGraphStatus> {
    return this.withAppState((appState) => {
      const snapshot = appState.workflowDagRuns.getSnapshot(runId);
      if (!snapshot) {
        throw new AthenaError("CONFIG_ERROR", `workflowRuns.status.runId must reference an existing workflow run. Received: ${runId}.`);
      }
      return buildWorkflowRunGraphStatus(snapshot);
    });
  }

  private withAppState<T>(read: (appState: AppStateDatabase) => T): T {
    if (this.options.appState) {
      return read(this.options.appState);
    }
    const appState = openAppStateDatabase(this.config);
    try {
      return read(appState);
    } finally {
      appState.close();
    }
  }
}

export function buildWorkflowRunGraphStatus(snapshot: WorkflowDagRunSnapshot): WorkflowRunGraphStatus {
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
