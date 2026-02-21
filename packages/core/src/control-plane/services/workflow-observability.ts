import type {
  Workflow,
  WorkflowRun,
  WorkflowRunArtifactReference,
  WorkflowRunEta,
  WorkflowRunObservability,
  WorkflowRunProgressMetadata,
  WorkflowRunStepState
} from "../../shared/contracts.js";

export function buildWorkflowRunObservabilitySnapshot(
  workflow: Workflow,
  run: WorkflowRun,
  history: WorkflowRun[]
): WorkflowRunObservability {
  const nodes = toOrderedWorkflowNodes(run);
  const progress = toWorkflowProgressMetadata(nodes);
  const artifactRefs = toWorkflowArtifactReferences(run, nodes);
  const eta = toWorkflowEta(run, nodes, history);
  return {
    workflow,
    run,
    nodes,
    progress,
    artifactRefs,
    eta
  };
}

function toOrderedWorkflowNodes(run: WorkflowRun): WorkflowRunStepState[] {
  const ordered: WorkflowRunStepState[] = [];
  const seen = new Set<string>();
  const cloned = cloneWorkflowRunStepStates(run.stepStates);
  for (const stepId of run.stepOrder) {
    const state = cloned[stepId];
    if (!state) {
      continue;
    }
    ordered.push(state);
    seen.add(stepId);
  }
  const extras = Object.keys(cloned)
    .filter((stepId) => !seen.has(stepId))
    .sort((left, right) => left.localeCompare(right));
  for (const stepId of extras) {
    ordered.push(cloned[stepId]!);
  }
  return ordered;
}

function toWorkflowProgressMetadata(nodes: WorkflowRunStepState[]): WorkflowRunProgressMetadata {
  const totalSteps = nodes.length;
  const completedSteps = nodes.filter((node) => node.status === "ok").length;
  const runningSteps = nodes.filter((node) => node.status === "running").length;
  const failedSteps = nodes.filter((node) => node.status === "failed").length;
  const pendingSteps = nodes.filter((node) => node.status === "pending").length;
  const percentComplete = totalSteps === 0 ? 100 : Math.round((completedSteps / totalSteps) * 10_000) / 100;
  return {
    totalSteps,
    completedSteps,
    runningSteps,
    failedSteps,
    pendingSteps,
    percentComplete
  };
}

function toWorkflowArtifactReferences(run: WorkflowRun, nodes: WorkflowRunStepState[]): WorkflowRunArtifactReference[] {
  const references: WorkflowRunArtifactReference[] = [];
  for (const node of nodes) {
    const artifact = node.checkpoint?.artifact;
    if (!artifact) {
      continue;
    }
    references.push({
      stepId: node.stepId,
      artifactRef: buildWorkflowArtifactRef(run.id, node.stepId, artifact.kind),
      kind: artifact.kind,
      provider: artifact.provider,
      model: artifact.model,
      createdAt: artifact.createdAt,
      outputChars: artifact.output.length
    });
  }
  return references;
}

function toWorkflowEta(run: WorkflowRun, nodes: WorkflowRunStepState[], history: WorkflowRun[]): WorkflowRunEta {
  const computedAt = new Date().toISOString();
  if (run.status === "ok") {
    return {
      computedAt,
      source: "completed",
      historicalSampleSize: 0,
      estimatedRemainingMs: 0,
      ...(run.finishedAt ? { estimatedCompletionAt: run.finishedAt } : {})
    };
  }

  const durationsByStep = collectHistoricalStepDurations(history);
  const sampleSize = Array.from(durationsByStep.values()).reduce((sum, durations) => sum + durations.length, 0);
  const globalAverageMs = computeAverageMs(Array.from(durationsByStep.values()).flat());
  const unresolved = nodes.filter((node) => node.status !== "ok");

  if (unresolved.length === 0) {
    return {
      computedAt,
      source: "completed",
      historicalSampleSize: sampleSize,
      estimatedRemainingMs: 0,
      ...(run.finishedAt ? { estimatedCompletionAt: run.finishedAt } : {})
    };
  }

  let estimatedRemainingMs = 0;
  for (const node of unresolved) {
    const averageStepMs = computeAverageMs(durationsByStep.get(node.stepId) ?? []) ?? globalAverageMs;
    if (averageStepMs === undefined) {
      return {
        computedAt,
        source: "insufficient-history",
        historicalSampleSize: sampleSize
      };
    }
    const startedAtMs = parseIsoToMillis(node.checkpoint?.startedAt);
    if (node.status === "running" && startedAtMs !== undefined) {
      const elapsedMs = Math.max(0, Date.now() - startedAtMs);
      estimatedRemainingMs += Math.max(0, Math.round(averageStepMs - elapsedMs));
      continue;
    }
    estimatedRemainingMs += Math.round(averageStepMs);
  }

  return {
    computedAt,
    source: "historical-average",
    historicalSampleSize: sampleSize,
    estimatedRemainingMs,
    estimatedCompletionAt: new Date(Date.now() + estimatedRemainingMs).toISOString()
  };
}

function collectHistoricalStepDurations(history: WorkflowRun[]): Map<string, number[]> {
  const durationsByStep = new Map<string, number[]>();
  for (const run of history) {
    for (const state of Object.values(run.stepStates)) {
      if (state.status !== "ok") {
        continue;
      }
      const startedAtMs = parseIsoToMillis(state.checkpoint?.startedAt);
      const finishedAtMs = parseIsoToMillis(state.checkpoint?.finishedAt);
      if (startedAtMs === undefined || finishedAtMs === undefined) {
        continue;
      }
      const durationMs = Math.max(0, finishedAtMs - startedAtMs);
      const stepDurations = durationsByStep.get(state.stepId) ?? [];
      stepDurations.push(durationMs);
      durationsByStep.set(state.stepId, stepDurations);
    }
  }
  return durationsByStep;
}

function computeAverageMs(values: number[]): number | undefined {
  if (values.length === 0) {
    return undefined;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function parseIsoToMillis(value: string | undefined): number | undefined {
  if (!value) {
    return undefined;
  }
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function buildWorkflowArtifactRef(runId: string, stepId: string, kind: string): string {
  return `workflow-run:${runId}:step:${stepId}:artifact:${kind}`;
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
