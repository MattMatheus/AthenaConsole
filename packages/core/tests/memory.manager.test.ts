import { existsSync, mkdtempSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { createFileMemoryManager, createMemoryManager } from "../src/memory/index.js";
import type { AthenaConfig } from "../src/shared/config.js";

function testConfig(workspaceRoot: string, memoryEnabled = true): AthenaConfig {
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
    memory: {
      enabled: memoryEnabled,
      includeTranscripts: false,
      maxResults: 6,
      maxSnippetChars: 200,
      maxInjectedChars: 800
    }
  };
}

function testConfigWithTranscripts(workspaceRoot: string): AthenaConfig {
  return {
    ...testConfig(workspaceRoot, true),
    memory: {
      enabled: true,
      includeTranscripts: true,
      maxResults: 6,
      maxSnippetChars: 200,
      maxInjectedChars: 800
    }
  };
}

describe("file memory manager", () => {
  it("searches MEMORY.md and memory/**/*.md and returns citations", async () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-memory-search-"));
    try {
      mkdirSync(join(dir, "memory"), { recursive: true });
      writeFileSync(join(dir, "MEMORY.md"), "Athena project note\nDecisions are here\n", "utf8");
      writeFileSync(join(dir, "memory", "2026-02-16.md"), "todo: review athena queue\n", "utf8");

      const manager = createFileMemoryManager(testConfig(dir));
      const results = await manager.search("athena");

      expect(results.length).toBe(2);
      expect(results[0]?.citation).toMatch(/#L\d+/);
      expect(results.map((r) => r.sourcePath).sort()).toEqual(["MEMORY.md", "memory/2026-02-16.md"]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("reads bounded line ranges via get", async () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-memory-get-"));
    try {
      mkdirSync(join(dir, "memory"), { recursive: true });
      writeFileSync(join(dir, "memory", "notes.md"), "l1\nl2\nl3\nl4\n", "utf8");

      const manager = createFileMemoryManager(testConfig(dir));
      const result = await manager.get({
        path: "memory/notes.md",
        from: 2,
        lines: 2
      });

      expect(result.path).toBe("memory/notes.md");
      expect(result.text).toBe("l2\nl3");
      expect(result.lineStart).toBe(2);
      expect(result.lineEnd).toBe(3);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("rejects path traversal in memory_get", async () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-memory-guard-"));
    try {
      mkdirSync(join(dir, "memory"), { recursive: true });
      writeFileSync(join(dir, "memory", "notes.md"), "safe\n", "utf8");
      const manager = createFileMemoryManager(testConfig(dir));

      await expect(manager.get({ path: "../secrets.md" })).rejects.toMatchObject({
        code: "CONFIG_ERROR"
      });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("optionally indexes transcripts for search", async () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-memory-transcripts-"));
    try {
      mkdirSync(join(dir, ".athena", "transcripts"), { recursive: true });
      writeFileSync(
        join(dir, ".athena", "transcripts", "s1.jsonl"),
        JSON.stringify({
          id: "u1",
          role: "user",
          content: "remember transcript-only marker",
          createdAt: "2026-02-16T00:00:00.000Z"
        }) + "\n",
        "utf8"
      );

      const manager = createFileMemoryManager(testConfigWithTranscripts(dir));
      const results = await manager.search("transcript-only marker");
      expect(results.some((row) => row.sourcePath.endsWith(".athena/transcripts/s1.jsonl"))).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("does not initialize sqlite artifacts when memory is disabled", async () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-memory-disabled-"));
    try {
      const manager = createMemoryManager(testConfig(dir, false));
      const searchResults = await manager.search("anything");
      expect(searchResults).toEqual([]);

      await expect(manager.get({ path: "MEMORY.md" })).rejects.toMatchObject({
        code: "CONFIG_ERROR"
      });

      expect(existsSync(join(dir, ".athena", "memory"))).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("rejects absolute sqlite path outside workspace", async () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-memory-sqlite-path-"));
    try {
      mkdirSync(join(dir, "memory"), { recursive: true });
      writeFileSync(join(dir, "memory", "notes.md"), "athena\n", "utf8");

      const manager = createFileMemoryManager({
        ...testConfig(dir, true),
        memory: {
          enabled: true,
          includeTranscripts: false,
          maxResults: 6,
          maxSnippetChars: 200,
          maxInjectedChars: 800,
          sqlitePath: "/tmp/outside-athena.sqlite"
        }
      });

      await expect(manager.search("athena")).rejects.toMatchObject({
        code: "CONFIG_ERROR"
      });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
