import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { openAppStateDatabase } from "../src/control-plane/app-state/index.js";
import { LocalWorkerHeartbeatService } from "../src/control-plane/services/worker-heartbeats.js";
import { loadConfig } from "../src/shared/config.js";

describe("worker heartbeat persistence", () => {
  it("upserts worker identity, active work, capacity, version, and expiry", () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-worker-heartbeat-upsert-"));
    try {
      const config = loadConfig(dir);
      const appState = openAppStateDatabase(config);
      try {
        const service = new LocalWorkerHeartbeatService(config, { appState, defaultTtlMs: 30_000 });
        const now = new Date("2026-06-13T01:00:00.000Z");

        const created = service.heartbeat({
          workerId: "worker-a",
          identity: { host: "runner-1", pid: 123 },
          activeRunId: "run-1",
          activeSessionId: "session-1",
          capacity: 2,
          version: "0.1.0",
          metadata: { queue: "default" },
          now
        });

        expect(created).toMatchObject({
          workerId: "worker-a",
          identity: { host: "runner-1", pid: 123 },
          activeRunId: "run-1",
          activeSessionId: "session-1",
          capacity: 2,
          version: "0.1.0",
          metadata: { queue: "default" },
          lastHeartbeatAt: "2026-06-13T01:00:00.000Z",
          expiresAt: "2026-06-13T01:00:30.000Z"
        });

        const updated = service.heartbeat({
          workerId: "worker-a",
          activeRunId: null,
          activeSessionId: null,
          capacity: 3,
          version: "0.1.1",
          now: new Date("2026-06-13T01:00:10.000Z")
        });

        expect(updated).toMatchObject({
          workerId: "worker-a",
          identity: { host: "runner-1", pid: 123 },
          capacity: 3,
          version: "0.1.1",
          lastHeartbeatAt: "2026-06-13T01:00:10.000Z",
          expiresAt: "2026-06-13T01:00:40.000Z"
        });
        expect(updated.activeRunId).toBeUndefined();
        expect(updated.activeSessionId).toBeUndefined();
      } finally {
        appState.close();
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("classifies active versus expired workers and cleans up expired rows", () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-worker-heartbeat-expiry-"));
    try {
      const config = loadConfig(dir);
      const appState = openAppStateDatabase(config);
      try {
        const service = new LocalWorkerHeartbeatService(config, { appState });
        service.heartbeat({
          workerId: "expired-worker",
          identity: { host: "old" },
          now: new Date("2026-06-13T01:00:00.000Z"),
          ttlMs: 10_000
        });
        service.heartbeat({
          workerId: "active-worker",
          identity: { host: "new" },
          activeRunId: "run-active",
          capacity: 4,
          now: new Date("2026-06-13T01:00:25.000Z"),
          ttlMs: 60_000
        });

        const checkAt = new Date("2026-06-13T01:00:30.000Z");
        expect(service.listExpired(checkAt).map((worker) => worker.workerId)).toEqual(["expired-worker"]);
        expect(service.listActive(checkAt).map((worker) => worker.workerId)).toEqual(["active-worker"]);

        expect(service.cleanupExpired(checkAt)).toBe(1);
        expect(appState.workerHeartbeats.get("expired-worker")).toBeUndefined();
        expect(appState.workerHeartbeats.get("active-worker")).toMatchObject({
          workerId: "active-worker",
          activeRunId: "run-active",
          capacity: 4
        });
      } finally {
        appState.close();
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
