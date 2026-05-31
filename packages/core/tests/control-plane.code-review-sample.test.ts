import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import { createApiServer } from "../src/api/server.js";
import { loadConfig } from "../src/shared/config.js";

const repoRoot = resolve(fileURLToPath(new URL("../../..", import.meta.url)));

describe("code review sample plugin", () => {
  beforeAll(() => {
    execFileSync("npm", ["--workspace", "@athena/pdk", "run", "build"], {
      cwd: repoRoot,
      stdio: "pipe"
    });
  });

  it("indexes and runs the read-only code review agent", async () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-code-review-"));
    const samplePluginsPath = resolve(repoRoot, "sample-plugins");
    const targetRepo = join(dir, "target-repo");
    mkdirSync(join(targetRepo, "src"), { recursive: true });
    execFileSync("git", ["init", "-b", "main"], { cwd: targetRepo, stdio: "pipe" });
    execFileSync("git", ["config", "user.email", "test@example.com"], { cwd: targetRepo, stdio: "pipe" });
    execFileSync("git", ["config", "user.name", "Test User"], { cwd: targetRepo, stdio: "pipe" });
    writeFileSync(join(targetRepo, "README.md"), "# Target Repo\n", "utf8");
    writeFileSync(join(targetRepo, "package.json"), '{"name":"target-repo","version":"0.1.0"}\n', "utf8");
    writeFileSync(join(targetRepo, "package-lock.json"), '{"name":"target-repo","lockfileVersion":3}\n', "utf8");
    writeFileSync(join(targetRepo, "src", "index.ts"), "export const value = 1;\n", "utf8");
    execFileSync("git", ["add", "."], { cwd: targetRepo, stdio: "pipe" });
    execFileSync("git", ["commit", "-m", "initial"], { cwd: targetRepo, stdio: "pipe" });
    execFileSync("git", ["checkout", "-b", "feature"], { cwd: targetRepo, stdio: "pipe" });
    writeFileSync(join(targetRepo, "package.json"), '{"name":"target-repo","version":"0.2.0"}\n', "utf8");
    writeFileSync(join(targetRepo, "src", "index.ts"), "export const value = 2;\nconsole.log(value);\n// TODO: add real handling\n", "utf8");
    execFileSync("git", ["add", "."], { cwd: targetRepo, stdio: "pipe" });
    execFileSync("git", ["commit", "-m", "feature"], { cwd: targetRepo, stdio: "pipe" });
    writeFileSync(join(dir, ".env"), `ATHENA_PLUGIN_PATHS=${samplePluginsPath}\n`, "utf8");

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
      rmSync(dir, { recursive: true, force: true });
      if (message.includes("EPERM")) {
        return;
      }
      throw error;
    }

    const base = `http://${bound.host}:${bound.port}`;
    try {
      const pluginEnvelope = await readJson<{
        data: {
          plugins: Array<{ id: string; status: string; enabled: boolean; agentCount: number }>;
        };
      }>(`${base}/api/v1/agent-catalog/plugins`);
      expect(pluginEnvelope.data.plugins).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: "team-orchestrator.samples.code-review",
            status: "loaded",
            enabled: true,
            agentCount: 1
          })
        ])
      );

      const agentEnvelope = await readJson<{
        data: {
          agents: Array<{ id: string; available: boolean; capabilities: string[] }>;
        };
      }>(`${base}/api/v1/agent-catalog/agents?capabilities=code.review`);
      expect(agentEnvelope.data.agents).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: "code.review.local",
            available: true,
            capabilities: expect.arrayContaining(["code.review", "repo.diff", "artifacts.produce"])
          })
        ])
      );

      const taskEnvelope = await readJson<{
        data: { id: string; status: string };
      }>(`${base}/api/v1/tasks`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          id: "task-code-review-sample",
          title: "Review target repo",
          status: "ready",
          capabilityRequirements: ["code.review"],
          assignedAgentId: "code.review.local",
          assignedAgentVersion: "0.1.0",
          inputs: {
            repo: {
              path: targetRepo
            },
            baseRef: "main",
            headRef: "feature",
            maxFiles: 50
          }
        })
      });
      expect(taskEnvelope.data).toMatchObject({
        id: "task-code-review-sample",
        status: "ready"
      });

      const runEnvelope = await readJson<{
        data: {
          id: string;
          status: string;
          output?: { summaryMarkdown?: string; findings?: Array<{ title: string; priority: string }> };
        };
      }>(`${base}/api/v1/tasks/task-code-review-sample/run`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}"
      });
      expect(runEnvelope.data.status).toBe("completed");
      expect(runEnvelope.data.output?.summaryMarkdown).toContain("# Code Review: target-repo");
      expect(runEnvelope.data.output?.summaryMarkdown).toContain("Package manifest changed without lockfile update");
      expect(runEnvelope.data.output?.findings).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ priority: "P2", title: "Package manifest changed without lockfile update" }),
          expect.objectContaining({ priority: "P2", title: "Source changes have no companion test updates" }),
          expect.objectContaining({ priority: "P3", title: "Debug logging added" })
        ])
      );

      const runDetail = await readJson<{
        data: {
          run: { status: string };
          artifacts: Array<{ label: string; kind: string; format: string; storageUri: string; metadata?: Record<string, unknown> }>;
        };
      }>(`${base}/api/v1/task-runs/${encodeURIComponent(runEnvelope.data.id)}`);
      expect(runDetail.data.run.status).toBe("completed");
      expect(runDetail.data.artifacts).toEqual([
        expect.objectContaining({
          label: "Code review: target-repo",
          kind: "primary",
          format: "markdown",
          storageUri: expect.stringContaining("memory://code-review/"),
          metadata: expect.objectContaining({
            repoPath: targetRepo,
            baseRef: "main",
            headRef: "feature",
            deterministic: true,
            readOnly: true
          })
        })
      ]);
    } finally {
      await server.stop();
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

async function readJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const body = await response.text();
  expect(response.status, body).toBe(200);
  return JSON.parse(body) as T;
}
