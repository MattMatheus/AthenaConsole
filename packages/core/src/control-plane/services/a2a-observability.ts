import type {
  A2aLatencyHeatmapCell,
  A2aObservabilityQuery,
  A2aObservabilityResult,
  A2aQueueThroughputPoint,
  A2aStallAlert,
  A2aStallAlertCsvExportQuery,
  A2aStallAlertHistoryEntry,
  A2aStallAlertHistoryQuery,
  A2aStallAlertHistoryResult,
  EventRecord
} from "../../shared/contracts.js";
import { AthenaError } from "../../runtime/errors.js";
import type { A2aObservabilityService, EventService } from "../interfaces.js";

const DEFAULT_LIMIT = 500;
const MAX_LIMIT = 2_000;
const DEFAULT_WINDOW_MINUTES = 60;
const MAX_WINDOW_MINUTES = 24 * 60;
const DEFAULT_BUCKET_MINUTES = 5;
const MAX_BUCKET_MINUTES = 60;
const DEFAULT_HISTORY_WINDOW_MINUTES = 24 * 60;
const MAX_HISTORY_WINDOW_MINUTES = 30 * 24 * 60;
const DEFAULT_HISTORY_LIMIT = 100;
const MAX_HISTORY_LIMIT = 10_000;
const MAX_EXPORT_WINDOW_MINUTES = 31 * 24 * 60;
const MAX_EXPORT_ROWS = 10_000;

type ItemTimestamps = {
  traceId: string;
  stepId: string;
  queueId: string;
  correlationId: string;
  enqueuedAtMs?: number;
  startedAtMs?: number;
  finishedAtMs?: number;
};

export class LocalA2aObservabilityService implements A2aObservabilityService {
  constructor(private readonly eventService: EventService) {}

  async getSnapshot(query: A2aObservabilityQuery = {}): Promise<A2aObservabilityResult> {
    const computedAtMs = Date.now();
    const limit = clampLimit(query.limit);
    const windowMinutes = clampWindowMinutes(query.windowMinutes);
    const bucketMinutes = clampBucketMinutes(query.bucketMinutes);
    const createdAfter = new Date(computedAtMs - windowMinutes * 60_000).toISOString();
    const traceId = query.traceId?.trim();

    const collected = await this.collectEvents({
      limit,
      createdAfter,
      ...(traceId ? { traceId } : {})
    });
    const sortedEvents = [...collected.items].sort(compareEventOrder);

    const throughput = buildThroughput(sortedEvents, bucketMinutes);
    const items = buildItemTimelineMap(sortedEvents);
    const { latencyHeatmap, stallAlerts } = buildLatencySignals(items, computedAtMs);

    return {
      computedAt: new Date(computedAtMs).toISOString(),
      windowStart: createdAfter,
      windowEnd: new Date(computedAtMs).toISOString(),
      bucketMinutes,
      throughput,
      latencyHeatmap,
      stallAlerts,
      sampleCount: sortedEvents.length,
      truncated: collected.truncated
    };
  }

  async listAlertHistory(query: A2aStallAlertHistoryQuery = {}): Promise<A2aStallAlertHistoryResult> {
    const nowMs = Date.now();
    const normalized = normalizeHistoryQuery(query, nowMs);
    const collected = await this.collectEvents({
      limit: 25_000,
      createdAfter: normalized.createdAfter,
      createdBefore: normalized.createdBefore,
      ...(normalized.traceId ? { traceId: normalized.traceId } : {})
    });
    const sortedEvents = [...collected.items].sort(compareEventOrder);
    const items = buildItemTimelineMap(sortedEvents);
    const alerts = buildStallAlertHistory(items, parseIsoToMillis(normalized.createdBefore) ?? nowMs);
    const filtered = alerts.filter((alert) => {
      if (normalized.stepId && alert.stepId !== normalized.stepId) {
        return false;
      }
      if (normalized.severity && alert.severity !== normalized.severity) {
        return false;
      }
      const createdAtMs = parseIsoToMillis(alert.createdAt) ?? 0;
      const createdAfterMs = parseIsoToMillis(normalized.createdAfter) ?? 0;
      const createdBeforeMs = parseIsoToMillis(normalized.createdBefore) ?? Number.MAX_SAFE_INTEGER;
      return createdAtMs >= createdAfterMs && createdAtMs <= createdBeforeMs;
    });
    const offset = decodeOffsetCursor(query.cursor);
    const page = filtered.slice(offset, offset + normalized.limit);
    const nextOffset = offset + page.length;
    return {
      items: page,
      ...(nextOffset < filtered.length ? { nextCursor: encodeOffsetCursor(nextOffset) } : {})
    };
  }

  async exportAlertHistoryCsv(query: A2aStallAlertCsvExportQuery): Promise<string> {
    const normalized = normalizeExportQuery(query);
    const listed = await this.listAlertHistory({
      ...normalized,
      limit: MAX_EXPORT_ROWS
    });
    const rows = listed.items.slice(0, MAX_EXPORT_ROWS);
    const lines = [
      "id,createdAt,resolvedAt,status,severity,traceId,stepId,queueId,correlationId,startedAt,pendingForMs,historicalP95Ms"
    ];
    for (const row of rows) {
      lines.push(
        [
          escapeCsv(row.id),
          escapeCsv(row.createdAt),
          escapeCsv(row.resolvedAt ?? ""),
          escapeCsv(row.status),
          escapeCsv(row.severity),
          escapeCsv(row.traceId),
          escapeCsv(row.stepId),
          escapeCsv(row.queueId),
          escapeCsv(row.correlationId),
          escapeCsv(row.startedAt),
          escapeCsv(String(Math.max(0, Math.round(row.pendingForMs)))),
          escapeCsv(String(Math.max(0, Math.round(row.historicalP95Ms))))
        ].join(",")
      );
    }
    return `${lines.join("\n")}\n`;
  }

  private async collectEvents(query: {
    limit: number;
    createdAfter: string;
    createdBefore?: string;
    traceId?: string;
  }): Promise<{ items: EventRecord[]; truncated: boolean }> {
    let cursor: string | undefined;
    const events: EventRecord[] = [];

    while (events.length < query.limit + 1) {
      const page = await this.eventService.list({
        ...(cursor ? { cursor } : {}),
        limit: 500,
        createdAfter: query.createdAfter,
        ...(query.createdBefore ? { createdBefore: query.createdBefore } : {}),
        ...(query.traceId ? { traceId: query.traceId } : {})
      });
      if (page.events.length === 0) {
        break;
      }
      for (const event of page.events) {
        if (!isObservabilityRelevant(event)) {
          continue;
        }
        events.push(event);
        if (events.length >= query.limit + 1) {
          break;
        }
      }
      if (!page.nextCursor) {
        break;
      }
      cursor = page.nextCursor;
    }

    return {
      items: events.slice(0, query.limit),
      truncated: events.length > query.limit
    };
  }
}

function buildStallAlertHistory(items: Map<string, ItemTimestamps>, nowMs: number): A2aStallAlertHistoryEntry[] {
  const completedDurations = new Map<string, number[]>();
  for (const item of items.values()) {
    const stepKey = `${item.traceId}|${item.stepId}`;
    const startedAtMs = item.startedAtMs ?? item.enqueuedAtMs;
    if (startedAtMs !== undefined && item.finishedAtMs !== undefined && item.finishedAtMs >= startedAtMs) {
      const durations = completedDurations.get(stepKey) ?? [];
      durations.push(item.finishedAtMs - startedAtMs);
      completedDurations.set(stepKey, durations);
    }
  }

  const alerts: A2aStallAlertHistoryEntry[] = [];
  for (const item of items.values()) {
    const startedAtMs = item.startedAtMs ?? item.enqueuedAtMs;
    if (startedAtMs === undefined || startedAtMs > nowMs) {
      continue;
    }
    const stepKey = `${item.traceId}|${item.stepId}`;
    const p95 = percentile95(completedDurations.get(stepKey) ?? []);
    if (p95 === undefined || p95 <= 0) {
      continue;
    }
    const endedAtMs = item.finishedAtMs;
    const pendingForMs = Math.max(0, (endedAtMs ?? nowMs) - startedAtMs);
    if (pendingForMs <= p95) {
      continue;
    }
    const severity: A2aStallAlert["severity"] = pendingForMs >= p95 * 2 ? "critical" : "warning";
    const createdAtMs = startedAtMs + p95;
    alerts.push({
      id: `${item.traceId}:${item.stepId}:${item.correlationId}:${Math.floor(createdAtMs)}`,
      traceId: item.traceId,
      stepId: item.stepId,
      queueId: item.queueId,
      correlationId: item.correlationId,
      startedAt: new Date(startedAtMs).toISOString(),
      createdAt: new Date(createdAtMs).toISOString(),
      ...(endedAtMs !== undefined ? { resolvedAt: new Date(endedAtMs).toISOString() } : {}),
      status: endedAtMs !== undefined ? "resolved" : "active",
      pendingForMs: Math.round(pendingForMs),
      historicalP95Ms: Math.round(p95),
      severity
    });
  }

  return alerts.sort((left, right) => {
    const leftMs = parseIsoToMillis(left.createdAt) ?? 0;
    const rightMs = parseIsoToMillis(right.createdAt) ?? 0;
    if (leftMs !== rightMs) {
      return rightMs - leftMs;
    }
    if (left.pendingForMs !== right.pendingForMs) {
      return right.pendingForMs - left.pendingForMs;
    }
    return left.id.localeCompare(right.id);
  });
}

function normalizeHistoryQuery(
  query: A2aStallAlertHistoryQuery,
  nowMs: number
): {
  limit: number;
  traceId?: string;
  stepId?: string;
  severity?: A2aStallAlert["severity"];
  createdAfter: string;
  createdBefore: string;
} {
  const limit = clampExplicitLimit(query.limit, DEFAULT_HISTORY_LIMIT, MAX_HISTORY_LIMIT);
  const createdBeforeMs = parseCreatedBoundary(query.createdBefore, "a2a.observability.alerts.createdBefore") ?? nowMs;
  const fallbackAfterMs = createdBeforeMs - DEFAULT_HISTORY_WINDOW_MINUTES * 60_000;
  const createdAfterMs =
    parseCreatedBoundary(query.createdAfter, "a2a.observability.alerts.createdAfter") ?? Math.max(0, fallbackAfterMs);
  const windowMinutes = (createdBeforeMs - createdAfterMs) / 60_000;
  if (windowMinutes < 0) {
    throw new AthenaError("CONFIG_ERROR", "a2a.observability.alerts window must be non-negative.");
  }
  if (windowMinutes > MAX_HISTORY_WINDOW_MINUTES) {
    throw new AthenaError(
      "CONFIG_ERROR",
      `a2a.observability.alerts window must be <= ${MAX_HISTORY_WINDOW_MINUTES} minutes.`
    );
  }
  const severity = normalizeSeverity(query.severity);
  const traceId = query.traceId?.trim();
  const stepId = query.stepId?.trim();
  return {
    limit,
    ...(traceId ? { traceId } : {}),
    ...(stepId ? { stepId } : {}),
    ...(severity ? { severity } : {}),
    createdAfter: new Date(createdAfterMs).toISOString(),
    createdBefore: new Date(createdBeforeMs).toISOString()
  };
}

function normalizeExportQuery(query: A2aStallAlertCsvExportQuery): A2aStallAlertCsvExportQuery {
  const createdAfterMs = parseCreatedBoundary(query.createdAfter, "a2a.observability.alerts.export.createdAfter");
  const createdBeforeMs = parseCreatedBoundary(query.createdBefore, "a2a.observability.alerts.export.createdBefore");
  if (createdAfterMs === undefined || createdBeforeMs === undefined) {
    throw new AthenaError(
      "CONFIG_ERROR",
      "a2a.observability.alerts.export requires createdAfter and createdBefore."
    );
  }
  if (createdBeforeMs < createdAfterMs) {
    throw new AthenaError(
      "CONFIG_ERROR",
      "a2a.observability.alerts.export createdBefore must be >= createdAfter."
    );
  }
  const windowMinutes = (createdBeforeMs - createdAfterMs) / 60_000;
  if (windowMinutes > MAX_EXPORT_WINDOW_MINUTES) {
    throw new AthenaError(
      "CONFIG_ERROR",
      `a2a.observability.alerts.export window must be <= ${MAX_EXPORT_WINDOW_MINUTES} minutes.`
    );
  }
  const severity = normalizeSeverity(query.severity);
  return {
    ...(query.traceId?.trim() ? { traceId: query.traceId.trim() } : {}),
    ...(query.stepId?.trim() ? { stepId: query.stepId.trim() } : {}),
    ...(severity ? { severity } : {}),
    createdAfter: new Date(createdAfterMs).toISOString(),
    createdBefore: new Date(createdBeforeMs).toISOString()
  };
}

function parseCreatedBoundary(value: string | undefined, field: string): number | undefined {
  if (!value) {
    return undefined;
  }
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    throw new AthenaError("CONFIG_ERROR", `${field} must be a valid ISO datetime.`);
  }
  return parsed;
}

function normalizeSeverity(value: string | undefined): A2aStallAlert["severity"] | undefined {
  if (!value) {
    return undefined;
  }
  if (value === "warning" || value === "critical") {
    return value;
  }
  throw new AthenaError("CONFIG_ERROR", "a2a.observability.alerts.severity must be warning|critical.");
}

function clampExplicitLimit(value: number | undefined, fallback: number, max: number): number {
  if (!Number.isFinite(value)) {
    return fallback;
  }
  return Math.max(1, Math.min(max, Math.floor(value as number)));
}

function encodeOffsetCursor(offset: number): string {
  return Buffer.from(String(Math.max(0, Math.floor(offset))), "utf8").toString("base64url");
}

function decodeOffsetCursor(cursor: string | undefined): number {
  if (!cursor) {
    return 0;
  }
  try {
    const decoded = Buffer.from(cursor, "base64url").toString("utf8");
    const parsed = Number.parseInt(decoded, 10);
    if (!Number.isFinite(parsed) || parsed < 0) {
      return 0;
    }
    return parsed;
  } catch {
    return 0;
  }
}

function escapeCsv(value: string): string {
  if (!value.includes(",") && !value.includes("\"") && !value.includes("\n") && !value.includes("\r")) {
    return value;
  }
  return `"${value.replaceAll("\"", "\"\"")}"`;
}

function buildThroughput(events: EventRecord[], bucketMinutes: number): A2aQueueThroughputPoint[] {
  const bucketMs = bucketMinutes * 60_000;
  const rows = new Map<string, { queueId: string; bucketStartMs: number; processedItems: number; queueDepth: number }>();

  for (const event of events) {
    const createdAtMs = parseIsoToMillis(event.createdAt);
    if (createdAtMs === undefined) {
      continue;
    }
    const queueId = resolveQueueId(event);
    const bucketStartMs = Math.floor(createdAtMs / bucketMs) * bucketMs;
    const rowKey = `${queueId}|${bucketStartMs}`;
    const row = rows.get(rowKey) ?? {
      queueId,
      bucketStartMs,
      processedItems: 0,
      queueDepth: 0
    };

    const processedIncrement = toProcessedIncrement(event);
    if (processedIncrement > 0) {
      row.processedItems += processedIncrement;
    }

    const observedDepth = toObservedQueueDepth(event);
    if (observedDepth !== undefined) {
      row.queueDepth = observedDepth;
    }
    rows.set(rowKey, row);
  }

  return [...rows.values()]
    .sort((left, right) => left.bucketStartMs - right.bucketStartMs || left.queueId.localeCompare(right.queueId))
    .map((row) => ({
      queueId: row.queueId,
      bucketStart: new Date(row.bucketStartMs).toISOString(),
      bucketEnd: new Date(row.bucketStartMs + bucketMs).toISOString(),
      processedItems: row.processedItems,
      itemsPerMinute: roundTo(row.processedItems / bucketMinutes, 2),
      queueDepth: row.queueDepth
    }));
}

function buildItemTimelineMap(events: EventRecord[]): Map<string, ItemTimestamps> {
  const itemMap = new Map<string, ItemTimestamps>();
  for (const event of events) {
    const createdAtMs = parseIsoToMillis(event.createdAt);
    if (createdAtMs === undefined) {
      continue;
    }
    const stepId = resolveStepId(event);
    const correlationId = resolveCorrelationId(event);
    const queueId = resolveQueueId(event);
    const key = `${event.traceId}|${stepId}|${correlationId}`;
    const existing = itemMap.get(key) ?? {
      traceId: event.traceId,
      stepId,
      queueId,
      correlationId
    };

    if (isEnqueuedEvent(event)) {
      existing.enqueuedAtMs = minDefined(existing.enqueuedAtMs, createdAtMs);
    }
    if (isStartedEvent(event)) {
      existing.startedAtMs = minDefined(existing.startedAtMs, createdAtMs);
    }
    if (isFinishedEvent(event)) {
      existing.finishedAtMs = maxDefined(existing.finishedAtMs, createdAtMs);
    }

    itemMap.set(key, existing);
  }
  return itemMap;
}

function buildLatencySignals(
  items: Map<string, ItemTimestamps>,
  nowMs: number
): { latencyHeatmap: A2aLatencyHeatmapCell[]; stallAlerts: A2aStallAlert[] } {
  const completedDurations = new Map<string, number[]>();
  const queueWaitDurations = new Map<string, number[]>();
  const stallCandidates: A2aStallAlert[] = [];

  for (const item of items.values()) {
    const stepKey = `${item.traceId}|${item.stepId}`;
    const startedAtMs = item.startedAtMs ?? item.enqueuedAtMs;
    if (startedAtMs !== undefined && item.finishedAtMs !== undefined && item.finishedAtMs >= startedAtMs) {
      const durationMs = item.finishedAtMs - startedAtMs;
      const durations = completedDurations.get(stepKey) ?? [];
      durations.push(durationMs);
      completedDurations.set(stepKey, durations);
    }
    if (
      item.enqueuedAtMs !== undefined &&
      item.startedAtMs !== undefined &&
      item.startedAtMs >= item.enqueuedAtMs
    ) {
      const waits = queueWaitDurations.get(stepKey) ?? [];
      waits.push(item.startedAtMs - item.enqueuedAtMs);
      queueWaitDurations.set(stepKey, waits);
    }
  }

  for (const item of items.values()) {
    if (item.finishedAtMs !== undefined) {
      continue;
    }
    const startedAtMs = item.startedAtMs ?? item.enqueuedAtMs;
    if (startedAtMs === undefined || startedAtMs > nowMs) {
      continue;
    }
    const stepKey = `${item.traceId}|${item.stepId}`;
    const p95 = percentile95(completedDurations.get(stepKey) ?? []);
    if (p95 === undefined) {
      continue;
    }
    const pendingForMs = Math.max(0, nowMs - startedAtMs);
    if (pendingForMs <= p95) {
      continue;
    }
    stallCandidates.push({
      traceId: item.traceId,
      stepId: item.stepId,
      queueId: item.queueId,
      correlationId: item.correlationId,
      startedAt: new Date(startedAtMs).toISOString(),
      pendingForMs,
      historicalP95Ms: Math.round(p95),
      severity: pendingForMs >= p95 * 2 ? "critical" : "warning"
    });
  }

  const latencyHeatmap: A2aLatencyHeatmapCell[] = [...completedDurations.entries()]
    .map(([stepKey, durations]) => {
      const [traceId, stepId] = stepKey.split("|");
      const queueWait = queueWaitDurations.get(stepKey) ?? [];
      return {
        traceId: traceId ?? "",
        stepId: stepId ?? "",
        sampleSize: durations.length,
        averageLatencyMs: Math.round(average(durations)),
        p95LatencyMs: Math.round(percentile95(durations) ?? 0),
        averageQueueWaitMs: Math.round(average(queueWait))
      };
    })
    .sort((left, right) => right.averageLatencyMs - left.averageLatencyMs || left.stepId.localeCompare(right.stepId));

  const stallAlerts = stallCandidates
    .sort((left, right) => right.pendingForMs - left.pendingForMs)
    .slice(0, 25);

  return {
    latencyHeatmap,
    stallAlerts
  };
}

function resolveQueueId(event: EventRecord): string {
  const payloadQueueId = readString(event.payload.queueId) ?? readString(event.payload.sessionId);
  const queueId = payloadQueueId ?? event.sessionId ?? "unscoped";
  return queueId.trim().length > 0 ? queueId : "unscoped";
}

function resolveStepId(event: EventRecord): string {
  const fromPayload =
    readString(event.payload.stepId) ??
    readString(event.payload.nodeId) ??
    readString(event.payload.toAgent) ??
    readString(event.payload.toAgent) ??
    readString(event.payload.targetAgent) ??
    readString(event.payload.callee);
  const stepId = fromPayload ?? event.taskId ?? event.runId ?? "unknown-step";
  return stepId.trim().length > 0 ? stepId : "unknown-step";
}

function resolveCorrelationId(event: EventRecord): string {
  const fromPayload =
    readString(event.payload.messageId) ??
    readString(event.payload.itemId) ??
    readString(event.payload.workItemId) ??
    readString(event.payload.queueItemId) ??
    readString(event.payload.id) ??
    readString(event.payload.requestId);
  const correlationId = fromPayload ?? event.taskId ?? event.runId ?? event.id;
  return correlationId.trim().length > 0 ? correlationId : event.id;
}

function readString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function toProcessedIncrement(event: EventRecord): number {
  if (event.type === "work.drained") {
    const drainedItems = readFiniteNonNegativeNumber(event.payload.drainedItems);
    return drainedItems === undefined ? 0 : Math.max(0, Math.round(drainedItems));
  }
  return isFinishedEvent(event) ? 1 : 0;
}

function toObservedQueueDepth(event: EventRecord): number | undefined {
  const fromPayload =
    readFiniteNonNegativeNumber(event.payload.queueDepthAfter) ?? readFiniteNonNegativeNumber(event.payload.queueDepth);
  if (fromPayload !== undefined) {
    return Math.max(0, Math.round(fromPayload));
  }
  return undefined;
}

function readFiniteNonNegativeNumber(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return undefined;
  }
  return value;
}

function isObservabilityRelevant(event: EventRecord): boolean {
  return event.type.startsWith("a2a.") || event.type.startsWith("work.") || event.type.startsWith("failed-work.");
}

function isEnqueuedEvent(event: EventRecord): boolean {
  const type = event.type.toLowerCase();
  return type.includes("enqueued") || type.includes("queued") || type.includes("sent");
}

function isStartedEvent(event: EventRecord): boolean {
  const type = event.type.toLowerCase();
  return type.includes("started") || type.includes("running") || type.includes("received");
}

function isFinishedEvent(event: EventRecord): boolean {
  const type = event.type.toLowerCase();
  return type.includes("completed") || type.includes("processed") || type.includes("ok") || type.includes("failed");
}

function parseIsoToMillis(value: string): number | undefined {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function compareEventOrder(left: EventRecord, right: EventRecord): number {
  const leftMs = parseIsoToMillis(left.createdAt) ?? 0;
  const rightMs = parseIsoToMillis(right.createdAt) ?? 0;
  if (leftMs !== rightMs) {
    return leftMs - rightMs;
  }
  return left.id.localeCompare(right.id);
}

function minDefined(current: number | undefined, next: number): number {
  if (current === undefined) {
    return next;
  }
  return Math.min(current, next);
}

function maxDefined(current: number | undefined, next: number): number {
  if (current === undefined) {
    return next;
  }
  return Math.max(current, next);
}

function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function percentile95(values: number[]): number | undefined {
  if (values.length === 0) {
    return undefined;
  }
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.max(0, Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.95) - 1));
  return sorted[index];
}

function roundTo(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function clampLimit(value: number | undefined): number {
  if (!Number.isFinite(value)) {
    return DEFAULT_LIMIT;
  }
  return Math.max(1, Math.min(MAX_LIMIT, Math.floor(value as number)));
}

function clampWindowMinutes(value: number | undefined): number {
  if (!Number.isFinite(value)) {
    return DEFAULT_WINDOW_MINUTES;
  }
  return Math.max(5, Math.min(MAX_WINDOW_MINUTES, Math.floor(value as number)));
}

function clampBucketMinutes(value: number | undefined): number {
  if (!Number.isFinite(value)) {
    return DEFAULT_BUCKET_MINUTES;
  }
  return Math.max(1, Math.min(MAX_BUCKET_MINUTES, Math.floor(value as number)));
}
