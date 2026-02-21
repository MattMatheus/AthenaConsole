import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { ProviderRegistry, type ProviderAdapter } from "../src/providers/index.js";
import { AthenaError } from "../src/runtime/errors.js";
import { createRuntime } from "../src/runtime/index.js";
import type { RunRequest, RunResult } from "../src/shared/contracts.js";

class RetryableFailProvider implements ProviderAdapter {
  readonly id = "broken";

  async generate(_request: RunRequest, _options?: { signal?: AbortSignal }): Promise<RunResult> {
    throw new AthenaError("PROVIDER_ERROR", "simulated failure", true);
  }
}

class EchoProvider implements ProviderAdapter {
  readonly id = "backup";

  async generate(request: RunRequest, _options?: { signal?: AbortSignal }): Promise<RunResult> {
    const input = request.input ?? "";
    return {
      sessionId: request.sessionId,
      output: `ok:${input.length}`,
      model: "backup-model",
      provider: this.id,
      createdAt: new Date().toISOString()
    };
  }
}

function config(workspaceRoot: string) {
  return {
    workspaceRoot,
    stateDir: ".athena",
    defaultProvider: "broken",
    defaultModel: "m1",
    providerFallbackOrder: ["backup"],
    localProviderCommand: "/bin/echo",
    localProviderArgs: [],
    httpProviderUrl: undefined,
    httpProviderApiKey: undefined,
    httpProviderTimeoutMs: 20000,
    runtimeRunTimeoutMs: 30000,
    scheduleRunTimeoutMs: 45000,
    context: {
      strategy: "raw" as const,
      maxChars: 1800,
      reserveChars: 300,
      maxOverflowRetries: 2,
      summaryMaxChars: 250,
      maxToolResultChars: 500
    }
  };
}

describe("runtime reliability metadata", () => {
  it("captures fallback, latency, and compaction counters", async () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-runtime-reliability-"));
    try {
      const sessionId = "s1";
      const transcriptDir = join(dir, ".athena", "transcripts");
      const sessionDir = join(dir, ".athena", "sessions");
      mkdirSync(transcriptDir, { recursive: true });
      mkdirSync(sessionDir, { recursive: true });
      const transcriptPath = join(transcriptDir, `${sessionId}.jsonl`);
      const rows = Array.from({ length: 8 }).flatMap((_, index) => [
        JSON.stringify({
          id: `u-${index}`,
          role: "user",
          content: `question-${index}:${"a".repeat(240)}`,
          createdAt: "2026-02-16T00:00:00.000Z"
        }),
        JSON.stringify({
          id: `a-${index}`,
          role: "assistant",
          content: `answer-${index}:${"b".repeat(240)}`,
          createdAt: "2026-02-16T00:00:01.000Z"
        })
      ]);
      writeFileSync(transcriptPath, `${rows.join("\n")}\n`, "utf8");
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

      const providers = new ProviderRegistry();
      providers.register(new RetryableFailProvider());
      providers.register(new EchoProvider());

      const runtime = createRuntime({
        config: config(dir),
        providers,
        maxAttempts: 1
      });

      const result = await runtime.run({ sessionId, input: "latest" });
      expect(result.contextMeta?.overflowRecovered).toBe(true);
      expect(result.reliability?.fallbackHops).toBe(1);
      expect(result.reliability?.providerAttempts).toBe(2);
      expect(result.reliability?.providerRetries).toBe(0);
      expect(result.reliability?.contextCompactions).toBeGreaterThan(0);
      expect(result.reliability?.contextOverflowAttempts).toBeGreaterThan(0);
      expect(result.reliability?.turnLatencyMs).toBeGreaterThanOrEqual(0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
