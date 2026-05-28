import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { createApiServer } from "../src/api/server.js";
import { loadConfig } from "../src/shared/config.js";

describe("first-run demo plugin workflow", () => {
  it("indexes, instantiates, executes, and exposes inspectable demo evidence", async () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-first-run-demo-"));
    const samplePluginsPath = resolve(fileURLToPath(new URL("../../../sample-plugins", import.meta.url)));
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
        ok: boolean;
        data: {
          plugins: Array<{ id: string; status: string; enabled: boolean; agentCount: number }>;
        };
      }>(`${base}/api/v1/agent-catalog/plugins`);
      expect(pluginEnvelope.data.plugins).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: "team-orchestrator.samples.first-run",
            status: "loaded",
            enabled: true,
            agentCount: 1
          })
        ])
      );

      const templateEnvelope = await readJson<{
        ok: boolean;
        data: {
          templates: Array<{ id: string; available: boolean; taskCount: number }>;
        };
      }>(`${base}/api/v1/workflow-templates?pluginId=${encodeURIComponent("team-orchestrator.samples.first-run")}`);
      expect(templateEnvelope.data.templates).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: "first-run.demo.workflow",
            available: true,
            taskCount: 2
          })
        ])
      );

      const instantiationEnvelope = await readJson<{
        ok: boolean;
        data: {
          workflowDagRun: { id: string };
        };
      }>(`${base}/api/v1/workflow-templates/first-run.demo.workflow/instantiate`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          missionId: "mission-first-run-demo-test",
          taskIdPrefix: "first-run-demo-test",
          inputs: {
            demoName: "Docs Demo"
          }
        })
      });
      expect(instantiationEnvelope.data.workflowDagRun.id).toBe("workflow-run-mission-first-run-demo-test");

      const executionEnvelope = await readJson<{
        ok: boolean;
        data: {
          runId: string;
          status: string;
          executedStepIds: string[];
        };
      }>(`${base}/api/v1/workflow-runs/workflow-run-mission-first-run-demo-test/execute`, {
        method: "POST"
      });
      expect(executionEnvelope.data).toMatchObject({
        runId: "workflow-run-mission-first-run-demo-test",
        status: "completed",
        executedStepIds: ["prepare", "verify"]
      });

      const statusEnvelope = await readJson<{
        ok: boolean;
        data: {
          run: { id: string; status: string };
          progress: { completedSteps: number; percentComplete: number };
          nodes: Array<{ id: string; status: string; output?: { taskRunId?: string; output?: { message?: string } } }>;
          events: Array<{ type: string; stepId?: string }>;
        };
      }>(`${base}/api/v1/workflow-runs/workflow-run-mission-first-run-demo-test/status`);

      expect(statusEnvelope.ok).toBe(true);
      expect(statusEnvelope.data.run.status).toBe("completed");
      expect(statusEnvelope.data.progress).toMatchObject({
        completedSteps: 2,
        percentComplete: 100
      });
      expect(statusEnvelope.data.nodes.map((node) => ({ id: node.id, status: node.status }))).toEqual([
        { id: "prepare", status: "completed" },
        { id: "verify", status: "completed" }
      ]);
      expect(statusEnvelope.data.nodes.find((node) => node.id === "prepare")?.output?.output).toMatchObject({
        message: "Docs Demo: prepare completed locally."
      });
      expect(statusEnvelope.data.events.map((event) => event.type)).toEqual(
        expect.arrayContaining(["workflow.created", "workflow.step.completed"])
      );

      const prepareTaskRunId = statusEnvelope.data.nodes.find((node) => node.id === "prepare")?.output?.taskRunId;
      expect(prepareTaskRunId).toEqual(expect.any(String));
      const taskRunEnvelope = await readJson<{
        ok: boolean;
        data: {
          run: { id: string; status: string };
          events: Array<{ type: string; message: string }>;
          artifacts: Array<{ label: string; kind: string; format: string; storageUri: string; metadata?: Record<string, unknown> }>;
        };
      }>(`${base}/api/v1/task-runs/${encodeURIComponent(prepareTaskRunId ?? "")}`);

      expect(taskRunEnvelope.ok).toBe(true);
      expect(taskRunEnvelope.data.run.status).toBe("completed");
      expect(taskRunEnvelope.data.events.map((event) => event.type)).toEqual(
        expect.arrayContaining(["run.started", "artifact.created", "run.completed"])
      );
      expect(taskRunEnvelope.data.artifacts).toEqual([
        expect.objectContaining({
          label: "First-run demo evidence: prepare",
          kind: "supporting",
          format: "json",
          storageUri: expect.stringContaining("memory://first-run-demo/"),
          metadata: expect.objectContaining({
            demoName: "Docs Demo",
            stepId: "prepare",
            deterministic: true
          })
        })
      ]);
      expect(JSON.stringify(taskRunEnvelope.data)).not.toContain("apiKey");
      expect(JSON.stringify(taskRunEnvelope.data)).not.toContain("OPENAI_API_KEY");
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
