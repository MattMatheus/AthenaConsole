import {
  assertApiResponseSchema,
} from "../../control-plane/api-schemas.js";
import { AthenaError } from "../../runtime/errors.js";
import { resolveTenantId, trackOperationEvent } from "../../observability/application-insights.js";
import type { TranscriptEntry } from "../../shared/contracts.js";
import {
  parseCancelRunRequest,
  parseCreateRunRequest,
  parseCursorPageQuery,
  parseRunControlQuery,
  parseSessionSearchQuery,
  parseTailQuery
} from "../request-parsers/index.js";
import type { RouteParams } from "../router.js";
import { emitEventBestEffort, readJson, writeSuccess } from "../route-helpers.js";
import { defineApiRoutes, type ApiRouteContext } from "./route-registration.js";

export const RUN_ROUTES = defineApiRoutes("runs", [
  { method: "POST", path: "/api/v1/runs", handler: handleCreateRunRoute },
  { method: "GET", path: "/api/v1/runs/active", handler: handleListActiveRunsRoute },
  { method: "GET", path: "/api/v1/runs/cancel-requests", handler: handleListCancellationRequestsRoute },
  { method: "POST", path: "/api/v1/runs/:sessionId/cancel", handler: handleCancelRunRoute },
  { method: "POST", path: "/api/v1/run-control/by-run/:runId/cancel", handler: handleCancelRunByRunIdRoute }
]);

export const SESSION_ROUTES = defineApiRoutes("sessions", [
  { method: "GET", path: "/api/v1/sessions", handler: handleListSessionsRoute },
  { method: "GET", path: "/api/v1/sessions/search", handler: handleSearchSessionsRoute },
  { method: "GET", path: "/api/v1/sessions/:sessionId/transcript", handler: handleGetSessionTranscriptRoute },
  { method: "GET", path: "/api/v1/sessions/:sessionId/artifacts", handler: handleListSessionArtifactsRoute },
  {
    method: "GET",
    path: "/api/v1/sessions/:sessionId/artifacts/:runId/:artifactId",
    handler: handleGetSessionArtifactRoute
  },
  { method: "GET", path: "/api/v1/sessions/:sessionId/transcript/stream", handler: handleStreamSessionTranscriptRoute },
  { method: "GET", path: "/api/v1/sessions/:sessionId/work-queue", handler: handleGetSessionWorkQueueRoute }
]);

const SESSION_TRANSCRIPT_HEARTBEAT_MS = 15_000;

async function handleListActiveRunsRoute(context: ApiRouteContext): Promise<void> {
  const query = parseRunControlQuery(context.requestUrl);
  writeSuccess(context.res, "listActiveRuns", 200, await context.services.runService.listActiveRuns(query));
}

async function handleListCancellationRequestsRoute(context: ApiRouteContext): Promise<void> {
  const query = parseRunControlQuery(context.requestUrl);
  writeSuccess(
    context.res,
    "listCancellationRequests",
    200,
    await context.services.runService.listCancellationRequests(query)
  );
}

async function handleCreateRunRoute(context: ApiRouteContext): Promise<void> {
  const body = await readJson(context.req);
  const runRequest = parseCreateRunRequest(body);
  const result = await context.services.runService.run(runRequest);
  trackOperationEvent("athena.run.created", {
    runId: result.runId,
    agentId: runRequest.metadata?.agentId,
    tenantId: resolveTenantId(context.req),
    sessionId: runRequest.sessionId,
    provider: result.provider,
    model: result.model
  });
  await emitEventBestEffort(context.services, {
    traceId: context.traceId,
    type: "run.created",
    sessionId: runRequest.sessionId,
    payload: {
      ...(result.directiveId ? { directiveId: result.directiveId } : {}),
      ...(result.harnessProfileId ? { harnessProfileId: result.harnessProfileId } : {}),
      provider: result.provider,
      model: result.model
    }
  });
  writeSuccess(context.res, "createRun", 200, result);
}

async function handleCancelRunRoute(context: ApiRouteContext, params: RouteParams): Promise<void> {
  const body = await readJson(context.req);
  const cancelRequest = parseCancelRunRequest(body);
  const result = await context.services.runService.cancel({
    sessionId: decodeRouteParam(params, "sessionId"),
    ...cancelRequest
  });
  await emitEventBestEffort(context.services, {
    traceId: context.traceId,
    type: "run.cancel.requested",
    sessionId: result.sessionId,
    payload: {
      status: result.status,
      ...(cancelRequest.reason ? { reason: cancelRequest.reason } : {})
    }
  });
  writeSuccess(context.res, "cancelRun", 200, result);
}

async function handleCancelRunByRunIdRoute(context: ApiRouteContext, params: RouteParams): Promise<void> {
  const body = await readJson(context.req);
  const cancelRequest = parseCancelRunRequest(body);
  const result = await context.services.runService.cancelByRunId({
    runId: decodeRouteParam(params, "runId"),
    ...cancelRequest
  });
  trackOperationEvent("athena.run.cancel.requested", {
    runId: result.runId,
    tenantId: resolveTenantId(context.req),
    ...(result.sessionId ? { sessionId: result.sessionId } : {})
  });
  await emitEventBestEffort(context.services, {
    traceId: context.traceId,
    type: "run.cancel.requested",
    ...(result.sessionId ? { sessionId: result.sessionId } : {}),
    payload: {
      runId: result.runId,
      status: result.status,
      ...(cancelRequest.reason ? { reason: cancelRequest.reason } : {})
    }
  });
  writeSuccess(context.res, "cancelRunByRunId", 200, result);
}

async function handleListSessionsRoute(context: ApiRouteContext): Promise<void> {
  const query = parseCursorPageQuery(context.requestUrl);
  const sessions = await context.services.sessionService.listSessions();
  sessions.sort(compareSessionsDesc);
  const page = pageSessionRows(sessions, query);
  writeSuccess(context.res, "listSessions", 200, {
    items: page.items,
    ...(page.nextCursor ? { nextCursor: page.nextCursor } : {})
  });
}

async function handleSearchSessionsRoute(context: ApiRouteContext): Promise<void> {
  const query = parseSessionSearchQuery(context.requestUrl);
  const results = await context.services.sessionService.searchSessions(query);
  writeSuccess(context.res, "searchSessions", 200, results);
}

async function handleGetSessionTranscriptRoute(context: ApiRouteContext, params: RouteParams): Promise<void> {
  const query = parseTailQuery(context.requestUrl);
  const transcript = await context.services.sessionService.getTranscript(decodeRouteParam(params, "sessionId"), {
    ...(query.after ? { after: query.after } : {}),
    limit: query.limit
  });
  writeSuccess(context.res, "getSessionTranscript", 200, { items: transcript });
}

async function handleStreamSessionTranscriptRoute(context: ApiRouteContext, params: RouteParams): Promise<void> {
  const query = parseTailQuery(context.requestUrl);
  const initialCursor = query.after ?? context.req.headers["last-event-id"];
  const after = typeof initialCursor === "string" ? initialCursor : undefined;
  await streamSessionTranscript(context, {
    sessionId: decodeRouteParam(params, "sessionId"),
    ...(after ? { after } : {}),
    limit: query.limit
  });
}

async function handleGetSessionWorkQueueRoute(context: ApiRouteContext, params: RouteParams): Promise<void> {
  writeSuccess(
    context.res,
    "getSessionWorkQueue",
    200,
    await context.services.workService.status(decodeRouteParam(params, "sessionId"))
  );
}

async function handleListSessionArtifactsRoute(context: ApiRouteContext, params: RouteParams): Promise<void> {
  const sessionId = decodeRouteParam(params, "sessionId");
  const items = await context.services.sessionService.listArtifacts(sessionId);
  writeSuccess(context.res, "listSessionArtifacts", 200, { items });
}

async function handleGetSessionArtifactRoute(context: ApiRouteContext, params: RouteParams): Promise<void> {
  const sessionId = decodeRouteParam(params, "sessionId");
  const runId = decodeRouteParam(params, "runId");
  const artifactId = decodeRouteParam(params, "artifactId");
  const artifact = await context.services.sessionService.getArtifact(sessionId, runId, artifactId);
  if (!artifact) {
    throw new AthenaError("PROVIDER_NOT_FOUND", "Artifact was not found for the requested session.");
  }
  writeSuccess(context.res, "getSessionArtifact", 200, artifact);
}

async function streamSessionTranscript(
  context: ApiRouteContext,
  options: { sessionId: string; after?: string; limit: number }
): Promise<void> {
  let cursor = options.after;
  let closed = false;
  let heartbeat: NodeJS.Timeout | undefined;
  const seen = new Set<string>();
  const buffered: TranscriptEntry[] = [];
  let primed = false;

  const close = () => {
    if (closed) {
      return;
    }
    closed = true;
    if (heartbeat) {
      clearInterval(heartbeat);
    }
  };

  context.res.on("close", close);
  context.res.writeHead(200, {
    "content-type": "text/event-stream",
    "cache-control": "no-cache",
    connection: "keep-alive"
  });
  context.res.write("retry: 1500\n");

  const writeEntry = (entry: TranscriptEntry) => {
    if (closed || seen.has(entry.id)) {
      return;
    }
    const payload = JSON.stringify({ ok: true, data: entry });
    assertApiResponseSchema("streamSessionTranscript", { ok: true, data: entry });
    context.res.write(`id: ${entry.id}\n`);
    context.res.write("event: transcript.entry\n");
    context.res.write(`data: ${payload}\n\n`);
    seen.add(entry.id);
    cursor = entry.id;
  };

  const subscription = await context.services.sessionService.subscribeTranscript(options.sessionId, (entry) => {
    if (!primed) {
      buffered.push(entry);
      return;
    }
    writeEntry(entry);
  });

  try {
    const initialEntries = await context.services.sessionService.getTranscript(options.sessionId, {
      ...(cursor ? { after: cursor } : {}),
      limit: options.limit
    });
    for (const entry of initialEntries) {
      writeEntry(entry);
    }
    primed = true;
    for (const entry of buffered) {
      writeEntry(entry);
    }
    buffered.length = 0;
    heartbeat = setInterval(() => {
      if (!closed) {
        context.res.write(": heartbeat\n\n");
      }
    }, SESSION_TRANSCRIPT_HEARTBEAT_MS);
    await waitForClose(context.res);
  } finally {
    close();
    subscription.close();
  }
}

function waitForClose(res: ApiRouteContext["res"]): Promise<void> {
  if (res.writableEnded) {
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    res.once("close", () => resolve());
  });
}

interface DecodedOffsetCursor {
  kind: "offset";
  offset: number;
}

interface DecodedSessionCursor {
  kind: "sessions";
  updatedAt: string;
  id: string;
}

type DecodedSessionsPageCursor = DecodedOffsetCursor | DecodedSessionCursor;

function pageSessionRows<T extends { id: string; updatedAt: string }>(
  sessions: T[],
  query: { cursor?: string; limit: number }
): { items: T[]; nextCursor?: string } {
  const decoded = decodeSessionsPageCursor(query.cursor);
  if (query.cursor && (!decoded || decoded.kind === "offset")) {
    const offset = decodeCursorOffset(query.cursor);
    const items = sessions.slice(offset, offset + query.limit);
    const nextOffset = offset + items.length;
    return {
      items,
      ...(nextOffset < sessions.length ? { nextCursor: encodeCursorOffset(nextOffset) } : {})
    };
  }

  const remaining =
    decoded && decoded.kind === "sessions"
      ? (() => {
          const startIndex = sessions.findIndex((row) => compareSessionToCursor(row, decoded) > 0);
          if (startIndex < 0) {
            return [];
          }
          return sessions.slice(startIndex);
        })()
      : sessions;
  const items = remaining.slice(0, query.limit);
  return {
    items,
    ...(remaining.length > items.length ? { nextCursor: encodeSessionCursor(items[items.length - 1]!) } : {})
  };
}

function encodeSessionCursor(row: { id: string; updatedAt: string }): string {
  return Buffer.from(
    JSON.stringify({
      kind: "sessions",
      updatedAt: row.updatedAt,
      id: row.id
    }),
    "utf8"
  ).toString("base64url");
}

function encodeCursorOffset(offset: number): string {
  return Buffer.from(String(offset), "utf8").toString("base64url");
}

function decodeSessionsPageCursor(cursor: string | undefined): DecodedSessionsPageCursor | undefined {
  if (!cursor) {
    return undefined;
  }
  const offset = decodeCursorOffsetRaw(cursor);
  if (offset !== undefined) {
    return {
      kind: "offset",
      offset
    };
  }
  try {
    const decoded = Buffer.from(cursor, "base64url").toString("utf8");
    const parsed = JSON.parse(decoded) as Record<string, unknown>;
    if (parsed.kind === "sessions" && typeof parsed.updatedAt === "string" && typeof parsed.id === "string") {
      return {
        kind: "sessions",
        updatedAt: parsed.updatedAt,
        id: parsed.id
      };
    }
    return undefined;
  } catch {
    return undefined;
  }
}

function decodeCursorOffset(cursor: string | undefined): number {
  if (!cursor) {
    return 0;
  }
  const parsed = decodeCursorOffsetRaw(cursor);
  return parsed ?? 0;
}

function decodeCursorOffsetRaw(cursor: string): number | undefined {
  try {
    const decoded = Buffer.from(cursor, "base64url").toString("utf8");
    const parsed = Number.parseInt(decoded, 10);
    if (!Number.isFinite(parsed) || parsed < 0) {
      return undefined;
    }
    return parsed;
  } catch {
    return undefined;
  }
}

function compareSessionsDesc(left: { updatedAt: string; id: string }, right: { updatedAt: string; id: string }): number {
  return compareStringsDesc(left.updatedAt, right.updatedAt) || compareStringsDesc(left.id, right.id);
}

function compareSessionToCursor(row: { updatedAt: string; id: string }, cursor: DecodedSessionsPageCursor): number {
  if (cursor.kind !== "sessions") {
    return -1;
  }
  return compareStringsDesc(row.updatedAt, cursor.updatedAt) || compareStringsDesc(row.id, cursor.id);
}

function compareStringsDesc(left: string, right: string): number {
  return right.localeCompare(left);
}

function decodeRouteParam(params: RouteParams, key: string): string {
  return decodeURIComponent(params[key] ?? "");
}
