import type {
  AppStateDatabase,
  WorkflowDagRunSnapshot,
  WorkflowDagStepRecord,
  WorkflowTemplateIndexRecord
} from "../app-state/index.js";
import { parseWorkflowTemplateDag, type WorkflowTemplateDagTask } from "../workflow-template-dag.js";

export interface WorkflowStateTemplateTask extends WorkflowTemplateDagTask {
  id: string;
}

export interface CreateWorkflowStateRunRequest {
  workflowTemplateId: string;
  workspaceId?: string;
  workflowTemplateVersion?: string;
  pluginId?: string;
  pluginVersion?: string;
  tasks: WorkflowStateTemplateTask[];
  runId?: string;
  now?: Date;
}

export class LocalWorkflowStateService {
  constructor(private readonly appState: AppStateDatabase) {}

  createRun(request: CreateWorkflowStateRunRequest): WorkflowDagRunSnapshot {
    const dag = parseWorkflowTemplateDag(request.tasks);
    return this.appState.workflowDagRuns.create({
      id: request.runId,
      workspaceId: request.workspaceId,
      workflowTemplateId: request.workflowTemplateId,
      workflowTemplateVersion: request.workflowTemplateVersion,
      pluginId: request.pluginId,
      pluginVersion: request.pluginVersion,
      stepOrder: dag.taskOrder,
      dependencies: dag.dependenciesByTaskId,
      now: request.now
    });
  }

  createRunFromTemplate(template: WorkflowTemplateIndexRecord, options: { runId?: string; workspaceId?: string; now?: Date } = {}): WorkflowDagRunSnapshot {
    return this.createRun({
      runId: options.runId,
      workspaceId: options.workspaceId,
      workflowTemplateId: template.id,
      workflowTemplateVersion: template.version,
      pluginId: template.pluginId,
      pluginVersion: template.pluginVersion,
      tasks: extractTemplateTasks(template.manifest),
      now: options.now
    });
  }

  loadRun(runId: string): WorkflowDagRunSnapshot | undefined {
    return this.appState.workflowDagRuns.getSnapshot(runId);
  }

  requireRun(runId: string): WorkflowDagRunSnapshot {
    return this.appState.workflowDagRuns.requireSnapshot(runId);
  }

  startStep(runId: string, stepId: string, now: Date = new Date()): WorkflowDagRunSnapshot {
    return this.appState.db.transaction(() => {
      const snapshot = this.appState.workflowDagRuns.requireSnapshot(runId);
      const step = requireStep(snapshot, stepId);
      const timestamp = now.toISOString();
      const attempt = step.attempt + 1;
      this.appState.workflowDagRuns.updateRun(runId, {
        status: "running",
        startedAt: snapshot.run.startedAt ?? timestamp,
        finishedAt: null,
        now
      });
      this.appState.workflowDagRuns.updateStep(runId, stepId, {
        status: "running",
        attempt,
        ready: false,
        startedAt: timestamp,
        finishedAt: null,
        failure: undefined,
        now
      });
      this.appState.workflowDagRuns.startAttempt({
        runId,
        stepId,
        attempt,
        startedAt: timestamp,
        now
      });
      this.appState.workflowDagRuns.appendEvent({
        runId,
        stepId,
        type: "workflow.step.started",
        message: `Workflow step ${stepId} started.`,
        payload: { attempt },
        timestamp
      });
      return this.recomputeReadiness(runId, now);
    })();
  }

  completeStep(runId: string, stepId: string, output: unknown = {}, now: Date = new Date()): WorkflowDagRunSnapshot {
    return this.appState.db.transaction(() => {
      const snapshot = this.appState.workflowDagRuns.requireSnapshot(runId);
      const step = requireStep(snapshot, stepId);
      const timestamp = now.toISOString();
      this.appState.workflowDagRuns.updateStep(runId, stepId, {
        status: "completed",
        ready: false,
        finishedAt: timestamp,
        output,
        now
      });
      this.appState.workflowDagRuns.finishAttempt({
        runId,
        stepId,
        attempt: step.attempt,
        status: "completed",
        finishedAt: timestamp,
        output,
        now
      });
      this.appState.workflowDagRuns.appendEvent({
        runId,
        stepId,
        type: "workflow.step.completed",
        message: `Workflow step ${stepId} completed.`,
        payload: { attempt: step.attempt },
        timestamp
      });
      return this.finalizeRun(this.recomputeReadiness(runId, now), now);
    })();
  }

  failStep(runId: string, stepId: string, failure: unknown, now: Date = new Date()): WorkflowDagRunSnapshot {
    return this.appState.db.transaction(() => {
      const snapshot = this.appState.workflowDagRuns.requireSnapshot(runId);
      const step = requireStep(snapshot, stepId);
      const timestamp = now.toISOString();
      this.appState.workflowDagRuns.updateStep(runId, stepId, {
        status: "failed",
        ready: false,
        finishedAt: timestamp,
        failure,
        now
      });
      this.appState.workflowDagRuns.updateRun(runId, {
        status: "failed",
        failure: { stepId, detail: failure },
        finishedAt: timestamp,
        now
      });
      this.appState.workflowDagRuns.finishAttempt({
        runId,
        stepId,
        attempt: step.attempt,
        status: "failed",
        finishedAt: timestamp,
        failure,
        now
      });
      this.appState.workflowDagRuns.appendEvent({
        runId,
        stepId,
        type: "workflow.step.failed",
        level: "error",
        message: `Workflow step ${stepId} failed.`,
        payload: { attempt: step.attempt, failure },
        timestamp
      });
      return this.recomputeReadiness(runId, now);
    })();
  }

  cancelStep(runId: string, stepId: string, cancellation: unknown, now: Date = new Date()): WorkflowDagRunSnapshot {
    return this.appState.db.transaction(() => {
      const snapshot = this.appState.workflowDagRuns.requireSnapshot(runId);
      const step = requireStep(snapshot, stepId);
      if (step.status === "cancelled") {
        return snapshot;
      }
      const timestamp = now.toISOString();
      this.appState.workflowDagRuns.updateStep(runId, stepId, {
        status: "cancelled",
        ready: false,
        finishedAt: timestamp,
        failure: cancellation,
        now
      });
      this.appState.workflowDagRuns.updateRun(runId, {
        status: "cancelled",
        failure: { stepId, detail: cancellation },
        finishedAt: timestamp,
        now
      });
      if (step.attempt > 0) {
        this.appState.workflowDagRuns.finishAttempt({
          runId,
          stepId,
          attempt: step.attempt,
          status: "cancelled",
          finishedAt: timestamp,
          failure: cancellation,
          now
        });
      }
      this.appState.workflowDagRuns.appendEvent({
        runId,
        stepId,
        type: "workflow.step.cancelled",
        level: "warning",
        message: `Workflow step ${stepId} cancelled.`,
        payload: { attempt: step.attempt, cancellation },
        timestamp
      });
      return this.recomputeReadiness(runId, now);
    })();
  }

  recoverStaleRunningSteps(runId: string, now: Date = new Date()): WorkflowDagRunSnapshot {
    return this.appState.db.transaction(() => {
      const snapshot = this.appState.workflowDagRuns.requireSnapshot(runId);
      const runningSteps = snapshot.steps.filter((step) => step.status === "running");
      if (runningSteps.length === 0) {
        return snapshot;
      }
      const timestamp = now.toISOString();
      for (const step of runningSteps) {
        const failure = {
          code: "STALE_RUNNING_STEP",
          message: "Recovered stale running step after restart."
        };
        this.appState.workflowDagRuns.updateStep(runId, step.stepId, {
          status: "failed",
          ready: false,
          finishedAt: timestamp,
          failure,
          now
        });
        this.appState.workflowDagRuns.finishAttempt({
          runId,
          stepId: step.stepId,
          attempt: step.attempt,
          status: "failed",
          finishedAt: timestamp,
          failure,
          now
        });
      }
      this.appState.workflowDagRuns.updateRun(runId, {
        status: "resumable",
        failure: {
          code: "STALE_RUNNING_STEPS",
          stepIds: runningSteps.map((step) => step.stepId)
        },
        finishedAt: timestamp,
        now
      });
      this.appState.workflowDagRuns.appendEvent({
        runId,
        type: "workflow.recovered_stale_steps",
        level: "warning",
        message: "Recovered stale running workflow steps after restart.",
        payload: { stepIds: runningSteps.map((step) => step.stepId) },
        timestamp
      });
      return this.recomputeReadiness(runId, now);
    })();
  }

  resumeFromFirstFailedStep(runId: string, now: Date = new Date()): WorkflowDagRunSnapshot {
    return this.appState.db.transaction(() => {
      const snapshot = this.appState.workflowDagRuns.requireSnapshot(runId);
      const firstFailedStep = snapshot.steps.find((step) => step.status === "failed");
      if (!firstFailedStep) {
        return this.recomputeReadiness(runId, now);
      }
      const affectedStepIds = collectDescendantStepIds(snapshot, firstFailedStep.stepId);
      for (const step of snapshot.steps) {
        if (!affectedStepIds.has(step.stepId)) {
          continue;
        }
        this.appState.workflowDagRuns.updateStep(runId, step.stepId, {
          status: "pending",
          ready: false,
          finishedAt: null,
          failure: null,
          now
        });
      }
      this.appState.workflowDagRuns.updateRun(runId, {
        status: "pending",
        failure: null,
        finishedAt: null,
        now
      });
      this.appState.workflowDagRuns.appendEvent({
        runId,
        stepId: firstFailedStep.stepId,
        type: "workflow.resume.prepared",
        message: `Workflow resume prepared from failed step ${firstFailedStep.stepId}.`,
        timestamp: now.toISOString()
      });
      return this.recomputeReadiness(runId, now);
    })();
  }

  recomputeReadiness(runId: string, now: Date = new Date()): WorkflowDagRunSnapshot {
    const snapshot = this.appState.workflowDagRuns.requireSnapshot(runId);
    for (const step of snapshot.steps) {
      const blockingStepIds = step.dependencies.filter((dependencyId) => {
        const dependency = snapshot.steps.find((candidate) => candidate.stepId === dependencyId);
        return dependency?.status !== "completed";
      });
      this.appState.workflowDagRuns.updateStep(runId, step.stepId, {
        ready: step.status === "pending" && blockingStepIds.length === 0,
        blockingStepIds,
        now
      });
    }
    return this.appState.workflowDagRuns.requireSnapshot(runId);
  }

  private finalizeRun(snapshot: WorkflowDagRunSnapshot, now: Date): WorkflowDagRunSnapshot {
    if (snapshot.steps.every((step) => step.status === "completed")) {
      this.appState.workflowDagRuns.updateRun(snapshot.run.id, {
        status: "completed",
        failure: null,
        finishedAt: now.toISOString(),
        now
      });
    } else if (snapshot.run.status !== "failed" && snapshot.run.status !== "resumable") {
      this.appState.workflowDagRuns.updateRun(snapshot.run.id, {
        status: "running",
        now
      });
    }
    return this.appState.workflowDagRuns.requireSnapshot(snapshot.run.id);
  }
}

function extractTemplateTasks(manifest: unknown): WorkflowStateTemplateTask[] {
  if (!isRecord(manifest) || !isRecord(manifest.workflow) || !Array.isArray(manifest.workflow.tasks)) {
    return [];
  }
  return manifest.workflow.tasks.map((task) => {
    if (!isRecord(task) || typeof task.id !== "string") {
      return { id: "" };
    }
    const dependsOn = Array.isArray(task.dependsOn)
      ? task.dependsOn.filter((dependency): dependency is string => typeof dependency === "string")
      : undefined;
    return {
      id: task.id,
      ...(dependsOn ? { dependsOn } : {})
    };
  });
}

function requireStep(snapshot: WorkflowDagRunSnapshot, stepId: string): WorkflowDagStepRecord {
  const step = snapshot.steps.find((candidate) => candidate.stepId === stepId);
  if (!step) {
    throw new Error(`Workflow step not found: ${snapshot.run.id}/${stepId}`);
  }
  return step;
}

function collectDescendantStepIds(snapshot: WorkflowDagRunSnapshot, startStepId: string): Set<string> {
  const visited = new Set<string>();
  const queue = [startStepId];
  while (queue.length > 0) {
    const stepId = queue.shift();
    if (!stepId || visited.has(stepId)) {
      continue;
    }
    visited.add(stepId);
    for (const [candidateStepId, dependencies] of Object.entries(snapshot.run.dependencies)) {
      if (dependencies.includes(stepId)) {
        queue.push(candidateStepId);
      }
    }
  }
  return visited;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
