import type {
  DurableMemoryInspectorSummary,
  DurableMemoryNamespaceRef,
  DurableMemoryOperatorStatus,
  DurableMemoryProvenanceRef,
  DurableMemoryProviderHealthStatus,
  DurableMemoryRecord,
  DurableMemoryRetrievalDiagnostics,
  DurableMemorySearchMatch,
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

export function retrievalDiagnosticsSummary(
  diagnostics: DurableMemoryRetrievalDiagnostics | undefined,
): Array<{ label: string; value: string; tone?: "pass" | "warn" | "fail" }> {
  if (!diagnostics) {
    return [
      { label: "Mode", value: "List" },
      { label: "Fallback", value: "None", tone: "pass" },
    ];
  }
  return [
    { label: "Requested", value: durableMemoryStatusLabel(diagnostics.requestedMode) },
    { label: "Effective", value: durableMemoryStatusLabel(diagnostics.effectiveMode) },
    { label: "Fallback", value: diagnostics.degraded ? "Degraded" : "None", tone: diagnostics.degraded ? "warn" : "pass" },
    {
      label: "Capabilities",
      value: [
        diagnostics.providerCapabilities.keyword ? "keyword" : undefined,
        diagnostics.providerCapabilities.semantic ? "semantic" : undefined,
        diagnostics.providerCapabilities.hybrid ? "hybrid" : undefined,
      ]
        .filter((value): value is string => Boolean(value))
        .join(", ") || "none",
    },
  ];
}

export function retrievalMatchSummary(match: DurableMemorySearchMatch): string {
  const signals = match.signals.map((signal) => `${signal.kind}:${signal.score.toFixed(2)}`).join(", ");
  return signals ? `score ${match.score.toFixed(2)} via ${signals}` : `score ${match.score.toFixed(2)}`;
}
