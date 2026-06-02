import type {
  DurableMemoryInspectorSummary,
  DurableMemoryNamespaceRef,
  DurableMemoryOperatorStatus,
  DurableMemoryProvenanceRef,
  DurableMemoryProviderHealthStatus,
  DurableMemoryRecord,
} from "./types";
import { namespaceLabel } from "./api";

export function durableMemoryStatusTone(
  status: DurableMemoryOperatorStatus | DurableMemoryProviderHealthStatus,
): "pass" | "warn" | "fail" {
  if (status === "remote-current" || status === "cache-current" || status === "ok") {
    return "pass";
  }
  if (status === "remote-unavailable" || status === "unavailable" || status === "unauthorized" || status === "disabled") {
    return "fail";
  }
  return "warn";
}

export function durableMemoryStatusLabel(status: string): string {
  return status
    .split("-")
    .map((part) => part[0]!.toUpperCase() + part.slice(1))
    .join(" ");
}

export function provenanceSummary(provenance: DurableMemoryProvenanceRef): string {
  const refs = [
    provenance.actorId ? `actor ${provenance.actorId}` : undefined,
    provenance.agentId ? `agent ${provenance.agentId}` : undefined,
    provenance.taskId ? `task ${provenance.taskId}` : undefined,
    provenance.runId ? `run ${provenance.runId}` : undefined,
    provenance.workflowRunId ? `workflow ${provenance.workflowRunId}` : undefined,
    provenance.artifactId ? `artifact ${provenance.artifactId}` : undefined,
    provenance.connectorId ? `connector ${provenance.connectorId}` : undefined,
    provenance.importJobId ? `import ${provenance.importJobId}` : undefined,
  ].filter((value): value is string => Boolean(value));
  return refs.length > 0
    ? `${durableMemoryStatusLabel(provenance.sourceKind)} via ${refs.join(", ")}`
    : durableMemoryStatusLabel(provenance.sourceKind);
}

export function memoryPreview(record: DurableMemoryRecord, maxLength = 180): string {
  const value = record.summary?.trim() || record.body.trim();
  if (value.length <= maxLength) {
    return value;
  }
  return `${value.slice(0, Math.max(0, maxLength - 3)).trimEnd()}...`;
}

export function namespaceFromParts(scope: DurableMemoryNamespaceRef["scope"], id: string): DurableMemoryNamespaceRef {
  return { scope, id: id.trim() || "default" };
}

export function inspectorCounts(summary: DurableMemoryInspectorSummary): Array<{ label: string; value: string }> {
  return [
    { label: "Records", value: String(summary.totalRecords) },
    { label: "Proposals", value: String(summary.proposals.length) },
    { label: "Snapshots", value: String(summary.snapshots.length) },
    { label: "Namespace", value: summary.records[0] ? namespaceLabel(summary.records[0].namespace) : "Current scope" },
  ];
}
