import type {
  A2aFlowEdge,
  A2aFlowGraphQuery,
  A2aFlowGraphResult,
  A2aFlowHopStatus,
  A2aFlowNode,
  EventRecord
} from "../../shared/contracts.js";
import type { A2aFlowService, EventService } from "../interfaces.js";

const DEFAULT_LIMIT = 200;
const MAX_LIMIT = 1_000;

interface FlowNodeRef {
  id: string;
  kind: A2aFlowNode["kind"];
  label: string;
}

export class LocalA2aFlowService implements A2aFlowService {
  constructor(private readonly eventService: EventService) {}

  async getTrace(traceId: string, query: A2aFlowGraphQuery = {}): Promise<A2aFlowGraphResult> {
    const normalizedTraceId = traceId.trim();
    const limit = clampLimit(query.limit);
    const types = normalizeTypes(query.types);

    const events = await this.collectTraceEvents(normalizedTraceId, limit, types);
    const sorted = [...events.items].sort(compareEventOrder);

    const nodeMap = new Map<string, { node: A2aFlowNode; firstSeen: number }>();
    const edges: A2aFlowEdge[] = [];

    for (let index = 0; index < sorted.length; index += 1) {
      const event = sorted[index]!;
      const source = resolveSourceNode(event);
      const target = resolveTargetNode(event);
      addNode(nodeMap, source, index);
      addNode(nodeMap, target, index);

      const status = resolveHopStatus(event);
      edges.push({
        id: `flow-edge-${event.id}`,
        eventId: event.id,
        type: event.type,
        fromNodeId: source.id,
        toNodeId: target.id,
        status,
        statusLabel: `Step ${index + 1}: ${toStatusLabel(status)}`,
        step: index + 1,
        timestamp: event.createdAt,
        ...(event.runId ? { runId: event.runId } : {}),
        ...(event.parentRunId ? { parentRunId: event.parentRunId } : {}),
        ...(event.sessionId ? { sessionId: event.sessionId } : {}),
        ...(event.taskId ? { taskId: event.taskId } : {})
      });
    }

    const nodes = [...nodeMap.values()]
      .sort((left, right) => left.firstSeen - right.firstSeen)
      .map((item) => item.node);

    return {
      traceId: normalizedTraceId,
      nodes,
      edges,
      truncated: events.truncated
    };
  }

  private async collectTraceEvents(
    traceId: string,
    limit: number,
    types: string[] | undefined
  ): Promise<{ items: EventRecord[]; truncated: boolean }> {
    let cursor: string | undefined;
    const events: EventRecord[] = [];

    while (events.length < limit + 1) {
      const page = await this.eventService.list({
        ...(cursor ? { cursor } : {}),
        limit: 500,
        traceId,
        ...(types ? { types } : {})
      });
      if (page.events.length === 0) {
        break;
      }
      events.push(...page.events);
      if (!page.nextCursor) {
        break;
      }
      cursor = page.nextCursor;
    }

    return {
      items: events.slice(0, limit),
      truncated: events.length > limit
    };
  }
}

function addNode(
  nodeMap: Map<string, { node: A2aFlowNode; firstSeen: number }>,
  node: FlowNodeRef,
  firstSeen: number
): void {
  const existing = nodeMap.get(node.id);
  if (existing) {
    return;
  }
  nodeMap.set(node.id, {
    node,
    firstSeen
  });
}

function resolveSourceNode(event: EventRecord): FlowNodeRef {
  if (event.parentRunId) {
    return {
      id: `run:${event.parentRunId}`,
      kind: "run",
      label: `Run ${event.parentRunId}`
    };
  }

  const fromAgent = readAgentFromPayload(event.payload, ["fromAgent", "fromPersona", "sourceAgent", "caller"]);
  if (fromAgent) {
    return {
      id: `agent:${fromAgent}`,
      kind: "agent",
      label: fromAgent
    };
  }

  if (event.sessionId) {
    return {
      id: `session:${event.sessionId}`,
      kind: "session",
      label: `Session ${event.sessionId}`
    };
  }

  return {
    id: `trace:${event.traceId}`,
    kind: "trace",
    label: `Trace ${event.traceId}`
  };
}

function resolveTargetNode(event: EventRecord): FlowNodeRef {
  if (event.runId) {
    return {
      id: `run:${event.runId}`,
      kind: "run",
      label: `Run ${event.runId}`
    };
  }

  const toAgent = readAgentFromPayload(event.payload, ["toAgent", "toPersona", "targetAgent", "callee"]);
  if (toAgent) {
    return {
      id: `agent:${toAgent}`,
      kind: "agent",
      label: toAgent
    };
  }

  if (event.taskId) {
    return {
      id: `task:${event.taskId}`,
      kind: "task",
      label: `Task ${event.taskId}`
    };
  }

  if (event.sessionId) {
    return {
      id: `session:${event.sessionId}`,
      kind: "session",
      label: `Session ${event.sessionId}`
    };
  }

  return {
    id: `trace:${event.traceId}`,
    kind: "trace",
    label: `Trace ${event.traceId}`
  };
}

function readAgentFromPayload(payload: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = payload[key];
    if (typeof value !== "string") {
      continue;
    }
    const trimmed = value.trim();
    if (trimmed.length > 0) {
      return trimmed;
    }
  }
  return undefined;
}

function resolveHopStatus(event: EventRecord): A2aFlowHopStatus {
  const eventType = event.type.toLowerCase();
  const payloadStatus = readString(event.payload.status)?.toLowerCase();

  if (
    eventType.includes("failed") ||
    eventType.includes("error") ||
    payloadStatus === "failed" ||
    payloadStatus === "error"
  ) {
    return "failed";
  }
  if (
    eventType.includes("sent") ||
    eventType.includes("queued") ||
    eventType.includes("enqueued") ||
    payloadStatus === "sent"
  ) {
    return "sent";
  }
  if (
    eventType.includes("received") ||
    eventType.includes("running") ||
    eventType.includes("started") ||
    payloadStatus === "received" ||
    payloadStatus === "running"
  ) {
    return "received";
  }
  if (
    eventType.includes("ok") ||
    eventType.includes("completed") ||
    eventType.includes("resumed") ||
    payloadStatus === "ok" ||
    payloadStatus === "completed"
  ) {
    return "processed";
  }
  return "unknown";
}

function toStatusLabel(status: A2aFlowHopStatus): string {
  if (status === "sent") {
    return "Message Sent";
  }
  if (status === "received") {
    return "Message Received";
  }
  if (status === "processed") {
    return "Response Processed";
  }
  if (status === "failed") {
    return "Response Failed";
  }
  return "State Unknown";
}

function compareEventOrder(left: EventRecord, right: EventRecord): number {
  const leftTs = Date.parse(left.createdAt);
  const rightTs = Date.parse(right.createdAt);
  if (Number.isFinite(leftTs) && Number.isFinite(rightTs) && leftTs !== rightTs) {
    return leftTs - rightTs;
  }
  if (left.createdAt !== right.createdAt) {
    return left.createdAt.localeCompare(right.createdAt);
  }
  return left.id.localeCompare(right.id);
}

function normalizeTypes(types: string[] | undefined): string[] | undefined {
  if (!types || types.length === 0) {
    return undefined;
  }
  const normalized = types.map((item) => item.trim()).filter((item) => item.length > 0);
  return normalized.length > 0 ? normalized : undefined;
}

function clampLimit(value: number | undefined): number {
  if (!Number.isFinite(value)) {
    return DEFAULT_LIMIT;
  }
  const parsed = Math.floor(value as number);
  return Math.max(1, Math.min(MAX_LIMIT, parsed));
}

function readString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}
