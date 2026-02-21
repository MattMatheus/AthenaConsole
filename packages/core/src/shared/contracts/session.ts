export interface TranscriptEntry {
  id: string;
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  kind?: "message" | "tool-call" | "tool-result";
  toolCallId?: string;
  toolName?: string;
  isError?: boolean;
  metadata?: Record<string, string>;
  createdAt: string;
}

export interface SessionRecord {
  schemaVersion?: number;
  id: string;
  transcriptPath: string;
  model?: string;
  provider?: string;
  createdAt: string;
  updatedAt: string;
}

export type SessionSearchStatus = "ok" | "failed";

export interface SessionSearchQuery {
  query: string;
  personaId?: string;
  userId?: string;
  status?: SessionSearchStatus;
  from?: string;
  to?: string;
  limit?: number;
}

export interface SessionSearchResultItem {
  session: SessionRecord;
  snippet: string;
  snippetEntryId?: string;
  matchedAt: string;
  status: SessionSearchStatus;
  personaId?: string;
  userId?: string;
}

export interface SessionSearchResult {
  items: SessionSearchResultItem[];
  total: number;
  tookMs: number;
}

export type SessionArtifactType = "text" | "json" | "binary";

export type SessionArtifactFormat = "text" | "json" | "markdown" | "image" | "binary";

export type SessionArtifactContent =
  | { kind: "text"; text: string }
  | { kind: "json"; value: unknown }
  | { kind: "binary"; base64: string };

export interface SessionArtifactSummary {
  id: string;
  runId: string;
  sessionId: string;
  traceId: string;
  label: string;
  type: SessionArtifactType;
  format: SessionArtifactFormat;
  artifactRef: string;
  sizeBytes: number;
  createdAt: string;
  transcriptEntryId?: string;
}

export interface SessionArtifactRecord extends SessionArtifactSummary {
  content: SessionArtifactContent;
}
