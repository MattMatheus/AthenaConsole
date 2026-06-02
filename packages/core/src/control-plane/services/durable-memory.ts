import { randomUUID } from "node:crypto";
import type {
  DurableMemoryArchiveRequest,
  DurableMemoryDeleteRequest,
  DurableMemoryGetRequest,
  DurableMemoryListRequest,
  DurableMemoryProposal,
  DurableMemoryProposalCreateRequest,
  DurableMemoryProposalReviewRequest,
  DurableMemoryProviderHealth,
  DurableMemoryRecord,
  DurableMemoryRecordListResult,
  DurableMemorySearchRequest,
  DurableMemorySearchResult,
  DurableMemorySnapshot,
  DurableMemorySnapshotCreateRequest,
  DurableMemorySnapshotListResult,
  DurableMemorySnapshotRestoreRequest,
  DurableMemoryWriteRequest
} from "../../shared/contracts/durable-memory.js";
import { AthenaError } from "../../runtime/errors.js";
import type { DurableMemoryServerStorage } from "../../durable-memory/server-storage.js";

export interface DurableMemoryService {
  write(request: DurableMemoryWriteRequest): Promise<DurableMemoryRecord>;
  get(request: DurableMemoryGetRequest): Promise<DurableMemoryRecord>;
  list(request: DurableMemoryListRequest): Promise<DurableMemoryRecordListResult>;
  search(request: DurableMemorySearchRequest): Promise<DurableMemorySearchResult>;
  archive(request: DurableMemoryArchiveRequest): Promise<DurableMemoryRecord>;
  delete(request: DurableMemoryDeleteRequest): Promise<DurableMemoryRecord>;
  createProposal(request: DurableMemoryProposalCreateRequest): Promise<DurableMemoryProposal>;
  listProposals(request: DurableMemoryListRequest): Promise<DurableMemoryProposal[]>;
  approveProposal(request: DurableMemoryProposalReviewRequest): Promise<DurableMemoryProposal>;
  rejectProposal(request: DurableMemoryProposalReviewRequest): Promise<DurableMemoryProposal>;
  createSnapshot(request: DurableMemorySnapshotCreateRequest): Promise<DurableMemorySnapshot>;
  listSnapshots(request: DurableMemoryListRequest): Promise<DurableMemorySnapshotListResult>;
  restoreSnapshot(request: DurableMemorySnapshotRestoreRequest): Promise<DurableMemorySnapshot>;
  getHealth(): Promise<DurableMemoryProviderHealth>;
}

export class LocalDurableMemoryService implements DurableMemoryService {
  constructor(private readonly storage: DurableMemoryServerStorage) {}

  async write(request: DurableMemoryWriteRequest): Promise<DurableMemoryRecord> {
    return this.storage.writeRecord({
      ...request,
      id: `dmr_${randomUUID()}`
    });
  }

  async get(request: DurableMemoryGetRequest): Promise<DurableMemoryRecord> {
    const record = this.storage.getRecord(request.id);
    if (!record) {
      throw notFound("durable memory record", request.id);
    }
    if (request.namespace && (record.namespace.scope !== request.namespace.scope || record.namespace.id !== request.namespace.id)) {
      throw notFound("durable memory record", request.id);
    }
    return record;
  }

  async list(request: DurableMemoryListRequest): Promise<DurableMemoryRecordListResult> {
    return this.storage.listRecords(request);
  }

  async search(request: DurableMemorySearchRequest): Promise<DurableMemorySearchResult> {
    return this.storage.searchRecords(request);
  }

  async archive(request: DurableMemoryArchiveRequest): Promise<DurableMemoryRecord> {
    const record = this.storage.archiveRecord(request);
    if (!record) {
      throw notFound("durable memory record", request.id);
    }
    return record;
  }

  async delete(request: DurableMemoryDeleteRequest): Promise<DurableMemoryRecord> {
    const record = this.storage.deleteRecord(request);
    if (!record) {
      throw notFound("durable memory record", request.id);
    }
    return record;
  }

  async createProposal(request: DurableMemoryProposalCreateRequest): Promise<DurableMemoryProposal> {
    return this.storage.createProposal({
      ...request,
      id: `dmp_${randomUUID()}`
    });
  }

  async listProposals(request: DurableMemoryListRequest): Promise<DurableMemoryProposal[]> {
    return this.storage.listProposals(request.namespace);
  }

  async approveProposal(request: DurableMemoryProposalReviewRequest): Promise<DurableMemoryProposal> {
    const proposal = this.storage.updateProposalStatus(request.id, "approved", request.actorId);
    if (!proposal) {
      throw notFound("durable memory proposal", request.id);
    }
    return proposal;
  }

  async rejectProposal(request: DurableMemoryProposalReviewRequest): Promise<DurableMemoryProposal> {
    const proposal = this.storage.updateProposalStatus(request.id, "rejected", request.actorId);
    if (!proposal) {
      throw notFound("durable memory proposal", request.id);
    }
    return proposal;
  }

  async createSnapshot(request: DurableMemorySnapshotCreateRequest): Promise<DurableMemorySnapshot> {
    return this.storage.createSnapshot({
      ...request,
      id: `dms_${randomUUID()}`
    });
  }

  async listSnapshots(request: DurableMemoryListRequest): Promise<DurableMemorySnapshotListResult> {
    return this.storage.listSnapshots(request.namespace);
  }

  async restoreSnapshot(request: DurableMemorySnapshotRestoreRequest): Promise<DurableMemorySnapshot> {
    let snapshot: DurableMemorySnapshot | undefined;
    try {
      snapshot = this.storage.restoreSnapshot(request);
    } catch (error) {
      throw new AthenaError("CONFIG_ERROR", error instanceof Error ? error.message : String(error));
    }
    if (!snapshot) {
      throw notFound("durable memory snapshot", request.id);
    }
    return snapshot;
  }

  async getHealth(): Promise<DurableMemoryProviderHealth> {
    return {
      providerId: "server-mode",
      status: "ok",
      operatorStatus: "remote-current",
      checkedAt: new Date().toISOString(),
      message: "Durable memory server storage is available."
    };
  }
}

function notFound(label: string, id: string): AthenaError {
  return new AthenaError("PROVIDER_NOT_FOUND", `${label} not found: ${id}`);
}
