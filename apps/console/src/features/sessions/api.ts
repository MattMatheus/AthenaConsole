import { apiClient } from "../../services";
import type {
  SessionArtifactContent,
  SessionArtifactRecord,
  SessionArtifactSummary,
  SessionSearchQuery,
  SessionSearchResult,
  SessionSearchResultItem,
  SessionSearchStatus,
  SessionRecord,
  TranscriptEntry
} from "./types";

interface SessionsListResponse {
  items: SessionRecord[];
}

interface TranscriptResponse {
  items: TranscriptEntry[];
}

interface SessionArtifactsResponse {
  items: SessionArtifactSummary[];
}

interface SessionSearchResponse {
  items: SessionSearchResultItem[];
  total: number;
  tookMs: number;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (typeof value === "object" && value !== null) {
    return value as Record<string, unknown>;
  }
  return undefined;
}

function asSessionRecord(value: unknown): SessionRecord | undefined {
  const row = asRecord(value);
  if (!row || typeof row.id !== "string" || typeof row.transcriptPath !== "string") {
    return undefined;
  }
  if (typeof row.createdAt !== "string" || typeof row.updatedAt !== "string") {
    return undefined;
  }
  return {
    id: row.id,
    transcriptPath: row.transcriptPath,
    ...(typeof row.model === "string" ? { model: row.model } : {}),
    ...(typeof row.provider === "string" ? { provider: row.provider } : {}),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}

function asTranscriptEntry(value: unknown): TranscriptEntry | undefined {
  const row = asRecord(value);
  if (!row || typeof row.id !== "string" || typeof row.content !== "string" || typeof row.createdAt !== "string") {
    return undefined;
  }
  if (row.role !== "system" && row.role !== "user" && row.role !== "assistant" && row.role !== "tool") {
    return undefined;
  }
  const metadataRow = asRecord(row.metadata);
  const metadata =
    metadataRow &&
    Object.entries(metadataRow).every((entry) => typeof entry[1] === "string")
      ? (metadataRow as Record<string, string>)
      : undefined;

  return {
    id: row.id,
    role: row.role,
    content: row.content,
    ...(row.kind === "message" || row.kind === "tool-call" || row.kind === "tool-result" ? { kind: row.kind } : {}),
    ...(typeof row.toolCallId === "string" ? { toolCallId: row.toolCallId } : {}),
    ...(typeof row.toolName === "string" ? { toolName: row.toolName } : {}),
    ...(typeof row.isError === "boolean" ? { isError: row.isError } : {}),
    ...(metadata ? { metadata } : {}),
    createdAt: row.createdAt
  };
}

function asSessionArtifactContent(value: unknown): SessionArtifactContent | undefined {
  const row = asRecord(value);
  if (!row || typeof row.kind !== "string") {
    return undefined;
  }
  if (row.kind === "text" && typeof row.text === "string") {
    return { kind: "text", text: row.text };
  }
  if (row.kind === "json" && "value" in row) {
    return { kind: "json", value: row.value };
  }
  if (row.kind === "binary" && typeof row.base64 === "string") {
    return { kind: "binary", base64: row.base64 };
  }
  return undefined;
}

function asSessionArtifactSummary(value: unknown): SessionArtifactSummary | undefined {
  const row = asRecord(value);
  if (
    !row ||
    typeof row.id !== "string" ||
    typeof row.runId !== "string" ||
    typeof row.sessionId !== "string" ||
    typeof row.traceId !== "string" ||
    typeof row.label !== "string" ||
    typeof row.artifactRef !== "string" ||
    typeof row.sizeBytes !== "number" ||
    typeof row.createdAt !== "string"
  ) {
    return undefined;
  }
  if (row.type !== "text" && row.type !== "json" && row.type !== "binary") {
    return undefined;
  }
  if (
    row.format !== "text" &&
    row.format !== "json" &&
    row.format !== "markdown" &&
    row.format !== "image" &&
    row.format !== "binary"
  ) {
    return undefined;
  }
  return {
    id: row.id,
    runId: row.runId,
    sessionId: row.sessionId,
    traceId: row.traceId,
    label: row.label,
    type: row.type,
    format: row.format,
    artifactRef: row.artifactRef,
    sizeBytes: row.sizeBytes,
    createdAt: row.createdAt,
    ...(typeof row.transcriptEntryId === "string" ? { transcriptEntryId: row.transcriptEntryId } : {})
  };
}

function asSessionArtifactRecord(value: unknown): SessionArtifactRecord | undefined {
  const summary = asSessionArtifactSummary(value);
  if (!summary) {
    return undefined;
  }
  const content = asSessionArtifactContent(asRecord(value)?.content);
  if (!content) {
    return undefined;
  }
  return {
    ...summary,
    content
  };
}

function asSessionSearchStatus(value: unknown): SessionSearchStatus | undefined {
  return value === "ok" || value === "failed" ? value : undefined;
}

function asSessionSearchResultItem(value: unknown): SessionSearchResultItem | undefined {
  const row = asRecord(value);
  if (!row || typeof row.snippet !== "string" || typeof row.matchedAt !== "string") {
    return undefined;
  }
  const session = asSessionRecord(row.session);
  const status = asSessionSearchStatus(row.status);
  if (!session || !status) {
    return undefined;
  }
  return {
    session,
    snippet: row.snippet,
    matchedAt: row.matchedAt,
    status,
    ...(typeof row.snippetEntryId === "string" ? { snippetEntryId: row.snippetEntryId } : {}),
    ...(typeof row.agentId === "string" ? { agentId: row.agentId } : {}),
    ...(typeof row.userId === "string" ? { userId: row.userId } : {})
  };
}

export async function fetchSessions(limit = 100): Promise<SessionRecord[]> {
  const payload = await apiClient.get<SessionsListResponse | unknown>(`/v1/sessions?limit=${Math.max(1, limit)}`);
  const response = asRecord(payload);
  const items = Array.isArray(response?.items) ? response.items : [];
  return items.map((item) => asSessionRecord(item)).filter((item): item is SessionRecord => Boolean(item));
}

export async function fetchTranscript(sessionId: string, options: { limit?: number } = {}): Promise<TranscriptEntry[]> {
  const limit = options.limit ?? 150;
  const payload = await apiClient.get<TranscriptResponse | unknown>(
    `/v1/sessions/${encodeURIComponent(sessionId)}/transcript?limit=${Math.max(1, limit)}`
  );
  const response = asRecord(payload);
  const items = Array.isArray(response?.items) ? response.items : [];
  return items.map((item) => asTranscriptEntry(item)).filter((item): item is TranscriptEntry => Boolean(item));
}

export async function fetchSessionArtifacts(sessionId: string): Promise<SessionArtifactSummary[]> {
  const payload = await apiClient.get<SessionArtifactsResponse | unknown>(
    `/v1/sessions/${encodeURIComponent(sessionId)}/artifacts`
  );
  const response = asRecord(payload);
  const items = Array.isArray(response?.items) ? response.items : [];
  return items.map((item) => asSessionArtifactSummary(item)).filter((item): item is SessionArtifactSummary => Boolean(item));
}

export async function fetchSessionArtifact(
  sessionId: string,
  runId: string,
  artifactId: string
): Promise<SessionArtifactRecord> {
  const payload = await apiClient.get<SessionArtifactRecord | unknown>(
    `/v1/sessions/${encodeURIComponent(sessionId)}/artifacts/${encodeURIComponent(runId)}/${encodeURIComponent(artifactId)}`
  );
  const artifact = asSessionArtifactRecord(payload);
  if (!artifact) {
    throw new Error("Malformed artifact payload.");
  }
  return artifact;
}

export async function fetchSessionSearch(query: SessionSearchQuery): Promise<SessionSearchResult> {
  const params = new URLSearchParams();
  params.set("query", query.query);
  if (query.agentId) {
    params.set("agentId", query.agentId);
  }
  if (query.userId) {
    params.set("userId", query.userId);
  }
  if (query.status) {
    params.set("status", query.status);
  }
  if (query.from) {
    params.set("from", query.from);
  }
  if (query.to) {
    params.set("to", query.to);
  }
  if (typeof query.limit === "number") {
    params.set("limit", String(query.limit));
  }
  const payload = await apiClient.get<SessionSearchResponse | unknown>(`/v1/sessions/search?${params.toString()}`);
  const response = asRecord(payload);
  const items = Array.isArray(response?.items) ? response.items : [];
  const decodedItems = items
    .map((item) => asSessionSearchResultItem(item))
    .filter((item): item is SessionSearchResultItem => Boolean(item));
  return {
    items: decodedItems,
    total: typeof response?.total === "number" ? response.total : decodedItems.length,
    tookMs: typeof response?.tookMs === "number" ? response.tookMs : 0
  };
}
