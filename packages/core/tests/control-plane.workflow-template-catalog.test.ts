import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { openAppStateDatabase } from "../src/control-plane/app-state/index.js";
import { LocalWorkflowTemplateCatalogService } from "../src/control-plane/services/workflow-template-catalog.js";
import { loadConfig } from "../src/shared/config.js";

describe("workflow template catalog service", () => {
  it("lists available indexed workflow templates with plugin and template metadata", async () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-workflow-template-catalog-"));
    try {
      const config = loadConfig(dir);
      const appState = openAppStateDatabase(config);
      try {
        appState.plugins.upsert({
          id: "team-orchestrator.test.templates",
          version: "0.1.0",
          path: join(dir, "plugins", "templates"),
          sourceType: "local",
          status: "loaded",
          manifest: {
            schemaVersion: 1,
            plugin: {
              id: "team-orchestrator.test.templates",
              name: "Template Plugin",
              version: "0.1.0"
            }
          },
          validationErrors: []
        });
        appState.workflowTemplates.upsert({
          id: "templates.release.workflow",
          version: "0.1.0",
          pluginId: "team-orchestrator.test.templates",
          pluginVersion: "0.1.0",
          name: "Release Workflow",
          description: "Prepare a release plan.",
          taskCount: 2,
          manifest: {
            schemaVersion: 1,
            workflow: {
              id: "templates.release.workflow",
              name: "Release Workflow",
              version: "0.1.0",
              goal: "Prepare a release plan.",
              context: { release: "next" },
              inputs: {
                releaseName: { type: "string", label: "Release Name", required: true },
                dryRun: { type: "boolean", default: true }
              },
              providerRequirements: [
                {
                  required: true,
                  providerId: "openai-main",
                  providerKind: "openai-compatible",
                  model: "gpt-4.1-mini"
                }
              ],
              tasks: [
                { id: "plan", title: "Plan", capabilityRequirements: ["test.run"] },
                { id: "review", title: "Review", dependsOn: ["plan"] }
              ],
              ui: { icon: "list-checks" }
            }
          },
          status: "loaded",
          validationErrors: []
        });

        const service = new LocalWorkflowTemplateCatalogService(config, { appState });
        const result = await service.list();

        expect(result.total).toBe(1);
        expect(result.templates[0]).toMatchObject({
          id: "templates.release.workflow",
          version: "0.1.0",
          name: "Release Workflow",
          available: true,
          providerReadiness: {
            status: "missing",
            required: true,
            providerId: "openai-main"
          },
          taskCount: 2,
          plugin: {
            id: "team-orchestrator.test.templates",
            name: "Template Plugin",
            enabled: true,
            status: "loaded"
          },
          metadata: {
            goal: "Prepare a release plan.",
            context: { release: "next" },
            inputs: {
              releaseName: { type: "string", label: "Release Name", required: true },
              dryRun: { type: "boolean", default: true }
            },
            providerRequirements: [
              {
                required: true,
                providerId: "openai-main",
                providerKind: "openai-compatible",
                model: "gpt-4.1-mini"
              }
            ],
            ui: { icon: "list-checks" }
          },
          validationErrors: []
        });
        expect(result.templates[0]?.metadata.tasks).toHaveLength(2);
      } finally {
        appState.close();
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("reports configured workflow provider readiness without exposing secret references", async () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-workflow-template-provider-"));
    try {
      const config = loadConfig(dir);
      const appState = openAppStateDatabase(config);
      try {
        appState.plugins.upsert({
          id: "team-orchestrator.test.templates",
          version: "0.1.0",
          path: join(dir, "plugins", "templates"),
          sourceType: "local",
          status: "loaded",
          manifest: {
            schemaVersion: 1,
            plugin: {
              id: "team-orchestrator.test.templates",
              name: "Template Plugin",
              version: "0.1.0"
            }
          },
          validationErrors: []
        });
        appState.modelProviderConfigs.create({
          id: "openai-main",
          name: "OpenAI Main",
          providerKind: "openai-compatible",
          baseUrl: "https://api.openai.com/v1",
          defaultModel: "gpt-4.1-mini",
          secretRef: {
            kind: "env",
            name: "OPENAI_API_KEY"
          },
          status: "configured"
        });
        appState.workflowTemplates.upsert({
          id: "templates.provider.workflow",
          version: "0.1.0",
          pluginId: "team-orchestrator.test.templates",
          pluginVersion: "0.1.0",
          name: "Provider Workflow",
          taskCount: 1,
          manifest: {
            schemaVersion: 1,
            workflow: {
              id: "templates.provider.workflow",
              name: "Provider Workflow",
              version: "0.1.0",
              goal: "Use a model-backed provider.",
              providerRequirements: [{ required: true, providerId: "openai-main", model: "gpt-4.1-mini" }],
              tasks: [{ id: "plan", title: "Plan" }]
            }
          },
          status: "loaded"
        });

        const service = new LocalWorkflowTemplateCatalogService(config, { appState });
        const result = await service.list();

        expect(result.templates[0]?.providerReadiness).toMatchObject({
          status: "configured",
          providerName: "OpenAI Main"
        });
        expect(JSON.stringify(result)).not.toContain("OPENAI_API_KEY");
      } finally {
        appState.close();
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("filters unavailable templates unless requested", async () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-workflow-template-catalog-unavailable-"));
    try {
      const config = loadConfig(dir);
      const appState = openAppStateDatabase(config);
      try {
        appState.plugins.upsert({
          id: "team-orchestrator.test.disabled",
          version: "0.1.0",
          path: join(dir, "plugins", "disabled"),
          sourceType: "local",
          status: "loaded",
          manifest: {
            schemaVersion: 1,
            plugin: {
              id: "team-orchestrator.test.disabled",
              name: "Disabled Plugin",
              version: "0.1.0"
            }
          },
          validationErrors: []
        });
        appState.plugins.setEnabled("team-orchestrator.test.disabled", "0.1.0", false);
        appState.workflowTemplates.upsert({
          id: "disabled.workflow",
          version: "0.1.0",
          pluginId: "team-orchestrator.test.disabled",
          pluginVersion: "0.1.0",
          name: "Disabled Workflow",
          manifest: {
            schemaVersion: 1,
            workflow: {
              id: "disabled.workflow",
              name: "Disabled Workflow",
              version: "0.1.0",
              goal: "Stay hidden until requested.",
              tasks: [{ id: "plan", title: "Plan" }]
            }
          },
          status: "loaded"
        });

        const service = new LocalWorkflowTemplateCatalogService(config, { appState });

        await expect(service.list()).resolves.toMatchObject({ total: 0, templates: [] });
        await expect(service.list({ pluginId: "team-orchestrator.test.disabled", includeUnavailable: true })).resolves.toMatchObject({
          total: 1,
          templates: [expect.objectContaining({ id: "disabled.workflow", available: false })],
          filters: {
            pluginId: "team-orchestrator.test.disabled",
            includeUnavailable: true
          }
        });
      } finally {
        appState.close();
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
