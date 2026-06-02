import { describe, expect, it } from "vitest";
import {
  durableMemoryStatusLabel,
  durableMemoryStatusTone,
  memoryPreview,
  namespaceFromParts,
  provenanceSummary,
  retrievalDiagnosticsSummary,
  retrievalMatchSummary,
} from "./inspectorModel";

describe("durable memory inspector model", () => {
  it("labels status tones for remote, cached, and unavailable memory", () => {
    expect(durableMemoryStatusTone("remote-current")).toBe("pass");
    expect(durableMemoryStatusTone("cache-stale")).toBe("warn");
    expect(durableMemoryStatusTone("remote-unavailable")).toBe("fail");
    expect(durableMemoryStatusLabel("conflict-review-required")).toBe("Conflict Review Required");
  });

  it("summarizes provenance references without rendering event payloads", () => {
    expect(
      provenanceSummary({
        sourceKind: "artifact",
        artifactId: "artifact-1",
        runId: "run-1",
        createdByAction: "write",
      }),
    ).toBe("Artifact via run run-1, artifact artifact-1");
  });

  it("builds namespace input and compact previews", () => {
    expect(namespaceFromParts("repository", "  repo-1  ")).toEqual({ scope: "repository", id: "repo-1" });
    expect(
      memoryPreview({
        id: "mem-1",
        namespace: { scope: "workspace", id: "workspace-1" },
        provenance: { sourceKind: "system", actorType: "system", createdByAction: "write" },
        memoryType: "note",
        body: "a".repeat(220),
        sensitivity: "internal",
        status: "active",
        createdAt: "2026-06-02T12:00:00.000Z",
        updatedAt: "2026-06-02T12:00:00.000Z",
      }),
    ).toHaveLength(180);
  });

  it("summarizes retrieval diagnostics without backend internals", () => {
    expect(
      retrievalDiagnosticsSummary({
        requestedMode: "hybrid",
        effectiveMode: "keyword",
        degraded: true,
        degradationReasons: ["semantic retrieval requires a configured semantic index adapter"],
        providerCapabilities: {
          keyword: true,
          semantic: false,
          hybrid: false,
        },
        omitted: [{ category: "namespace-mismatch", count: 2 }],
      }),
    ).toEqual([
      { label: "Requested", value: "Hybrid" },
      { label: "Effective", value: "Keyword" },
      { label: "Fallback", value: "Degraded", tone: "warn" },
      { label: "Capabilities", value: "keyword" },
    ]);
    expect(
      retrievalMatchSummary({
        recordId: "memory-1",
        score: 0.82,
        signals: [
          { kind: "keyword", score: 0.65 },
          { kind: "recency", score: 0.1 },
        ],
      }),
    ).toBe("score 0.82 via keyword:0.65, recency:0.10");
  });
});
