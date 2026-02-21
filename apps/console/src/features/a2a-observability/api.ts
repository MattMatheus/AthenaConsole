import { apiClient } from "../../services";
import type {
  A2aLatencyHeatmapCell,
  A2aObservabilityQuery,
  A2aObservabilityResult,
  A2aQueueThroughputPoint,
  A2aStallAlertHistoryEntry,
  A2aStallAlertHistoryQuery,
  A2aStallAlertHistoryResult,
  A2aStallAlert
} from "./types";

type RecordValue = Record<string, unknown>;

function isRecord(value: unknown): value is RecordValue {
  return typeof value === "object" && value !== null;
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function readNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function parseThroughputPoint(value: unknown): A2aQueueThroughputPoint | undefined {
  if (!isRecord(value)) {
    return undefined;
  }
  const queueId = readString(value.queueId);
  const bucketStart = readString(value.bucketStart);
  const bucketEnd = readString(value.bucketEnd);
  const processedItems = readNumber(value.processedItems);
  const itemsPerMinute = readNumber(value.itemsPerMinute);
  const queueDepth = readNumber(value.queueDepth);
  if (
    !queueId ||
    !bucketStart ||
    !bucketEnd ||
    processedItems === undefined ||
    itemsPerMinute === undefined ||
    queueDepth === undefined
  ) {
    return undefined;
  }
  return {
    queueId,
    bucketStart,
    bucketEnd,
    processedItems,
    itemsPerMinute,
    queueDepth
  };
}

function parseLatencyHeatmapCell(value: unknown): A2aLatencyHeatmapCell | undefined {
  if (!isRecord(value)) {
    return undefined;
  }
  const traceId = readString(value.traceId);
  const stepId = readString(value.stepId);
  const sampleSize = readNumber(value.sampleSize);
  const averageLatencyMs = readNumber(value.averageLatencyMs);
  const p95LatencyMs = readNumber(value.p95LatencyMs);
  const averageQueueWaitMs = readNumber(value.averageQueueWaitMs);
  if (
    !traceId ||
    !stepId ||
    sampleSize === undefined ||
    averageLatencyMs === undefined ||
    p95LatencyMs === undefined ||
    averageQueueWaitMs === undefined
  ) {
    return undefined;
  }
  return {
    traceId,
    stepId,
    sampleSize,
    averageLatencyMs,
    p95LatencyMs,
    averageQueueWaitMs
  };
}

function parseStallAlert(value: unknown): A2aStallAlert | undefined {
  if (!isRecord(value)) {
    return undefined;
  }
  const traceId = readString(value.traceId);
  const stepId = readString(value.stepId);
  const queueId = readString(value.queueId);
  const correlationId = readString(value.correlationId);
  const startedAt = readString(value.startedAt);
  const pendingForMs = readNumber(value.pendingForMs);
  const historicalP95Ms = readNumber(value.historicalP95Ms);
  const severity = value.severity === "critical" || value.severity === "warning" ? value.severity : undefined;
  if (
    !traceId ||
    !stepId ||
    !queueId ||
    !correlationId ||
    !startedAt ||
    pendingForMs === undefined ||
    historicalP95Ms === undefined ||
    !severity
  ) {
    return undefined;
  }
  return {
    traceId,
    stepId,
    queueId,
    correlationId,
    startedAt,
    pendingForMs,
    historicalP95Ms,
    severity
  };
}

function parseStallAlertHistoryEntry(value: unknown): A2aStallAlertHistoryEntry | undefined {
  if (!isRecord(value)) {
    return undefined;
  }
  const alert = parseStallAlert(value);
  const id = readString(value.id);
  const createdAt = readString(value.createdAt);
  const resolvedAt = readString(value.resolvedAt);
  const status = value.status === "active" || value.status === "resolved" ? value.status : undefined;
  if (!alert || !id || !createdAt || !status) {
    return undefined;
  }
  return {
    ...alert,
    id,
    createdAt,
    ...(resolvedAt ? { resolvedAt } : {}),
    status
  };
}

function toSearchParams(query: A2aObservabilityQuery): URLSearchParams {
  const params = new URLSearchParams();
  if (query.limit !== undefined) {
    params.set("limit", String(query.limit));
  }
  if (query.windowMinutes !== undefined) {
    params.set("windowMinutes", String(query.windowMinutes));
  }
  if (query.bucketMinutes !== undefined) {
    params.set("bucketMinutes", String(query.bucketMinutes));
  }
  if (query.traceId) {
    params.set("traceId", query.traceId);
  }
  return params;
}

function toAlertHistorySearchParams(query: A2aStallAlertHistoryQuery): URLSearchParams {
  const params = new URLSearchParams();
  if (query.cursor) {
    params.set("cursor", query.cursor);
  }
  if (query.limit !== undefined) {
    params.set("limit", String(query.limit));
  }
  if (query.traceId) {
    params.set("traceId", query.traceId);
  }
  if (query.stepId) {
    params.set("stepId", query.stepId);
  }
  if (query.severity) {
    params.set("severity", query.severity);
  }
  if (query.createdAfter) {
    params.set("createdAfter", query.createdAfter);
  }
  if (query.createdBefore) {
    params.set("createdBefore", query.createdBefore);
  }
  return params;
}

export async function fetchA2aObservability(query: A2aObservabilityQuery): Promise<A2aObservabilityResult> {
  const params = toSearchParams(query);
  const suffix = params.toString().length > 0 ? `?${params.toString()}` : "";
  const payload = await apiClient.get<unknown>(`/work/observability${suffix}`);
  if (!isRecord(payload)) {
    throw new Error("A2A observability payload is invalid.");
  }
  const computedAt = readString(payload.computedAt);
  const windowStart = readString(payload.windowStart);
  const windowEnd = readString(payload.windowEnd);
  const bucketMinutes = readNumber(payload.bucketMinutes);
  const sampleCount = readNumber(payload.sampleCount);
  const truncated = typeof payload.truncated === "boolean" ? payload.truncated : undefined;
  if (
    !computedAt ||
    !windowStart ||
    !windowEnd ||
    bucketMinutes === undefined ||
    sampleCount === undefined ||
    truncated === undefined
  ) {
    throw new Error("A2A observability payload is missing required fields.");
  }
  return {
    computedAt,
    windowStart,
    windowEnd,
    bucketMinutes,
    throughput: Array.isArray(payload.throughput)
      ? payload.throughput.map(parseThroughputPoint).filter((row): row is A2aQueueThroughputPoint => row !== undefined)
      : [],
    latencyHeatmap: Array.isArray(payload.latencyHeatmap)
      ? payload.latencyHeatmap
          .map(parseLatencyHeatmapCell)
          .filter((row): row is A2aLatencyHeatmapCell => row !== undefined)
      : [],
    stallAlerts: Array.isArray(payload.stallAlerts)
      ? payload.stallAlerts.map(parseStallAlert).filter((row): row is A2aStallAlert => row !== undefined)
      : [],
    sampleCount,
    truncated
  };
}

export async function fetchA2aStallAlertHistory(query: A2aStallAlertHistoryQuery): Promise<A2aStallAlertHistoryResult> {
  const params = toAlertHistorySearchParams(query);
  const suffix = params.toString().length > 0 ? `?${params.toString()}` : "";
  const payload = await apiClient.get<unknown>(`/work/observability/alerts${suffix}`);
  if (!isRecord(payload)) {
    throw new Error("A2A observability alert history payload is invalid.");
  }
  const nextCursor = readString(payload.nextCursor);
  return {
    items: Array.isArray(payload.items)
      ? payload.items.map(parseStallAlertHistoryEntry).filter((row): row is A2aStallAlertHistoryEntry => row !== undefined)
      : [],
    ...(nextCursor ? { nextCursor } : {})
  };
}

export async function exportA2aStallAlertHistoryCsv(query: A2aStallAlertHistoryQuery): Promise<string> {
  const params = toAlertHistorySearchParams(query);
  const suffix = params.toString().length > 0 ? `?${params.toString()}` : "";
  return apiClient.getText(`/work/observability/alerts/export.csv${suffix}`);
}
