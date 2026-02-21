import { mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { setTimeout as delay } from "node:timers/promises";
import { describe, expect, it } from "vitest";
import { createRuntime } from "../src/runtime/index.js";
import { ProviderRegistry } from "../src/providers/index.js";

function testConfig(workspaceRoot: string) {
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

describe("runtime validation and context", () => {
  it("rejects invalid sessionId values", async () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-sessionid-"));

    try {
      const runtime = createRuntime({ config: testConfig(dir) });

      await expect(runtime.run({ sessionId: "../../tmp/x", input: "hello" })).rejects.toMatchObject({
        code: "CONFIG_ERROR"
      });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("passes compiled context content to provider input", async () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-context-"));

    try {
      const runtime = createRuntime({ config: testConfig(dir) });
      const result = await runtime.run({ sessionId: "s1", input: "hello" });
      expect(result.output).toBe("Echo: user: hello");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("migrates legacy session records to include schemaVersion on write", async () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-session-migrate-"));
    try {
      mkdirSync(join(dir, ".athena", "transcripts"), { recursive: true });
      mkdirSync(join(dir, ".athena", "sessions"), { recursive: true });
      writeFileSync(
        join(dir, ".athena", "sessions", "s1.json"),
        JSON.stringify(
          {
            id: "s1",
            transcriptPath: join(dir, ".athena", "transcripts", "s1.jsonl"),
            createdAt: "2026-02-16T00:00:00.000Z",
            updatedAt: "2026-02-16T00:00:00.000Z"
          },
          null,
          2
        ),
        "utf8"
      );

      const runtime = createRuntime({ config: testConfig(dir) });
      await runtime.run({ sessionId: "s1", input: "hello" });

      const session = JSON.parse(readFileSync(join(dir, ".athena", "sessions", "s1.json"), "utf8")) as {
        schemaVersion?: number;
      };
      expect(session.schemaVersion).toBe(1);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("repairs orphaned tool results from prior history before provider input assembly", async () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-history-repair-"));

    try {
      mkdirSync(join(dir, ".athena", "transcripts"), { recursive: true });
      mkdirSync(join(dir, ".athena", "sessions"), { recursive: true });
      writeFileSync(
        join(dir, ".athena", "transcripts", "s1.jsonl"),
        [
          JSON.stringify({
            id: "u1",
            role: "user",
            content: "hello",
            createdAt: "2026-02-16T00:00:00.000Z"
          }),
          JSON.stringify({
            id: "t-orphan",
            role: "tool",
            kind: "tool-result",
            toolCallId: "missing",
            content: "should be dropped",
            createdAt: "2026-02-16T00:00:01.000Z"
          })
        ].join("\n") + "\n",
        "utf8"
      );
      writeFileSync(
        join(dir, ".athena", "sessions", "s1.json"),
        JSON.stringify({
          id: "s1",
          transcriptPath: join(dir, ".athena", "transcripts", "s1.jsonl"),
          createdAt: "2026-02-16T00:00:00.000Z",
          updatedAt: "2026-02-16T00:00:00.000Z"
        }),
        "utf8"
      );

      const runtime = createRuntime({ config: testConfig(dir) });
      const result = await runtime.run({ sessionId: "s1", input: "next" });
      expect(result.output).toBe("Echo: user: hello\n\nuser: next");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("injects bounded memory snippets into context when memory is enabled", async () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-memory-inject-"));

    try {
      mkdirSync(join(dir, "memory"), { recursive: true });
      writeFileSync(
        join(dir, "MEMORY.md"),
        "Athena stores durable decisions in memory files.\nUse memory_search before answering.\n",
        "utf8"
      );

      const runtime = createRuntime({
        config: {
          ...testConfig(dir),
          memory: {
            enabled: true,
            includeTranscripts: false,
            maxResults: 4,
            maxSnippetChars: 160,
            maxInjectedChars: 200
          }
        }
      });
      const result = await runtime.run({ sessionId: "s1", input: "memory_search" });
      expect(result.output).toContain("system: Memory recall snippets");
      expect(result.output).toContain("[Memory: MEMORY.md#L");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("supports async runtime.attachEvidence dispatch without blocking run completion", async () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-evidence-async-"));

    try {
      const providers = new ProviderRegistry();
      const runtime = createRuntime({
        config: testConfig(dir),
        providers
      });
      providers.register({
        id: "mock",
        async generate(request) {
          runtime.attachEvidence("stdout", "hello evidence", "text");
          runtime.attachEvidence("structured", { ok: true, step: "generate" }, "json");
          runtime.attachEvidence("artifact", new Uint8Array([1, 2, 3]), "binary");
          return {
            sessionId: request.sessionId,
            output: "ok",
            provider: "mock",
            model: request.model ?? "mock-model",
            createdAt: new Date().toISOString()
          };
        }
      });
      let completions = 0;
      const result = await runtime.run(
        {
          sessionId: "s1",
          input: "hello"
        },
        {
          onAttachEvidence: async () => {
            await delay(75);
            completions += 1;
          }
        }
      );
      expect(result.output).toBe("ok");
      expect(result.evidenceCount).toBe(3);
      expect(completions).toBe(0);
      await delay(150);
      expect(completions).toBe(3);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("rejects runtime.attachEvidence calls outside an active run scope", () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-evidence-scope-"));
    try {
      const runtime = createRuntime({ config: testConfig(dir) });
      try {
        runtime.attachEvidence("oops", "no run", "text");
        throw new Error("expected runtime.attachEvidence to throw outside an active run.");
      } catch (error) {
        expect(error).toMatchObject({ code: "CONFIG_ERROR" });
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
