import { readFileSync } from "node:fs";
import type {
  DurableMemoryArchiveRequest,
  DurableMemoryDeleteRequest,
  DurableMemoryGetRequest,
  DurableMemoryListRequest,
  DurableMemoryProposal,
  DurableMemoryProposalCreateRequest,
  DurableMemoryProposalReviewRequest,
  DurableMemoryProvider,
  DurableMemoryProviderConfig,
  DurableMemoryProviderHealth,
  DurableMemoryProviderHealthStatus,
  DurableMemoryRecord,
  DurableMemoryRecordListResult,
  DurableMemorySearchRequest,
  DurableMemorySearchResult,
  DurableMemorySnapshot,
  DurableMemorySnapshotCreateRequest,
  DurableMemorySnapshotListResult,
  DurableMemorySnapshotRestoreRequest,
  DurableMemoryWriteRequest,
  DurableMemoryOperatorVisibleStatus
} from "../shared/contracts/durable-memory.js";

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

type FetchLike = (url: string, init: RequestInit) => Promise<Response>;

export interface RemoteHttpDurableMemoryProviderOptions {
  config: DurableMemoryProviderConfig & { kind: "remote-http"; baseUrl: string };
  timeoutMs?: number;
  retryLimit?: number;
  retryDelayMs?: number;
  identity?: string;
  fetchImpl?: FetchLike;
}

export class DurableMemoryRemoteProviderError extends Error {
  readonly status?: number;
  readonly code?: string;
  readonly retryable: boolean;
  readonly providerStatus: DurableMemoryProviderHealthStatus;
  readonly operatorStatus: DurableMemoryOperatorVisibleStatus;
  readonly traceId?: string;

  constructor(
    message: string,
    options: {
      status?: number;
      code?: string;
      retryable?: boolean;
      providerStatus: DurableMemoryProviderHealthStatus;
      operatorStatus: DurableMemoryOperatorVisibleStatus;
      traceId?: string;
      cause?: unknown;
    }
  ) {
    super(message, options.cause ? { cause: options.cause } : undefined);
    this.name = "DurableMemoryRemoteProviderError";
    if (options.status !== undefined) {
      this.status = options.status;
    }
    if (options.code !== undefined) {
      this.code = options.code;
    }
    this.retryable = options.retryable ?? false;
    this.providerStatus = options.providerStatus;
    this.operatorStatus = options.operatorStatus;
    if (options.traceId !== undefined) {
      this.traceId = options.traceId;
    }
  }
}

export class RemoteHttpDurableMemoryProvider implements DurableMemoryProvider {
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly retryLimit: number;
  private readonly retryDelayMs: number;
  private readonly fetchImpl: FetchLike;
  private readonly identity: string;

  constructor(private readonly options: RemoteHttpDurableMemoryProviderOptions) {
    this.baseUrl = normalizeBaseUrl(options.config.baseUrl);
    this.timeoutMs = options.timeoutMs ?? 15_000;
    this.retryLimit = options.retryLimit ?? 1;
    this.retryDelayMs = options.retryDelayMs ?? 25;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.identity = options.identity ?? "durable-memory-remote-provider";
  }

  write(request: DurableMemoryWriteRequest): Promise<DurableMemoryRecord> {
    return this.requestJson("POST", "/api/v1/durable-memory/records", request);
  }

  get(request: DurableMemoryGetRequest): Promise<DurableMemoryRecord | undefined> {
    return this.requestJson("POST", "/api/v1/durable-memory/records/get", request);
  }

  list(request: DurableMemoryListRequest): Promise<DurableMemoryRecordListResult> {
    return this.requestJson("POST", "/api/v1/durable-memory/records/list", request);
  }

  search(request: DurableMemorySearchRequest): Promise<DurableMemorySearchResult> {
    return this.requestJson("POST", "/api/v1/durable-memory/records/search", request);
  }

  createProposal(request: DurableMemoryProposalCreateRequest): Promise<DurableMemoryProposal> {
    return this.requestJson("POST", "/api/v1/durable-memory/proposals", request);
  }

  approveProposal(request: DurableMemoryProposalReviewRequest): Promise<DurableMemoryProposal> {
    return this.requestJson(
      "POST",
      `/api/v1/durable-memory/proposals/${encodeURIComponent(request.id)}/approve`,
      omitId(request)
    );
  }

  rejectProposal(request: DurableMemoryProposalReviewRequest): Promise<DurableMemoryProposal> {
    return this.requestJson(
      "POST",
      `/api/v1/durable-memory/proposals/${encodeURIComponent(request.id)}/reject`,
      omitId(request)
    );
  }

  archive(request: DurableMemoryArchiveRequest): Promise<DurableMemoryRecord> {
    return this.requestJson(
      "POST",
      `/api/v1/durable-memory/records/${encodeURIComponent(request.id)}/archive`,
      omitId(request)
    );
  }

  delete(request: DurableMemoryDeleteRequest): Promise<DurableMemoryRecord> {
    return this.requestJson(
      "POST",
      `/api/v1/durable-memory/records/${encodeURIComponent(request.id)}/delete`,
      omitId(request)
    );
  }

  createSnapshot(request: DurableMemorySnapshotCreateRequest): Promise<DurableMemorySnapshot> {
    return this.requestJson("POST", "/api/v1/durable-memory/snapshots", request);
  }

  listSnapshots(namespace: DurableMemoryListRequest["namespace"]): Promise<DurableMemorySnapshotListResult> {
    return this.requestJson("POST", "/api/v1/durable-memory/snapshots/list", { namespace });
  }

  restoreSnapshot(request: DurableMemorySnapshotRestoreRequest): Promise<DurableMemorySnapshot> {
    return this.requestJson(
      "POST",
      `/api/v1/durable-memory/snapshots/${encodeURIComponent(request.id)}/restore`,
      omitId(request)
    );
  }

  async getHealth(): Promise<DurableMemoryProviderHealth> {
    try {
      return await this.requestJson("GET", "/api/v1/durable-memory/health", {});
    } catch (error) {
      if (error instanceof DurableMemoryRemoteProviderError) {
        return {
          providerId: this.options.config.id,
          status: error.providerStatus,
          operatorStatus: error.operatorStatus,
          checkedAt: new Date().toISOString(),
          message: error.message
        };
      }
      return {
        providerId: this.options.config.id,
        status: "unavailable",
        operatorStatus: "remote-unavailable",
        checkedAt: new Date().toISOString(),
        message: "Remote durable memory provider is unavailable."
      };
    }
  }

  private async requestJson<T>(
    method: "GET" | "POST",
    path: string,
    body: object
  ): Promise<T> {
    let lastError: DurableMemoryRemoteProviderError | undefined;
    const attempts = Math.max(1, this.retryLimit + 1);
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      try {
        return await this.requestJsonOnce(method, path, body);
      } catch (error) {
        const mapped = error instanceof DurableMemoryRemoteProviderError ? error : mapTransportError(this.baseUrl, path, error);
        lastError = mapped;
        if (!mapped.retryable || attempt >= attempts - 1) {
          throw mapped;
        }
        await delay(this.retryDelayMs);
      }
    }
    throw lastError ?? mapTransportError(this.baseUrl, path, new Error("request failed"));
  }

  private async requestJsonOnce<T>(
    method: "GET" | "POST",
    path: string,
    body: object
  ): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    let response: Response;
    try {
      response = await this.fetchImpl(`${this.baseUrl}${path}`, {
        method,
        headers: this.buildHeaders(),
        ...(method === "GET" ? {} : { body: JSON.stringify(body) }),
        signal: controller.signal
      });
    } catch (error) {
      throw mapTransportError(this.baseUrl, path, error);
    } finally {
      clearTimeout(timeout);
    }

    const parsed = await readJson(response);
    if (response.ok && isSuccessEnvelope<T>(parsed)) {
      return parsed.data;
    }
    throw mapResponseError(this.baseUrl, path, response, parsed);
  }

  private buildHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      "content-type": "application/json",
      "x-athena-identity": this.identity
    };
    const token = resolveToken(this.options.config);
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
    return headers;
  }
}

function resolveToken(config: DurableMemoryProviderConfig): string | undefined {
  const ref = config.tokenRef;
  if (!ref) {
    return undefined;
  }
  if (ref.kind === "env") {
    return process.env[ref.name]?.trim() || undefined;
  }
  return readFileSync(ref.name, "utf8").trim() || undefined;
}

function mapTransportError(baseUrl: string, path: string, error: unknown): DurableMemoryRemoteProviderError {
  const aborted = error instanceof Error && error.name === "AbortError";
  const message = aborted
    ? `Remote durable memory request timed out for ${redactUrl(baseUrl, path)}.`
    : `Remote durable memory provider is unavailable for ${redactUrl(baseUrl, path)}.`;
  return new DurableMemoryRemoteProviderError(message, {
    retryable: true,
    providerStatus: "unavailable",
    operatorStatus: "remote-unavailable",
    cause: error
  });
}

function mapResponseError(
  baseUrl: string,
  path: string,
  response: Response,
  parsed: unknown
): DurableMemoryRemoteProviderError {
  const envelope = isErrorEnvelope(parsed) ? parsed : undefined;
  const code = envelope?.error?.code;
  const retryable = envelope?.error?.retryable ?? (response.status === 429 || response.status >= 500);
  const classification = classifyStatus(response.status);
  const traceSuffix = envelope?.error?.traceId ? ` traceId=${envelope.error.traceId}` : "";
  const serverMessage = envelope?.error?.message ? `: ${redactSecrets(envelope.error.message)}` : "";
  return new DurableMemoryRemoteProviderError(
    `Remote durable memory ${classification.label} for ${redactUrl(baseUrl, path)}${serverMessage}${traceSuffix}`,
    {
      status: response.status,
      ...(code ? { code } : {}),
      retryable,
      providerStatus: classification.providerStatus,
      operatorStatus: classification.operatorStatus,
      ...(envelope?.error?.traceId ? { traceId: envelope.error.traceId } : {})
    }
  );
}

function classifyStatus(status: number): {
  label: string;
  providerStatus: DurableMemoryProviderHealthStatus;
  operatorStatus: DurableMemoryOperatorVisibleStatus;
} {
  if (status === 401 || status === 403) {
    return { label: "authorization failure", providerStatus: "unauthorized", operatorStatus: "remote-unavailable" };
  }
  if (status === 400) {
    return { label: "validation failure", providerStatus: "degraded", operatorStatus: "remote-unavailable" };
  }
  if (status === 409) {
    return { label: "conflict", providerStatus: "degraded", operatorStatus: "conflict-review-required" };
  }
  return { label: "request failure", providerStatus: "unavailable", operatorStatus: "remote-unavailable" };
}

async function readJson(response: Response): Promise<unknown> {
  const raw = await response.text();
  if (!raw.trim()) {
    return undefined;
  }
  try {
    return JSON.parse(raw) as unknown;
  } catch (error) {
    throw new DurableMemoryRemoteProviderError("Remote durable memory provider returned invalid JSON.", {
      status: response.status,
      retryable: false,
      providerStatus: "degraded",
      operatorStatus: "remote-unavailable",
      cause: error
    });
  }
}

function isSuccessEnvelope<T>(value: unknown): value is ApiSuccessEnvelope<T> {
  return value !== null && typeof value === "object" && (value as { ok?: unknown }).ok === true && "data" in value;
}

function isErrorEnvelope(value: unknown): value is ApiErrorEnvelope {
  return value !== null && typeof value === "object" && (value as { ok?: unknown }).ok === false;
}

function omitId<T extends { id: string }>(input: T): Omit<T, "id"> {
  const { id: _id, ...rest } = input;
  return rest;
}

function normalizeBaseUrl(input: string): string {
  return input.trim().replace(/\/+$/, "");
}

function redactUrl(baseUrl: string, path: string): string {
  try {
    const url = new URL(`${baseUrl}${path}`);
    url.username = url.username ? "[redacted]" : "";
    url.password = url.password ? "[redacted]" : "";
    for (const key of [...url.searchParams.keys()]) {
      if (isSecretKey(key)) {
        url.searchParams.set(key, "[redacted]");
      }
    }
    return url.toString();
  } catch {
    return redactSecrets(`${baseUrl}${path}`);
  }
}

function redactSecrets(value: string): string {
  return value
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [redacted]")
    .replace(/(api[_-]?token|token|authorization|password|secret)=([^&\s]+)/gi, "$1=[redacted]");
}

function isSecretKey(key: string): boolean {
  return /token|authorization|password|secret|api[_-]?key/i.test(key);
}

function delay(ms: number): Promise<void> {
  if (ms <= 0) {
    return Promise.resolve();
  }
  return new Promise((resolve) => setTimeout(resolve, ms));
}
