import { randomUUID } from "node:crypto";
import { AthenaError } from "../../runtime/errors.js";
import type { Workflow, WorkflowDefinition, WorkflowRun, WorkflowRunStepState } from "../../shared/contracts.js";
import type { RunService } from "../interfaces.js";
import type { StateStore } from "../state-store.js";

export class WorkflowExecutor {
  constructor(
    private readonly stateStore: StateStore,
    private readonly runService: RunService
  ) {}

  async resolveResumableRun(workflow: Workflow): Promise<WorkflowRun> {
    const runs = await this.stateStore.listWorkflowRuns(workflow.id);
    const resumable = runs.find((run) => run.status !== "ok");
    if (resumable) {
      return resumable;
    }
    return this.stateStore.createWorkflowRun({
      workflowId: workflow.id,
      stepOrder: workflow.definition.steps.map((step) => step.id),
      stepStates: buildInitialWorkflowStepStates(workflow),
      ...(runs[0] ? { resumedFromRunId: runs[0].id } : {})
    });
  }

  async recoverStaleRunningSteps(workflow: Workflow, run: WorkflowRun): Promise<WorkflowRun> {
    if (!Object.values(run.stepStates).some((step) => step.status === "running")) {
      return run;
    }
    return this.stateStore.transitionWorkflowRun(workflow.id, run.id, (current) => {
      const now = new Date().toISOString();
      const nextStates = cloneWorkflowRunStepStates(current.stepStates);
      for (const state of Object.values(nextStates)) {
        if (state.status !== "running") {
          continue;
        }
        state.status = "pending";
        state.ready = false;
        state.updatedAt = now;
        state.checkpoint = {
          attempt: Math.max(1, state.attempt),
          ...(state.checkpoint?.startedAt ? { startedAt: state.checkpoint.startedAt } : {}),
          finishedAt: now,
          error: "Recovered stale running step after restart."
        };
      }
      const { finishedAt: _finishedAt, ...currentWithoutFinishedAt } = current;
      return {
        ...currentWithoutFinishedAt,
        status: "pending",
        stepStates: this.recomputeDependencyReadiness(workflow, nextStates),
        executionLog: [
          ...current.executionLog,
          makeWorkflowRunLogEntry("info", "Recovered stale running steps to pending state during resume.")
        ],
        updatedAt: now
      };
    });
  }

  async resetFromFirstFailedNode(workflow: Workflow, run: WorkflowRun): Promise<WorkflowRun> {
    const firstFailed = workflow.definition.steps.find((step) => run.stepStates[step.id]?.status === "failed");
    if (!firstFailed) {
      return run;
    }
    const descendants = collectDescendantStepIds(workflow.definition, firstFailed.id);
    return this.stateStore.transitionWorkflowRun(workflow.id, run.id, (current) => {
      const now = new Date().toISOString();
      const nextStates = cloneWorkflowRunStepStates(current.stepStates);
      for (const [stepId, state] of Object.entries(nextStates)) {
        if (!descendants.has(stepId) || state.status === "ok") {
          continue;
        }
        state.status = "pending";
        state.ready = false;
        state.updatedAt = now;
      }
      const { finishedAt: _finishedAt, ...currentWithoutFinishedAt } = current;
      return {
        ...currentWithoutFinishedAt,
        status: "pending",
        stepStates: this.recomputeDependencyReadiness(workflow, nextStates),
        executionLog: [
          ...current.executionLog,
          makeWorkflowRunLogEntry("info", `Resuming workflow from first failed step: ${firstFailed.id}.`, firstFailed.id)
        ],
        updatedAt: now
      };
    });
  }

  async executeReadySteps(workflow: Workflow, run: WorkflowRun): Promise<WorkflowRun> {
    let current = run;
    while (true) {
      const nextStep = workflow.definition.steps.find((step) => {
        const state = current.stepStates[step.id];
        return !!state && state.status === "pending" && state.ready;
      });
      if (!nextStep) {
        return this.finalizeWorkflowRun(workflow, current);
      }
      const startedAt = new Date().toISOString();
      const running = await this.stateStore.transitionWorkflowRun(workflow.id, current.id, (snapshot) => {
        const state = snapshot.stepStates[nextStep.id];
        if (!state) {
          throw new AthenaError("SESSION_IO_ERROR", `Missing workflow step state: ${nextStep.id}.`);
        }
        const nextStates = cloneWorkflowRunStepStates(snapshot.stepStates);
        nextStates[nextStep.id] = {
          ...state,
          status: "running",
          attempt: state.attempt + 1,
          ready: false,
          updatedAt: startedAt,
          checkpoint: {
            attempt: state.attempt + 1,
            startedAt
          }
        };
        return {
          ...snapshot,
          status: "running",
          stepStates: this.recomputeDependencyReadiness(workflow, nextStates),
          executionLog: [
            ...snapshot.executionLog,
            makeWorkflowRunLogEntry("info", `Step ${nextStep.id} started (attempt ${state.attempt + 1}).`, nextStep.id)
          ],
          updatedAt: startedAt,
          ...(snapshot.startedAt ? {} : { startedAt })
        };
      });

      try {
        const result = await this.runService.run({
          sessionId: buildWorkflowStepSessionId(workflow.id, running.id, nextStep.id),
          directiveId: nextStep.directiveId,
          harnessProfileId: nextStep.harnessProfileId,
          metadata: {
            workflowId: workflow.id,
            workflowRunId: running.id,
            workflowStepId: nextStep.id
          }
        });
        const finishedAt = new Date().toISOString();
        current = await this.stateStore.transitionWorkflowRun(workflow.id, running.id, (snapshot) => {
          const state = snapshot.stepStates[nextStep.id];
          if (!state) {
            throw new AthenaError("SESSION_IO_ERROR", `Missing workflow step state: ${nextStep.id}.`);
          }
          const nextStates = cloneWorkflowRunStepStates(snapshot.stepStates);
          nextStates[nextStep.id] = {
            ...state,
            status: "ok",
            updatedAt: finishedAt,
            checkpoint: {
              attempt: state.attempt,
              ...(state.checkpoint?.startedAt ? { startedAt: state.checkpoint.startedAt } : {}),
              finishedAt,
              artifact: {
                kind: "run-result",
                output: result.output,
                provider: result.provider,
                model: result.model,
                createdAt: result.createdAt
              }
            }
          };
          return {
            ...snapshot,
            status: "running",
            stepStates: this.recomputeDependencyReadiness(workflow, nextStates),
            executionLog: [...snapshot.executionLog, makeWorkflowRunLogEntry("info", `Step ${nextStep.id} completed.`, nextStep.id)],
            updatedAt: finishedAt
          };
        });
      } catch (error) {
        const failedAt = new Date().toISOString();
        const message = error instanceof Error ? error.message : String(error);
        current = await this.stateStore.transitionWorkflowRun(workflow.id, running.id, (snapshot) => {
          const state = snapshot.stepStates[nextStep.id];
          if (!state) {
            throw new AthenaError("SESSION_IO_ERROR", `Missing workflow step state: ${nextStep.id}.`);
          }
          const nextStates = cloneWorkflowRunStepStates(snapshot.stepStates);
          nextStates[nextStep.id] = {
            ...state,
            status: "failed",
            updatedAt: failedAt,
            checkpoint: {
              attempt: state.attempt,
              ...(state.checkpoint?.startedAt ? { startedAt: state.checkpoint.startedAt } : {}),
              finishedAt: failedAt,
              error: message
            }
          };
          return {
            ...snapshot,
            status: "failed",
            stepStates: this.recomputeDependencyReadiness(workflow, nextStates),
            executionLog: [...snapshot.executionLog, makeWorkflowRunLogEntry("error", `Step ${nextStep.id} failed: ${message}`, nextStep.id)],
            updatedAt: failedAt,
            finishedAt: failedAt
          };
        });
        return current;
      }
    }
  }

  recomputeDependencyReadiness(
    workflow: Workflow,
    stepStates: Record<string, WorkflowRunStepState>
  ): Record<string, WorkflowRunStepState> {
    const upstream = buildWorkflowUpstreamMap(workflow.definition);
    const now = new Date().toISOString();
    const nextStates = cloneWorkflowRunStepStates(stepStates);
    for (const step of workflow.definition.steps) {
      const state = nextStates[step.id];
      if (!state) {
        continue;
      }
      const parents = upstream.get(step.id) ?? [];
      const blockingStepIds = parents
        .filter((upstreamId) => nextStates[upstreamId]?.status !== "ok")
        .sort((left, right) => left.localeCompare(right));
      const readyDependencies = parents.length - blockingStepIds.length;
      state.dependencyReadiness = {
        totalDependencies: parents.length,
        readyDependencies,
        blockingStepIds
      };
      state.ready = state.status === "pending" && blockingStepIds.length === 0;
      state.updatedAt = state.updatedAt || now;
    }
    return nextStates;
  }

  private async finalizeWorkflowRun(workflow: Workflow, run: WorkflowRun): Promise<WorkflowRun> {
    return this.stateStore.transitionWorkflowRun(workflow.id, run.id, (snapshot) => {
      const now = new Date().toISOString();
      const states = this.recomputeDependencyReadiness(workflow, cloneWorkflowRunStepStates(snapshot.stepStates));
      const allOk = workflow.definition.steps.every((step) => states[step.id]?.status === "ok");
      const hasFailed = workflow.definition.steps.some((step) => states[step.id]?.status === "failed");
      const status = allOk ? "ok" : hasFailed ? "failed" : "running";
      return {
        ...snapshot,
        status,
        stepStates: states,
        updatedAt: now,
        ...(status === "ok" || status === "failed" ? { finishedAt: now } : {})
      };
    });
  }
}

export function buildInitialWorkflowStepStates(workflow: Workflow): Record<string, WorkflowRunStepState> {
  const now = new Date().toISOString();
  const states: Record<string, WorkflowRunStepState> = {};
  for (const step of workflow.definition.steps) {
    states[step.id] = {
      stepId: step.id,
      status: "pending",
      attempt: 0,
      ready: false,
      dependencyReadiness: {
        totalDependencies: 0,
        readyDependencies: 0,
        blockingStepIds: []
      },
      updatedAt: now
    };
  }
  const upstream = buildWorkflowUpstreamMap(workflow.definition);
  for (const step of workflow.definition.steps) {
    const parents = upstream.get(step.id) ?? [];
    const state = states[step.id];
    if (!state) {
      continue;
    }
    state.dependencyReadiness = {
      totalDependencies: parents.length,
      readyDependencies: parents.length,
      blockingStepIds: []
    };
    state.ready = parents.length === 0;
  }
  return states;
}

function buildWorkflowUpstreamMap(definition: WorkflowDefinition): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const step of definition.steps) {
    map.set(step.id, []);
  }
  for (const dependency of definition.dependencies) {
    const row = map.get(dependency.to);
    if (!row) {
      continue;
    }
    row.push(dependency.from);
  }
  for (const [stepId, row] of map.entries()) {
    map.set(stepId, [...new Set(row)].sort((left, right) => left.localeCompare(right)));
  }
  return map;
}

function collectDescendantStepIds(definition: WorkflowDefinition, startStepId: string): Set<string> {
  const downstream = new Map<string, string[]>();
  for (const step of definition.steps) {
    downstream.set(step.id, []);
  }
  for (const edge of definition.dependencies) {
    const row = downstream.get(edge.from);
    if (row) {
      row.push(edge.to);
    }
  }
  const visited = new Set<string>();
  const queue: string[] = [startStepId];
  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || visited.has(current)) {
      continue;
    }
    visited.add(current);
    for (const next of downstream.get(current) ?? []) {
      queue.push(next);
    }
  }
  return visited;
}

function cloneWorkflowRunStepStates(
  states: Record<string, WorkflowRunStepState>
): Record<string, WorkflowRunStepState> {
  const cloned: Record<string, WorkflowRunStepState> = {};
  for (const [stepId, state] of Object.entries(states)) {
    cloned[stepId] = {
      ...state,
      dependencyReadiness: {
        ...state.dependencyReadiness,
        blockingStepIds: [...state.dependencyReadiness.blockingStepIds]
      },
      ...(state.checkpoint
        ? {
            checkpoint: {
              ...state.checkpoint,
              ...(state.checkpoint.artifact ? { artifact: { ...state.checkpoint.artifact } } : {})
            }
          }
        : {})
    };
  }
  return cloned;
}

function makeWorkflowRunLogEntry(level: "info" | "error", message: string, stepId?: string): WorkflowRun["executionLog"][number] {
  return {
    id: randomUUID(),
    level,
    message,
    createdAt: new Date().toISOString(),
    ...(stepId ? { stepId } : {})
  };
}

function buildWorkflowStepSessionId(workflowId: string, runId: string, stepId: string): string {
  const sanitized = `${workflowId}-${runId}-${stepId}`.replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 48);
  return `wf-${sanitized}-${randomUUID().slice(0, 8)}`;
}
