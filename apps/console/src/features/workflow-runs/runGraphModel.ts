import type {
  WorkflowRunGraphRunStatus,
  WorkflowRunGraphStepStatus,
  WorkflowRunStatusEdge,
  WorkflowRunStatusNode,
} from "./types";

export type WorkflowRunStatusTone = "neutral" | "running" | "success" | "danger" | "warning";

export function workflowRunStatusTone(status: WorkflowRunGraphRunStatus | WorkflowRunGraphStepStatus): WorkflowRunStatusTone {
  if (status === "completed" || status === "skipped") {
    return "success";
  }
  if (status === "failed") {
    return "danger";
  }
  if (status === "resumable") {
    return "warning";
  }
  if (status === "running") {
    return "running";
  }
  return "neutral";
}

export function isWorkflowRunTerminal(status: WorkflowRunGraphRunStatus): boolean {
  return status === "completed" || status === "failed";
}

export function shouldPollWorkflowRun(status: WorkflowRunGraphRunStatus): boolean {
  return !isWorkflowRunTerminal(status);
}

export function dependencyLabel(node: Pick<WorkflowRunStatusNode, "dependencies">): string {
  return node.dependencies.length > 0 ? node.dependencies.join(", ") : "none";
}

export function readinessLabel(node: Pick<WorkflowRunStatusNode, "ready" | "readiness" | "blockingStepIds">): string {
  if (node.ready) {
    return "ready";
  }
  if (node.blockingStepIds.length > 0) {
    return `blocked by ${node.blockingStepIds.join(", ")}`;
  }
  return `${node.readiness.readyDependencies}/${node.readiness.totalDependencies} dependencies ready`;
}

export function formatWorkflowRunDate(value: string | undefined): string {
  if (!value) {
    return "not recorded";
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

export function formatWorkflowRunUnknown(value: unknown): string {
  if (value === undefined) {
    return "";
  }
  if (value === null) {
    return "null";
  }
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export function edgeSummary(edges: WorkflowRunStatusEdge[]): string {
  if (edges.length === 0) {
    return "No dependencies";
  }
  return edges.map((edge) => `${edge.from} -> ${edge.to}`).join(", ");
}

export function taskRunIdFromWorkflowNodeOutput(output: unknown): string | undefined {
  if (!output || typeof output !== "object" || Array.isArray(output)) {
    return undefined;
  }
  const record = output as Record<string, unknown>;
  return typeof record.taskRunId === "string" && record.taskRunId.trim().length > 0 ? record.taskRunId : undefined;
}

export function workflowNodeOutputSummary(node: Pick<WorkflowRunStatusNode, "output" | "taskRunEvidence">): string {
  if (node.taskRunEvidence?.outputSummary) {
    return node.taskRunEvidence.outputSummary;
  }
  if (taskRunIdFromWorkflowNodeOutput(node.output)) {
    return "This workflow step produced a linked task run. Open the task evidence to inspect output and artifacts.";
  }
  if (node.output === undefined) {
    return "No workflow step output was recorded yet.";
  }
  return formatWorkflowRunUnknown(node.output);
}

export function workflowNodeArtifactSummary(node: Pick<WorkflowRunStatusNode, "taskRunEvidence">): string {
  const artifactCount = node.taskRunEvidence?.artifactCount ?? 0;
  if (artifactCount === 0) {
    return "No artifacts recorded";
  }
  return artifactCount === 1 ? "1 artifact recorded" : `${artifactCount} artifacts recorded`;
}
