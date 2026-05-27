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

  it("instantiates indexed workflow templates", async () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-api-workflow-template-instantiate-"));
    const config = loadConfig(dir);
    const appState = openAppStateDatabase(config);
    try {
      seedInstantiationTemplate(appState);
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
      const response = await fetch(`${base}/api/v1/workflow-templates/api.instantiate.workflow/instantiate`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          missionId: "mission-api-template",
          taskIdPrefix: "api-template",
          inputs: {
            topic: "schedules"
          }
        })
      });
      expect(response.status).toBe(200);
      const envelope = (await response.json()) as {
        ok: boolean;
        data: {
          mission: { id: string; taskOrder: string[] };
          tasks: Array<{ id: string; title: string; dependsOn: string[]; provenance?: { workflowTemplateId?: string } }>;
          inputValues: Record<string, unknown>;
        };
      };

      expect(envelope).toMatchObject({
        ok: true,
        data: {
          mission: {
            id: "mission-api-template",
            taskOrder: ["api-template-draft", "api-template-review"]
          },
          tasks: [
            {
              id: "api-template-draft",
              title: "Draft schedules",
              dependsOn: [],
              provenance: { workflowTemplateId: "api.instantiate.workflow" }
            },
            {
              id: "api-template-review",
              dependsOn: ["api-template-draft"]
            }
          ],
          inputValues: {
            topic: "schedules"
          }
        }
      });
    } finally {
      await server.stop();
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

function seedInstantiationTemplate(appState: ReturnType<typeof openAppStateDatabase>): void {
  appState.plugins.upsert({
    id: "team-orchestrator.test.api-instantiate",
    version: "0.1.0",
    path: "/tmp/team-orchestrator-api-instantiate-plugin",
    sourceType: "local",
    status: "loaded",
    manifest: {
      schemaVersion: 1,
      plugin: {
        id: "team-orchestrator.test.api-instantiate",
        name: "API Instantiate Plugin",
        version: "0.1.0"
      }
    },
    validationErrors: []
  });
  appState.workflowTemplates.upsert({
    id: "api.instantiate.workflow",
    version: "0.1.0",
    pluginId: "team-orchestrator.test.api-instantiate",
    pluginVersion: "0.1.0",
    name: "API Instantiate Workflow",
    taskCount: 2,
    manifest: {
      schemaVersion: 1,
      workflow: {
        id: "api.instantiate.workflow",
        name: "API Instantiate Workflow",
        version: "0.1.0",
        goal: "Draft and review {{topic}}.",
        inputs: {
          topic: { required: true }
        },
        tasks: [
          {
            id: "draft",
            title: "Draft {{topic}}"
          },
          {
            id: "review",
            title: "Review {{topic}}",
            dependsOn: ["draft"]
          }
        ]
      }
    },
    status: "loaded",
    validationErrors: []
  });
}
