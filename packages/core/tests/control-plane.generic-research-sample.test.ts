import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import { createApiServer } from "../src/api/server.js";
import { loadConfig } from "../src/shared/config.js";

const repoRoot = resolve(fileURLToPath(new URL("../../..", import.meta.url)));

describe("generic research sample plugin", () => {
  beforeAll(() => {
    execFileSync("npm", ["--workspace", "@athena/pdk", "run", "build"], {
      cwd: repoRoot,
      stdio: "pipe"
    });
  });

  it("indexes and runs the article summarizer and shopping planner examples", async () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-generic-research-"));
    try {
      const articlePath = join(dir, "article.md");
      writeFileSync(
        articlePath,
        [
          "# Local Article",
          "",
          "Document input should work without a network request.",
          "The example reads only the supplied local file.",
          "Operators can replace this runner with model-backed logic later."
        ].join("\n"),
        "utf8"
      );
      const server = createApiServer({
        config: loadConfigWithSamplePlugins(dir),
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

      const base = `http://${bound.host}:${bound.port}`;
      try {
        const plugins = await readJson<{
          data: { plugins: Array<{ id: string; status: string; agentCount: number }> };
        }>(`${base}/api/v1/agent-catalog/plugins`);
        expect(plugins.data.plugins).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              id: "team-orchestrator.samples.generic-research",
              status: "loaded",
              agentCount: 2
            })
          ])
        );

        const summaryRun = await createAndRunTask(base, {
          id: "task-article-summary-sample",
          title: "Summarize article",
          status: "ready",
          capabilityRequirements: ["article.summarize"],
          assignedAgentId: "research.article.summarizer.local",
          assignedAgentVersion: "0.1.0",
          inputs: {
            article: {
              title: "Local-first operators",
              text: "Local-first operators need predictable tools. Deterministic examples help them learn safely. Provider-backed agents can come later."
            },
            maxBullets: 2
          }
        });
        expect(summaryRun.output?.summaryMarkdown).toContain("# Article Summary: Local-first operators");
        expect(summaryRun.artifacts).toEqual([
          expect.objectContaining({
            label: "Article summary: Local-first operators",
            format: "markdown",
            metadata: expect.objectContaining({
              deterministic: true,
              networkAccess: "denied"
            })
          })
        ]);

        const fileSummaryRun = await createAndRunTask(base, {
          id: "task-article-file-summary-sample",
          title: "Summarize local article",
          status: "ready",
          capabilityRequirements: ["article.summarize"],
          assignedAgentId: "research.article.summarizer.local",
          assignedAgentVersion: "0.1.0",
          inputs: {
            article: {
              path: articlePath
            },
            maxBullets: 2
          }
        });
        expect(fileSummaryRun.output?.summaryMarkdown).toContain("# Article Summary: article.md");
        expect(fileSummaryRun.output?.summaryMarkdown).toContain("Source: ");
        expect(fileSummaryRun.artifacts[0]).toEqual(
          expect.objectContaining({
            metadata: expect.objectContaining({
              title: "article.md",
              networkAccess: "denied"
            })
          })
        );

        const plannerRun = await createAndRunTask(base, {
          id: "task-shopping-plan-sample",
          title: "Plan chair research",
          status: "ready",
          capabilityRequirements: ["shopping.plan"],
          assignedAgentId: "research.shopping.planner.local",
          assignedAgentVersion: "0.1.0",
          inputs: {
            objective: "Find a comfortable office chair",
            constraints: {
              budget: "$300",
              mustHave: ["adjustable arms", "lumbar support"]
            },
            preferences: {
              style: "quiet and durable"
            },
            decisionDeadline: "this weekend"
          }
        });
        expect(plannerRun.output?.planMarkdown).toContain("# Research Plan: Find a comfortable office chair");
        expect(plannerRun.output?.planMarkdown).toContain("No purchasing or checkout flows.");
        expect(plannerRun.artifacts).toEqual([
          expect.objectContaining({
            label: "Research plan: Find a comfortable office chair",
            format: "markdown",
            metadata: expect.objectContaining({
              deterministic: true,
              purchasing: "out-of-scope"
            })
          })
        ]);
      } finally {
        await server.stop();
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

function loadConfigWithSamplePlugins(workspaceRoot: string) {
  const config = loadConfig(workspaceRoot);
  return {
    ...config,
    plugins: {
      ...(config.plugins ?? {}),
      searchPaths: [resolve(repoRoot, "sample-plugins")],
      systemPluginPaths: config.plugins?.systemPluginPaths ?? []
    }
  };
}

async function createAndRunTask(
  base: string,
  request: Record<string, unknown>
): Promise<{ output?: Record<string, unknown>; artifacts: Array<Record<string, unknown>> }> {
  await readJson(`${base}/api/v1/tasks`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(request)
  });
  const runEnvelope = await readJson<{ data: { id: string; status: string; output?: Record<string, unknown> } }>(
    `${base}/api/v1/tasks/${encodeURIComponent(String(request.id))}/run`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}"
    }
  );
  expect(runEnvelope.data.status).toBe("completed");
  const detail = await readJson<{ data: { artifacts: Array<Record<string, unknown>> } }>(
    `${base}/api/v1/task-runs/${encodeURIComponent(runEnvelope.data.id)}`
  );
  return {
    output: runEnvelope.data.output,
    artifacts: detail.data.artifacts
  };
}

async function readJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const body = await response.text();
  expect(response.status, body).toBe(200);
  return JSON.parse(body) as T;
}
