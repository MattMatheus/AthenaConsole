export interface FailedWorkItem {
  id: string;
  createdAt: string;
  updatedAt: string;
  status: "pending" | "retried" | "discarded";
  reason?: string;
  payload: Record<string, unknown>;
}

export interface FailedWorkListQuery {
  cursor?: string;
  limit?: number;
  status?: FailedWorkItem["status"];
}

export interface FailedWorkListResult {
  items: FailedWorkItem[];
  nextCursor?: string;
}

export interface A2aFlowGraphQuery {
  limit?: number;
  types?: string[];
}

export type A2aFlowNodeKind = "trace" | "run" | "session" | "task" | "agent";

export interface A2aFlowNode {
  id: string;
  kind: A2aFlowNodeKind;
  label: string;
}

export type A2aFlowHopStatus = "sent" | "received" | "processed" | "failed" | "unknown";

export interface A2aFlowEdge {
  id: string;
  eventId: string;
  type: string;
  fromNodeId: string;
  toNodeId: string;
  status: A2aFlowHopStatus;
  statusLabel: string;
  step: number;
  timestamp: string;
  runId?: string;
  parentRunId?: string;
  sessionId?: string;
  taskId?: string;
}

export interface A2aFlowGraphResult {
  traceId: string;
  nodes: A2aFlowNode[];
  edges: A2aFlowEdge[];
  truncated: boolean;
}

export interface A2aObservabilityQuery {
  limit?: number;
  windowMinutes?: number;
  bucketMinutes?: number;
  traceId?: string;
}

export interface A2aQueueThroughputPoint {
  queueId: string;
  bucketStart: string;
  bucketEnd: string;
  processedItems: number;
  itemsPerMinute: number;
  queueDepth: number;
}

export interface A2aLatencyHeatmapCell {
  traceId: string;
  stepId: string;
  sampleSize: number;
  averageLatencyMs: number;
  p95LatencyMs: number;
  averageQueueWaitMs: number;
}

export interface A2aStallAlert {
  traceId: string;
  stepId: string;
  queueId: string;
  correlationId: string;
  startedAt: string;
  pendingForMs: number;
  historicalP95Ms: number;
  severity: "warning" | "critical";
}

export interface A2aStallAlertHistoryQuery {
  cursor?: string;
  limit?: number;
  traceId?: string;
  stepId?: string;
  severity?: A2aStallAlert["severity"];
  createdAfter?: string;
  createdBefore?: string;
}

export interface A2aStallAlertHistoryEntry extends A2aStallAlert {
  id: string;
  createdAt: string;
  resolvedAt?: string;
  status: "active" | "resolved";
}

export interface A2aStallAlertHistoryResult {
  items: A2aStallAlertHistoryEntry[];
  nextCursor?: string;
}

export interface A2aStallAlertCsvExportQuery {
  traceId?: string;
  stepId?: string;
  severity?: A2aStallAlert["severity"];
  createdAfter: string;
  createdBefore: string;
}

export interface A2aObservabilityResult {
  computedAt: string;
  windowStart: string;
  windowEnd: string;
  bucketMinutes: number;
  throughput: A2aQueueThroughputPoint[];
  latencyHeatmap: A2aLatencyHeatmapCell[];
  stallAlerts: A2aStallAlert[];
  sampleCount: number;
  truncated: boolean;
}
