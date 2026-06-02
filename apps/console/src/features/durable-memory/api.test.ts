import { describe, expect, it } from "vitest";
import {
  namespaceLabel,
  parseDurableMemoryHealth,
  parseDurableMemoryProposals,
  parseDurableMemoryRecordListResult,
  parseDurableMemorySearchResult,
  parseDurableMemorySnapshotListResult,
} from "./api";

describe("durable memory api model", () => {
  it("normalizes records with namespace, provenance, and provider status metadata", () => {
    const result = parseDurableMemorySearchResult({
      total: 1,
      operatorStatus: "cache-stale",
      matches: [
        {
          recordId: "mem-1",
          score: 0.82,
          snippet: "Short summary",
          signals: [
            { kind: "keyword", score: 0.65, evidence: "body-or-summary" },
            { kind: "recency", score: 0.1, evidence: "2026-06-02T12:01:00.000Z" },
          ],
        },
      ],
      diagnostics: {
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
      },
      records: [
        {
          id: "mem-1",
          namespace: {
            scope: "repository",
            id: "repo-1",
            parent: { scope: "workspace", id: "workspace-1" },
          },
          provenance: {
            sourceKind: "agent",
            actorType: "agent",
            agentId: "research-agent",
            runId: "run-1",
            createdByAction: "write",
          },
          memoryType: "finding",
          body: "Long memory body",
          summary: "Short summary",
          sensitivity: "internal",
          status: "active",
          createdAt: "2026-06-02T12:00:00.000Z",
          updatedAt: "2026-06-02T12:01:00.000Z",
          provider: {
            providerId: "durable-memory",
            syncStatus: "cache-stale",
            operatorStatus: "cache-stale",
            localDevOnly: false,
          },
          embedding: {
            status: "stale",
            providerId: "openai-embeddings",
            model: "text-embedding-3-small",
            backendKind: "chroma",
            indexRevision: "idx-7",
            reindexReason: "record-updated",
          },
        },
      ],
    });

    expect(result.operatorStatus).toBe("cache-stale");
    expect(result.matches?.[0]).toMatchObject({
      recordId: "mem-1",
      score: 0.82,
      signals: [expect.objectContaining({ kind: "keyword" }), expect.objectContaining({ kind: "recency" })],
    });
    expect(result.diagnostics).toMatchObject({
      requestedMode: "hybrid",
      effectiveMode: "keyword",
      degraded: true,
      degradationReasons: ["semantic retrieval requires a configured semantic index adapter"],
      omitted: [{ category: "namespace-mismatch", count: 2 }],
    });
    expect(result.records[0]).toMatchObject({
      id: "mem-1",
      summary: "Short summary",
      provider: {
        providerId: "durable-memory",
        operatorStatus: "cache-stale",
      },
      embedding: {
        status: "stale",
        providerId: "openai-embeddings",
        reindexReason: "record-updated",
      },
    });
    expect(namespaceLabel(result.records[0]!.namespace)).toBe("workspace:workspace-1 / repository:repo-1");
  });

  it("normalizes absent, current, stale, and failed embedding lifecycle states", () => {
    const result = parseDurableMemoryRecordListResult({
      records: [
        {
          id: "mem-current",
          namespace: { scope: "workspace", id: "workspace-1" },
          provenance: { sourceKind: "operator", actorType: "operator", actorId: "alice", createdByAction: "write" },
          memoryType: "note",
          body: "Current embedding.",
          sensitivity: "internal",
          status: "active",
          createdAt: "2026-06-02T12:00:00.000Z",
          updatedAt: "2026-06-02T12:00:00.000Z",
          embedding: {
            status: "indexed",
            providerId: "openai-embeddings",
            model: "text-embedding-3-small",
            modelVersion: "2026-06-02",
            backendKind: "chroma",
            indexRevision: "idx-1",
            indexedAt: "2026-06-02T12:01:00.000Z",
          },
        },
        {
          id: "mem-stale",
          namespace: { scope: "workspace", id: "workspace-1" },
          provenance: { sourceKind: "operator", actorType: "operator", actorId: "alice", createdByAction: "write" },
          memoryType: "note",
          body: "Stale embedding.",
          sensitivity: "internal",
          status: "active",
          createdAt: "2026-06-02T12:00:00.000Z",
          updatedAt: "2026-06-02T12:00:00.000Z",
          embedding: {
            status: "stale",
            reindexReason: "model-changed",
          },
        },
        {
          id: "mem-failed",
          namespace: { scope: "workspace", id: "workspace-1" },
          provenance: { sourceKind: "operator", actorType: "operator", actorId: "alice", createdByAction: "write" },
          memoryType: "note",
          body: "Failed embedding.",
          sensitivity: "internal",
          status: "active",
          createdAt: "2026-06-02T12:00:00.000Z",
          updatedAt: "2026-06-02T12:00:00.000Z",
          embedding: {
            status: "failed",
            failureCode: "provider-unavailable",
            failureReason: "Provider unavailable.",
          },
        },
        {
          id: "mem-absent",
          namespace: { scope: "workspace", id: "workspace-1" },
          provenance: { sourceKind: "operator", actorType: "operator", actorId: "alice", createdByAction: "write" },
          memoryType: "note",
          body: "No embedding metadata.",
          sensitivity: "internal",
          status: "active",
          createdAt: "2026-06-02T12:00:00.000Z",
          updatedAt: "2026-06-02T12:00:00.000Z",
        },
      ],
    });

    expect(result.records.map((record) => record.embedding?.status ?? "absent")).toEqual(["indexed", "stale", "failed", "absent"]);
    expect(result.records[0]?.embedding).toMatchObject({
      status: "indexed",
      model: "text-embedding-3-small",
      indexRevision: "idx-1",
    });
    expect(result.records[2]?.embedding).toMatchObject({
      status: "failed",
      failureCode: "provider-unavailable",
    });
  });

  it("parses health, proposal, and snapshot views without requiring raw event payloads", () => {
    expect(
      parseDurableMemoryHealth({
        providerId: "durable-memory",
        status: "unauthorized",
        operatorStatus: "remote-unavailable",
        checkedAt: "2026-06-02T12:00:00.000Z",
        message: "Token missing",
      }),
    ).toMatchObject({
      status: "unauthorized",
      operatorStatus: "remote-unavailable",
    });

    const proposals = parseDurableMemoryProposals([
        {
          id: "proposal-1",
          targetNamespace: { scope: "workspace", id: "workspace-1" },
          provenance: { sourceKind: "operator", actorType: "operator", actorId: "alice", createdByAction: "proposal-create" },
          memoryType: "note",
          proposedBody: "Proposed text",
          reason: "operator review",
          status: "archived",
          createdAt: "2026-06-02T12:00:00.000Z",
          reviewedAt: "2026-06-02T12:30:00.000Z",
          reviewedBy: "alice",
        },
      ]);
    expect(proposals[0]?.provenance).toMatchObject({
      sourceKind: "operator",
      actorId: "alice",
    });
    expect(proposals[0]).toMatchObject({
      status: "archived",
      reviewedBy: "alice",
    });

    expect(
      parseDurableMemorySnapshotListResult({
        snapshots: [
          {
            id: "snapshot-1",
            namespace: { scope: "workspace", id: "workspace-1" },
            provenance: { sourceKind: "system", actorType: "system", createdByAction: "snapshot-create" },
            recordIds: ["mem-1", 12],
            createdAt: "2026-06-02T12:00:00.000Z",
            reason: "backup",
          },
        ],
      }).snapshots[0]?.recordIds,
    ).toEqual(["mem-1"]);
  });

  it("throws on malformed list envelopes", () => {
    expect(() => parseDurableMemoryRecordListResult({ records: {} })).toThrow("record list");
    expect(() => parseDurableMemorySearchResult({ records: {} })).toThrow("search");
    expect(() => parseDurableMemoryProposals({ proposals: [] })).toThrow("proposal list");
  });
});
