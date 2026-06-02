import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";
import { SqliteDurableMemoryServerStorage } from "../src/durable-memory/index.js";
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
