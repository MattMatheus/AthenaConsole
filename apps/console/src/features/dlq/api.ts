import { apiClient } from "../../services";
import type {
  A2aDlqDiscardRequest,
  A2aDlqItem,
  A2aDlqListQuery,
  A2aDlqListResult,
  A2aDlqMutationResult,
  A2aDlqStatus,
} from "./types";

type RecordValue = Record<string, unknown>;

function isRecord(value: unknown): value is RecordValue {
  return typeof value === "object" && value !== null;
}

function parseStatus(value: unknown): A2aDlqStatus | undefined {
  if (value === "pending" || value === "requeued" || value === "discarded") {
    return value;
  }
  return undefined;
}

function parseItem(value: unknown): A2aDlqItem | undefined {
  if (!isRecord(value)) {
    return undefined;
  }
  const status = parseStatus(value.status);
  if (
    !status ||
    typeof value.id !== "string" ||
    typeof value.createdAt !== "string" ||
    typeof value.updatedAt !== "string"
  ) {
    return undefined;
  }
  return {
    id: value.id,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
    status,
    ...(typeof value.reason === "string" ? { reason: value.reason } : {}),
    payload: isRecord(value.payload) ? value.payload : {},
  };
}

function parseMutationResult(payload: unknown): A2aDlqMutationResult {
  if (!isRecord(payload) || typeof payload.updated !== "boolean") {
    throw new Error("A2A DLQ mutation payload is invalid.");
  }
  const parsedItem = parseItem(payload.item);
  return {
    updated: payload.updated,
    ...(parsedItem ? { item: parsedItem } : {}),
  };
}

function toSearchParams(query: A2aDlqListQuery): URLSearchParams {
  const params = new URLSearchParams();
  if (query.cursor) {
    params.set("cursor", query.cursor);
  }
  if (query.limit !== undefined) {
    params.set("limit", String(query.limit));
  }
  if (query.status) {
    params.set("status", query.status);
  }
  return params;
}

export async function fetchA2aDlqList(query: A2aDlqListQuery = {}): Promise<A2aDlqListResult> {
  const params = toSearchParams(query);
  const suffix = params.toString().length > 0 ? `?${params.toString()}` : "";
  const payload = await apiClient.get<unknown>(`/a2a/dlq${suffix}`);
  if (!isRecord(payload)) {
    throw new Error("A2A DLQ list payload is invalid.");
  }
  return {
    items: Array.isArray(payload.items)
      ? payload.items.map(parseItem).filter((item): item is A2aDlqItem => item !== undefined)
      : [],
    ...(typeof payload.nextCursor === "string" && payload.nextCursor.length > 0
      ? { nextCursor: payload.nextCursor }
      : {}),
  };
}

export async function requeueA2aDlqItem(id: string): Promise<A2aDlqMutationResult> {
  return parseMutationResult(await apiClient.post<unknown>(`/a2a/dlq/${encodeURIComponent(id)}/requeue`, {}));
}

export async function discardA2aDlqItem(
  id: string,
  request: A2aDlqDiscardRequest = {},
): Promise<A2aDlqMutationResult> {
  return parseMutationResult(
    await apiClient.post<unknown>(`/a2a/dlq/${encodeURIComponent(id)}/discard`, {
      ...(request.auditNote ? { auditNote: request.auditNote } : {}),
    }),
  );
}
