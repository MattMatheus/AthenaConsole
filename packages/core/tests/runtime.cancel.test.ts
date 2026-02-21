import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { RuntimeCancellationStore } from "../src/runtime/cancellation.js";

function config(workspaceRoot: string) {
  return {
    workspaceRoot,
    stateDir: ".athena",
    defaultProvider: "slow-cancel",
    defaultModel: "slow-model",
    providerFallbackOrder: [],
    localProviderCommand: "/bin/echo",
    localProviderArgs: [],
    httpProviderUrl: undefined,
    httpProviderApiKey: undefined,
    httpProviderTimeoutMs: 20000,
    runtimeRunTimeoutMs: 30_000,
    scheduleRunTimeoutMs: 45000
  };
}

describe("runtime cancellation", () => {
  it("cancels an active run via persisted cancellation request", async () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-runtime-cancel-"));

    try {
      const cfg = config(dir);
      const store = new RuntimeCancellationStore(cfg);
      await store.markRunActive("cancel-1");
      const controller = new AbortController();
      const watch = store.watchForCancellation("cancel-1", controller);
      const cancelResult = await store.requestCancellation("cancel-1", "user-requested");
      const reason = await watch.done;

      expect(cancelResult.status).toBe("cancelled");
      expect(reason).toBe("user-requested");
      expect(controller.signal.aborted).toBe(true);
      watch.stop();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("lists active runs and cancellation requests with bounded query controls", async () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-runtime-cancel-list-"));

    try {
      const cfg = config(dir);
      const store = new RuntimeCancellationStore(cfg);

      await store.markRunActive("cancel-list");
      const active = await store.listActiveRuns({ sessionId: "cancel-list", limit: 5 });
      expect(active.items.length).toBe(1);
      expect(active.items[0]?.sessionId).toBe("cancel-list");
      expect(typeof active.items[0]?.runId).toBe("string");
      expect(typeof active.items[0]?.traceId).toBe("string");

      const cancelResult = await store.requestCancellation("cancel-list", "operator");
      expect(cancelResult.status).toBe("cancelled");
      const runId = active.items[0]?.runId;
      expect(typeof runId).toBe("string");
      const requests = await store.listCancellationRequests({
        sessionId: "cancel-list",
        runId: runId!,
        limit: 5
      });
      expect(requests.items.length).toBe(1);
      expect(requests.items[0]?.sessionId).toBe("cancel-list");
      expect(requests.items[0]?.reason).toBe("operator");
      expect(requests.items[0]?.runId).toBe(active.items[0]?.runId);
      expect(requests.items[0]?.traceId).toBe(active.items[0]?.traceId);
      expect(requests.items[0]?.startedAt).toBe(active.items[0]?.startedAt);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("resolves runId-based cancellation to an active session and preserves not-running semantics", async () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-runtime-cancel-by-runid-"));

    try {
      const cfg = config(dir);
      const store = new RuntimeCancellationStore(cfg);

      await store.markRunActive("cancel-by-runid");
      const active = await store.listActiveRuns({ sessionId: "cancel-by-runid", limit: 1 });
      const runId = active.items[0]?.runId;
      expect(typeof runId).toBe("string");

      const cancelled = await store.requestCancellationByRunId(runId!, "operator");
      expect(cancelled.status).toBe("cancelled");
      expect(cancelled.sessionId).toBe("cancel-by-runid");

      const notRunning = await store.requestCancellationByRunId("missing-run-id", "operator");
      expect(notRunning.status).toBe("not-running");
      expect(notRunning.sessionId).toBeUndefined();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("paginates active-run snapshots with stable keyset cursors under churn", async () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-runtime-cancel-keyset-"));

    try {
      const cfg = config(dir);
      const store = new RuntimeCancellationStore(cfg);
      await store.ensureDirectories();
      const activeDir = join(dir, ".athena", "runtime", "active");
      mkdirSync(activeDir, { recursive: true });
      writeFileSync(
        join(activeDir, "s1.json"),
        JSON.stringify(
          {
            schemaVersion: 1,
            sessionId: "s1",
            pid: process.pid,
            startedAt: "2026-02-16T10:00:00.000Z",
            runId: "run-1",
            traceId: "trace-1"
          },
          null,
          2
        ),
        "utf8"
      );
      writeFileSync(
        join(activeDir, "s2.json"),
        JSON.stringify(
          {
            schemaVersion: 1,
            sessionId: "s2",
            pid: process.pid,
            startedAt: "2026-02-16T09:00:00.000Z",
            runId: "run-2",
            traceId: "trace-2"
          },
          null,
          2
        ),
        "utf8"
      );

      const firstPage = await store.listActiveRuns({ limit: 1 });
      expect(firstPage.items[0]?.sessionId).toBe("s1");
      expect(typeof firstPage.nextCursor).toBe("string");

      writeFileSync(
        join(activeDir, "s3.json"),
        JSON.stringify(
          {
            schemaVersion: 1,
            sessionId: "s3",
            pid: process.pid,
            startedAt: "2026-02-16T11:00:00.000Z",
            runId: "run-3",
            traceId: "trace-3"
          },
          null,
          2
        ),
        "utf8"
      );

      const secondPage = await store.listActiveRuns({
        limit: 1,
        cursor: firstPage.nextCursor!
      });
      expect(secondPage.items.length).toBe(1);
      expect(secondPage.items[0]?.sessionId).toBe("s2");
      expect(secondPage.items[0]?.runId).toBe("run-2");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("derives stable legacy runId values for records persisted before runId support", async () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-runtime-cancel-legacy-runid-"));

    try {
      const cfg = config(dir);
      const store = new RuntimeCancellationStore(cfg);
      await store.ensureDirectories();
      const activeDir = join(dir, ".athena", "runtime", "active");
      const cancelDir = join(dir, ".athena", "runtime", "cancel");
      mkdirSync(activeDir, { recursive: true });
      mkdirSync(cancelDir, { recursive: true });
      const startedAt = "2026-02-18T09:00:00.000Z";
      writeFileSync(
        join(activeDir, "legacy.json"),
        JSON.stringify(
          {
            schemaVersion: 1,
            sessionId: "legacy",
            pid: process.pid,
            startedAt
          },
          null,
          2
        ),
        "utf8"
      );
      writeFileSync(
        join(cancelDir, "legacy.json"),
        JSON.stringify(
          {
            schemaVersion: 1,
            sessionId: "legacy",
            requestedAt: "2026-02-18T09:00:01.000Z",
            reason: "operator",
            startedAt
          },
          null,
          2
        ),
        "utf8"
      );

      const first = await store.listActiveRuns({ sessionId: "legacy", limit: 5 });
      const second = await store.listActiveRuns({ sessionId: "legacy", limit: 5 });
      expect(first.items.length).toBe(1);
      expect(first.items[0]?.runId.startsWith("legacy-")).toBe(true);
      expect(second.items[0]?.runId).toBe(first.items[0]?.runId);

      const requests = await store.listCancellationRequests({ sessionId: "legacy", limit: 5 });
      expect(requests.items.length).toBe(1);
      expect(requests.items[0]?.runId).toBe(first.items[0]?.runId);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
