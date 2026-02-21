import type { WorkflowRunObservability } from "../../shared/contracts.js";

export function formatWorkflowStatus(snapshot: WorkflowRunObservability): string {
  const lines = [
    `workflowId=${snapshot.workflow.id} runId=${snapshot.run.id} status=${snapshot.run.status}`,
    `progress=${snapshot.progress.completedSteps}/${snapshot.progress.totalSteps} (${snapshot.progress.percentComplete.toFixed(2)}%) running=${snapshot.progress.runningSteps} failed=${snapshot.progress.failedSteps} pending=${snapshot.progress.pendingSteps}`,
    formatWorkflowEta(snapshot),
    "nodes:"
  ];
  for (const node of snapshot.nodes) {
    const marker = formatWorkflowNodeMarker(node.status);
    const blockers =
      node.dependencyReadiness.blockingStepIds.length > 0
        ? ` blocking=${node.dependencyReadiness.blockingStepIds.join(",")}`
        : "";
    const artifactRef = snapshot.artifactRefs.find((entry) => entry.stepId === node.stepId)?.artifactRef;
    const artifact = artifactRef ? ` artifactRef=${artifactRef}` : "";
    lines.push(
      `  ${marker} ${node.stepId} attempt=${node.attempt} deps=${node.dependencyReadiness.readyDependencies}/${node.dependencyReadiness.totalDependencies}${blockers}${artifact}`
    );
  }
  return lines.join("\n");
}

function formatWorkflowEta(snapshot: WorkflowRunObservability): string {
  const eta = snapshot.eta;
  if (eta.source === "completed") {
    return `eta=completed sampleSize=${eta.historicalSampleSize}`;
  }
  if (eta.source === "insufficient-history") {
    return `eta=insufficient-history sampleSize=${eta.historicalSampleSize}`;
  }
  return `eta=${eta.estimatedRemainingMs ?? 0}ms completionAt=${eta.estimatedCompletionAt ?? "unknown"} sampleSize=${eta.historicalSampleSize}`;
}

function formatWorkflowNodeMarker(status: WorkflowRunObservability["run"]["status"]): string {
  switch (status) {
    case "ok":
      return "[OK]";
    case "running":
      return "[..]";
    case "failed":
      return "[!!]";
    default:
      return "[  ]";
  }
}
