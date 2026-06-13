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
            inputs: {
              topic: { type: "string", required: true }
            },
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
          templates: Array<{
            id: string;
            available: boolean;
            plugin: { name: string };
            metadata: { goal?: string; inputs?: Record<string, unknown> };
          }>;
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
              metadata: {
                goal: "Expose templates to clients.",
                inputs: { topic: { type: "string", required: true } }
              }
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
          workflowDagRun: { id: string };
          mission: { id: string; taskOrder: string[] };
          tasks: Array<{ id: string; title: string; dependsOn: string[]; provenance?: { workflowTemplateId?: string } }>;
          inputValues: Record<string, unknown>;
        };
      };

      expect(envelope).toMatchObject({
        ok: true,
        data: {
          workflowDagRun: {
            id: "workflow-run-mission-api-template"
          },
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
      const statusResponse = await fetch(`${base}/api/v1/workflow-runs/${envelope.data.workflowDagRun.id}/status`);
      expect(statusResponse.status).toBe(200);
      await expect(statusResponse.json()).resolves.toMatchObject({
        ok: true,
        data: {
          run: {
            id: "workflow-run-mission-api-template",
            workflowTemplate: { id: "api.instantiate.workflow" }
          },
          nodes: [
            { id: "draft", ready: true, dependencies: [] },
            { id: "review", ready: false, dependencies: ["draft"] }
          ]
        }
      });
    } finally {
      await server.stop();
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("blocks workflow instantiation with structured preflight details", async () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-api-workflow-template-blocked-"));
    const config = loadConfig(dir);
    const appState = openAppStateDatabase(config);
    try {
      seedProviderBlockedTemplate(appState);
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
      const response = await fetch(`${base}/api/v1/workflow-templates/api.provider-blocked.workflow/instantiate`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ inputs: { topic: "providers" } })
      });
      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toMatchObject({
        ok: false,
        error: {
          details: {
            kind: "workflow-template-readiness",
            readiness: {
              status: "blocked",
              checks: expect.arrayContaining([
                expect.objectContaining({
                  id: "model-provider",
                  status: "blocked",
                  nextStep: "Configure a valid model provider before instantiating this workflow."
                })
              ])
            }
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

function seedProviderBlockedTemplate(appState: ReturnType<typeof openAppStateDatabase>): void {
  appState.plugins.upsert({
    id: "team-orchestrator.test.api-provider-blocked",
    version: "0.1.0",
    path: "/tmp/team-orchestrator-api-provider-blocked-plugin",
    sourceType: "local",
    status: "loaded",
    manifest: {
      schemaVersion: 1,
      plugin: {
        id: "team-orchestrator.test.api-provider-blocked",
        name: "API Provider Blocked Plugin",
        version: "0.1.0"
      }
    },
    validationErrors: []
  });
  appState.workflowTemplates.upsert({
    id: "api.provider-blocked.workflow",
    version: "0.1.0",
    pluginId: "team-orchestrator.test.api-provider-blocked",
    pluginVersion: "0.1.0",
    name: "API Provider Blocked Workflow",
    taskCount: 1,
    manifest: {
      schemaVersion: 1,
      workflow: {
        id: "api.provider-blocked.workflow",
        name: "API Provider Blocked Workflow",
        version: "0.1.0",
        goal: "Use a configured provider for {{topic}}.",
        providerRequirements: [
          {
            required: true,
            providerKind: "openai-compatible",
            providerId: "missing-provider",
            model: "gpt-test"
          }
        ],
        inputs: {
          topic: { required: true }
        },
        tasks: [{ id: "draft", title: "Draft {{topic}}" }]
      }
    },
    status: "loaded",
    validationErrors: []
  });
}
