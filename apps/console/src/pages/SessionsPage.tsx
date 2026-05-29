import { useQuery } from "@tanstack/react-query";
import Prism from "prismjs";
import "prismjs/components/prism-json";
import "prismjs/components/prism-typescript";
import "prismjs/components/prism-jsx";
import "prismjs/components/prism-markdown";
import { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import {
  fetchSessionArtifact,
  fetchSessionArtifacts,
  fetchSessionSearch,
  fetchSessions,
  fetchTranscript
} from "../features/sessions/api";
import type {
  SessionArtifactRecord,
  SessionArtifactSummary,
  SessionSearchResultItem,
  TranscriptEntry
} from "../features/sessions/types";
import styles from "./SessionsPage.module.css";

const TRANSCRIPT_BOOTSTRAP_LIMIT = 200;

type StreamState = "connecting" | "live" | "reconnecting" | "offline";

function toLocalTimeLabel(iso: string): string {
  const parsed = Date.parse(iso);
  if (!Number.isFinite(parsed)) {
    return iso;
  }
  return new Date(parsed).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });
}

function toSizeLabel(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) {
    return "--";
  }
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function roleClassName(role: TranscriptEntry["role"]): string {
  if (role === "system") {
    return styles.entrySystem ?? "";
  }
  if (role === "user") {
    return styles.entryUser ?? "";
  }
  if (role === "assistant") {
    return styles.entryAssistant ?? "";
  }
  return styles.entryTool ?? "";
}

function upsertTranscriptEntry(entries: TranscriptEntry[], next: TranscriptEntry): TranscriptEntry[] {
  if (entries.some((entry) => entry.id === next.id)) {
    return entries;
  }
  return [...entries, next].sort((left, right) => left.createdAt.localeCompare(right.createdAt));
}

function parseStreamEntry(data: string): TranscriptEntry | undefined {
  try {
    const parsed = JSON.parse(data) as { ok?: unknown; data?: unknown };
    if (!parsed || parsed.ok !== true || typeof parsed.data !== "object" || parsed.data === null) {
      return undefined;
    }
    const row = parsed.data as Record<string, unknown>;
    if (
      typeof row.id !== "string" ||
      typeof row.content !== "string" ||
      typeof row.createdAt !== "string" ||
      (row.role !== "system" && row.role !== "user" && row.role !== "assistant" && row.role !== "tool")
    ) {
      return undefined;
    }
    return {
      id: row.id,
      role: row.role,
      content: row.content,
      ...(row.kind === "message" || row.kind === "tool-call" || row.kind === "tool-result" ? { kind: row.kind } : {}),
      ...(typeof row.toolCallId === "string" ? { toolCallId: row.toolCallId } : {}),
      ...(typeof row.toolName === "string" ? { toolName: row.toolName } : {}),
      ...(typeof row.isError === "boolean" ? { isError: row.isError } : {}),
      createdAt: row.createdAt
    };
  } catch {
    return undefined;
  }
}

function artifactKey(artifact: Pick<SessionArtifactSummary, "runId" | "id">): string {
  return `${artifact.runId}:${artifact.id}`;
}

function artifactLanguage(artifact: SessionArtifactSummary | SessionArtifactRecord): string {
  const lower = artifact.label.toLowerCase();
  if (lower.endsWith(".json")) {
    return "json";
  }
  if (lower.endsWith(".ts") || lower.endsWith(".tsx")) {
    return "typescript";
  }
  if (lower.endsWith(".js") || lower.endsWith(".jsx")) {
    return "javascript";
  }
  if (lower.endsWith(".md") || lower.endsWith(".markdown")) {
    return "markdown";
  }
  return "plain";
}

function escapeHtml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function highlightCode(text: string, language: string): string {
  if (language === "plain") {
    return escapeHtml(text);
  }
  const grammar = Prism.languages[language];
  if (!grammar) {
    return escapeHtml(text);
  }
  return Prism.highlight(text, grammar, language);
}

function resolveImageMimeType(label: string): string {
  const lower = label.toLowerCase();
  if (lower.endsWith(".png")) {
    return "image/png";
  }
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) {
    return "image/jpeg";
  }
  if (lower.endsWith(".gif")) {
    return "image/gif";
  }
  if (lower.endsWith(".webp")) {
    return "image/webp";
  }
  if (lower.endsWith(".svg")) {
    return "image/svg+xml";
  }
  return "application/octet-stream";
}

function renderHighlightedSnippet(snippet: string, query: string): JSX.Element {
  if (!query.trim()) {
    return <>{snippet}</>;
  }
  const lowerSnippet = snippet.toLowerCase();
  const lowerQuery = query.trim().toLowerCase();
  const hit = lowerSnippet.indexOf(lowerQuery);
  if (hit < 0) {
    return <>{snippet}</>;
  }
  const before = snippet.slice(0, hit);
  const target = snippet.slice(hit, hit + lowerQuery.length);
  const after = snippet.slice(hit + lowerQuery.length);
  return (
    <>
      {before}
      <mark>{target}</mark>
      {after}
    </>
  );
}

function renderArtifactPreview(artifact: SessionArtifactRecord | undefined, loading: boolean): JSX.Element {
  if (loading) {
    return <p className={styles.emptyState}>Loading preview...</p>;
  }
  if (!artifact) {
    return <p className={styles.emptyState}>Select an artifact to preview.</p>;
  }

  if (artifact.format === "image" && artifact.content.kind === "binary") {
    const mimeType = resolveImageMimeType(artifact.label);
    const src = `data:${mimeType};base64,${artifact.content.base64}`;
    return <img src={src} alt={artifact.label} className={styles.previewImage} />;
  }

  if (artifact.format === "markdown" && artifact.content.kind === "text") {
    return (
      <div className={styles.markdownPreview}>
        <ReactMarkdown>{artifact.content.text}</ReactMarkdown>
      </div>
    );
  }

  if (artifact.format === "json") {
    const raw =
      artifact.content.kind === "json"
        ? JSON.stringify(artifact.content.value, null, 2)
        : artifact.content.kind === "text"
          ? artifact.content.text
          : "Binary payload cannot be rendered as JSON.";
    const html = highlightCode(raw, "json");
    return <pre className={styles.codePreview} dangerouslySetInnerHTML={{ __html: html }} />;
  }

  if (artifact.content.kind === "text") {
    const html = highlightCode(artifact.content.text, artifactLanguage(artifact));
    return <pre className={styles.codePreview} dangerouslySetInnerHTML={{ __html: html }} />;
  }

  return (
    <div className={styles.binaryFallback}>
      <p>Preview is unavailable for binary artifacts.</p>
      <p className={styles.sessionMeta}>Type: {artifact.type}</p>
      <p className={styles.sessionMeta}>Size: {toSizeLabel(artifact.sizeBytes)}</p>
    </div>
  );
}

export function SessionsPage() {
  const sessionsQuery = useQuery({
    queryKey: ["sessions", "list"],
    queryFn: () => fetchSessions(150),
    refetchInterval: 10_000
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [searchPersonaId, setSearchPersonaId] = useState("");
  const [searchUserId, setSearchUserId] = useState("");
  const [searchStatus, setSearchStatus] = useState<"" | "ok" | "failed">("");
  const [searchFrom, setSearchFrom] = useState("");
  const [searchTo, setSearchTo] = useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  const [selectedSessionId, setSelectedSessionId] = useState<string>();
  const [selectedArtifactKey, setSelectedArtifactKey] = useState<string>();
  const [streamState, setStreamState] = useState<StreamState>("offline");
  const [entries, setEntries] = useState<TranscriptEntry[]>([]);
  const [streamError, setStreamError] = useState<string>();
  const [focusedEntryId, setFocusedEntryId] = useState<string>();
  const transcriptEntryRefs = useRef<Record<string, HTMLElement | null>>({});
  const lastEntryIdRef = useRef<string>();

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearchQuery(searchQuery.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [searchQuery]);

  const hasActiveSearch = Boolean(
    debouncedSearchQuery || searchPersonaId.trim() || searchUserId.trim() || searchStatus || searchFrom || searchTo
  );

  const sessionSearchQuery = useQuery({
    queryKey: ["sessions", "search", debouncedSearchQuery, searchPersonaId, searchUserId, searchStatus, searchFrom, searchTo],
    queryFn: () =>
      fetchSessionSearch({
        query: debouncedSearchQuery,
        ...(searchPersonaId.trim() ? { personaId: searchPersonaId.trim() } : {}),
        ...(searchUserId.trim() ? { userId: searchUserId.trim() } : {}),
        ...(searchStatus ? { status: searchStatus } : {}),
        ...(searchFrom ? { from: new Date(`${searchFrom}T00:00:00.000Z`).toISOString() } : {}),
        ...(searchTo ? { to: new Date(`${searchTo}T23:59:59.999Z`).toISOString() } : {}),
        limit: 150
      }),
    enabled: hasActiveSearch,
    refetchInterval: 10_000
  });

  const transcriptQuery = useQuery({
    queryKey: ["sessions", "transcript", selectedSessionId],
    queryFn: () => fetchTranscript(selectedSessionId!, { limit: TRANSCRIPT_BOOTSTRAP_LIMIT }),
    enabled: Boolean(selectedSessionId)
  });

  const artifactsQuery = useQuery({
    queryKey: ["sessions", "artifacts", selectedSessionId],
    queryFn: () => fetchSessionArtifacts(selectedSessionId!),
    enabled: Boolean(selectedSessionId)
  });

  const selectedArtifactSummary = useMemo(
    () => artifactsQuery.data?.find((artifact) => artifactKey(artifact) === selectedArtifactKey),
    [artifactsQuery.data, selectedArtifactKey]
  );

  const searchHitsBySessionId = useMemo(() => {
    const map = new Map<string, SessionSearchResultItem>();
    for (const hit of sessionSearchQuery.data?.items ?? []) {
      map.set(hit.session.id, hit);
    }
    return map;
  }, [sessionSearchQuery.data]);

  const visibleSessions = useMemo(
    () => (hasActiveSearch ? (sessionSearchQuery.data?.items ?? []).map((item) => item.session) : sessionsQuery.data ?? []),
    [hasActiveSearch, sessionSearchQuery.data, sessionsQuery.data]
  );

  const artifactPreviewQuery = useQuery({
    queryKey: [
      "sessions",
      "artifacts",
      "detail",
      selectedSessionId,
      selectedArtifactSummary?.runId,
      selectedArtifactSummary?.id
    ],
    queryFn: () => fetchSessionArtifact(selectedSessionId!, selectedArtifactSummary!.runId, selectedArtifactSummary!.id),
    enabled: Boolean(selectedSessionId && selectedArtifactSummary)
  });

  useEffect(() => {
    if (selectedSessionId || visibleSessions.length === 0) {
      return;
    }
    setSelectedSessionId(visibleSessions[0]?.id);
  }, [selectedSessionId, visibleSessions]);

  useEffect(() => {
    if (!selectedSessionId || visibleSessions.some((session) => session.id === selectedSessionId)) {
      return;
    }
    setSelectedSessionId(visibleSessions[0]?.id);
  }, [selectedSessionId, visibleSessions]);

  useEffect(() => {
    setSelectedArtifactKey(undefined);
  }, [selectedSessionId]);

  useEffect(() => {
    if (!artifactsQuery.data || artifactsQuery.data.length === 0) {
      return;
    }
    const hasSelected = selectedArtifactKey
      ? artifactsQuery.data.some((artifact) => artifactKey(artifact) === selectedArtifactKey)
      : false;
    if (!hasSelected) {
      setSelectedArtifactKey(artifactKey(artifactsQuery.data[0]!));
    }
  }, [artifactsQuery.data, selectedArtifactKey]);

  useEffect(() => {
    if (!transcriptQuery.data) {
      return;
    }
    setEntries(transcriptQuery.data);
    lastEntryIdRef.current = transcriptQuery.data[transcriptQuery.data.length - 1]?.id;
  }, [transcriptQuery.data]);

  useEffect(() => {
    if (!selectedSessionId || transcriptQuery.isLoading) {
      setStreamState("offline");
      return;
    }
    let disposed = false;
    let stream: EventSource | undefined;
    let reconnectTimer: number | undefined;
    let attempts = 0;

    const connect = (delayMs: number) => {
      if (disposed) {
        return;
      }
      setStreamState(attempts === 0 ? "connecting" : "reconnecting");
      reconnectTimer = window.setTimeout(() => {
        if (disposed) {
          return;
        }
        const after = lastEntryIdRef.current;
        const url = new URL(
          `/api/v1/sessions/${encodeURIComponent(selectedSessionId)}/transcript/stream`,
          window.location.origin
        );
        url.searchParams.set("limit", String(TRANSCRIPT_BOOTSTRAP_LIMIT));
        if (after) {
          url.searchParams.set("after", after);
        }
        stream = new EventSource(url.toString());
        stream.addEventListener("transcript.entry", (event: MessageEvent) => {
          const entry = parseStreamEntry(event.data);
          if (!entry) {
            return;
          }
          lastEntryIdRef.current = entry.id;
          setEntries((current) => upsertTranscriptEntry(current, entry));
        });
        stream.onopen = () => {
          attempts = 0;
          setStreamState("live");
          setStreamError(undefined);
        };
        stream.onerror = () => {
          stream?.close();
          stream = undefined;
          if (disposed) {
            return;
          }
          attempts += 1;
          setStreamError("Stream interrupted. Reconnecting...");
          const backoff = Math.min(1_000 * 2 ** (attempts - 1), 8_000);
          connect(backoff);
        };
      }, delayMs);
    };

    connect(0);

    return () => {
      disposed = true;
      if (reconnectTimer !== undefined) {
        window.clearTimeout(reconnectTimer);
      }
      stream?.close();
    };
  }, [selectedSessionId, transcriptQuery.isLoading]);

  useEffect(() => {
    if (!focusedEntryId) {
      return;
    }
    const timer = window.setTimeout(() => setFocusedEntryId(undefined), 1800);
    return () => window.clearTimeout(timer);
  }, [focusedEntryId]);

  const selectedSession = useMemo(
    () => visibleSessions.find((session) => session.id === selectedSessionId) ?? sessionsQuery.data?.find((session) => session.id === selectedSessionId),
    [visibleSessions, sessionsQuery.data, selectedSessionId]
  );

  const jumpToArtifactTurn = () => {
    const entryId = artifactPreviewQuery.data?.transcriptEntryId ?? selectedArtifactSummary?.transcriptEntryId;
    if (!entryId) {
      return;
    }
    const target = transcriptEntryRefs.current[entryId];
    if (!target) {
      return;
    }
    target.scrollIntoView({ behavior: "smooth", block: "center" });
    setFocusedEntryId(entryId);
  };

  return (
    <section className={styles.page}>
      <h2>Session Explorer</h2>
      <div className={styles.layout}>
        <aside className={styles.panel}>
          <header className={styles.panelHeader}>
            <strong>Sessions</strong>
            <span className={styles.sessionMeta}>
              {visibleSessions.length}
            </span>
          </header>
          <div className={styles.searchControls}>
            <input
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              className={styles.searchInput}
              placeholder="Search transcript text"
            />
            <div className={styles.filterGrid}>
              <input
                type="text"
                value={searchPersonaId}
                onChange={(event) => setSearchPersonaId(event.target.value)}
                className={styles.searchInput}
                placeholder="operator profile id"
              />
              <input
                type="text"
                value={searchUserId}
                onChange={(event) => setSearchUserId(event.target.value)}
                className={styles.searchInput}
                placeholder="userId"
              />
              <select
                value={searchStatus}
                onChange={(event) => setSearchStatus(event.target.value as "" | "ok" | "failed")}
                className={styles.searchSelect}
              >
                <option value="">all statuses</option>
                <option value="ok">ok</option>
                <option value="failed">failed</option>
              </select>
              <input
                type="date"
                value={searchFrom}
                onChange={(event) => setSearchFrom(event.target.value)}
                className={styles.searchInput}
                aria-label="From date"
              />
              <input
                type="date"
                value={searchTo}
                onChange={(event) => setSearchTo(event.target.value)}
                className={styles.searchInput}
                aria-label="To date"
              />
            </div>
            {hasActiveSearch ? (
              <p className={styles.searchMeta}>
                {sessionSearchQuery.data ? `${sessionSearchQuery.data.total} hits` : "Searching..."}
                {sessionSearchQuery.data ? ` in ${sessionSearchQuery.data.tookMs} ms` : ""}
              </p>
            ) : null}
          </div>
          {sessionsQuery.isLoading ? (
            <p className={styles.emptyState}>Loading sessions...</p>
          ) : hasActiveSearch && sessionSearchQuery.isLoading ? (
            <p className={styles.emptyState}>Searching sessions...</p>
          ) : hasActiveSearch && sessionSearchQuery.error ? (
            <p className={styles.emptyState}>Unable to search sessions.</p>
          ) : sessionsQuery.error ? (
            <p className={styles.emptyState}>Unable to load sessions.</p>
          ) : visibleSessions.length === 0 ? (
            <p className={styles.emptyState}>No sessions available.</p>
          ) : (
            <ul className={styles.sessionList}>
              {visibleSessions.map((session) => {
                const hit = searchHitsBySessionId.get(session.id);
                return (
                  <li key={session.id}>
                    <button
                      type="button"
                      className={`${styles.sessionItem} ${selectedSessionId === session.id ? styles.sessionItemActive : ""}`}
                      onClick={() => setSelectedSessionId(session.id)}
                    >
                      <span className={styles.sessionId}>{session.id}</span>
                      <span className={styles.sessionMeta}>{toLocalTimeLabel(session.updatedAt)}</span>
                      {hit ? (
                        <>
                          <span className={styles.sessionSearchStatus}>{hit.status}</span>
                          <span className={styles.sessionSnippet}>
                            {renderHighlightedSnippet(hit.snippet, debouncedSearchQuery)}
                          </span>
                        </>
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </aside>

        <section className={styles.panel}>
          <header className={styles.panelHeader}>
            <strong>{selectedSession?.id ?? "Transcript"}</strong>
            <span
              className={
                streamState === "live"
                  ? styles.statusLive
                  : streamState === "reconnecting" || streamState === "connecting"
                    ? styles.statusReconnecting
                    : styles.statusOffline
              }
            >
              {streamState}
            </span>
          </header>
          {transcriptQuery.isLoading ? (
            <p className={styles.emptyState}>Loading transcript...</p>
          ) : entries.length === 0 ? (
            <p className={styles.emptyState}>{streamError ?? "No transcript entries yet."}</p>
          ) : (
            <div className={styles.transcript}>
              {entries.map((entry) => (
                <article
                  key={entry.id}
                  ref={(element) => {
                    transcriptEntryRefs.current[entry.id] = element;
                  }}
                  className={`${styles.entry} ${roleClassName(entry.role)} ${entry.isError ? styles.entryError : ""} ${focusedEntryId === entry.id ? styles.entryFocused : ""}`}
                >
                  <header className={styles.entryHeader}>
                    <span className={styles.entryRole}>{entry.role}</span>
                    <span>{toLocalTimeLabel(entry.createdAt)}</span>
                  </header>
                  <p className={styles.entryContent}>{entry.content}</p>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className={styles.panel}>
          <header className={styles.panelHeader}>
            <strong>Artifact Gallery</strong>
            <span className={styles.sessionMeta}>{artifactsQuery.data ? `${artifactsQuery.data.length}` : "0"}</span>
          </header>
          <div className={styles.galleryLayout}>
            <div className={styles.galleryList}>
              {artifactsQuery.isLoading ? (
                <p className={styles.emptyState}>Loading artifacts...</p>
              ) : artifactsQuery.error ? (
                <p className={styles.emptyState}>Unable to load artifacts.</p>
              ) : !artifactsQuery.data || artifactsQuery.data.length === 0 ? (
                <p className={styles.emptyState}>No artifacts captured for this session.</p>
              ) : (
                artifactsQuery.data.map((artifact) => {
                  const selected = selectedArtifactKey === artifactKey(artifact);
                  return (
                    <button
                      key={artifactKey(artifact)}
                      type="button"
                      className={`${styles.artifactCard} ${selected ? styles.artifactCardActive : ""}`}
                      onClick={() => setSelectedArtifactKey(artifactKey(artifact))}
                    >
                      <span className={styles.artifactFormat}>{artifact.format}</span>
                      <strong className={styles.artifactLabel}>{artifact.label}</strong>
                      <span className={styles.sessionMeta}>{toSizeLabel(artifact.sizeBytes)}</span>
                      <span className={styles.sessionMeta}>{toLocalTimeLabel(artifact.createdAt)}</span>
                    </button>
                  );
                })
              )}
            </div>

            <div className={styles.previewPanel}>
              <header className={styles.previewHeader}>
                <strong>{selectedArtifactSummary?.label ?? "Preview"}</strong>
                <button
                  type="button"
                  className={styles.auditTrailButton}
                  onClick={jumpToArtifactTurn}
                  disabled={!(artifactPreviewQuery.data?.transcriptEntryId ?? selectedArtifactSummary?.transcriptEntryId)}
                >
                  Audit Trail
                </button>
              </header>
              <div className={styles.previewBody}>
                {renderArtifactPreview(artifactPreviewQuery.data, artifactPreviewQuery.isLoading)}
              </div>
            </div>
          </div>
        </section>
      </div>
    </section>
  );
}
