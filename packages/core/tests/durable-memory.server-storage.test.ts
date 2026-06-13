import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";
import { SqliteDurableMemoryServerStorage } from "../src/durable-memory/index.js";
import { LocalDurableMemoryService } from "../src/control-plane/services/durable-memory.js";
import type { DurableMemoryNamespaceRef, DurableMemoryProvenanceRef } from "../src/shared/contracts/index.js";

describe("durable memory server storage", () => {
  const workspaceNamespace: DurableMemoryNamespaceRef = {
    scope: "workspace",
    id: "workspace-1",
    parent: {
      scope: "operator",
      id: "operator-1"
    }
  };
  const repositoryNamespace: DurableMemoryNamespaceRef = {
    scope: "repository",
    id: "repo-1",
    parent: workspaceNamespace
  };
  const siblingRepositoryNamespace: DurableMemoryNamespaceRef = {
    scope: "repository",
    id: "repo-2",
    parent: workspaceNamespace
  };
  const provenance: DurableMemoryProvenanceRef = {
    sourceKind: "operator",
    actorType: "operator",
    actorId: "operator-1",
    createdByAction: "operator-note"
  };

  it("persists records with namespace, provenance, source kind, status, and provider metadata", () => {
    const storage = createStorage();
    const record = storage.writeRecord({
      id: "memory-1",
      namespace: repositoryNamespace,
      provenance,
      memoryType: "repo-convention",
      body: "Use npm workspaces for core package commands.",
      summary: "Core package command convention",
      sensitivity: "internal",
      provider: {
        providerId: "server-mode",
        providerRecordId: "memory-1",
        revision: "7",
        etag: "etag-7",
        syncStatus: "not-cached",
        operatorStatus: "remote-current",
        fetchedAt: "2026-06-02T16:10:00.000Z"
      },
      now: new Date("2026-06-02T16:10:00.000Z")
    });

    expect(record).toMatchObject({
      id: "memory-1",
      namespace: repositoryNamespace,
      provenance,
      memoryType: "repo-convention",
      sensitivity: "internal",
      status: "active",
      createdAt: "2026-06-02T16:10:00.000Z",
      updatedAt: "2026-06-02T16:10:00.000Z",
      provider: {
        providerId: "server-mode",
        providerRecordId: "memory-1",
        revision: "7",
        etag: "etag-7"
      }
    });
    expect(storage.getRecord("memory-1")).toEqual(record);
  });

  it("derives storage workspace ids from namespaces for records, proposals, and snapshots", () => {
    const db = new Database(":memory:");
    const storage = new SqliteDurableMemoryServerStorage(db);
    storage.writeRecord({
      id: "memory-workspace",
      namespace: repositoryNamespace,
      provenance,
      memoryType: "repo-convention",
      body: "Workspace-scoped record.",
      now: new Date("2026-06-02T16:10:00.000Z")
    });
    storage.createProposal({
      id: "proposal-workspace",
      targetNamespace: repositoryNamespace,
      provenance,
      memoryType: "repo-convention",
      proposedBody: "Workspace-scoped proposal.",
      reason: "capture convention",
      now: new Date("2026-06-02T16:11:00.000Z")
    });
    storage.createSnapshot({
      id: "snapshot-workspace",
      namespace: repositoryNamespace,
      provenance,
      reason: "workspace backup",
      now: new Date("2026-06-02T16:12:00.000Z")
    });

    expect(db.prepare("select workspace_id from durable_memory_records where id = ?").get("memory-workspace")).toEqual({
      workspace_id: "workspace-1"
    });
    expect(db.prepare("select target_workspace_id from durable_memory_proposals where id = ?").get("proposal-workspace")).toEqual({
      target_workspace_id: "workspace-1"
    });
    expect(db.prepare("select workspace_id from durable_memory_snapshots where id = ?").get("snapshot-workspace")).toEqual({
      workspace_id: "workspace-1"
    });
  });

  it("persists embedding lifecycle metadata independently from record status", () => {
    const storage = createStorage();
    const indexed = storage.writeRecord({
      id: "memory-indexed",
      namespace: repositoryNamespace,
      provenance,
      memoryType: "repo-convention",
      body: "Use semantic retrieval fixtures for durable memory tests.",
      embedding: {
        status: "indexed",
        providerId: "openai-embeddings",
        model: "text-embedding-3-small",
        modelVersion: "2026-06-02",
        backendKind: "chroma",
        indexRevision: "idx-7",
        indexedAt: "2026-06-02T16:10:00.000Z"
      },
      now: new Date("2026-06-02T16:10:00.000Z")
    });
    const stale = storage.writeRecord({
      id: "memory-stale",
      namespace: repositoryNamespace,
      provenance,
      memoryType: "repo-convention",
      body: "This record changed after indexing.",
      embedding: {
        status: "stale",
        providerId: "openai-embeddings",
        model: "text-embedding-3-small",
        backendKind: "chroma",
        indexRevision: "idx-6",
        reindexReason: "record-updated"
      },
      now: new Date("2026-06-02T16:11:00.000Z")
    });
    const failed = storage.writeRecord({
      id: "memory-failed",
      namespace: repositoryNamespace,
      provenance,
      memoryType: "repo-convention",
      body: "This record failed embedding.",
      embedding: {
        status: "failed",
        providerId: "openai-embeddings",
        model: "text-embedding-3-small",
        backendKind: "chroma",
        failureCode: "provider-unavailable",
        failureReason: "Embedding provider was unavailable."
      },
      now: new Date("2026-06-02T16:12:00.000Z")
    });

    expect(indexed.embedding).toMatchObject({
      status: "indexed",
      providerId: "openai-embeddings",
      indexRevision: "idx-7"
    });
    expect(stale).toMatchObject({
      status: "active",
      embedding: {
        status: "stale",
        reindexReason: "record-updated"
      }
    });
    expect(failed.embedding).toMatchObject({
      status: "failed",
      failureCode: "provider-unavailable"
    });
    expect(storage.searchRecords({ namespace: repositoryNamespace, query: "record" }).records.map((record) => record.embedding?.status)).toEqual([
      "failed",
      "stale"
    ]);
  });

  it("lists and searches records without leaking sibling namespaces", () => {
    const storage = createStorage();
    storage.writeRecord({
      id: "repo-1-memory",
      namespace: repositoryNamespace,
      provenance,
      memoryType: "repo-convention",
      body: "Repo one uses durable memory contracts.",
      now: new Date("2026-06-02T16:10:00.000Z")
    });
    storage.writeRecord({
      id: "repo-2-memory",
      namespace: siblingRepositoryNamespace,
      provenance,
      memoryType: "repo-convention",
      body: "Repo two should stay isolated.",
      now: new Date("2026-06-02T16:11:00.000Z")
    });

    expect(storage.listRecords({ namespace: repositoryNamespace }).records.map((record) => record.id)).toEqual(["repo-1-memory"]);
    expect(storage.searchRecords({ namespace: repositoryNamespace, query: "repo" }).records.map((record) => record.id)).toEqual([
      "repo-1-memory"
    ]);
    expect(
      storage
        .listRecords({
          namespace: workspaceNamespace,
          includeDescendants: true
        })
        .records.map((record) => record.id)
        .sort()
    ).toEqual(["repo-1-memory", "repo-2-memory"]);
  });

  it("returns hybrid retrieval match metadata and semantic fallback diagnostics", () => {
    const storage = createStorage();
    storage.writeRecord({
      id: "older-keyword",
      namespace: repositoryNamespace,
      provenance,
      memoryType: "repo-note",
      body: "Durable memory retrieval should rank keyword matches.",
      embedding: {
        status: "indexed",
        providerId: "openai-embeddings",
        model: "text-embedding-3-small",
        backendKind: "chroma",
        indexRevision: "idx-1",
        indexedAt: "2026-06-02T16:10:00.000Z"
      },
      now: new Date("2026-06-02T16:10:00.000Z")
    });
    storage.writeRecord({
      id: "newer-provenance",
      namespace: repositoryNamespace,
      provenance: {
        sourceKind: "agent",
        actorType: "agent",
        agentId: "retrieval-agent",
        runId: "run-1",
        createdByAction: "agent-retrieval-note"
      },
      memoryType: "retrieval-guide",
      body: "Hybrid retrieval ranking should include provenance and metadata signals.",
      embedding: {
        status: "stale",
        providerId: "openai-embeddings",
        model: "text-embedding-3-small",
        backendKind: "chroma",
        reindexReason: "record-updated"
      },
      now: new Date("2026-06-02T16:12:00.000Z")
    });
    storage.writeRecord({
      id: "failed-embedding",
      namespace: repositoryNamespace,
      provenance,
      memoryType: "other",
      body: "This retrieval record has a failed semantic lifecycle.",
      embedding: {
        status: "failed",
        failureCode: "provider-unavailable",
        failureReason: "Provider unavailable."
      },
      now: new Date("2026-06-02T16:11:00.000Z")
    });
    storage.writeRecord({
      id: "sibling-filtered",
      namespace: siblingRepositoryNamespace,
      provenance,
      memoryType: "retrieval-guide",
      body: "Sibling retrieval record should be filtered out.",
      now: new Date("2026-06-02T16:13:00.000Z")
    });

    const result = storage.searchRecords({
      namespace: repositoryNamespace,
      query: "retrieval",
      mode: "hybrid"
    });

    expect(result.records.map((record) => record.id)).toEqual(["newer-provenance", "failed-embedding", "older-keyword"]);
    expect(result.matches?.[0]).toMatchObject({
      recordId: "newer-provenance",
      signals: expect.arrayContaining([
        expect.objectContaining({ kind: "keyword" }),
        expect.objectContaining({ kind: "metadata" }),
        expect.objectContaining({ kind: "provenance" }),
        expect.objectContaining({ kind: "recency" })
      ])
    });
    expect(result.diagnostics).toMatchObject({
      requestedMode: "hybrid",
      effectiveMode: "keyword",
      degraded: true,
      providerCapabilities: {
        keyword: true,
        semantic: false,
        hybrid: false
      },
      omitted: expect.arrayContaining([expect.objectContaining({ category: "namespace-mismatch", count: 1 })])
    });
    expect(result.diagnostics?.degradationReasons).toEqual(
      expect.arrayContaining([
        "semantic retrieval requires a configured semantic index adapter",
        "only some records have current semantic indexes",
        "one or more records have failed embedding lifecycle state",
        "one or more records have stale embedding lifecycle state"
      ])
    );
  });

  it("refreshes and invalidates cache metadata with degraded read status", () => {
    const storage = createStorage();
    storage.writeRecord({
      id: "cache-record",
      namespace: repositoryNamespace,
      provenance,
      memoryType: "repo-note",
      body: "Cache refresh should make remote memory readable.",
      provider: {
        providerId: "remote-http",
        providerRecordId: "remote-1",
        revision: "1",
        syncStatus: "cache-stale",
        operatorStatus: "cache-stale",
        staleAt: "2026-06-02T16:00:00.000Z"
      },
      now: new Date("2026-06-02T16:00:00.000Z")
    });

    const refreshed = storage.refreshRecordCache({
      id: "cache-record",
      namespace: repositoryNamespace,
      provider: {
        providerId: "remote-http",
        providerRecordId: "remote-1",
        revision: "2",
        etag: "etag-2",
        syncStatus: "cache-stale",
        operatorStatus: "cache-stale"
      },
      now: new Date("2026-06-02T16:05:00.000Z")
    });

    expect(refreshed?.provider).toMatchObject({
      providerId: "remote-http",
      providerRecordId: "remote-1",
      revision: "2",
      etag: "etag-2",
      syncStatus: "cache-current",
      operatorStatus: "cache-current",
      fetchedAt: "2026-06-02T16:05:00.000Z"
    });
    expect(storage.searchRecords({ namespace: repositoryNamespace, query: "cache" }).operatorStatus).toBe("cache-current");

    const unavailable = storage.invalidateRecordCache({
      id: "cache-record",
      namespace: repositoryNamespace,
      reason: "provider-unavailable",
      now: new Date("2026-06-02T16:06:00.000Z")
    });

    expect(unavailable?.provider).toMatchObject({
      syncStatus: "offline",
      operatorStatus: "remote-unavailable",
      staleAt: "2026-06-02T16:06:00.000Z"
    });
    const degradedRead = storage.searchRecords({ namespace: repositoryNamespace, query: "cache" });
    expect(degradedRead).toMatchObject({
      operatorStatus: "remote-unavailable",
      records: [expect.objectContaining({ id: "cache-record" })]
    });

    const stale = storage.invalidateRecordCache({
      id: "cache-record",
      namespace: repositoryNamespace,
      reason: "provider-config-changed",
      now: new Date("2026-06-02T16:07:00.000Z")
    });
    expect(stale?.provider).toMatchObject({
      syncStatus: "cache-stale",
      operatorStatus: "cache-stale",
      staleAt: "2026-06-02T16:07:00.000Z"
    });
    expect(
      storage.refreshRecordCache({
        id: "cache-record",
        namespace: siblingRepositoryNamespace,
        provider: {
          providerId: "remote-http",
          syncStatus: "not-cached",
          operatorStatus: "remote-current"
        }
      })
    ).toBeUndefined();
  });

  it("archives and deletes records without removing provider-owned history", () => {
    const storage = createStorage();
    storage.writeRecord({
      id: "memory-archive",
      namespace: repositoryNamespace,
      provenance,
      memoryType: "repo-note",
      body: "Archive me.",
      now: new Date("2026-06-02T16:10:00.000Z")
    });

    const archived = storage.archiveRecord({
      id: "memory-archive",
      namespace: repositoryNamespace,
      provenance,
      reason: "superseded"
    });
    expect(archived).toMatchObject({
      id: "memory-archive",
      status: "archived"
    });
    expect(archived?.archivedAt).toBeDefined();
    expect(archived?.provider?.revision).toBe("2");
    expect(storage.listRecords({ namespace: repositoryNamespace }).records).toEqual([]);
    expect(storage.listRecords({ namespace: repositoryNamespace, includeArchived: true }).records.map((record) => record.id)).toEqual([
      "memory-archive"
    ]);

    const deleted = storage.deleteRecord({
      id: "memory-archive",
      namespace: repositoryNamespace,
      provenance,
      reason: "operator requested removal"
    });
    expect(deleted?.status).toBe("deleted");
    expect(deleted?.deletedAt).toBeDefined();
    expect(
      storage.archiveRecord({
        id: "memory-archive",
        namespace: siblingRepositoryNamespace,
        provenance,
        reason: "wrong namespace"
      })
    ).toBeUndefined();
  });

  it("keeps proposals separate from accepted records and supports review state", () => {
    const storage = createStorage();
    const proposal = storage.createProposal({
      id: "proposal-1",
      targetNamespace: repositoryNamespace,
      provenance: {
        sourceKind: "artifact",
        artifactId: "artifact-1",
        runId: "run-1",
        taskId: "task-1",
        createdByAction: "artifact-summary-proposed"
      },
      memoryType: "artifact-summary",
      proposedBody: "The artifact says tests passed.",
      reason: "promote useful task evidence",
      now: new Date("2026-06-02T16:12:00.000Z")
    });

    expect(proposal).toMatchObject({
      id: "proposal-1",
      status: "pending",
      targetNamespace: repositoryNamespace
    });
    expect(storage.listRecords({ namespace: repositoryNamespace }).records).toEqual([]);
    expect(storage.listProposals(repositoryNamespace).map((entry) => entry.id)).toEqual(["proposal-1"]);

    const reviewed = storage.updateProposalStatus(
      "proposal-1",
      "approved",
      "operator-1",
      new Date("2026-06-02T16:13:00.000Z")
    );
    expect(reviewed).toMatchObject({
      status: "approved",
      reviewedAt: "2026-06-02T16:13:00.000Z",
      reviewedBy: "operator-1"
    });
  });

  it("approves edited proposals into durable records and archives dismissed proposals", async () => {
    const storage = createStorage();
    const service = new LocalDurableMemoryService(storage);
    const proposal = await service.createProposal({
      targetNamespace: repositoryNamespace,
      provenance: {
        sourceKind: "task-run",
        taskId: "task-1",
        runId: "run-1",
        createdByAction: "runtime-memory-proposal"
      },
      memoryType: "repo-note",
      proposedBody: "Original proposal body.",
      reason: "agent proposed useful context"
    });

    const approved = await service.approveProposal({
      id: proposal.id,
      actorId: "operator-1",
      reason: "approved after edit",
      editedProposedBody: "Edited approved body."
    });

    expect(approved).toMatchObject({ status: "approved", reviewedBy: "operator-1" });
    expect(storage.listRecords({ namespace: repositoryNamespace }).records).toEqual([
      expect.objectContaining({
        memoryType: "repo-note",
        body: "Edited approved body.",
        provenance: expect.objectContaining({
          actorId: "operator-1",
          createdByAction: "proposal-approved",
          runId: "run-1"
        })
      })
    ]);

    const archivedProposal = await service.createProposal({
      targetNamespace: repositoryNamespace,
      provenance,
      memoryType: "repo-note",
      proposedBody: "Dismiss me.",
      reason: "duplicate"
    });
    const archived = await service.archiveProposal({
      id: archivedProposal.id,
      actorId: "operator-1",
      reason: "duplicate"
    });

    expect(archived).toMatchObject({ status: "archived", reviewedBy: "operator-1" });
    expect(storage.listRecords({ namespace: repositoryNamespace }).records).toHaveLength(1);
  });

  it("creates snapshots and blocks restore into broader namespaces", () => {
    const storage = createStorage();
    storage.writeRecord({
      id: "memory-snapshot",
      namespace: repositoryNamespace,
      provenance,
      memoryType: "repo-note",
      body: "Snapshot me.",
      now: new Date("2026-06-02T16:10:00.000Z")
    });

    const snapshot = storage.createSnapshot({
      id: "snapshot-1",
      namespace: repositoryNamespace,
      provenance,
      reason: "pre-release backup",
      now: new Date("2026-06-02T16:20:00.000Z")
    });

    expect(snapshot).toMatchObject({
      id: "snapshot-1",
      namespace: repositoryNamespace,
      recordIds: ["memory-snapshot"],
      reason: "pre-release backup"
    });
    expect(storage.listSnapshots(workspaceNamespace).snapshots.map((entry) => entry.id)).toEqual(["snapshot-1"]);
    expect(
      storage.restoreSnapshot({
        id: "snapshot-1",
        targetNamespace: repositoryNamespace,
        provenance,
        reason: "reviewed restore"
      })
    ).toEqual(snapshot);
    expect(() =>
      storage.restoreSnapshot({
        id: "snapshot-1",
        targetNamespace: workspaceNamespace,
        provenance,
        reason: "attempt wider restore"
      })
    ).toThrow("snapshot restore target namespace must match snapshot namespace");
  });
});

function createStorage(): SqliteDurableMemoryServerStorage {
  return new SqliteDurableMemoryServerStorage(new Database(":memory:"));
}
