import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { createLocalControlPlaneServices } from "../src/control-plane/services.js";
import { loadConfig } from "../src/shared/config.js";

function git(cwd: string, args: string[]): string {
  return execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
}

function writePersona(dir: string): void {
  mkdirSync(join(dir, "specialists", "code-review"), { recursive: true });
  writeFileSync(
    join(dir, "specialists", "code-review", "manifest.json"),
    JSON.stringify(
      {
        schemaVersion: 1,
        id: "code-review",
        git: { baseRefDefault: "main", requireCleanWorktree: true, baseRefAutodetect: true },
        output: { stdoutDefault: "summary" }
      },
      null,
      2
    ),
    "utf8"
  );
}

describe("persona audit artifacts and telemetry", () => {
  it("persists audit artifacts with usage/findings/runtime/context metadata and records lifecycle events", async () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-persona-audit-"));
    try {
      writePersona(dir);
      git(dir, ["init", "-b", "main"]);
      git(dir, ["config", "user.email", "athena@example.com"]);
      git(dir, ["config", "user.name", "Athena"]);
      writeFileSync(join(dir, ".gitignore"), ".athena/\n", "utf8");
      writeFileSync(join(dir, "a.txt"), "hello\n", "utf8");
      git(dir, ["add", "."]);
      git(dir, ["commit", "-m", "init"]);
      git(dir, ["checkout", "-q", "-b", "feature"]);
      writeFileSync(join(dir, "a.txt"), "hello world\n", "utf8");
      git(dir, ["add", "."]);
      git(dir, ["commit", "-m", "change"]);

      const services = createLocalControlPlaneServices({ config: loadConfig(dir) });
      const request = {
        name: "code-review",
        repoPath: ".",
        headRef: "feature",
        sessionId: "persona-audit-session",
        stdout: "json" as const
      };

      const runA = await services.specialistService.run(request);
      const runB = await services.specialistService.run(request);
      expect(runA.result.runId).not.toBe(runB.result.runId);

      expect(existsSync(runA.result.artifacts.resultJsonPath)).toBe(true);
      expect(existsSync(runA.result.artifacts.reportMarkdownPath)).toBe(true);
      const persisted = JSON.parse(readFileSync(runA.result.artifacts.resultJsonPath, "utf8")) as {
        usage?: { totalTokens?: number };
        findings?: unknown[];
        runtimeResult?: { provider?: string; model?: string };
        contextMeta?: unknown;
        evidenceManifest?: Array<{ sha256: string; artifactPath: string }>;
      };
      const reportMarkdown = readFileSync(runA.result.artifacts.reportMarkdownPath, "utf8");
      const auditDirEntries = readdirSync(runA.result.artifacts.auditDir);

      expect(persisted.usage?.totalTokens).toBeGreaterThan(0);
      expect(Array.isArray(persisted.findings)).toBe(true);
      expect(persisted.runtimeResult?.provider).toBe("mock");
      expect(typeof persisted.runtimeResult?.model).toBe("string");
      expect(persisted.contextMeta).toBeDefined();
      expect(Array.isArray(persisted.evidenceManifest)).toBe(true);
      expect(persisted.evidenceManifest?.length).toBe(0);
      expect(reportMarkdown.trim().length).toBeGreaterThan(0);
      expect(auditDirEntries.some((entry) => entry.includes(".tmp"))).toBe(false);

      const events = await services.eventService.list({
        sessionId: "persona-audit-session",
        types: ["specialist.run.started", "specialist.run.completed"],
        limit: 20
      });
      expect(events.events.filter((event) => event.type === "specialist.run.started")).toHaveLength(2);
      expect(events.events.filter((event) => event.type === "specialist.run.completed")).toHaveLength(2);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("records failed lifecycle events when persona run fails", async () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-persona-audit-failed-"));
    try {
      writePersona(dir);
      git(dir, ["init", "-b", "main"]);
      git(dir, ["config", "user.email", "athena@example.com"]);
      git(dir, ["config", "user.name", "Athena"]);
      writeFileSync(join(dir, "a.txt"), "hello\n", "utf8");
      git(dir, ["add", "."]);
      git(dir, ["commit", "-m", "init"]);
      git(dir, ["checkout", "-q", "-b", "feature"]);
      writeFileSync(join(dir, "a.txt"), "hello dirty\n", "utf8");
      // Leave dirty changes to trigger preflight failure.

      const services = createLocalControlPlaneServices({ config: loadConfig(dir) });
      await expect(
        services.specialistService.run({
          name: "code-review",
          repoPath: ".",
          headRef: "feature",
          sessionId: "persona-failed-session"
        })
      ).rejects.toThrow("uncommitted changes");

      const events = await services.eventService.list({
        sessionId: "persona-failed-session",
        types: ["specialist.run.started", "specialist.run.failed"],
        limit: 10
      });
      expect(events.events.some((event) => event.type === "specialist.run.started")).toBe(false);
      expect(events.events.some((event) => event.type === "specialist.run.failed")).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

});
