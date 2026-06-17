import { AthenaError } from "../../runtime/errors.js";
import type { AthenaConfig } from "../../shared/config.js";
import type { TaskWorkbenchTaskRun } from "../../shared/contracts.js";
import type { AppStateDatabase, AppStateProvider, AppStateProviderOptions, TaskRecord, WorkflowDagRunSnapshot, WorkflowDagStepRecord } from "../app-state/index.js";
import { resolveAppStateProvider } from "../app-state/index.js";
import { LocalTaskWorkbenchService } from "./task-workbench.js";
import { computeRetryBackoffMs, isRetryFailurePhase, parseWorkflowTaskRetryPolicy, type RetryFailurePhase } from "./workflow-retry-policy.js";
import { LocalWorkflowStateService } from "./workflow-state.js";

export interface LocalWorkflowDagExecutorOptions extends AppStateProviderOptions {
  sleep?: (ms: number) => Promise<void>;
}

export interface WorkflowDagExecutionResult {
  runId: string;
  status: WorkflowDagRunSnapshot["run"]["status"];
  executedStepIds: string[];
  snapshot: WorkflowDagRunSnapshot;
}

interface RetryDecision {
  retry: boolean;
  reason: "no-policy" | "exhausted" | "phase-not-retryable" | "unsafe-non-idempotent-write" | "eligible";
  phase: RetryFailurePhase;
  attempt: number;
  maxAttempts: number;
}

export class LocalWorkflowDagExecutorService {
  private readonly inFlightRuns = new Map<string, Promise<WorkflowDagExecutionResult>>();
  private readonly appStateProvider: AppStateProvider;
  private readonly sleep: (ms: number) => Promise<void>;

  constructor(
    private readonly config: AthenaConfig,
    private readonly options: LocalWorkflowDagExecutorOptions = {}
  ) {
    this.appStateProvider = resolveAppStateProvider(config, options);
    this.sleep = options.sleep ?? defaultWorkflowDagExecutorSleep;
  }

  async execute(runId: string): Promise<WorkflowDagExecutionResult> {
    return this.withRunGuard(runId, () => this.executeInternal(runId));
  }

  async resume(runId: string): Promise<WorkflowDagExecutionResult> {
    return this.withRunGuard(runId, () => this.resumeInternal(runId));
  }

  async getRunWorkspaceId(runId: string): Promise<string> {
    return this.withAppStateAsync(async (appState) => {
      const run = appState.workflowDagRuns.get(runId);
      if (!run) {
        throw new AthenaError("CONFIG_ERROR", `Workflow DAG run not found: ${runId}`);
      }
      return run.workspaceId;
    });
  }

  private async withRunGuard(
    runId: string,
    run: () => Promise<WorkflowDagExecutionResult>
  ): Promise<WorkflowDagExecutionResult> {
    const existing = this.inFlightRuns.get(runId);
    if (existing) {
      return existing;
    }
    const promise = run().finally(() => {
      this.inFlightRuns.delete(runId);
    });
    this.inFlightRuns.set(runId, promise);
    return promise;
  }

  private async executeInternal(runId: string): Promise<WorkflowDagExecutionResult> {
    return this.withAppStateAsync(async (appState) => {
      const executedStepIds: string[] = [];
      const workflowState = new LocalWorkflowStateService(appState);
      let snapshot = workflowState.recomputeReadiness(runId);

      while (snapshot.run.status !== "failed" && snapshot.run.status !== "completed" && snapshot.run.status !== "resumable") {
        const step = selectNextReadyStep(snapshot);
        if (!step) {
          break;
        }
        const task = appState.tasks.findByWorkflowDagStep(runId, step.stepId);
        if (!task) {
          throw new AthenaError(
            "CONFIG_ERROR",
            `workflowDagExecutor.runId step '${step.stepId}' must map to an existing workflow-template task. Received runId=${runId}.`
          );
        }

        const taskWorkbench = new LocalTaskWorkbenchService(this.config, { appState });
        const taskRun = await taskWorkbench.runTask(task.id);
        executedStepIds.push(step.stepId);
        snapshot = workflowState.recomputeReadiness(runId);
        if (taskRun.status !== "completed") {
          const failedStep = snapshot.steps.find((candidate) => candidate.stepId === step.stepId) ?? step;
          const retryDecision = evaluateRetryDecision(task, failedStep, taskRun);
          appState.workflowDagRuns.appendEvent({
            runId,
            stepId: step.stepId,
            type: retryDecision.retry ? "workflow.step.retry_scheduled" : "workflow.step.retry_blocked",
            level: retryDecision.retry ? "warning" : retryDecision.reason === "exhausted" ? "warning" : "info",
            message: retryDecision.retry
              ? `Workflow step ${step.stepId} scheduled for retry.`
              : `Workflow step ${step.stepId} will not be retried: ${retryDecision.reason}.`,
            payload: retryDecision
          });
          if (!retryDecision.retry) {
            break;
          }
          const resumable = workflowState.resumeFromFirstFailedStep(runId);
          resetProjectedTasksForPendingSteps(appState, resumable);
          const policy = parseWorkflowTaskRetryPolicy(task);
          if (policy) {
            await this.sleep(computeRetryBackoffMs(policy.backoff, failedStep.attempt));
          }
          snapshot = workflowState.recomputeReadiness(runId);
          continue;
        }
      }

      return {
        runId,
        status: snapshot.run.status,
        executedStepIds,
        snapshot
      };
    });
  }

  private async resumeInternal(runId: string): Promise<WorkflowDagExecutionResult> {
    return this.withAppStateAsync(async (appState) => {
      const workflowState = new LocalWorkflowStateService(appState);
      workflowState.recoverStaleRunningSteps(runId);
      const resumable = workflowState.resumeFromFirstFailedStep(runId);
      resetProjectedTasksForPendingSteps(appState, resumable);
      return this.executeInternal(runId);
    });
  }

  private async withAppStateAsync<T>(access: (appState: AppStateDatabase) => Promise<T>): Promise<T> {
    return this.appStateProvider.withAppStateAsync(access);
  }
}

function resetProjectedTasksForPendingSteps(appState: AppStateDatabase, snapshot: WorkflowDagRunSnapshot): void {
  for (const step of snapshot.steps) {
    if (step.status !== "pending") {
      continue;
    }
    const task = appState.tasks.findByWorkflowDagStep(snapshot.run.id, step.stepId);
    if (!task || task.status === "ready" || task.status === "completed" || task.status === "archived") {
      continue;
    }
    appState.tasks.update(task.id, { status: "ready" });
  }
}

function defaultWorkflowDagExecutorSleep(ms: number): Promise<void> {
  return ms > 0 ? new Promise((resolve) => setTimeout(resolve, ms)) : Promise.resolve();
}

function evaluateRetryDecision(task: TaskRecord, step: WorkflowDagStepRecord, taskRun: TaskWorkbenchTaskRun): RetryDecision {
  const phase = classifyRetryFailurePhase(taskRun.failure, taskRun);
  const policy = parseWorkflowTaskRetryPolicy(task);
  if (!policy) {
    return {
      retry: false,
      reason: "no-policy",
      phase,
      attempt: step.attempt,
      maxAttempts: 1
    };
  }
  if (step.attempt >= policy.maxAttempts) {
    return {
      retry: false,
      reason: "exhausted",
      phase,
      attempt: step.attempt,
      maxAttempts: policy.maxAttempts
    };
  }
  if (!policy.retryableFailurePhases.includes(phase)) {
    return {
      retry: false,
      reason: "phase-not-retryable",
      phase,
      attempt: step.attempt,
      maxAttempts: policy.maxAttempts
    };
  }
  if (policy.idempotency === "non-idempotent" && policy.externalWriteRetry !== "allow") {
    return {
      retry: false,
      reason: "unsafe-non-idempotent-write",
      phase,
      attempt: step.attempt,
      maxAttempts: policy.maxAttempts
    };
  }
  return {
    retry: true,
    reason: "eligible",
    phase,
    attempt: step.attempt,
    maxAttempts: policy.maxAttempts
  };
}

function classifyRetryFailurePhase(failure: unknown, taskRun: TaskWorkbenchTaskRun): RetryFailurePhase {
  if (taskRun.verificationStatus === "verification-failed") {
    return "verification";
  }
  if (isRecord(failure)) {
    if (failure.status === 429) {
      return "connector-rate-limit";
    }
    if (isRetryFailurePhase(failure.phase)) {
      return failure.phase;
    }
    if (failure.phase === "start") {
      return "runtime-start";
    }
    if (failure.phase === "artifact") {
      return "artifact-export";
    }
    if (failure.phase === "provider") {
      return "provider";
    }
  }
  if (taskRun.status === "stopped-by-limit") {
    return "execution";
  }
  return "execution";
}

function selectNextReadyStep(snapshot: WorkflowDagRunSnapshot): WorkflowDagStepRecord | undefined {
  for (const stepId of snapshot.run.stepOrder) {
    const step = snapshot.steps.find((candidate) => candidate.stepId === stepId);
    if (step?.status === "pending" && step.ready) {
      return step;
    }
  }
  return undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
