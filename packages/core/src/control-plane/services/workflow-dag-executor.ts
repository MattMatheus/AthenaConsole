import { AthenaError } from "../../runtime/errors.js";
import type { AthenaConfig } from "../../shared/config.js";
import type { AppStateDatabase, WorkflowDagRunSnapshot, WorkflowDagStepRecord } from "../app-state/index.js";
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
          break;
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

function selectNextReadyStep(snapshot: WorkflowDagRunSnapshot): WorkflowDagStepRecord | undefined {
  for (const stepId of snapshot.run.stepOrder) {
    const step = snapshot.steps.find((candidate) => candidate.stepId === stepId);
    if (step?.status === "pending" && step.ready) {
      return step;
    }
  }
  return undefined;
}
