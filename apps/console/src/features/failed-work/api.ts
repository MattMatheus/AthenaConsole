import { apiClient } from "../../services";
import type {
  FailedWorkDiscardRequest,
  FailedWorkItem,
  FailedWorkListQuery,
  FailedWorkListResult,
  FailedWorkMutationResult,
  FailedWorkStatus,
} from "./types";

type RecordValue = Record<string, unknown>;

function isRecord(value: unknown): value is RecordValue {
  return typeof value === "object" && value !== null;
}

function parseStatus(value: unknown): FailedWorkStatus | undefined {
  if (value === "pending" || value === "retried" || value === "discarded") {
    return value;
  }
  return undefined;
}

function parseItem(value: unknown): FailedWorkItem | undefined {
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

function parseMutationResult(payload: unknown): FailedWorkMutationResult {
  if (!isRecord(payload) || typeof payload.updated !== "boolean") {
    throw new Error("Failed work mutation payload is invalid.");
  }
  const parsedItem = parseItem(payload.item);
  return {
    updated: payload.updated,
    ...(parsedItem ? { item: parsedItem } : {}),
  };
}

function toSearchParams(query: FailedWorkListQuery): URLSearchParams {
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

export async function fetchFailedWorkList(query: FailedWorkListQuery = {}): Promise<FailedWorkListResult> {
  const params = toSearchParams(query);
  const suffix = params.toString().length > 0 ? `?${params.toString()}` : "";
  const payload = await apiClient.get<unknown>(`/failed-work${suffix}`);
  if (!isRecord(payload)) {
    throw new Error("Failed work list payload is invalid.");
  }
  return {
    items: Array.isArray(payload.items)
      ? payload.items.map(parseItem).filter((item): item is FailedWorkItem => item !== undefined)
      : [],
    ...(typeof payload.nextCursor === "string" && payload.nextCursor.length > 0
      ? { nextCursor: payload.nextCursor }
      : {}),
  };
}

export async function retryFailedWorkItem(id: string): Promise<FailedWorkMutationResult> {
  return parseMutationResult(await apiClient.post<unknown>(`/failed-work/${encodeURIComponent(id)}/retry`, {}));
}

export async function discardFailedWorkItem(
  id: string,
  request: FailedWorkDiscardRequest = {},
): Promise<FailedWorkMutationResult> {
  return parseMutationResult(
    await apiClient.post<unknown>(`/failed-work/${encodeURIComponent(id)}/discard`, {
      ...(request.auditNote ? { auditNote: request.auditNote } : {}),
    }),
  );
}
