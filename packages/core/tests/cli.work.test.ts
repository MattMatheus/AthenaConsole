import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { createApiServer } from "../src/api/server.js";
import { runCli } from "../src/cli/index.js";
import { loadConfig } from "../src/shared/config.js";

describe("CLI work commands", () => {
  it("enqueues, reports status, and drains queue", async () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-cli-work-"));

    try {
      const enqueue = await runCli(["work", "enqueue", "--session", "s1", "--input", "hello", "--mode", "followup"], {
        cwd: dir
      });
      const enqueueParsed = JSON.parse(enqueue) as { queuedItems: number; queueDepth: number };
      expect(enqueueParsed.queuedItems).toBe(1);
      expect(enqueueParsed.queueDepth).toBe(1);

      const status = await runCli(["work", "status", "--session", "s1"], { cwd: dir });
      const statusParsed = JSON.parse(status) as { queuedItems: number; queueDepth: number };
      expect(statusParsed.queuedItems).toBe(1);
      expect(statusParsed.queueDepth).toBe(1);

      const drain = await runCli(["work", "drain", "--session", "s1"], { cwd: dir });
      const drainParsed = JSON.parse(drain) as {
        status: string;
        drainedItems: number;
        queueDepthBefore: number;
        queueDepthAfter: number;
      };
      expect(drainParsed.status).toBe("ok");
      expect(drainParsed.drainedItems).toBe(1);
      expect(drainParsed.queueDepthBefore).toBe(1);
      expect(drainParsed.queueDepthAfter).toBe(0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("rejects invalid enqueue mode", async () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-cli-work-invalid-mode-"));

    try {
      await expect(
        runCli(["work", "enqueue", "--session", "s1", "--input", "hello", "--mode", "foo"], {
          cwd: dir
        })
      ).rejects.toThrow("Invalid --mode 'foo'");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("runs work commands through API transport", async () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-cli-work-api-"));
    try {
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
        const enqueue = await runCli(
          [
            "work",
            "enqueue",
            "--session",
            "s1",
            "--input",
            "hello api",
            "--mode",
            "followup",
            "--transport",
            "api",
            "--api-base-url",
            baseUrl
          ],
          { cwd: dir }
        );
        const enqueueParsed = JSON.parse(enqueue) as { queuedItems: number };
        expect(enqueueParsed.queuedItems).toBe(1);

        const status = await runCli(
          ["work", "status", "--session", "s1", "--transport", "api", "--api-base-url", baseUrl],
          { cwd: dir }
        );
        const statusParsed = JSON.parse(status) as { queuedItems: number };
        expect(statusParsed.queuedItems).toBe(1);

        const drain = await runCli(
          ["work", "drain", "--session", "s1", "--transport", "api", "--api-base-url", baseUrl],
          { cwd: dir }
        );
        const drainParsed = JSON.parse(drain) as { status: string; drainedItems: number };
        expect(drainParsed.status).toBe("ok");
        expect(drainParsed.drainedItems).toBe(1);
      } finally {
        await server.stop();
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
