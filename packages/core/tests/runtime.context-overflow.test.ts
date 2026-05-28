import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { createRuntime } from "../src/runtime/index.js";

function baseConfig(workspaceRoot: string) {
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
    scheduleRunTimeoutMs: 45000,
    runHistory: {
      retentionDays: 3650,
      sweepIntervalMs: 60 * 60 * 1000
    }
  };
}

function writeSessionWithTranscript(workspaceRoot: string, sessionId: string, entries: Record<string, unknown>[]) {
  const transcriptDir = join(workspaceRoot, ".athena", "transcripts");
  const sessionDir = join(workspaceRoot, ".athena", "sessions");
  mkdirSync(transcriptDir, { recursive: true });
  mkdirSync(sessionDir, { recursive: true });
  const transcriptPath = join(transcriptDir, `${sessionId}.jsonl`);
  writeFileSync(transcriptPath, `${entries.map((entry) => JSON.stringify(entry)).join("\n")}\n`, "utf8");
  writeFileSync(
    join(sessionDir, `${sessionId}.json`),
    JSON.stringify(
      {
        id: sessionId,
        transcriptPath,
        createdAt: "2026-02-16T00:00:00.000Z",
        updatedAt: "2026-02-16T00:00:00.000Z"
      },
      null,
      2
    ),
    "utf8"
  );
}

describe("runtime context overflow recovery", () => {
  it("applies summary strategy and persists compaction metadata", async () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-context-summary-"));
    try {
      const sessionId = "s1";
      const rows: Record<string, unknown>[] = [];
      for (let index = 0; index < 8; index += 1) {
        rows.push({
          id: `u-${index}`,
          role: "user",
          content: `question-${index}:${"a".repeat(250)}`,
          createdAt: "2026-02-16T00:00:00.000Z"
        });
        rows.push({
          id: `a-${index}`,
          role: "assistant",
          content: `answer-${index}:${"b".repeat(250)}`,
          createdAt: "2026-02-16T00:00:01.000Z"
        });
      }
      writeSessionWithTranscript(dir, sessionId, rows);

      const runtime = createRuntime({
        config: {
          ...baseConfig(dir),
          context: {
            strategy: "raw",
            maxChars: 1900,
            reserveChars: 300,
            maxOverflowRetries: 2,
            summaryMaxChars: 260,
            maxToolResultChars: 600
          }
        }
      });

      const result = await runtime.run({ sessionId, input: "latest question" });
      expect(result.contextMeta?.overflowRecovered).toBe(true);
      expect(result.contextMeta?.finalStrategy).toBe("summary");
      expect(result.contextMeta?.steps.find((step) => step.kind === "summary")?.applied).toBe(true);

      const transcriptPath = join(dir, ".athena", "transcripts", `${sessionId}.jsonl`);
      const lines = readFileSync(transcriptPath, "utf8")
        .trim()
        .split(/\r?\n/);
      const lastRow = JSON.parse(lines[lines.length - 1] ?? "{}") as { metadata?: Record<string, string> };
      expect(lastRow.metadata?.contextFinalStrategy).toBe("summary");
      expect(lastRow.metadata?.contextOverflowRecovered).toBe("true");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("falls back to tool-result truncation after summary overflow", async () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-context-trunc-"));
    try {
      const sessionId = "s1";
      writeSessionWithTranscript(dir, sessionId, [
        {
          id: "u-1",
          role: "user",
          content: "run tool",
          createdAt: "2026-02-16T00:00:00.000Z"
        },
        {
          id: "a-1",
          role: "assistant",
          kind: "tool-call",
          toolCallId: "call-1",
          toolName: "read_file",
          content: "calling read_file",
          createdAt: "2026-02-16T00:00:01.000Z"
        },
        {
          id: "t-1",
          role: "tool",
          kind: "tool-result",
          toolCallId: "call-1",
          content: "x".repeat(2800),
          createdAt: "2026-02-16T00:00:02.000Z"
        }
      ]);

      const runtime = createRuntime({
        config: {
          ...baseConfig(dir),
          context: {
            strategy: "raw",
            maxChars: 1500,
            reserveChars: 300,
            maxOverflowRetries: 3,
            summaryMaxChars: 200,
            maxToolResultChars: 300
          }
        }
      });

      const result = await runtime.run({ sessionId, input: "continue" });
      const truncationStep = result.contextMeta?.steps.find((step) => step.kind === "tool-result-truncation");
      expect(truncationStep?.applied).toBe(true);
      expect(result.output).toContain("tool result truncated to fit context budget");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("returns CONTEXT_OVERFLOW when recovery cannot resolve oversized context", async () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-context-fail-"));
    try {
      const runtime = createRuntime({
        config: {
          ...baseConfig(dir),
          context: {
            strategy: "raw",
            maxChars: 1400,
            reserveChars: 200,
            maxOverflowRetries: 1,
            summaryMaxChars: 180,
            maxToolResultChars: 300
          }
        }
      });

      const error = await runtime.run({ sessionId: "s1", input: "u".repeat(5000) }).catch((caught: unknown) => caught);
      expect(error).toMatchObject({
        code: "CONTEXT_OVERFLOW"
      });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
