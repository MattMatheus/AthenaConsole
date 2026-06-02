import type { URL } from "node:url";
import { AthenaError } from "../../runtime/errors.js";
import {
  DURABLE_MEMORY_NAMESPACE_SCOPES,
  DURABLE_MEMORY_SOURCE_KINDS,
  assertDurableMemoryNamespace,
  assertDurableMemoryProvenance,
  validateDurableMemoryMutationReason,
  type DurableMemoryArchiveRequest,
  type DurableMemoryDeleteRequest,
  type DurableMemoryGetRequest,
  type DurableMemoryListRequest,
  type DurableMemoryNamespaceRef,
  type DurableMemoryProposalCreateRequest,
  type DurableMemoryProposalReviewRequest,
  type DurableMemoryProvenanceRef,
  type DurableMemorySearchRequest,
  type DurableMemorySensitivity,
  type DurableMemorySnapshotCreateRequest,
  type DurableMemorySnapshotRestoreRequest,
  type DurableMemoryWriteRequest
} from "../../shared/contracts/durable-memory.js";
import { optionalBoolean, optionalPositiveInt, optionalString, requireString } from "../validation.js";

export function parseDurableMemoryWriteRequest(body: Record<string, unknown>): DurableMemoryWriteRequest {
  const request = {
    namespace: parseNamespace(body.namespace, "durable-memory.write.namespace"),
    provenance: parseProvenance(body.provenance, "durable-memory.write.provenance"),
    memoryType: requireString(body, "memoryType", "durable-memory.write"),
    body: requireString(body, "body", "durable-memory.write"),
    ...(parseSensitivity(body.sensitivity, "durable-memory.write.sensitivity")),
    ...(optionalString(body, "reason", "durable-memory.write") ? { reason: optionalString(body, "reason", "durable-memory.write") } : {})
  };
  assertMutationReason("write", request.reason);
  return request;
}

export function parseDurableMemoryGetRequest(body: Record<string, unknown>): DurableMemoryGetRequest {
  return {
    id: requireString(body, "id", "durable-memory.get"),
    ...(body.namespace ? { namespace: parseNamespace(body.namespace, "durable-memory.get.namespace") } : {})
  };
}

export function parseDurableMemoryListRequest(body: Record<string, unknown>): DurableMemoryListRequest {
  return {
    namespace: parseNamespace(body.namespace, "durable-memory.list.namespace"),
    ...(optionalBoolean(body, "includeDescendants", "durable-memory.list") !== undefined
      ? { includeDescendants: optionalBoolean(body, "includeDescendants", "durable-memory.list") }
      : {}),
    ...(optionalBoolean(body, "includeArchived", "durable-memory.list") !== undefined
      ? { includeArchived: optionalBoolean(body, "includeArchived", "durable-memory.list") }
      : {}),
    ...(optionalPositiveInt(body, "limit", "durable-memory.list") !== undefined
      ? { limit: optionalPositiveInt(body, "limit", "durable-memory.list") }
      : {}),
    ...(optionalString(body, "cursor", "durable-memory.list") ? { cursor: optionalString(body, "cursor", "durable-memory.list") } : {})
  };
}

export function parseDurableMemorySearchRequest(body: Record<string, unknown>): DurableMemorySearchRequest {
  return {
    namespace: parseNamespace(body.namespace, "durable-memory.search.namespace"),
    query: requireString(body, "query", "durable-memory.search"),
    ...(optionalBoolean(body, "includeDescendants", "durable-memory.search") !== undefined
      ? { includeDescendants: optionalBoolean(body, "includeDescendants", "durable-memory.search") }
      : {}),
    ...(optionalPositiveInt(body, "limit", "durable-memory.search") !== undefined
      ? { limit: optionalPositiveInt(body, "limit", "durable-memory.search") }
      : {})
  };
}

export function parseDurableMemoryArchiveRequest(id: string, body: Record<string, unknown>): DurableMemoryArchiveRequest {
  const request = {
    id,
    namespace: parseNamespace(body.namespace, "durable-memory.archive.namespace"),
    provenance: parseProvenance(body.provenance, "durable-memory.archive.provenance"),
    reason: requireString(body, "reason", "durable-memory.archive")
  };
  assertMutationReason("archive", request.reason);
  return request;
}

export function parseDurableMemoryDeleteRequest(id: string, body: Record<string, unknown>): DurableMemoryDeleteRequest {
  const request = {
    id,
    namespace: parseNamespace(body.namespace, "durable-memory.delete.namespace"),
    provenance: parseProvenance(body.provenance, "durable-memory.delete.provenance"),
    reason: requireString(body, "reason", "durable-memory.delete"),
    ...(optionalBoolean(body, "hardDelete", "durable-memory.delete") !== undefined
      ? { hardDelete: optionalBoolean(body, "hardDelete", "durable-memory.delete") }
      : {})
  };
  assertMutationReason("delete", request.reason);
  return request;
}

export function parseDurableMemoryProposalCreateRequest(body: Record<string, unknown>): DurableMemoryProposalCreateRequest {
  const request = {
    targetNamespace: parseNamespace(body.targetNamespace, "durable-memory.proposal.targetNamespace"),
    provenance: parseProvenance(body.provenance, "durable-memory.proposal.provenance"),
    memoryType: requireString(body, "memoryType", "durable-memory.proposal"),
    proposedBody: requireString(body, "proposedBody", "durable-memory.proposal"),
    reason: requireString(body, "reason", "durable-memory.proposal")
  };
  assertMutationReason("proposal-create", request.reason);
  return request;
}

export function parseDurableMemoryProposalReviewRequest(
  id: string,
  body: Record<string, unknown>,
  operation: "proposal-approve" | "proposal-reject"
): DurableMemoryProposalReviewRequest {
  const request = {
    id,
    actorId: requireString(body, "actorId", "durable-memory.proposal-review"),
    reason: requireString(body, "reason", "durable-memory.proposal-review")
  };
  assertMutationReason(operation, request.reason);
  return request;
}

export function parseDurableMemorySnapshotCreateRequest(body: Record<string, unknown>): DurableMemorySnapshotCreateRequest {
  const request = {
    namespace: parseNamespace(body.namespace, "durable-memory.snapshot.namespace"),
    provenance: parseProvenance(body.provenance, "durable-memory.snapshot.provenance"),
    reason: requireString(body, "reason", "durable-memory.snapshot")
  };
  assertMutationReason("snapshot-create", request.reason);
  return request;
}

export function parseDurableMemorySnapshotRestoreRequest(
  id: string,
  body: Record<string, unknown>
): DurableMemorySnapshotRestoreRequest {
  const request = {
    id,
    targetNamespace: parseNamespace(body.targetNamespace, "durable-memory.snapshot-restore.targetNamespace"),
    provenance: parseProvenance(body.provenance, "durable-memory.snapshot-restore.provenance"),
    reason: requireString(body, "reason", "durable-memory.snapshot-restore")
  };
  assertMutationReason("snapshot-restore", request.reason);
  return request;
}

export function parseDurableMemoryHealthQuery(requestUrl: URL): { includeStorage: boolean } {
  return {
    includeStorage: requestUrl.searchParams.get("includeStorage") === "true"
  };
}

function parseNamespace(value: unknown, context: string): DurableMemoryNamespaceRef {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new AthenaError("CONFIG_ERROR", `${context} must be a JSON object.`);
  }
  const input = value as Record<string, unknown>;
  const scope = input.scope;
  if (!DURABLE_MEMORY_NAMESPACE_SCOPES.includes(scope as DurableMemoryNamespaceRef["scope"])) {
    throw new AthenaError("CONFIG_ERROR", `${context}.scope must be a durable-memory namespace scope.`);
  }
  const namespace: DurableMemoryNamespaceRef = {
    scope: scope as DurableMemoryNamespaceRef["scope"],
    id: requireString(input, "id", context),
    ...(input.parent ? { parent: parseNamespace(input.parent, `${context}.parent`) } : {})
  };
  try {
    return assertDurableMemoryNamespace(namespace);
  } catch (error) {
    throw new AthenaError("CONFIG_ERROR", error instanceof Error ? error.message : String(error));
  }
}

function parseProvenance(value: unknown, context: string): DurableMemoryProvenanceRef {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new AthenaError("CONFIG_ERROR", `${context} must be a JSON object.`);
  }
  const input = value as Record<string, unknown>;
  const sourceKind = input.sourceKind;
  if (!DURABLE_MEMORY_SOURCE_KINDS.includes(sourceKind as DurableMemoryProvenanceRef["sourceKind"])) {
    throw new AthenaError("CONFIG_ERROR", `${context}.sourceKind must be a durable-memory source kind.`);
  }
  const provenance: DurableMemoryProvenanceRef = {
    sourceKind: sourceKind as DurableMemoryProvenanceRef["sourceKind"],
    createdByAction: requireString(input, "createdByAction", context),
    ...(optionalString(input, "actorType", context) ? { actorType: optionalString(input, "actorType", context) as DurableMemoryProvenanceRef["actorType"] } : {}),
    ...(optionalString(input, "actorId", context) ? { actorId: optionalString(input, "actorId", context) } : {}),
    ...(optionalString(input, "agentId", context) ? { agentId: optionalString(input, "agentId", context) } : {}),
    ...(optionalString(input, "taskId", context) ? { taskId: optionalString(input, "taskId", context) } : {}),
    ...(optionalString(input, "runId", context) ? { runId: optionalString(input, "runId", context) } : {}),
    ...(optionalString(input, "workflowRunId", context) ? { workflowRunId: optionalString(input, "workflowRunId", context) } : {}),
    ...(optionalString(input, "artifactId", context) ? { artifactId: optionalString(input, "artifactId", context) } : {}),
    ...(optionalString(input, "connectorId", context) ? { connectorId: optionalString(input, "connectorId", context) } : {}),
    ...(optionalString(input, "externalSourceUri", context) ? { externalSourceUri: optionalString(input, "externalSourceUri", context) } : {}),
    ...(optionalString(input, "importJobId", context) ? { importJobId: optionalString(input, "importJobId", context) } : {}),
    ...(optionalString(input, "traceId", context) ? { traceId: optionalString(input, "traceId", context) } : {})
  };
  try {
    return assertDurableMemoryProvenance(provenance);
  } catch (error) {
    throw new AthenaError("CONFIG_ERROR", error instanceof Error ? error.message : String(error));
  }
}

function parseSensitivity(value: unknown, context: string): { sensitivity?: DurableMemorySensitivity } {
  if (value === undefined || value === null) {
    return {};
  }
  if (value === "public" || value === "internal" || value === "sensitive" || value === "secret-adjacent") {
    return { sensitivity: value };
  }
  throw new AthenaError("CONFIG_ERROR", `${context} must be public, internal, sensitive, or secret-adjacent.`);
}

function assertMutationReason(operation: Parameters<typeof validateDurableMemoryMutationReason>[0]["operation"], reason?: string): void {
  const result = validateDurableMemoryMutationReason({ operation, reason });
  if (!result.ok) {
    throw new AthenaError("CONFIG_ERROR", result.errors.join("; "));
  }
}
