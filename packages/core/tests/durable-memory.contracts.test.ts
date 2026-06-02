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
});
