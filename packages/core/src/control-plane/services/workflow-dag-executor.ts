import { AthenaError } from "../../runtime/errors.js";
import type { AthenaConfig } from "../../shared/config.js";
import type { TaskWorkbenchTaskRun } from "../../shared/contracts.js";
import type { AppStateDatabase, TaskRecord, WorkflowDagRunSnapshot, WorkflowDagStepRecord } from "../app-state/index.js";
import { openAppStateDatabase } from "../app-state/index.js";
import { LocalTaskWorkbenchService } from "./task-workbench.js";
import { LocalWorkflowStateService } from "./workflow-state.js";

export interface LocalWorkflowDagExecutorOptions {
  appState?: AppStateDatabase;
}

export interface WorkflowDagExecutionResult {
  runId: string;
  status: WorkflowDagRunSnapshot["run"]["status"];
  executedStepIds: string[];
  snapshot: WorkflowDagRunSnapshot;
}

type RetryFailurePhase = "runtime-start" | "execution" | "provider" | "verification" | "artifact-export" | "connector-rate-limit";

interface WorkflowTaskRetryPolicy {
  maxAttempts: number;
  backoff: "none" | "fixed" | "linear" | "exponential";
  retryableFailurePhases: RetryFailurePhase[];
  idempotency: "read-only" | "idempotent" | "non-idempotent";
  externalWriteRetry: "forbid" | "require-approval" | "allow";
}

interface RetryDecision {
  retry: boolean;
  reason: "no-policy" | "exhausted" | "phase-not-retryable" | "unsafe-non-idempotent-write" | "eligible";
  phase: RetryFailurePhase;
  attempt: number;
  maxAttempts: number;
}

export class LocalWorkflowDagExecutorService {
  constructor(
    private readonly config: AthenaConfig,
    private readonly options: LocalWorkflowDagExecutorOptions = {}
  ) {}

  async execute(runId: string): Promise<WorkflowDagExecutionResult> {
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

  async resume(runId: string): Promise<WorkflowDagExecutionResult> {
    return this.withAppStateAsync(async (appState) => {
      const workflowState = new LocalWorkflowStateService(appState);
      workflowState.recoverStaleRunningSteps(runId);
      const resumable = workflowState.resumeFromFirstFailedStep(runId);
      resetProjectedTasksForPendingSteps(appState, resumable);
      return this.execute(runId);
    });
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

function evaluateRetryDecision(task: TaskRecord, step: WorkflowDagStepRecord, taskRun: TaskWorkbenchTaskRun): RetryDecision {
  const phase = classifyRetryFailurePhase(taskRun.failure, taskRun);
  const policy = retryPolicyFromTask(task);
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

function retryPolicyFromTask(task: TaskRecord): WorkflowTaskRetryPolicy | undefined {
  if (!isRecord(task.provenance) || !isRecord(task.provenance.retryPolicy)) {
    return undefined;
  }
  const policy = task.provenance.retryPolicy;
  if (
    typeof policy.maxAttempts !== "number" ||
    !Number.isInteger(policy.maxAttempts) ||
    !isRetryBackoff(policy.backoff) ||
    !Array.isArray(policy.retryableFailurePhases) ||
    !isRetryIdempotency(policy.idempotency) ||
    !isExternalWriteRetry(policy.externalWriteRetry)
  ) {
    return undefined;
  }
  const retryableFailurePhases = policy.retryableFailurePhases.filter(isRetryFailurePhase);
  if (retryableFailurePhases.length === 0) {
    return undefined;
  }
  return {
    maxAttempts: policy.maxAttempts,
    backoff: policy.backoff,
    retryableFailurePhases,
    idempotency: policy.idempotency,
    externalWriteRetry: policy.externalWriteRetry
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

function isRetryBackoff(value: unknown): value is WorkflowTaskRetryPolicy["backoff"] {
  return value === "none" || value === "fixed" || value === "linear" || value === "exponential";
}

function isRetryFailurePhase(value: unknown): value is RetryFailurePhase {
  return (
    value === "runtime-start" ||
    value === "execution" ||
    value === "provider" ||
    value === "verification" ||
    value === "artifact-export" ||
    value === "connector-rate-limit"
  );
}

function isRetryIdempotency(value: unknown): value is WorkflowTaskRetryPolicy["idempotency"] {
  return value === "read-only" || value === "idempotent" || value === "non-idempotent";
}

function isExternalWriteRetry(value: unknown): value is WorkflowTaskRetryPolicy["externalWriteRetry"] {
  return value === "forbid" || value === "require-approval" || value === "allow";
}
