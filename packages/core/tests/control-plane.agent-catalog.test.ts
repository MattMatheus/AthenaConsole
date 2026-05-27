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
            description: "Developer workflow agents."
          },
          agentCount: 2
        });

        const agents = await service.listAgents();
        expect(agents.total).toBe(2);
        expect(agents.agents[0]).toMatchObject({
          id: "software.fix.local",
          name: "Software Fixer",
          capabilities: ["code.modify", "text.summarize"],
          available: true,
          plugin: {
            id: "team-orchestrator.test.software",
            name: "Software Plugin",
            sourceType: "local",
            sourceScope: "workspace"
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
        ui: {
          icon: "code"
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
