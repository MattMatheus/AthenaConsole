export type A2aObservabilityQuery = {
  limit?: number;
  windowMinutes?: number;
  bucketMinutes?: number;
  traceId?: string;
};

export type A2aQueueThroughputPoint = {
  queueId: string;
  bucketStart: string;
  bucketEnd: string;
  processedItems: number;
  itemsPerMinute: number;
  queueDepth: number;
};

export type A2aLatencyHeatmapCell = {
  traceId: string;
  stepId: string;
  sampleSize: number;
  averageLatencyMs: number;
  p95LatencyMs: number;
  averageQueueWaitMs: number;
};

export type A2aStallAlert = {
  traceId: string;
  stepId: string;
  queueId: string;
  correlationId: string;
  startedAt: string;
  pendingForMs: number;
  historicalP95Ms: number;
  severity: "warning" | "critical";
};

export type A2aStallAlertHistoryQuery = {
  cursor?: string;
  limit?: number;
  traceId?: string;
  stepId?: string;
  severity?: "warning" | "critical";
  createdAfter?: string;
  createdBefore?: string;
};

export type A2aStallAlertHistoryEntry = A2aStallAlert & {
  id: string;
  createdAt: string;
  resolvedAt?: string;
  status: "active" | "resolved";
};

export type A2aStallAlertHistoryResult = {
  items: A2aStallAlertHistoryEntry[];
  nextCursor?: string;
};

export type A2aObservabilityResult = {
  computedAt: string;
  windowStart: string;
  windowEnd: string;
  bucketMinutes: number;
  throughput: A2aQueueThroughputPoint[];
  latencyHeatmap: A2aLatencyHeatmapCell[];
  stallAlerts: A2aStallAlert[];
  sampleCount: number;
  truncated: boolean;
};
