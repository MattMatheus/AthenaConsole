import { describe, expect, it } from "vitest";
import {
  DurableMemoryRemoteProviderError,
  RemoteHttpDurableMemoryProvider
} from "../src/durable-memory/index.js";
import type {
  DurableMemoryNamespaceRef,
  DurableMemoryProvenanceRef,
  DurableMemoryProviderConfig,
  DurableMemoryRecord
} from "../src/shared/contracts/index.js";

describe("remote HTTP durable memory provider", () => {
  const namespace: DurableMemoryNamespaceRef = { scope: "workspace", id: "workspace-1" };
  const provenance: DurableMemoryProvenanceRef = {
    sourceKind: "operator",
    actorType: "operator",
    actorId: "operator-1",
    createdByAction: "remote-provider-test"
  };
  const record: DurableMemoryRecord = {
    id: "record-1",
    namespace,
    provenance,
    memoryType: "decision",
    body: "Use remote durable memory.",
    sensitivity: "internal",
    status: "active",
    createdAt: "2026-06-02T17:30:00.000Z",
    updatedAt: "2026-06-02T17:30:00.000Z",
    provider: {
      providerId: "server-mode",
      providerRecordId: "record-1",
      revision: "1",
      syncStatus: "not-cached",
      operatorStatus: "remote-current"
    }
  };

  it("maps provider operations to explicit durable-memory API routes", async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const provider = createProvider(async (url, init) => {
      calls.push({ url, init });
      if (url.endsWith("/api/v1/durable-memory/records")) {
        return jsonResponse(201, record);
      }
      if (url.endsWith("/api/v1/durable-memory/records/search")) {
        return jsonResponse(200, { records: [record], total: 1, operatorStatus: "remote-current" });
      }
      if (url.endsWith("/api/v1/durable-memory/records/record-1/archive")) {
        return jsonResponse(200, { ...record, status: "archived", archivedAt: "2026-06-02T17:31:00.000Z" });
      }
      if (url.endsWith("/api/v1/durable-memory/snapshots/list")) {
        return jsonResponse(200, { snapshots: [] });
      }
      throw new Error(`unexpected route: ${url}`);
    });

    expect(await provider.write({ namespace, provenance, memoryType: "decision", body: record.body })).toMatchObject({
      id: "record-1",
      provider: { operatorStatus: "remote-current" }
    });
    expect(await provider.search({ namespace, query: "remote" })).toMatchObject({
      total: 1,
      operatorStatus: "remote-current"
    });
    expect(await provider.archive({ id: "record-1", namespace, provenance, reason: "superseded" })).toMatchObject({
      status: "archived"
    });
    expect(await provider.listSnapshots(namespace)).toEqual({ snapshots: [] });

    expect(calls.map((call) => new URL(call.url).pathname)).toEqual([
      "/api/v1/durable-memory/records",
      "/api/v1/durable-memory/records/search",
      "/api/v1/durable-memory/records/record-1/archive",
      "/api/v1/durable-memory/snapshots/list"
    ]);
    expect(calls.some((call) => new URL(call.url).pathname.startsWith("/api/v1/memory/"))).toBe(false);
    expect(calls[0]?.init.headers).toMatchObject({
      "content-type": "application/json",
      "x-athena-identity": "operator-remote"
    });
  });

  it("maps auth, validation, conflict, and unavailable failures to explicit statuses", async () => {
    await expect(
      createProvider(async () => jsonError(401, "AUTH_TOKEN_INVALID", "Bearer secret-token-value is invalid")).write({
        namespace,
        provenance,
        memoryType: "decision",
        body: record.body
      })
    ).rejects.toMatchObject({
      providerStatus: "unauthorized",
      operatorStatus: "remote-unavailable",
      retryable: false
    });

    await expect(
      createProvider(async () => jsonError(400, "CONFIG_ERROR", "namespace.scope is invalid")).write({
        namespace,
        provenance,
        memoryType: "decision",
        body: record.body
      })
    ).rejects.toMatchObject({
      providerStatus: "degraded",
      operatorStatus: "remote-unavailable",
      retryable: false
    });

    await expect(
      createProvider(async () => jsonError(409, "SESSION_LOCK_TIMEOUT", "revision conflict")).archive({
        id: "record-1",
        namespace,
        provenance,
        reason: "conflict test"
      })
    ).rejects.toMatchObject({
      providerStatus: "degraded",
      operatorStatus: "conflict-review-required"
    });

    const health = await createProvider(async () => {
      throw new Error("ECONNREFUSED token=secret-token-value");
    }).getHealth();
    expect(health).toMatchObject({
      status: "unavailable",
      operatorStatus: "remote-unavailable"
    });
    expect(health.message).not.toContain("secret-token-value");
  });

  it("retries retryable responses and redacts secrets from errors", async () => {
    let attempts = 0;
    const provider = createProvider(
      async () => {
        attempts += 1;
        return attempts === 1
          ? jsonError(503, "PROVIDER_ERROR", "upstream unavailable token=secret-token-value", true)
          : jsonResponse(200, record);
      },
      { retryLimit: 1, retryDelayMs: 0, baseUrl: "http://user:secret-token-value@localhost?apiToken=secret-token-value" }
    );

    expect(await provider.get({ id: "record-1" })).toMatchObject({ id: "record-1" });
    expect(attempts).toBe(2);

    await expect(
      createProvider(async () => jsonError(503, "PROVIDER_ERROR", "token=secret-token-value", true), {
        retryLimit: 0,
        baseUrl: "http://user:secret-token-value@localhost?apiToken=secret-token-value"
      }).get({ id: "record-1" })
    ).rejects.toSatisfy((error: unknown) => {
      expect(error).toBeInstanceOf(DurableMemoryRemoteProviderError);
      expect(String((error as Error).message)).not.toContain("secret-token-value");
      expect(String((error as Error).message)).toContain("[redacted]");
      return true;
    });
  });

  it("times out aborted requests with retryable unavailable status", async () => {
    const provider = createProvider(
      (_url, init) =>
        new Promise<Response>((_resolve, reject) => {
          init.signal?.addEventListener("abort", () => {
            reject(new DOMException("aborted", "AbortError"));
          });
        }),
      { timeoutMs: 1, retryLimit: 0 }
    );

    await expect(provider.get({ id: "record-1" })).rejects.toMatchObject({
      providerStatus: "unavailable",
      operatorStatus: "remote-unavailable",
      retryable: true
    });
  });

  it("resolves bearer tokens from environment without exposing them in request errors", async () => {
    process.env.ATHENA_TEST_DURABLE_MEMORY_TOKEN = "secret-token-value";
    const calls: RequestInit[] = [];
    const provider = createProvider(
      async (_url, init) => {
        calls.push(init);
        return jsonResponse(200, { providerId: "remote", status: "ok", operatorStatus: "remote-current", checkedAt: "now" });
      },
      {
        tokenRef: { kind: "env", name: "ATHENA_TEST_DURABLE_MEMORY_TOKEN" }
      }
    );

    await provider.getHealth();
    expect(calls[0]?.headers).toMatchObject({
      Authorization: "Bearer secret-token-value"
    });
    delete process.env.ATHENA_TEST_DURABLE_MEMORY_TOKEN;
  });
});

function createProvider(
  fetchImpl: (url: string, init: RequestInit) => Promise<Response>,
  options: {
    retryLimit?: number;
    retryDelayMs?: number;
    timeoutMs?: number;
    baseUrl?: string;
    tokenRef?: DurableMemoryProviderConfig["tokenRef"];
  } = {}
): RemoteHttpDurableMemoryProvider {
  return new RemoteHttpDurableMemoryProvider({
    config: {
      id: "remote",
      kind: "remote-http",
      label: "Remote",
      baseUrl: options.baseUrl ?? "http://localhost",
      ...(options.tokenRef ? { tokenRef: options.tokenRef } : {})
    },
    identity: "operator-remote",
    retryLimit: options.retryLimit ?? 0,
    retryDelayMs: options.retryDelayMs ?? 0,
    timeoutMs: options.timeoutMs ?? 50,
    fetchImpl
  });
}

function jsonResponse(status: number, data: unknown): Response {
  return new Response(JSON.stringify({ ok: true, data }), {
    status,
    headers: { "content-type": "application/json" }
  });
}

function jsonError(status: number, code: string, message: string, retryable = false): Response {
  return new Response(
    JSON.stringify({
      ok: false,
      error: { code, message, retryable, traceId: "trace-1" }
    }),
    {
      status,
      headers: { "content-type": "application/json" }
    }
  );
}
