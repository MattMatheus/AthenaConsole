import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { createRuntime } from "../src/runtime/index.js";

describe("runtime session lock", () => {
  it("serializes concurrent writes for the same session", async () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-lock-"));

    try {
      const runtime = createRuntime({
        config: {
          workspaceRoot: dir,
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
        }
      });

      await Promise.all([
        runtime.run({ sessionId: "s-lock", input: "one" }),
        runtime.run({ sessionId: "s-lock", input: "two" })
      ]);

      const transcriptPath = join(dir, ".athena", "transcripts", "s-lock.jsonl");
      const lines = readFileSync(transcriptPath, "utf8")
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);

      expect(lines.length).toBe(4);
      for (const line of lines) {
        const parsed = JSON.parse(line) as { role: string; content: string };
        expect(["user", "assistant"]).toContain(parsed.role);
        expect(parsed.content.length).toBeGreaterThan(0);
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
