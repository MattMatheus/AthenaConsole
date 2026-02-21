import { describe, expect, it } from "vitest";
import { sanitizeTranscriptHistory } from "../src/runtime/history.js";
import type { AthenaConfig } from "../src/shared/config.js";
import type { TranscriptEntry } from "../src/shared/contracts.js";

function testConfig(overrides: Partial<AthenaConfig> = {}): AthenaConfig {
  return {
    workspaceRoot: process.cwd(),
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
    ...overrides
  };
}

function entry(
  id: string,
  role: TranscriptEntry["role"],
  content: string,
  createdAt = "2026-02-16T00:00:00.000Z"
): TranscriptEntry {
  return { id, role, content, createdAt };
}

describe("runtime history sanitization", () => {
  it("inserts missing tool results before the next non-tool message", () => {
    const input: TranscriptEntry[] = [
      entry("u1", "user", "hello"),
      {
        ...entry("a1", "assistant", "calling tool"),
        kind: "tool-call",
        toolCallId: "call-1",
        toolName: "read_file"
      },
      entry("u2", "user", "follow up")
    ];

    const result = sanitizeTranscriptHistory(input, testConfig());
    expect(result.entries.map((row) => row.id)).toEqual(["u1", "a1", "a1:missing-result:call-1", "u2"]);
    expect(result.report.insertedMissingToolResults).toBe(1);
  });

  it("drops orphan and duplicate tool results", () => {
    const input: TranscriptEntry[] = [
      entry("u1", "user", "hello"),
      {
        ...entry("a1", "assistant", "calling tool"),
        kind: "tool-call",
        toolCallId: "call-1",
        toolName: "read_file"
      },
      {
        ...entry("t1", "tool", "tool ok"),
        kind: "tool-result",
        toolCallId: "call-1"
      },
      {
        ...entry("t2", "tool", "duplicate"),
        kind: "tool-result",
        toolCallId: "call-1"
      },
      {
        ...entry("t3", "tool", "orphan"),
        kind: "tool-result",
        toolCallId: "call-2"
      }
    ];

    const result = sanitizeTranscriptHistory(input, testConfig());
    expect(result.entries.map((row) => row.id)).toEqual(["u1", "a1", "t1"]);
    expect(result.report.droppedDuplicateToolResults).toBe(1);
    expect(result.report.droppedOrphanToolResults).toBe(1);
  });

  it("applies entry truncation, control-char stripping, and max entry limit deterministically", () => {
    const input: TranscriptEntry[] = [
      entry("u1", "user", "first"),
      entry("u2", "user", `seco\u0000nd`),
      entry("u3", "user", "this entry is too long")
    ];

    const result = sanitizeTranscriptHistory(
      input,
      testConfig({
        history: {
          maxEntries: 2,
          maxEntryChars: 8,
          repairToolPairing: true,
          stripControlChars: true
        }
      })
    );

    expect(result.entries.map((row) => row.id)).toEqual(["u2", "u3"]);
    expect(result.entries[0]?.content).toBe("second");
    expect(result.entries[1]?.content).toBe("this ent");
    expect(result.report.trimmedByMaxEntries).toBe(1);
    expect(result.report.truncatedEntries).toBe(1);
  });
});
