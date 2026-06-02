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
        },
      ],
    });

    expect(result.operatorStatus).toBe("cache-stale");
    expect(result.records[0]).toMatchObject({
      id: "mem-1",
      summary: "Short summary",
      provider: {
        providerId: "durable-memory",
        operatorStatus: "cache-stale",
      },
    });
    expect(namespaceLabel(result.records[0]!.namespace)).toBe("workspace:workspace-1 / repository:repo-1");
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
          status: "pending",
          createdAt: "2026-06-02T12:00:00.000Z",
        },
      ]);
    expect(proposals[0]?.provenance).toMatchObject({
      sourceKind: "operator",
      actorId: "alice",
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
