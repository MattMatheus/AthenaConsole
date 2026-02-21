import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { createApiServer } from "../src/api/server.js";
import { runCli } from "../src/cli/index.js";
import { loadConfig } from "../src/shared/config.js";

describe("CLI schedule commands", () => {
  it("adds, lists, runs, reads logs, and removes a schedule", async () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-cli-schedule-"));
    try {
      const addOut = await runCli(
        [
          "schedule",
          "add",
          "--id",
          "job1",
          "--session",
          "s1",
          "--input",
          "hello from schedule",
          "--every-minutes",
          "10",
          "--start-now",
          "true"
        ],
        { cwd: dir }
      );
      const added = JSON.parse(addOut) as { id: string; sessionId: string };
      expect(added.id).toBe("job1");
      expect(added.sessionId).toBe("s1");

      const listOut = await runCli(["schedule", "list"], { cwd: dir });
      const listed = JSON.parse(listOut) as { count: number };
      expect(listed.count).toBe(1);

      const runOut = await runCli(["schedule", "run", "--id", "job1"], { cwd: dir });
      const ran = JSON.parse(runOut) as { status: string; summary: { ok: number; failed: number; alreadyRunning: number } };
      expect(ran.status).toBe("ok");
      expect(ran.summary.ok).toBe(1);
      expect(ran.summary.failed).toBe(0);

      const logsOut = await runCli(["schedule", "logs", "--id", "job1", "--limit", "5"], { cwd: dir });
      const logs = JSON.parse(logsOut) as { count: number; logs: Array<{ status: string }> };
      expect(logs.count).toBeGreaterThan(0);
      expect(logs.logs.some((row) => row.status === "ok")).toBe(true);

      const removeOut = await runCli(["schedule", "remove", "--id", "job1"], { cwd: dir });
      const removed = JSON.parse(removeOut) as { removed: boolean };
      expect(removed.removed).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("rejects invalid --start-now values", async () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-cli-schedule-invalid-bool-"));
    try {
      await expect(
        runCli(
          [
            "schedule",
            "add",
            "--id",
            "job1",
            "--session",
            "s1",
            "--input",
            "hello from schedule",
            "--every-minutes",
            "10",
            "--start-now",
            "maybe"
          ],
          { cwd: dir }
        )
      ).rejects.toThrow("Invalid --start-now 'maybe'. Expected true|false.");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("runs schedule add/list/run/tick/logs/remove through API transport", async () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-cli-schedule-api-"));
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
        const addOut = await runCli(
          [
            "schedule",
            "add",
            "--id",
            "job-api",
            "--session",
            "s1",
            "--input",
            "hello from api schedule",
            "--every-minutes",
            "10",
            "--start-now",
            "false",
            "--transport",
            "api",
            "--api-base-url",
            baseUrl
          ],
          { cwd: dir }
        );
        const added = JSON.parse(addOut) as { id: string };
        expect(added.id).toBe("job-api");

        const listOut = await runCli(
          ["schedule", "list", "--transport", "api", "--api-base-url", baseUrl],
          { cwd: dir }
        );
        const listed = JSON.parse(listOut) as { count: number };
        expect(listed.count).toBe(1);

        const runOut = await runCli(
          ["schedule", "run", "--id", "job-api", "--transport", "api", "--api-base-url", baseUrl],
          { cwd: dir }
        );
        const ran = JSON.parse(runOut) as { status: string };
        expect(ran.status).toBe("ok");

        const tickOut = await runCli(
          ["schedule", "tick", "--transport", "api", "--api-base-url", baseUrl, "--at", new Date().toISOString()],
          { cwd: dir }
        );
        const tick = JSON.parse(tickOut) as { run: unknown[]; skipped: number };
        expect(Array.isArray(tick.run)).toBe(true);
        expect(typeof tick.skipped).toBe("number");

        const logsOut = await runCli(
          ["schedule", "logs", "--id", "job-api", "--limit", "5", "--transport", "api", "--api-base-url", baseUrl],
          { cwd: dir }
        );
        const logs = JSON.parse(logsOut) as { count: number };
        expect(logs.count).toBeGreaterThan(0);

        const removeOut = await runCli(
          ["schedule", "remove", "--id", "job-api", "--transport", "api", "--api-base-url", baseUrl],
          { cwd: dir }
        );
        const removed = JSON.parse(removeOut) as { removed: boolean };
        expect(removed.removed).toBe(true);
      } finally {
        await server.stop();
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("supports schedule run/tick/remove in API-only transport and reports remote errors", async () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-cli-schedule-api-unsupported-"));
    try {
      await expect(
        runCli(["schedule", "remove", "--id", "job1", "--transport", "api", "--api-base-url", "http://127.0.0.1:8787"], {
          cwd: dir
        })
      ).rejects.toThrow("API transport failed for DELETE /api/v1/schedules/job1");
      await expect(
        runCli(["schedule", "run", "--id", "job1", "--transport", "api", "--api-base-url", "http://127.0.0.1:8787"], {
          cwd: dir
        })
      ).rejects.toThrow("API transport failed for POST /api/v1/schedules/job1/run");
      await expect(
        runCli(["schedule", "tick", "--transport", "api", "--api-base-url", "http://127.0.0.1:8787"], { cwd: dir })
      ).rejects.toThrow("API transport failed for POST /api/v1/schedules/tick");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
