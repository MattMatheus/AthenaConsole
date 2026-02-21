import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createRuntime } from "../src/runtime/index.js";
import { loadConfig } from "../src/shared/config.js";

describe("runtime run-history retention", () => {
  it("prunes stale session history records and transcripts when a sweep is due", async () => {
    const dir = mkdtemp("athena-run-history-retention-");
    try {
      writeFileSync(
        join(dir, ".env"),
        ["ATHENA_RUN_HISTORY_RETENTION_DAYS=1", "ATHENA_RUN_HISTORY_RETENTION_SWEEP_MS=1"].join("\n"),
        "utf8"
      );
      const config = loadConfig(dir);
      const sessionsDir = join(dir, ".athena", "sessions");
      const transcriptsDir = join(dir, ".athena", "transcripts");
      mkdirSync(sessionsDir, { recursive: true });
      mkdirSync(transcriptsDir, { recursive: true });
      writeSessionFile(sessionsDir, "stale", "2000-01-01T00:00:00.000Z");
      writeTranscriptFile(transcriptsDir, "stale");
      writeSessionFile(sessionsDir, "fresh", new Date().toISOString());
      writeTranscriptFile(transcriptsDir, "fresh");

      const runtime = createRuntime({ config });
      await runtime.run({
        sessionId: "live",
        input: "trigger retention sweep"
      });

      expect(existsSync(join(sessionsDir, "stale.json"))).toBe(false);
      expect(existsSync(join(transcriptsDir, "stale.jsonl"))).toBe(false);
      expect(existsSync(join(sessionsDir, "fresh.json"))).toBe(true);
      expect(existsSync(join(transcriptsDir, "fresh.jsonl"))).toBe(true);
      expect(existsSync(join(sessionsDir, "live.json"))).toBe(true);
      expect(existsSync(join(transcriptsDir, "live.jsonl"))).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("respects configured sweep interval to avoid pruning on every run", async () => {
    const dir = mkdtemp("athena-run-history-retention-interval-");
    try {
      writeFileSync(
        join(dir, ".env"),
        ["ATHENA_RUN_HISTORY_RETENTION_DAYS=1", "ATHENA_RUN_HISTORY_RETENTION_SWEEP_MS=86400000"].join("\n"),
        "utf8"
      );
      const config = loadConfig(dir);
      const sessionsDir = join(dir, ".athena", "sessions");
      const transcriptsDir = join(dir, ".athena", "transcripts");
      mkdirSync(sessionsDir, { recursive: true });
      mkdirSync(transcriptsDir, { recursive: true });
      const runtime = createRuntime({ config });

      writeSessionFile(sessionsDir, "stale-a", "2000-01-01T00:00:00.000Z");
      writeTranscriptFile(transcriptsDir, "stale-a");
      await runtime.run({
        sessionId: "live-a",
        input: "first sweep"
      });
      expect(existsSync(join(sessionsDir, "stale-a.json"))).toBe(false);

      writeSessionFile(sessionsDir, "stale-b", "2000-01-01T00:00:00.000Z");
      writeTranscriptFile(transcriptsDir, "stale-b");
      await runtime.run({
        sessionId: "live-b",
        input: "second run within sweep interval"
      });
      expect(existsSync(join(sessionsDir, "stale-b.json"))).toBe(true);
      expect(existsSync(join(transcriptsDir, "stale-b.jsonl"))).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

function writeSessionFile(sessionsDir: string, sessionId: string, updatedAt: string): void {
  writeFileSync(
    join(sessionsDir, `${sessionId}.json`),
    `${JSON.stringify(
      {
        schemaVersion: 1,
        id: sessionId,
        transcriptPath: `.athena/transcripts/${sessionId}.jsonl`,
        provider: "mock",
        model: "mock-model",
        createdAt: "2026-02-18T00:00:00.000Z",
        updatedAt
      },
      null,
      2
    )}\n`,
    "utf8"
  );
}

function writeTranscriptFile(transcriptsDir: string, sessionId: string): void {
  writeFileSync(
    join(transcriptsDir, `${sessionId}.jsonl`),
    `${JSON.stringify({
      id: `${sessionId}-entry-1`,
      role: "user",
      content: "old run",
      createdAt: "2026-02-18T00:00:00.000Z"
    })}\n`,
    "utf8"
  );
}

function mkdtemp(prefix: string): string {
  return mkdtempSync(join(tmpdir(), prefix));
}
