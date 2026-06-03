import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { openAppStateDatabase } from "../src/control-plane/app-state/index.js";
import { LocalAgentCatalogService } from "../src/control-plane/services/agent-catalog.js";
import { loadConfig } from "../src/shared/config.js";

describe("agent catalog service", () => {
  it("lists plugin and agent catalog metadata from SQLite app state", async () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-agent-catalog-"));
    try {
      const config = loadConfig(dir);
      const appState = openAppStateDatabase(config);
      try {
        seedCatalog(appState);
        const service = new LocalAgentCatalogService(config, { appState });

        const plugins = await service.listPlugins();
        expect(plugins.total).toBe(2);
        expect(plugins.plugins[0]).toMatchObject({
          id: "team-orchestrator.test.invalid",
          status: "invalid",
          sourceType: "system",
          sourceScope: "system",
          metadata: {
            name: "Invalid Test Plugin"
          },
          agentCount: 0
        });
        expect(plugins.plugins[0]?.validationErrors).toEqual([
          expect.objectContaining({
            resourceType: "agent",
            path: "$.agent.capabilities",
            message: "must NOT have fewer than 1 items"
          })
        ]);
        expect(plugins.plugins[1]).toMatchObject({
          id: "team-orchestrator.test.software",
          enabled: true,
          status: "loaded",
          sourceType: "local",
          sourceScope: "workspace",
          metadata: {
            name: "Software Plugin",
            description: "Developer workflow agents.",
            pack: {
              category: "software-team",
              maturity: "preview",
              safety: {
                posture: "review-required",
                externalWrites: false
              }
            }
          },
          agentCount: 2
        });
        expect(plugins.plugins[1]?.metadata.connectorReadiness).toMatchObject({
          status: "missing-credentials",
          serviceId: "fixture.service",
          credentialState: "missing",
          requiredScopes: ["fixture:read"]
        });

        const agents = await service.listAgents();
        expect(agents.total).toBe(2);
        expect(agents.agents[0]).toMatchObject({
          id: "software.fix.local",
          name: "Software Fixer",
          capabilities: ["code.modify", "text.summarize"],
          available: true,
          providerReadiness: {
            status: "missing",
            required: true,
            providerId: "openai-main",
            model: "gpt-4.1-mini"
          },
          plugin: {
            id: "team-orchestrator.test.software",
            name: "Software Plugin",
            sourceType: "local",
            sourceScope: "workspace",
            pack: {
              category: "software-team",
              maturity: "preview"
            }
          },
          metadata: {
            implementation: {
              type: "local-command",
              command: "npm"
            },
            observability: {
              mode: "inspectable"
            },
            limits: {
              maxRuntimeSeconds: 600,
              maxToolCalls: 40
            }
          },
          validationErrors: []
        });
        expect(agents.agents[1]?.providerReadiness.status).toBe("untested");
      } finally {
        appState.close();
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("filters agents by all requested capabilities", async () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-agent-catalog-filter-"));
    try {
      const config = loadConfig(dir);
      const appState = openAppStateDatabase(config);
      try {
        seedCatalog(appState);
        const service = new LocalAgentCatalogService(config, { appState });

        const modifyAgents = await service.listAgents({ capabilities: ["code.modify"] });
        expect(modifyAgents.agents.map((agent) => agent.id)).toEqual(["software.fix.local"]);
        expect(modifyAgents.filters).toEqual({ capabilities: ["code.modify"] });

        const noMatch = await service.listAgents({ capabilities: ["code.modify", "audio.transcribe"] });
        expect(noMatch.agents).toEqual([]);
        expect(noMatch.total).toBe(0);
      } finally {
        appState.close();
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("reports configured provider readiness without exposing secret values", async () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-agent-catalog-provider-"));
    try {
      const config = loadConfig(dir);
      const appState = openAppStateDatabase(config);
      try {
        seedCatalog(appState);
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
          status: "configured",
          statusMessage: "env secret reference is configured."
        });

        const service = new LocalAgentCatalogService(config, { appState });
        const agents = await service.listAgents();
        const softwareAgent = agents.agents.find((agent) => agent.id === "software.fix.local");

        expect(softwareAgent?.providerReadiness).toMatchObject({
          status: "configured",
          required: true,
          providerId: "openai-main",
          providerName: "OpenAI Main",
          model: "gpt-4.1-mini"
        });
        expect(JSON.stringify(softwareAgent)).not.toContain("OPENAI_API_KEY");
      } finally {
        appState.close();
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

function seedCatalog(appState: ReturnType<typeof openAppStateDatabase>): void {
  appState.plugins.upsert({
    id: "team-orchestrator.test.invalid",
    version: "0.1.0",
    path: "/tmp/team-orchestrator-invalid-plugin",
    status: "invalid",
    sourceType: "system",
    manifest: {
      plugin: {
        name: "Invalid Test Plugin"
      }
    },
    validationErrors: [
      {
        file: "/tmp/team-orchestrator-invalid-plugin/agents/broken.agent.yaml",
        path: "$.agent.capabilities",
        message: "must NOT have fewer than 1 items"
      }
    ]
  });
  appState.plugins.upsert({
    id: "team-orchestrator.test.software",
    version: "0.1.0",
    path: "/tmp/team-orchestrator-test-plugin",
    status: "loaded",
    sourceType: "local",
    manifest: {
      plugin: {
        name: "Software Plugin",
        description: "Developer workflow agents.",
        pack: {
          category: "software-team",
          maturity: "preview",
          credentialRequirements: ["model-provider"],
          memoryRequirements: ["none"],
          safety: {
            posture: "review-required",
            externalWrites: false
          }
        },
        ui: {
          icon: "code"
        },
        connector: {
          service: {
            id: "fixture.service",
            name: "Fixture Service"
          },
          auth: {
            type: "api-token",
            credentialBinding: "required"
          },
          scopes: [
            {
              id: "fixture:read",
              label: "Read fixture records",
              required: true,
              access: "read"
            }
          ],
          operations: [
            {
              id: "list-records",
              class: "read",
              scopes: ["fixture:read"]
            }
          ]
        }
      }
    },
    validationErrors: []
  });
  appState.agents.upsert({
    id: "software.fix.local",
    version: "1.0.0",
    pluginId: "team-orchestrator.test.software",
    pluginVersion: "0.1.0",
    name: "Software Fixer",
    capabilities: ["code.modify", "text.summarize"],
    status: "loaded",
    manifest: {
      agent: {
        description: "Makes local code changes.",
        implementation: {
          type: "local-command",
          command: "npm"
        },
        runtime: {
          modelProvider: {
            required: true,
            providerId: "openai-main",
            providerKind: "openai-compatible",
            model: "gpt-4.1-mini"
          }
        },
        limits: {
          maxRuntimeSeconds: 600,
          maxToolCalls: 40
        },
        observability: {
          mode: "inspectable"
        },
        permissions: {
          network: "deny",
          filesystem: "scoped"
        }
      }
    }
  });
  appState.agents.upsert({
    id: "software.plan.local",
    version: "1.0.0",
    pluginId: "team-orchestrator.test.software",
    pluginVersion: "0.1.0",
    name: "Software Planner",
    capabilities: ["task.plan"],
    status: "loaded",
    manifest: {
      agent: {
        implementation: {
          type: "local-command",
          command: "npm"
        }
      }
    }
  });
}
