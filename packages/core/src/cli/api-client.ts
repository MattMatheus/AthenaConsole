import type {
  CancelRunRequest,
  CancelRunResult,
  EvidenceBundle,
  RunRequest,
  RunResult,
  ScheduledTask,
  ScheduleRunLog,
  WorkItem,
  WorkQueueState
} from "../shared/contracts.js";
import type { DrainResult } from "../work/index.js";
import type { MemoryGetResult, MemorySearchOptions } from "../memory/index.js";

interface ApiSuccessEnvelope<T> {
  ok: true;
  data: T;
}

interface ApiErrorEnvelope {
  ok: false;
  error?: {
    code?: string;
    message?: string;
    retryable?: boolean;
    traceId?: string;
  };
}

export interface CliApiClientOptions {
  baseUrl: string;
  timeoutMs: number;
}

export class CliApiClientError extends Error {
  readonly kind: "transport" | "response";
  readonly status?: number;
  readonly code?: string;
  readonly retryable?: boolean;
  readonly traceId?: string;

  constructor(
    message: string,
    options: {
      kind: "transport" | "response";
      status?: number;
      code?: string;
      retryable?: boolean;
      traceId?: string;
      cause?: unknown;
    }
  ) {
    super(message, options.cause ? { cause: options.cause } : undefined);
    this.name = "CliApiClientError";
    this.kind = options.kind;
    if (options.status !== undefined) {
      this.status = options.status;
    }
    if (options.code !== undefined) {
      this.code = options.code;
    }
    if (options.retryable !== undefined) {
      this.retryable = options.retryable;
    }
    if (options.traceId !== undefined) {
      this.traceId = options.traceId;
    }
  }
}

export interface CliApiClient {
  run(request: RunRequest): Promise<RunResult>;
  runTemplate(request: { id: string; params?: Record<string, string> }): Promise<RunResult>;
  cancel(request: CancelRunRequest): Promise<CancelRunResult>;
  getTaskRunEvidenceBundle(runId: string): Promise<EvidenceBundle>;
  enqueueWork(request: { sessionId: string; payload: string; mode: WorkItem["mode"] }): Promise<WorkQueueState>;
  getWorkQueue(sessionId: string): Promise<WorkQueueState>;
  drainWork(request: { sessionId: string; provider?: string; model?: string }): Promise<DrainResult>;
  searchMemory(request: { query: string; maxResults?: number; minScore?: number }): Promise<
    Array<{
      id: string;
      sourcePath: string;
      snippet: string;
      score: number;
      lineStart?: number;
      lineEnd?: number;
      citation?: string;
    }>
  >;
  getMemory(request: { path: string; from?: number; lines?: number }): Promise<MemoryGetResult>;
  createSchedule(request: {
    id: string;
    sessionId: string;
    input: string;
    everyMinutes: number;
    startNow?: boolean;
    enabled?: boolean;
  }): Promise<ScheduledTask>;
  listSchedules(limit?: number): Promise<{ items: ScheduledTask[]; nextCursor?: string }>;
  removeSchedule(id: string): Promise<{ id: string; removed: boolean }>;
  runSchedule(request: { id: string; provider?: string; model?: string }): Promise<{
    status: "ok" | "failed" | "already-running";
    id: string;
    sessionId: string;
    startedAt: string;
    finishedAt: string;
    error?: string;
  }>;
  tickSchedules(request?: { at?: string; provider?: string; model?: string }): Promise<{
    at: string;
    run: Array<{
      status: "ok" | "failed" | "already-running";
      id: string;
      sessionId: string;
      startedAt: string;
      finishedAt: string;
      error?: string;
    }>;
    skipped: number;
  }>;
  getScheduleLogs(id: string, limit?: number): Promise<ScheduleRunLog[]>;
}

export function createCliApiClient(options: CliApiClientOptions): CliApiClient {
  const baseUrl = normalizeBaseUrl(options.baseUrl);
  const timeoutMs = options.timeoutMs;

  return {
    async run(request: RunRequest): Promise<RunResult> {
      return requestJson<RunResult>(baseUrl, timeoutMs, "POST", "/api/v1/runs", {
        sessionId: request.sessionId,
        ...(request.input ? { input: request.input } : {}),
        ...(request.directiveId ? { directiveId: request.directiveId } : {}),
        ...(request.harnessProfileId ? { harnessProfileId: request.harnessProfileId } : {}),
        ...(request.provider ? { provider: request.provider } : {}),
        ...(request.model ? { model: request.model } : {})
      });
    },
    async runTemplate(request: { id: string; params?: Record<string, string> }): Promise<RunResult> {
      return requestJson<RunResult>(baseUrl, timeoutMs, "POST", `/api/v1/templates/${encodeURIComponent(request.id)}/run`, {
        ...(request.params ? { params: request.params } : {})
      });
    },
    async cancel(request: CancelRunRequest): Promise<CancelRunResult> {
      return requestJson<CancelRunResult>(
        baseUrl,
        timeoutMs,
        "POST",
        `/api/v1/runs/${encodeURIComponent(request.sessionId)}/cancel`,
        {
          ...(request.reason ? { reason: request.reason } : {})
        }
      );
    },
    async getTaskRunEvidenceBundle(runId: string): Promise<EvidenceBundle> {
      return requestJson<EvidenceBundle>(
        baseUrl,
        timeoutMs,
        "GET",
        `/api/v1/task-runs/${encodeURIComponent(runId)}/evidence-bundle`,
        {}
      );
    },
    async enqueueWork(request: { sessionId: string; payload: string; mode: WorkItem["mode"] }): Promise<WorkQueueState> {
      return requestJson<WorkQueueState>(baseUrl, timeoutMs, "POST", "/api/v1/work/enqueue", {
        sessionId: request.sessionId,
        payload: request.payload,
        mode: request.mode
      });
    },
    async getWorkQueue(sessionId: string): Promise<WorkQueueState> {
      return requestJson<WorkQueueState>(
        baseUrl,
        timeoutMs,
        "GET",
        `/api/v1/sessions/${encodeURIComponent(sessionId)}/work-queue`,
        {}
      );
    },
    async drainWork(request: { sessionId: string; provider?: string; model?: string }): Promise<DrainResult> {
      return requestJson<DrainResult>(
        baseUrl,
        timeoutMs,
        "POST",
        `/api/v1/work/${encodeURIComponent(request.sessionId)}/drain`,
        {
          ...(request.provider ? { provider: request.provider } : {}),
          ...(request.model ? { model: request.model } : {})
        }
      );
    },
    async searchMemory(request: { query: string; maxResults?: number; minScore?: number }) {
      const query = new URLSearchParams({
        query: request.query,
        ...(request.maxResults !== undefined ? { maxResults: String(request.maxResults) } : {}),
        ...(request.minScore !== undefined ? { minScore: String(request.minScore) } : {})
      });
      return requestJson<
        Array<{
          id: string;
          sourcePath: string;
          snippet: string;
          score: number;
          lineStart?: number;
          lineEnd?: number;
          citation?: string;
        }>
      >(baseUrl, timeoutMs, "GET", `/api/v1/memory/search?${query.toString()}`, {});
    },
    async getMemory(request: { path: string; from?: number; lines?: number }): Promise<MemoryGetResult> {
      return requestJson<MemoryGetResult>(baseUrl, timeoutMs, "POST", "/api/v1/memory/get", {
        path: request.path,
        ...(request.from !== undefined ? { from: request.from } : {}),
        ...(request.lines !== undefined ? { lines: request.lines } : {})
      });
    },
    async createSchedule(request: {
      id: string;
      sessionId: string;
      input: string;
      everyMinutes: number;
      startNow?: boolean;
      enabled?: boolean;
    }): Promise<ScheduledTask> {
      return requestJson<ScheduledTask>(baseUrl, timeoutMs, "POST", "/api/v1/schedules", {
        id: request.id,
        sessionId: request.sessionId,
        input: request.input,
        everyMinutes: request.everyMinutes,
        ...(request.startNow !== undefined ? { startNow: request.startNow } : {}),
        ...(request.enabled !== undefined ? { enabled: request.enabled } : {})
      });
    },
    async listSchedules(limit?: number): Promise<{ items: ScheduledTask[]; nextCursor?: string }> {
      const query = limit !== undefined ? `?limit=${encodeURIComponent(String(limit))}` : "";
      return requestJson<{ items: ScheduledTask[]; nextCursor?: string }>(baseUrl, timeoutMs, "GET", `/api/v1/schedules${query}`, {});
    },
    async removeSchedule(id: string): Promise<{ id: string; removed: boolean }> {
      return requestJson<{ id: string; removed: boolean }>(
        baseUrl,
        timeoutMs,
        "DELETE",
        `/api/v1/schedules/${encodeURIComponent(id)}`,
        {}
      );
    },
    async runSchedule(request: { id: string; provider?: string; model?: string }): Promise<{
      status: "ok" | "failed" | "already-running";
      id: string;
      sessionId: string;
      startedAt: string;
      finishedAt: string;
      error?: string;
    }> {
      return requestJson<{
        status: "ok" | "failed" | "already-running";
        id: string;
        sessionId: string;
        startedAt: string;
        finishedAt: string;
        error?: string;
      }>(baseUrl, timeoutMs, "POST", `/api/v1/schedules/${encodeURIComponent(request.id)}/run`, {
        ...(request.provider ? { provider: request.provider } : {}),
        ...(request.model ? { model: request.model } : {})
      });
    },
    async tickSchedules(request?: { at?: string; provider?: string; model?: string }): Promise<{
      at: string;
      run: Array<{
        status: "ok" | "failed" | "already-running";
        id: string;
        sessionId: string;
        startedAt: string;
        finishedAt: string;
        error?: string;
      }>;
      skipped: number;
    }> {
      return requestJson<{
        at: string;
        run: Array<{
          status: "ok" | "failed" | "already-running";
          id: string;
          sessionId: string;
          startedAt: string;
          finishedAt: string;
          error?: string;
        }>;
        skipped: number;
      }>(baseUrl, timeoutMs, "POST", "/api/v1/schedules/tick", {
        ...(request?.at ? { at: request.at } : {}),
        ...(request?.provider ? { provider: request.provider } : {}),
        ...(request?.model ? { model: request.model } : {})
      });
    },
    async getScheduleLogs(id: string, limit?: number): Promise<ScheduleRunLog[]> {
      const query = limit !== undefined ? `?limit=${encodeURIComponent(String(limit))}` : "";
      return requestJson<ScheduleRunLog[]>(
        baseUrl,
        timeoutMs,
        "GET",
        `/api/v1/schedules/${encodeURIComponent(id)}/logs${query}`,
        {}
      );
    }
  };
}

export function isCliApiTransportError(error: unknown): boolean {
  return error instanceof CliApiClientError && error.kind === "transport";
}

function normalizeBaseUrl(input: string): string {
  return input.trim().replace(/\/+$/, "");
}

async function requestJson<T>(
  baseUrl: string,
  timeoutMs: number,
  method: "POST" | "GET" | "PUT" | "DELETE",
  path: string,
  body: Record<string, unknown>
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        "content-type": "application/json"
      },
      ...(method === "GET" ? {} : { body: JSON.stringify(body) }),
      signal: controller.signal
    });
  } catch (error) {
    clearTimeout(timeout);
    throw new CliApiClientError(`API transport failed for ${method} ${path}: ${formatTransportError(error)}`, {
      kind: "transport",
      cause: error
    });
  }
  clearTimeout(timeout);

  const parsed = await readJson(response);
  if (response.ok && isSuccessEnvelope<T>(parsed)) {
    validateSuccessData(method, path, parsed.data);
    return parsed.data;
  }

  if (isErrorEnvelope(parsed)) {
    const traceSuffix = parsed.error?.traceId ? ` (traceId=${parsed.error.traceId})` : "";
    throw new CliApiClientError(
      `API ${method} ${path} failed: ${parsed.error?.code ?? "UNKNOWN_ERROR"}: ${parsed.error?.message ?? "Unknown error"}${traceSuffix}`,
      {
        kind: "response",
        status: response.status,
        ...(parsed.error?.code !== undefined ? { code: parsed.error.code } : {}),
        ...(parsed.error?.retryable !== undefined ? { retryable: parsed.error.retryable } : {}),
        ...(parsed.error?.traceId !== undefined ? { traceId: parsed.error.traceId } : {})
      }
    );
  }

  throw new CliApiClientError(`API ${method} ${path} returned invalid response envelope`, {
    kind: "response",
    status: response.status
  });
}

async function readJson(response: Response): Promise<unknown> {
  const raw = await response.text();
  if (!raw.trim()) {
    return undefined;
  }
  try {
    return JSON.parse(raw) as unknown;
  } catch (error) {
    throw new CliApiClientError("API returned invalid JSON", { kind: "response", status: response.status, cause: error });
  }
}

function isSuccessEnvelope<T>(value: unknown): value is ApiSuccessEnvelope<T> {
  if (!value || typeof value !== "object") {
    return false;
  }
  return (value as { ok?: unknown }).ok === true && "data" in (value as Record<string, unknown>);
}

function isErrorEnvelope(value: unknown): value is ApiErrorEnvelope {
  if (!value || typeof value !== "object") {
    return false;
  }
  return (value as { ok?: unknown }).ok === false;
}

function formatTransportError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

function validateSuccessData(method: "POST" | "GET" | "PUT" | "DELETE", path: string, data: unknown): void {
  const expectsArray = path.startsWith("/api/v1/memory/search") || /^\/api\/v1\/schedules\/[^/]+\/logs/.test(path);
  if (expectsArray) {
    if (!Array.isArray(data)) {
      throw new CliApiClientError(`API ${method} ${path} expected array data`, { kind: "response" });
    }
    return;
  }

  if (!isObject(data)) {
    throw new CliApiClientError(`API ${method} ${path} returned invalid data payload`, { kind: "response" });
  }

  if (path === "/api/v1/runs" && typeof data.sessionId !== "string") {
    throw new CliApiClientError(`API ${method} ${path} missing data.sessionId`, { kind: "response" });
  }
  if (/^\/api\/v1\/templates\/[^/]+\/run$/.test(path) && typeof data.sessionId !== "string") {
    throw new CliApiClientError(`API ${method} ${path} missing data.sessionId`, { kind: "response" });
  }
  if (/^\/api\/v1\/runs\/[^/]+\/cancel$/.test(path) && typeof data.status !== "string") {
    throw new CliApiClientError(`API ${method} ${path} missing data.status`, { kind: "response" });
  }
  if (/^\/api\/v1\/task-runs\/[^/]+\/evidence-bundle$/.test(path) && typeof data.manifest !== "object") {
    throw new CliApiClientError(`API ${method} ${path} missing data.manifest`, { kind: "response" });
  }
  if (path === "/api/v1/work/enqueue" && !Array.isArray(data.items)) {
    throw new CliApiClientError(`API ${method} ${path} missing data.items`, { kind: "response" });
  }
  if (/^\/api\/v1\/sessions\/[^/]+\/work-queue$/.test(path) && !Array.isArray(data.items)) {
    throw new CliApiClientError(`API ${method} ${path} missing data.items`, { kind: "response" });
  }
  if (/^\/api\/v1\/workflows\/run\/[^/]+$/.test(path) && (typeof data.workflow !== "object" || typeof data.run !== "object")) {
    throw new CliApiClientError(`API ${method} ${path} missing workflow observability payload`, { kind: "response" });
  }
  if (/^\/api\/v1\/work\/[^/]+\/drain$/.test(path) && typeof data.status !== "string") {
    throw new CliApiClientError(`API ${method} ${path} missing data.status`, { kind: "response" });
  }
  if (path === "/api/v1/memory/get" && typeof data.path !== "string") {
    throw new CliApiClientError(`API ${method} ${path} missing data.path`, { kind: "response" });
  }
  if (method === "POST" && path === "/api/v1/schedules" && typeof data.id !== "string") {
    throw new CliApiClientError(`API ${method} ${path} missing data.id`, { kind: "response" });
  }
  if (method === "GET" && (path === "/api/v1/schedules" || path.startsWith("/api/v1/schedules?")) && !Array.isArray(data.items)) {
    throw new CliApiClientError(`API ${method} ${path} missing data.items`, { kind: "response" });
  }
  if (method === "DELETE" && /^\/api\/v1\/schedules\/[^/]+$/.test(path) && typeof data.removed !== "boolean") {
    throw new CliApiClientError(`API ${method} ${path} missing data.removed`, { kind: "response" });
  }
  if (/^\/api\/v1\/schedules\/[^/]+\/run$/.test(path) && typeof data.status !== "string") {
    throw new CliApiClientError(`API ${method} ${path} missing data.status`, { kind: "response" });
  }
  if (path === "/api/v1/schedules/tick" && !Array.isArray(data.run)) {
    throw new CliApiClientError(`API ${method} ${path} missing data.run`, { kind: "response" });
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
