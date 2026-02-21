import { describe, expect, it } from "vitest";
import { InMemoryRejectionEventStore } from "../src/control-plane/rejection-event-store.js";
import type { PolicyConcurrencyRejectionRecord } from "../src/shared/contracts.js";

function createRecord(index: number): PolicyConcurrencyRejectionRecord {
  const createdAt = `2026-02-18T00:00:0${index}.000Z`;
  const sessionId = `session-${index}`;
  return {
    id: `rej-${index}`,
    createdAt,
    sessionId,
    activeRuns: index,
    maxConcurrentRuns: 2,
    reason: "max-concurrent-runs-exceeded",
    event: {
      schemaVersion: 1,
      timestamp: createdAt,
      policyType: "CONCURRENCY",
      limit: 2,
      rejectedRunDetails: {
        sessionId
      },
      reason: "max-concurrent-runs-exceeded",
      activeRuns: index
    }
  };
}

describe("in-memory rejection event store", () => {
  it("retains only the most recent bounded records", () => {
    const store = new InMemoryRejectionEventStore({
      maxRecords: 3
    });

    store.add(createRecord(1));
    store.add(createRecord(2));
    store.add(createRecord(3));
    store.add(createRecord(4));

    const result = store.list({ limit: 10 });
    expect(result.items.map((row) => row.id)).toEqual(["rej-2", "rej-3", "rej-4"]);
  });

  it("supports filtered pagination and cursor continuation", () => {
    const store = new InMemoryRejectionEventStore({
      maxRecords: 10
    });
    for (let i = 1; i <= 4; i += 1) {
      store.add(createRecord(i));
    }

    const firstPage = store.list({
      sessionId: "session-3",
      limit: 1
    });
    expect(firstPage.items.map((row) => row.id)).toEqual(["rej-3"]);
    expect(firstPage.nextCursor).toBeUndefined();

    const pagedFirst = store.list({ limit: 2 });
    expect(pagedFirst.items.map((row) => row.id)).toEqual(["rej-1", "rej-2"]);
    expect(pagedFirst.nextCursor).toBeDefined();

    const pagedSecond = store.list({
      ...(pagedFirst.nextCursor ? { cursor: pagedFirst.nextCursor } : {}),
      limit: 2
    });
    expect(pagedSecond.items.map((row) => row.id)).toEqual(["rej-3", "rej-4"]);
    expect(pagedSecond.nextCursor).toBeUndefined();
  });
});
