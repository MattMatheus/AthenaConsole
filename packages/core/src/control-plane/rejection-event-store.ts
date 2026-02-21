import type {
  PolicyConcurrencyRejectionQuery,
  PolicyConcurrencyRejectionQueryResult,
  PolicyConcurrencyRejectionRecord
} from "../shared/contracts.js";

export interface RejectionEventStore {
  replace(records: PolicyConcurrencyRejectionRecord[]): void;
  add(record: PolicyConcurrencyRejectionRecord): void;
  list(query?: PolicyConcurrencyRejectionQuery): PolicyConcurrencyRejectionQueryResult;
}

export interface InMemoryRejectionEventStoreOptions {
  maxRecords: number;
  defaultLimit?: number;
  maxLimit?: number;
}

const DEFAULT_LIMIT = 200;
const DEFAULT_MAX_LIMIT = 500;

export class InMemoryRejectionEventStore implements RejectionEventStore {
  private readonly maxRecords: number;
  private readonly defaultLimit: number;
  private readonly maxLimit: number;
  private records: PolicyConcurrencyRejectionRecord[] = [];

  constructor(options: InMemoryRejectionEventStoreOptions) {
    this.maxRecords = Math.max(1, Math.floor(options.maxRecords));
    this.defaultLimit = Math.max(1, Math.floor(options.defaultLimit ?? DEFAULT_LIMIT));
    this.maxLimit = Math.max(this.defaultLimit, Math.floor(options.maxLimit ?? DEFAULT_MAX_LIMIT));
  }

  replace(records: PolicyConcurrencyRejectionRecord[]): void {
    this.records = records.slice(-this.maxRecords);
  }

  add(record: PolicyConcurrencyRejectionRecord): void {
    this.records.push(record);
    if (this.records.length > this.maxRecords) {
      this.records.splice(0, this.records.length - this.maxRecords);
    }
  }

  list(query: PolicyConcurrencyRejectionQuery = {}): PolicyConcurrencyRejectionQueryResult {
    const filtered = this.records.filter((row) => this.matchesQuery(row, query));
    const limit = this.clampLimit(query.limit ?? this.defaultLimit, 1, this.maxLimit);
    const offset = this.decodeOffsetCursor(query.cursor);
    const items = filtered.slice(offset, offset + limit);
    const next = offset + items.length;
    return {
      items,
      ...(next < filtered.length ? { nextCursor: this.encodeOffsetCursor(next) } : {})
    };
  }

  private matchesQuery(row: PolicyConcurrencyRejectionRecord, query: PolicyConcurrencyRejectionQuery): boolean {
    if (query.sessionId && row.sessionId !== query.sessionId) {
      return false;
    }
    if (query.createdAfter || query.createdBefore) {
      const createdAtMs = Date.parse(row.createdAt);
      if (!Number.isFinite(createdAtMs)) {
        return false;
      }
      if (query.createdAfter) {
        const afterMs = Date.parse(query.createdAfter);
        if (Number.isFinite(afterMs) && createdAtMs < afterMs) {
          return false;
        }
      }
      if (query.createdBefore) {
        const beforeMs = Date.parse(query.createdBefore);
        if (Number.isFinite(beforeMs) && createdAtMs > beforeMs) {
          return false;
        }
      }
    }
    return true;
  }

  private clampLimit(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, Math.floor(value)));
  }

  private decodeOffsetCursor(cursor: string | undefined): number {
    if (!cursor) {
      return 0;
    }
    try {
      const decoded = Buffer.from(cursor, "base64url").toString("utf8");
      const parsed = Number.parseInt(decoded, 10);
      if (!Number.isFinite(parsed) || parsed < 0) {
        return 0;
      }
      return parsed;
    } catch {
      return 0;
    }
  }

  private encodeOffsetCursor(offset: number): string {
    return Buffer.from(String(offset), "utf8").toString("base64url");
  }
}
