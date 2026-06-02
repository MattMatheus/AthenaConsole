import { describe, expect, it } from "vitest";
import { ChromaDurableMemoryAdapter } from "../src/durable-memory/index.js";
import type { DurableMemoryRecord } from "../src/shared/contracts/index.js";

describe("Chroma durable memory adapter", () => {
  const record: DurableMemoryRecord = {
    id: "memory-1",
    namespace: {
      scope: "repository",
      id: "repo-1",
      parent: { scope: "workspace", id: "workspace-1" }
    },
    provenance: {
      sourceKind: "agent",
      actorType: "agent",
      agentId: "research-agent",
      runId: "run-1",
      createdByAction: "agent-memory"
    },
    memoryType: "repo-note",
    body: "Use Chroma only as an optional semantic index.",
    summary: "Chroma semantic index posture",
    sensitivity: "internal",
    status: "active",
    createdAt: "2026-06-02T16:00:00.000Z",
    updatedAt: "2026-06-02T16:00:00.000Z"
  };

  it("upserts, searches, and deletes records through canonical metadata filters", async () => {
    const calls: Array<{ url: string; init: RequestInit; body?: unknown }> = [];
    const adapter = new ChromaDurableMemoryAdapter({
      baseUrl: "http://localhost:8000/",
      collectionName: "team_orchestrator_memory",
      fetchImpl: async (url, init) => {
        calls.push({ url, init, body: init.body ? JSON.parse(String(init.body)) : undefined });
        if (url.endsWith("/api/v2/query")) {
          return jsonResponse(200, {
            ids: [["memory-1"]],
            distances: [[0.12]],
            documents: [["Chroma semantic index posture"]]
          });
        }
        return jsonResponse(200, {});
      }
    });

    await adapter.upsertRecord(record);
    const search = await adapter.search({
      namespace: record.namespace,
      query: "semantic index",
      limit: 5
    });
    await adapter.deleteRecord(record);

    expect(calls.map((call) => new URL(call.url).pathname)).toEqual(["/api/v2/upsert", "/api/v2/query", "/api/v2/delete"]);
    expect(calls[0]?.body).toMatchObject({
      collection: "team_orchestrator_memory",
      ids: ["memory-1"],
      metadatas: [
        {
          memory_id: "memory-1",
          namespace_scope: "repository",
          namespace_id: "repo-1",
          source_kind: "agent",
          memory_type: "repo-note",
          sensitivity: "internal",
          status: "active"
        }
      ]
    });
    expect(calls[1]?.body).toMatchObject({
      where: {
        namespace_scope: "repository",
        namespace_id: "repo-1"
      }
    });
    expect(search).toEqual({
      operatorStatus: "remote-current",
      matches: [
        {
          recordId: "memory-1",
          score: 0.88,
          signals: [{ kind: "semantic", score: 0.88, evidence: "chroma" }],
          snippet: "Chroma semantic index posture"
        }
      ]
    });
  });

  it("reports health and unavailable/failure states without making Chroma mandatory", async () => {
    const ok = new ChromaDurableMemoryAdapter({
      baseUrl: "http://localhost:8000",
      collectionName: "team_orchestrator_memory",
      fetchImpl: async () => jsonResponse(200, { ok: true })
    });
    await expect(ok.getHealth()).resolves.toMatchObject({
      providerId: "chroma",
      status: "ok",
      operatorStatus: "remote-current"
    });

    const unavailable = new ChromaDurableMemoryAdapter({
      baseUrl: "http://localhost:8000",
      collectionName: "team_orchestrator_memory",
      fetchImpl: async () => jsonResponse(503, { error: "down" })
    });
    await expect(unavailable.getHealth()).resolves.toMatchObject({
      status: "unavailable",
      operatorStatus: "remote-unavailable"
    });

    const unsupportedFilter = new ChromaDurableMemoryAdapter({
      baseUrl: "http://localhost:8000",
      collectionName: "team_orchestrator_memory",
      fetchImpl: async () => jsonResponse(400, { error: "unsupported where filter" })
    });
    await expect(unsupportedFilter.getHealth()).resolves.toMatchObject({
      status: "degraded",
      operatorStatus: "remote-unavailable"
    });
  });
});

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" }
  });
}
