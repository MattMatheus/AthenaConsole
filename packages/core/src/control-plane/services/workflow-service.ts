import { AthenaError } from "../../runtime/errors.js";
import type {
  Workflow,
  WorkflowCreateRequest,
  WorkflowListQuery,
  WorkflowListResult,
  WorkflowRun,
  WorkflowRunObservability
} from "../../shared/contracts.js";
import type { RunService, WorkflowService } from "../interfaces.js";
import type { StateStore } from "../state-store.js";
import { clampLimit, decodeOffsetCursor, encodeOffsetCursor } from "./pagination.js";
import { buildWorkflowRunObservabilitySnapshot } from "./workflow-observability.js";
import { WorkflowExecutor } from "./workflow-executor.js";
import { assertWorkflowStepReferences, validateAndNormalizeWorkflowDefinition } from "./workflow-validation.js";

export class LocalWorkflowService implements WorkflowService {
  private readonly executor: WorkflowExecutor;

  constructor(
    private readonly stateStore: StateStore,
    private readonly runService: RunService
  ) {
    this.executor = new WorkflowExecutor(this.stateStore, this.runService);
  }

  async list(query: WorkflowListQuery = {}): Promise<WorkflowListResult> {
    const limit = clampLimit(query.limit ?? 50, 1, 500);
    const offset = decodeOffsetCursor(query.cursor);
    const workflows = await this.stateStore.listWorkflows();
    const items = workflows.slice(offset, offset + limit);
    const nextOffset = offset + items.length;
    return {
      items,
      ...(nextOffset < workflows.length ? { nextCursor: encodeOffsetCursor(nextOffset) } : {})
    };
  }

  async create(request: WorkflowCreateRequest): Promise<Workflow> {
    const normalizedDefinition = validateAndNormalizeWorkflowDefinition(request.definition);
    await assertWorkflowStepReferences(this.stateStore, normalizedDefinition);
    return this.stateStore.createWorkflow({
      definition: normalizedDefinition
    });
  }

  async status(id: string): Promise<WorkflowRunObservability> {
    const workflow = await this.resolveWorkflow(id, "workflows.status.id");
    const runs = await this.stateStore.listWorkflowRuns(workflow.id);
    const latestRun = runs[0];
    if (!latestRun) {
      throw new AthenaError("CONFIG_ERROR", `workflows.status.id has no workflow runs. Received: ${id}.`);
    }
    return buildWorkflowRunObservabilitySnapshot(workflow, latestRun, runs);
  }

  async resume(id: string): Promise<WorkflowRun> {
    const workflow = await this.resolveWorkflow(id, "workflows.resume.id");
    const latestRun = await this.executor.resolveResumableRun(workflow);
    const recovered = await this.executor.recoverStaleRunningSteps(workflow, latestRun);
    const reset = await this.executor.resetFromFirstFailedNode(workflow, recovered);
    const started = await this.stateStore.transitionWorkflowRun(workflow.id, reset.id, (run) => {
      if (run.status === "ok") {
        return run;
      }
      const now = new Date().toISOString();
      const { finishedAt: _finishedAt, ...runWithoutFinishedAt } = run;
      return {
        ...runWithoutFinishedAt,
        status: "running",
        updatedAt: now,
        ...(run.startedAt ? {} : { startedAt: now }),
        stepStates: this.executor.recomputeDependencyReadiness(workflow, run.stepStates)
      };
    });
    return this.executor.executeReadySteps(workflow, started);
  }

  private async resolveWorkflow(id: string, context: "workflows.resume.id" | "workflows.status.id"): Promise<Workflow> {
    const workflow = await this.stateStore.getWorkflow(id);
    if (workflow) {
      return workflow;
    }
    throw new AthenaError("CONFIG_ERROR", `${context} must reference an existing workflow. Received: ${id}.`);
  }
}
