import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createApiServer } from "../src/api/server.js";
import { openAppStateDatabase } from "../src/control-plane/app-state/index.js";
import { loadConfig } from "../src/shared/config.js";

describe("workflow template catalog api", () => {
  it("lists indexed workflow templates", async () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-api-workflow-template-catalog-"));
    const config = loadConfig(dir);
    const appState = openAppStateDatabase(config);
    try {
      appState.plugins.upsert({
        id: "team-orchestrator.test.api-templates",
        version: "0.1.0",
        path: join(dir, "plugins", "api-templates"),
        sourceType: "local",
        status: "loaded",
        manifest: {
          schemaVersion: 1,
          plugin: {
            id: "team-orchestrator.test.api-templates",
            name: "API Template Plugin",
            version: "0.1.0"
          }
        },
        validationErrors: []
      });
      appState.workflowTemplates.upsert({
        id: "api.template.workflow",
        version: "0.1.0",
        pluginId: "team-orchestrator.test.api-templates",
        pluginVersion: "0.1.0",
        name: "API Template Workflow",
        description: "Listed through the API.",
        taskCount: 1,
        manifest: {
          schemaVersion: 1,
          workflow: {
            id: "api.template.workflow",
            name: "API Template Workflow",
            version: "0.1.0",
            goal: "Expose templates to clients.",
            tasks: [{ id: "plan", title: "Plan" }]
          }
        },
        status: "loaded",
        validationErrors: []
      });
    } finally {
      appState.close();
    }

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
      const response = await fetch(
        `${base}/api/v1/workflow-templates?pluginId=${encodeURIComponent("team-orchestrator.test.api-templates")}`
      );
      expect(response.status).toBe(200);
      const envelope = (await response.json()) as {
        ok: boolean;
        data: {
          total: number;
          templates: Array<{ id: string; available: boolean; plugin: { name: string }; metadata: { goal?: string } }>;
          filters: { pluginId?: string };
        };
      };

      expect(envelope).toMatchObject({
        ok: true,
        data: {
          total: 1,
          templates: [
            {
              id: "api.template.workflow",
              available: true,
              plugin: { name: "API Template Plugin" },
              metadata: { goal: "Expose templates to clients." }
            }
          ],
          filters: {
            pluginId: "team-orchestrator.test.api-templates"
          }
        }
      });
    } finally {
      await server.stop();
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
