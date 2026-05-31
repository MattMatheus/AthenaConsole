import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import { createApiServer } from "../src/api/server.js";
import { loadConfig } from "../src/shared/config.js";

const repoRoot = resolve(fileURLToPath(new URL("../../..", import.meta.url)));

describe("repo summary sample plugin", () => {
  beforeAll(() => {
    execFileSync("npm", ["--workspace", "@athena/pdk", "run", "build"], {
      cwd: repoRoot,
      stdio: "pipe"
    });
  });

  it("indexes and runs the read-only repo summary agent", async () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-repo-summary-"));
    const samplePluginsPath = resolve(repoRoot, "sample-plugins");
    const targetRepo = join(dir, "target-repo");
    mkdirSync(join(targetRepo, "src"), { recursive: true });
    writeFileSync(join(targetRepo, "README.md"), "# Target Repo\n\nA small repo for deterministic summary testing.\n", "utf8");
    writeFileSync(join(targetRepo, "package.json"), '{"name":"target-repo","version":"0.1.0"}\n', "utf8");
    writeFileSync(join(targetRepo, "src", "index.ts"), "export const value = 1;\n", "utf8");
    execFileSync("git", ["init"], { cwd: targetRepo, stdio: "pipe" });
    execFileSync("git", ["config", "user.email", "test@example.com"], { cwd: targetRepo, stdio: "pipe" });
    execFileSync("git", ["config", "user.name", "Test User"], { cwd: targetRepo, stdio: "pipe" });
    execFileSync("git", ["add", "."], { cwd: targetRepo, stdio: "pipe" });
    execFileSync("git", ["commit", "-m", "Initial commit"], { cwd: targetRepo, stdio: "pipe" });
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
            id: "team-orchestrator.samples.repo-summary",
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
      }>(`${base}/api/v1/agent-catalog/agents?capabilities=repo.summarize`);
      expect(agentEnvelope.data.agents).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: "repo.summary.local",
            available: true,
            capabilities: expect.arrayContaining(["repo.inspect", "repo.summarize", "artifacts.produce"])
          })
        ])
      );

      const repositoryEnvelope = await readJson<{
        data: {
          id: string;
          name: string;
          workspacePath: string;
          status: string;
          dirtyState: string;
        };
      }>(`${base}/api/v1/repositories`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          id: "target-repo",
          name: "Target Repo",
          sourceType: "existing-path",
          workspacePath: targetRepo
        })
      });
      expect(repositoryEnvelope.data).toMatchObject({
        id: "target-repo",
        workspacePath: targetRepo,
        status: "ready"
      });

      const taskEnvelope = await readJson<{
        data: { id: string; status: string };
      }>(`${base}/api/v1/tasks`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          id: "task-repo-summary-sample",
          title: "Summarize target repo",
          status: "ready",
          capabilityRequirements: ["repo.summarize"],
          assignedAgentId: "repo.summary.local",
          assignedAgentVersion: "0.1.0",
          inputs: {
            repo: {
              id: "target-repo",
              name: repositoryEnvelope.data.name,
              sourceType: "existing-path",
              workspacePath: repositoryEnvelope.data.workspacePath,
              status: repositoryEnvelope.data.status,
              dirtyState: repositoryEnvelope.data.dirtyState
            },
            repoPath: targetRepo,
            maxFiles: 50
          }
        })
      });
      expect(taskEnvelope.data).toMatchObject({
        id: "task-repo-summary-sample",
        status: "ready"
      });

      const runEnvelope = await readJson<{
        data: { id: string; status: string; output?: { summaryMarkdown?: string; topLanguages?: Array<{ language: string }> } };
      }>(`${base}/api/v1/tasks/task-repo-summary-sample/run`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}"
      });
      expect(runEnvelope.data.status).toBe("completed");
      expect(runEnvelope.data.output?.summaryMarkdown).toContain("# Repo Summary: target-repo");
      expect(runEnvelope.data.output?.summaryMarkdown).toContain("README Excerpt");
      expect(runEnvelope.data.output?.topLanguages).toEqual(expect.arrayContaining([expect.objectContaining({ language: "ts" })]));

      const runDetail = await readJson<{
        data: {
          run: { status: string };
          artifacts: Array<{ label: string; kind: string; format: string; storageUri: string; metadata?: Record<string, unknown> }>;
        };
      }>(`${base}/api/v1/task-runs/${encodeURIComponent(runEnvelope.data.id)}`);
      expect(runDetail.data.run.status).toBe("completed");
      expect(runDetail.data.artifacts).toEqual([
        expect.objectContaining({
          label: "Repo summary: target-repo",
          kind: "primary",
          format: "markdown",
          storageUri: expect.stringContaining("memory://repo-summary/"),
          metadata: expect.objectContaining({
            repoPath: targetRepo,
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
