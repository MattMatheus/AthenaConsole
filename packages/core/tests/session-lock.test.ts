import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { acquireSessionLock } from "../src/runtime/session-lock.js";

describe("session lock stale recovery", () => {
  it("reclaims stale lockfiles for dead processes", async () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-lock-stale-"));
    try {
      const lockPath = join(dir, ".athena", "locks", "s1.lock");
      mkdirSync(join(dir, ".athena", "locks"), { recursive: true });
      writeFileSync(lockPath, "pid=999999\ncreatedAt=2000-01-01T00:00:00.000Z\n", "utf8");

      const lock = await acquireSessionLock(lockPath, {
        timeoutMs: 500,
        retryDelayMs: 20,
        staleAfterMs: 10
      });
      await lock.release();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("does not reclaim stale-looking lockfiles for live owner pids", async () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-lock-live-owner-"));
    try {
      const lockPath = join(dir, ".athena", "locks", "s1.lock");
      mkdirSync(join(dir, ".athena", "locks"), { recursive: true });
      writeFileSync(lockPath, `pid=${process.pid}\ncreatedAt=2000-01-01T00:00:00.000Z\n`, "utf8");

      await expect(
        acquireSessionLock(lockPath, {
          timeoutMs: 120,
          retryDelayMs: 20,
          staleAfterMs: 10
        })
      ).rejects.toMatchObject({
        code: "SESSION_LOCK_TIMEOUT"
      });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
