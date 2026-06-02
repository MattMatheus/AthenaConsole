import type {
  DurableMemoryNamespaceRef,
  DurableMemoryOperatorVisibleStatus,
  DurableMemoryProviderHealth,
  DurableMemoryProviderHealthStatus,
  DurableMemoryRecord,
  DurableMemorySearchMatch
} from "../shared/contracts/durable-memory.js";

type FetchLike = (url: string, init: RequestInit) => Promise<Response>;

export interface ChromaDurableMemoryAdapterOptions {
  baseUrl: string;
  collectionName: string;
  providerId?: string;
  tenant?: string;
  database?: string;
  fetchImpl?: FetchLike;
}

export interface ChromaDurableMemorySearchRequest {
  namespace: DurableMemoryNamespaceRef;
  query: string;
  limit?: number;
}

export interface ChromaDurableMemorySearchResult {
  matches: DurableMemorySearchMatch[];
  operatorStatus: DurableMemoryOperatorVisibleStatus;
}

export class ChromaDurableMemoryAdapter {
  private readonly baseUrl: string;
  private readonly fetchImpl: FetchLike;
  private readonly providerId: string;

  constructor(private readonly options: ChromaDurableMemoryAdapterOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, "");
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.providerId = options.providerId ?? "chroma";
  }

  async upsertRecord(record: DurableMemoryRecord): Promise<void> {
    await this.requestJson("POST", "/api/v2/upsert", {
      collection: this.options.collectionName,
      ids: [record.id],
      documents: [record.summary ?? record.body],
      metadatas: [this.toMetadata(record)]
    });
  }

  async search(request: ChromaDurableMemorySearchRequest): Promise<ChromaDurableMemorySearchResult> {
    const response = await this.requestJson<{
      ids?: string[][];
      distances?: number[][];
      documents?: string[][];
    }>("POST", "/api/v2/query", {
      collection: this.options.collectionName,
      query_texts: [request.query],
      n_results: request.limit ?? 10,
      where: {
        namespace_scope: request.namespace.scope,
        namespace_id: request.namespace.id
      }
    });
    const ids = response.ids?.[0] ?? [];
    const distances = response.distances?.[0] ?? [];
    const documents = response.documents?.[0] ?? [];
    return {
      operatorStatus: "remote-current",
      matches: ids.map((id, index) => ({
        recordId: id,
        score: normalizeDistance(distances[index]),
        signals: [{ kind: "semantic", score: normalizeDistance(distances[index]), evidence: this.providerId }],
        ...(documents[index] ? { snippet: documents[index] } : {})
      }))
    };
  }

  async deleteRecord(record: Pick<DurableMemoryRecord, "id">): Promise<void> {
    await this.requestJson("POST", "/api/v2/delete", {
      collection: this.options.collectionName,
      ids: [record.id]
    });
  }

  async getHealth(): Promise<DurableMemoryProviderHealth> {
    try {
      await this.requestJson("GET", "/api/v2/heartbeat", {});
      return {
        providerId: this.providerId,
        status: "ok",
        operatorStatus: "remote-current",
        checkedAt: new Date().toISOString(),
        message: "Chroma semantic index adapter is available."
      };
    } catch (error) {
      return {
        providerId: this.providerId,
        status: classifyHealth(error),
        operatorStatus: "remote-unavailable",
        checkedAt: new Date().toISOString(),
        message: "Chroma semantic index adapter is unavailable."
      };
    }
  }

  private toMetadata(record: DurableMemoryRecord): Record<string, string | number | boolean> {
    return {
      memory_id: record.id,
      namespace_scope: record.namespace.scope,
      namespace_id: record.namespace.id,
      source_kind: record.provenance.sourceKind,
      memory_type: record.memoryType,
      sensitivity: record.sensitivity,
      status: record.status,
      updated_at: record.updatedAt
    };
  }

  private async requestJson<T>(method: "GET" | "POST", path: string, body: object): Promise<T> {
    const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
      method,
      headers: { "content-type": "application/json" },
      ...(method === "GET" ? {} : { body: JSON.stringify(body) })
    });
    if (!response.ok) {
      throw new ChromaDurableMemoryAdapterError(`Chroma request failed with HTTP ${response.status}`, response.status);
    }
    return (await response.json()) as T;
  }
}

export class ChromaDurableMemoryAdapterError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "ChromaDurableMemoryAdapterError";
  }
}

function normalizeDistance(distance: number | undefined): number {
  if (typeof distance !== "number" || !Number.isFinite(distance)) {
    return 0;
  }
  return Number(Math.max(0, Math.min(1, 1 - distance)).toFixed(3));
}

function classifyHealth(error: unknown): DurableMemoryProviderHealthStatus {
  if (error instanceof ChromaDurableMemoryAdapterError && error.status === 401) {
    return "unauthorized";
  }
  if (error instanceof ChromaDurableMemoryAdapterError && error.status >= 400 && error.status < 500) {
    return "degraded";
  }
  return "unavailable";
}
