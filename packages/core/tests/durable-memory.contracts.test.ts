import { describe, expect, it } from "vitest";
import {
  assertDurableMemoryNamespace,
  validateDurableMemoryEventPayload,
  validateDurableMemoryMutationReason,
  validateDurableMemoryNamespace,
  validateDurableMemoryProvenance,
  type DurableMemoryNamespaceRef,
  type DurableMemoryProvenanceRef
} from "../src/shared/contracts/index.js";
import { parseDurableMemoryWriteRequest as parseApiDurableMemoryWriteRequest } from "../src/api/request-parsers/index.js";

describe("durable memory contracts", () => {
  const repositoryNamespace: DurableMemoryNamespaceRef = {
    scope: "repository",
    id: "repo-1",
    parent: {
      scope: "workspace",
      id: "workspace-1",
      parent: {
        scope: "operator",
        id: "operator-1"
      }
    }
  };

  it("validates accepted namespace scopes and parent chains", () => {
    expect(validateDurableMemoryNamespace(repositoryNamespace)).toEqual({ ok: true, errors: [] });
    expect(assertDurableMemoryNamespace(repositoryNamespace)).toBe(repositoryNamespace);
  });

  it("rejects missing namespace fields and invalid parent chains", () => {
    expect(validateDurableMemoryNamespace({ scope: "repository", id: "" }).errors).toContain("namespace.id is required");
    expect(
      validateDurableMemoryNamespace({
        scope: "artifact",
        id: "artifact-1",
        parent: {
          scope: "repository",
          id: "repo-1"
        }
      }).errors
    ).toContain("namespace.parent.scope cannot be repository for artifact");

    const cyclicNamespace: DurableMemoryNamespaceRef = {
      scope: "workspace",
      id: "workspace-1"
    };
    cyclicNamespace.parent = cyclicNamespace;

    expect(validateDurableMemoryNamespace(cyclicNamespace).errors).toContain("namespace.parent must not contain a parent cycle");
  });

  it("enforces source-kind-specific provenance requirements", () => {
    const validArtifactProvenance: DurableMemoryProvenanceRef = {
      sourceKind: "artifact",
      artifactId: "artifact-1",
      runId: "run-1",
      taskId: "task-1",
      createdByAction: "artifact-summary-proposed"
    };

    expect(validateDurableMemoryProvenance(validArtifactProvenance)).toEqual({ ok: true, errors: [] });

    expect(
      validateDurableMemoryProvenance({
        sourceKind: "agent",
        actorType: "agent",
        agentId: "agent-1",
        createdByAction: "agent-proposed-memory"
      }).errors
    ).toContain("provenance.runId or provenance.taskId is required for agent memory");

    expect(
      validateDurableMemoryProvenance({
        sourceKind: "connector",
        connectorId: "github",
        createdByAction: "connector-import"
      }).errors
    ).toContain("provenance.externalSourceUri is required");
  });

  it("requires reasons for high-risk or reviewable mutations", () => {
    expect(validateDurableMemoryMutationReason({ operation: "write" })).toEqual({ ok: true, errors: [] });
    expect(validateDurableMemoryMutationReason({ operation: "archive" }).errors).toContain("archive.reason is required");
    expect(validateDurableMemoryMutationReason({ operation: "snapshot-restore", reason: "restore reviewed snapshot" })).toEqual({
      ok: true,
      errors: []
    });
  });

  it("parses durable memory embedding lifecycle metadata on write requests", () => {
    const request = parseApiDurableMemoryWriteRequest({
      namespace: repositoryNamespace,
      provenance: {
        sourceKind: "operator",
        actorType: "operator",
        actorId: "operator-1",
        createdByAction: "operator-note"
      },
      memoryType: "repo-note",
      body: "Use embedding lifecycle metadata for semantic indexing.",
      embedding: {
        status: "queued",
        providerId: "openai-embeddings",
        model: "text-embedding-3-small",
        backendKind: "chroma",
        reindexReason: "new-record"
      }
    });

    expect(request.embedding).toMatchObject({
      status: "queued",
      providerId: "openai-embeddings",
      reindexReason: "new-record"
    });
    expect(() =>
      parseApiDurableMemoryWriteRequest({
        namespace: repositoryNamespace,
        provenance: {
          sourceKind: "operator",
          actorType: "operator",
          actorId: "operator-1",
          createdByAction: "operator-note"
        },
        memoryType: "repo-note",
        body: "Bad lifecycle.",
        embedding: { status: "ready" }
      })
    ).toThrow("embedding lifecycle status");
  });

  it("guards durable memory event payloads against bodies, raw payloads, and secrets", () => {
    expect(
      validateDurableMemoryEventPayload({
        memoryId: "memory-1",
        namespace: { scope: "repository", id: "repo-1" },
        sourceKind: "artifact",
        status: "written"
      }).ok
    ).toBe(true);

    const result = validateDurableMemoryEventPayload({
      memoryId: "memory-1",
      memoryBody: "do not emit this",
      nested: {
        rawArtifactPayload: "also forbidden",
        providerCredentials: {
          apiKey: "nope"
        }
      }
    });

    expect(result.ok).toBe(false);
    expect(result.errors).toContain(
      "event.payload.memoryBody must not include memory bodies, raw payloads, transcripts, secrets, or credentials"
    );
    expect(result.errors).toContain(
      "event.payload.nested.rawArtifactPayload must not include memory bodies, raw payloads, transcripts, secrets, or credentials"
    );
    expect(result.errors).toContain(
      "event.payload.nested.providerCredentials must not include memory bodies, raw payloads, transcripts, secrets, or credentials"
    );
    expect(result.errors).toContain(
      "event.payload.nested.providerCredentials.apiKey must not include memory bodies, raw payloads, transcripts, secrets, or credentials"
    );
  });

  it("accepts stable durable-memory run event payload shapes without raw bodies", () => {
    const base = {
      taskId: "task-1",
      runId: "run-1",
      agentId: "agent-1",
      namespace: { scope: "repository", id: "repo-1" }
    };

    const payloads = [
      {
        ...base,
        operatorStatus: "local-dev-only",
        resultCount: 1,
        total: 1
      },
      {
        ...base,
        recordIds: ["memory-1"],
        records: [{ recordId: "memory-1", namespace: base.namespace, sensitivity: "internal", status: "active" }]
      },
      {
        ...base,
        proposalId: "proposal-1",
        memoryType: "repo-note",
        status: "pending",
        reason: "Operator review required.",
        provenance: {
          sourceKind: "task-run",
          taskId: "task-1",
          runId: "run-1",
          agentId: "agent-1",
          createdByAction: "runtime-memory-proposal"
        }
      }
    ];

    for (const payload of payloads) {
      expect(validateDurableMemoryEventPayload(payload).errors).toEqual([]);
    }
  });
});
