import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { createApiServer } from "../src/api/server.js";
import { runCli } from "../src/cli/index.js";
import { loadConfig } from "../src/shared/config.js";

describe("CLI memory commands", () => {
  it("runs memory search and get", async () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-cli-memory-"));

    try {
      mkdirSync(join(dir, "memory"), { recursive: true });
      writeFileSync(join(dir, ".env"), "ATHENA_MEMORY_ENABLED=true\n", "utf8");
      writeFileSync(join(dir, "MEMORY.md"), "athena context block\nsecond line\n", "utf8");
      writeFileSync(join(dir, "memory", "notes.md"), "line 1\nline 2\nline 3\n", "utf8");

      const searchOut = await runCli(["memory", "search", "--query", "athena"], { cwd: dir });
      const searchParsed = JSON.parse(searchOut) as { count: number; results: Array<{ sourcePath: string }> };
      expect(searchParsed.count).toBeGreaterThanOrEqual(1);
      expect(searchParsed.results.some((row) => row.sourcePath === "MEMORY.md")).toBe(true);

      const getOut = await runCli(
        ["memory", "get", "--path", "memory/notes.md", "--from", "2", "--lines", "2"],
        { cwd: dir }
      );
      const getParsed = JSON.parse(getOut) as { text: string };
      expect(getParsed.text).toBe("line 2\nline 3");

      const envRaw = readFileSync(join(dir, ".env"), "utf8");
      expect(envRaw).toContain("ATHENA_MEMORY_ENABLED=true");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("rejects invalid memory search numeric flags", async () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-cli-memory-invalid-"));
    try {
      mkdirSync(join(dir, "memory"), { recursive: true });
      writeFileSync(join(dir, ".env"), "ATHENA_MEMORY_ENABLED=true\n", "utf8");
      writeFileSync(join(dir, "MEMORY.md"), "athena context block\n", "utf8");

      await expect(runCli(["memory", "search", "--query", "athena", "--max-results", "0"], { cwd: dir })).rejects.toThrow(
        "Invalid --max-results '0'"
      );
      await expect(
        runCli(["memory", "search", "--query", "athena", "--min-score", "-1"], { cwd: dir })
      ).rejects.toThrow("Invalid --min-score '-1'");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("runs memory search/get through API transport", async () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-cli-memory-api-"));

    try {
      mkdirSync(join(dir, "memory"), { recursive: true });
      writeFileSync(join(dir, ".env"), "ATHENA_MEMORY_ENABLED=true\n", "utf8");
      writeFileSync(join(dir, "MEMORY.md"), "athena api memory\nsecond line\n", "utf8");
      writeFileSync(join(dir, "memory", "notes.md"), "line 1\nline 2\nline 3\n", "utf8");

      const config = loadConfig(dir);
      const server = createApiServer({
        config,
        host: "127.0.0.1",
        port: 0
      });
      let bound: { host: string; port: number };
      try {
        bound = await server.start();
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (message.includes("EPERM")) {
          return;
        }
        throw error;
      }

      try {
        const baseUrl = `http://${bound.host}:${bound.port}`;
        const searchOut = await runCli(
          ["memory", "search", "--query", "athena", "--transport", "api", "--api-base-url", baseUrl],
          { cwd: dir }
        );
        const searchParsed = JSON.parse(searchOut) as { count: number; results: Array<{ sourcePath: string }> };
        expect(searchParsed.count).toBeGreaterThanOrEqual(1);
        expect(searchParsed.results.some((row) => row.sourcePath === "MEMORY.md")).toBe(true);

        const getOut = await runCli(
          [
            "memory",
            "get",
            "--path",
            "memory/notes.md",
            "--from",
            "2",
            "--lines",
            "2",
            "--transport",
            "api",
            "--api-base-url",
            baseUrl
          ],
          { cwd: dir }
        );
        const getParsed = JSON.parse(getOut) as { text: string };
        expect(getParsed.text).toBe("line 2\nline 3");
      } finally {
        await server.stop();
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
