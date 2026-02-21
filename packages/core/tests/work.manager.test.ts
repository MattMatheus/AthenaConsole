import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import type { AthenaConfig } from "../src/shared/config.js";
import { WorkManager } from "../src/work/index.js";

function testConfig(workspaceRoot: string): AthenaConfig {
  return {
    workspaceRoot,
    stateDir: ".athena",
    defaultProvider: "mock",
    defaultModel: "mock-model",
    providerFallbackOrder: [],
    localProviderCommand: "/bin/echo",
    localProviderArgs: [],
    httpProviderUrl: undefined,
    httpProviderApiKey: undefined,
    httpProviderTimeoutMs: 20000,
    runtimeRunTimeoutMs: 30000,
    scheduleRunTimeoutMs: 45000
  };
}

describe("work manager", () => {
  it("persists queue and supports restart recovery", async () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-work-"));

    try {
      const managerA = new WorkManager(testConfig(dir));
      await managerA.enqueue({ sessionId: "s1", payload: "one", mode: "followup" });

      const managerB = new WorkManager(testConfig(dir));
      const queue = await managerB.loadQueue("s1");
      expect(queue.items.length).toBe(1);
      expect(queue.items[0]?.payload).toBe("one");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("applies dedupe/drop policy", async () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-work-dedupe-"));

    try {
      const manager = new WorkManager(testConfig(dir));
      await manager.enqueue({ sessionId: "s1", payload: "same", mode: "followup" });
      await manager.enqueue({ sessionId: "s1", payload: "same", mode: "followup", dropPolicy: "keep-old" });

      let queue = await manager.loadQueue("s1");
      expect(queue.items.length).toBe(1);

      await manager.enqueue({ sessionId: "s1", payload: "same", mode: "followup", dropPolicy: "keep-new" });
      queue = await manager.loadQueue("s1");
      expect(queue.items.length).toBe(1);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("drains followup and collect batches in order", async () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-work-drain-"));

    try {
      const manager = new WorkManager(testConfig(dir));
      await manager.enqueue({ sessionId: "s1", payload: "A", mode: "collect" });
      await manager.enqueue({ sessionId: "s1", payload: "B", mode: "collect" });
      await manager.enqueue({ sessionId: "s1", payload: "C", mode: "followup" });

      const seen: Array<{ mode: string; payload: string; count: number }> = [];
      const result = await manager.drain("s1", async (batch) => {
        seen.push({ mode: batch.mode, payload: batch.payload, count: batch.sourceItems.length });
      });

      expect(result.status).toBe("ok");
      expect(result.drainedItems).toBe(3);
      expect(result.queueDepthBefore).toBe(3);
      expect(result.queueDepthAfter).toBe(0);
      expect(seen).toEqual([
        { mode: "collect", payload: "A\n\nB", count: 2 },
        { mode: "followup", payload: "C", count: 1 }
      ]);

      const queue = await manager.loadQueue("s1");
      expect(queue.items.length).toBe(0);
      expect(queue.draining).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("guards re-entrant drain calls", async () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-work-reentrant-"));

    try {
      const manager = new WorkManager(testConfig(dir));
      await manager.enqueue({ sessionId: "s1", payload: "one", mode: "followup" });

      let firstCallEntered = false;
      const firstDrain = manager.drain("s1", async () => {
        firstCallEntered = true;
        const nested = await manager.drain("s1", async () => {});
        expect(nested.status).toBe("already-draining");
      });

      await firstDrain;
      expect(firstCallEntered).toBe(true);

      const queuePath = join(dir, ".athena", "work", "queues", "s1.json");
      const raw = readFileSync(queuePath, "utf8");
      const queue = JSON.parse(raw) as { draining: boolean; items: unknown[] };
      expect(queue.draining).toBe(false);
      expect(queue.items.length).toBe(0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("resets persisted draining=false when handler fails", async () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-work-fail-cleanup-"));

    try {
      const manager = new WorkManager(testConfig(dir));
      await manager.enqueue({ sessionId: "s1", payload: "one", mode: "followup" });

      await expect(
        manager.drain("s1", async () => {
          throw new Error("boom");
        })
      ).rejects.toThrow("boom");

      const queue = await manager.loadQueue("s1");
      expect(queue.draining).toBe(false);
      expect(queue.items.length).toBe(1);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("serializes concurrent enqueues for same session without losing items", async () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-work-concurrent-enqueue-"));

    try {
      const manager = new WorkManager(testConfig(dir));
      await Promise.all(
        Array.from({ length: 25 }).map((_, i) =>
          manager.enqueue({
            sessionId: "s1",
            payload: `task-${i}`,
            mode: "followup",
            dedupeMode: "none"
          })
        )
      );

      const queue = await manager.loadQueue("s1");
      expect(queue.items.length).toBe(25);
      expect(new Set(queue.items.map((item) => item.payload)).size).toBe(25);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("prevents duplicate drain execution across manager instances", async () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-work-concurrent-drain-"));

    try {
      const managerA = new WorkManager(testConfig(dir));
      const managerB = new WorkManager(testConfig(dir));
      await managerA.enqueue({ sessionId: "s1", payload: "one", mode: "followup" });

      let processed = 0;
      await Promise.all([
        managerA.drain("s1", async () => {
          processed += 1;
          await new Promise((resolvePromise) => setTimeout(resolvePromise, 40));
        }),
        managerB.drain("s1", async () => {
          processed += 1;
        })
      ]);

      expect(processed).toBe(1);
      const queue = await managerA.loadQueue("s1");
      expect(queue.items.length).toBe(0);
      expect(queue.draining).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("migrates legacy queue file and clears stale draining flag on next drain", async () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-work-migrate-"));

    try {
      const queuesDir = join(dir, ".athena", "work", "queues");
      mkdirSync(queuesDir, { recursive: true });
      const queuePath = join(queuesDir, "s1.json");
      writeFileSync(
        queuePath,
        JSON.stringify(
          {
            sessionId: "s1",
            items: [
              {
                id: "item-1",
                sessionId: "s1",
                payload: "one",
                mode: "followup",
                createdAt: "2026-02-16T00:00:00.000Z"
              }
            ],
            draining: true,
            updatedAt: "2026-02-16T00:00:00.000Z"
          },
          null,
          2
        ),
        "utf8"
      );

      const manager = new WorkManager(testConfig(dir));
      const loaded = await manager.loadQueue("s1");
      expect(loaded.schemaVersion).toBe(1);

      const result = await manager.drain("s1", async () => {});
      expect(result.status).toBe("ok");
      expect(result.drainedItems).toBe(1);

      const raw = JSON.parse(readFileSync(queuePath, "utf8")) as { schemaVersion?: number; draining: boolean; items: unknown[] };
      expect(raw.schemaVersion).toBe(1);
      expect(raw.draining).toBe(false);
      expect(raw.items.length).toBe(0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
