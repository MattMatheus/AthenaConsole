import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type {
  AgentCatalogService,
  CapabilityService,
  ModelProviderConfigService,
  StateDiagnosticsService,
  WorkflowTemplateCatalogService
} from "../src/control-plane/interfaces.js";
import { LocalReadinessService } from "../src/control-plane/services/readiness.js";
import { loadConfig } from "../src/shared/config.js";

describe("control-plane readiness", () => {
  it("reports required and optional first-run checks without leaking secret-shaped values", async () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-readiness-"));
    try {
      mkdirSync(join(dir, "sample-plugins"), { recursive: true });
      const readiness = new LocalReadinessService(loadConfig(dir), {
        stateDiagnosticsService: stateDiagnosticsService({
          sqlitePath: join(dir, ".athena", "team-orchestrator.sqlite"),
          artifactPath: join(dir, ".athena", "run-evidence")
        }),
        agentCatalogService: agentCatalogService({
          total: 1,
          plugins: [{ id: "demo", enabled: true, status: "loaded" }]
        }),
        workflowTemplateCatalogService: workflowTemplateCatalogService({
          total: 0,
          templates: []
        }),
        capabilityService: capabilityService(),
        modelProviderConfigService: modelProviderConfigService({ total: 0, providers: [] })
      });

      const report = await readiness.getReadiness();

      expect(report.status).toBe("degraded");
      expect(report.summary).toEqual({
        ready: false,
        requiredFailed: 0,
        degraded: 3,
        optionalUnavailable: 3
      });
      expect(report.checks.map((check) => check.id)).toEqual([
        "api",
        "app-state",
        "artifact-storage",
        "managed-repo-root",
        "plugin-paths",
        "secret-root",
        "model-providers",
        "plugins",
        "runtime",
        "server-exposure",
        "sample-demo"
      ]);
      expect(report.checks.find((check) => check.id === "app-state")).toMatchObject({
        status: "ok",
        required: true,
        details: {
          appStatePath: join(dir, ".athena", "team-orchestrator.sqlite")
        }
      });
      expect(report.checks.find((check) => check.id === "runtime")).toMatchObject({
        status: "ok",
        details: {
          defaultProvider: "mock",
          providerConfigured: true
        }
      });
      expect(report.checks.find((check) => check.id === "artifact-storage")).toMatchObject({
        status: "ok",
        required: true,
        details: {
          artifactStoreCount: 1,
          writableArtifactStores: 1
        }
      });
      expect(report.checks.find((check) => check.id === "server-exposure")).toMatchObject({
        status: "ok",
        required: true,
        details: {
          externallyReachable: false
        }
      });
      expect(report.checks.find((check) => check.id === "sample-demo")).toMatchObject({
        status: "degraded",
        required: false,
        details: {
          totalWorkflowTemplates: 0,
          availableWorkflowTemplates: 0
        }
      });
      expect(JSON.stringify(report)).not.toContain("sk-");
      expect(JSON.stringify(report)).not.toContain("apiKey");
      expect(JSON.stringify(report)).not.toContain("ATHENA_");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("marks unreadable required diagnostics as not ready", async () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-readiness-failed-"));
    try {
      const readiness = new LocalReadinessService(loadConfig(dir), {
        stateDiagnosticsService: {
          getDiagnostics() {
            throw new Error("boom");
          }
        },
        agentCatalogService: agentCatalogService({
          total: 1,
          plugins: [{ id: "demo", enabled: true, status: "loaded" }]
        }),
        workflowTemplateCatalogService: workflowTemplateCatalogService({
          total: 1,
          templates: [{ available: true }]
        }),
        capabilityService: capabilityService(),
        modelProviderConfigService: modelProviderConfigService({ total: 0, providers: [] })
      });

      const report = await readiness.getReadiness();

      expect(report.status).toBe("not-ready");
      expect(report.summary.requiredFailed).toBe(2);
      expect(report.checks.find((check) => check.id === "app-state")).toMatchObject({
        status: "failed",
        required: true,
        nextStep: "Check local filesystem permissions and restart the API."
      });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("warns when the API is externally bound with the local unauthenticated override", async () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-readiness-exposure-"));
    const previousHost = process.env.ATHENA_DEV_API_HOST;
    const previousOverride = process.env.ATHENA_ALLOW_EXTERNAL_UNAUTHENTICATED;
    try {
      process.env.ATHENA_DEV_API_HOST = "0.0.0.0";
      process.env.ATHENA_ALLOW_EXTERNAL_UNAUTHENTICATED = "true";
      const config = loadConfig(dir);
      const readiness = new LocalReadinessService(config, {
        stateDiagnosticsService: stateDiagnosticsService({
          sqlitePath: join(dir, ".athena", "team-orchestrator.sqlite"),
          artifactPath: join(dir, ".athena", "run-evidence")
        }),
        agentCatalogService: agentCatalogService({
          total: 1,
          plugins: [{ id: "demo", enabled: true, status: "loaded" }]
        }),
        workflowTemplateCatalogService: workflowTemplateCatalogService({
          total: 1,
          templates: [{ available: true }]
        }),
        capabilityService: capabilityService(),
        modelProviderConfigService: modelProviderConfigService({ total: 0, providers: [] })
      });

      const report = await readiness.getReadiness();

      expect(report.checks.find((check) => check.id === "server-exposure")).toMatchObject({
        status: "degraded",
        required: true,
        message: "API is externally bound with unauthenticated access explicitly allowed.",
        details: {
          externallyReachable: true,
          authEnabled: false,
          explicitLocalOverride: true
        }
      });
      expect(JSON.stringify(report)).not.toContain("ATHENA_");
      expect(JSON.stringify(report)).not.toContain("apiKey");
    } finally {
      if (previousHost === undefined) {
        delete process.env.ATHENA_DEV_API_HOST;
      } else {
        process.env.ATHENA_DEV_API_HOST = previousHost;
      }
      if (previousOverride === undefined) {
        delete process.env.ATHENA_ALLOW_EXTERNAL_UNAUTHENTICATED;
      } else {
        process.env.ATHENA_ALLOW_EXTERNAL_UNAUTHENTICATED = previousOverride;
      }
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

function stateDiagnosticsService(input: { sqlitePath: string; artifactPath: string }): StateDiagnosticsService {
  return {
    getDiagnostics() {
      return {
        ownershipMap: "docs/product/architecture/state-ownership-map.md",
        sqlite: {
          appStatePath: input.sqlitePath
        },
        stores: [
          {
            id: "sqlite-app-state",
            label: "SQLite app-state database",
            category: "sqlite-app-state",
            path: input.sqlitePath
          },
          {
            id: "run-evidence",
            label: "Run evidence",
            category: "intentional-file-artifact",
            path: input.artifactPath
          }
        ]
      };
    }
  };
}

function modelProviderConfigService(input: {
  total: number;
  providers: Array<{ id: string; status: "configured" | "missing" | "invalid" | "unsupported" }>;
}): ModelProviderConfigService {
  return {
    async list() {
      return {
        total: input.total,
        providers: input.providers.map((provider) => ({
          id: provider.id,
          name: provider.id,
          providerKind: "openai-compatible",
          baseUrl: "https://example.invalid/v1",
          defaultModel: "model",
          secret: {
            kind: "local-file",
            name: "redacted",
            configured: provider.status === "configured"
          },
          status: provider.status,
          createdAt: new Date(0).toISOString(),
          updatedAt: new Date(0).toISOString()
        }))
      };
    },
    async get() {
      throw new Error("not used");
    },
    async create() {
      throw new Error("not used");
    },
    async update() {
      throw new Error("not used");
    },
    async delete() {
      throw new Error("not used");
    },
    async test() {
      throw new Error("not used");
    },
    async resolveRuntimeConfig() {
      throw new Error("not used");
    }
  } as ModelProviderConfigService;
}

function agentCatalogService(input: { total: number; plugins: Array<{ id: string; enabled: boolean; status: string }> }): AgentCatalogService {
  return {
    async listPlugins() {
      return {
        total: input.total,
        plugins: input.plugins.map((plugin) => ({
          id: plugin.id,
          version: "0.1.0",
          path: "/workspace/plugin",
          enabled: plugin.enabled,
          status: plugin.status,
          sourceType: "workspace",
          sourceScope: "workspace",
          metadata: { name: plugin.id },
          validationErrors: [],
          agentCount: 1,
          createdAt: new Date(0).toISOString(),
          updatedAt: new Date(0).toISOString()
        }))
      };
    },
    async listAgents() {
      return {
        agents: [],
        total: 0,
        filters: {}
      };
    }
  } as AgentCatalogService;
}

function workflowTemplateCatalogService(input: { total: number; templates: Array<{ available: boolean }> }): WorkflowTemplateCatalogService {
  return {
    async list() {
      return {
        total: input.total,
        filters: { includeUnavailable: true },
        templates: input.templates.map((template, index) => ({
          id: `template-${index}`,
          version: "0.1.0",
          name: `Template ${index}`,
          description: "Demo template",
          plugin: {
            id: "demo",
            version: "0.1.0",
            name: "demo",
            sourceType: "workspace",
            enabled: true,
            status: "loaded"
          },
          available: template.available,
          status: template.available ? "loaded" : "invalid",
          providerReadiness: {
            status: "untested",
            required: false,
            requirements: [],
            message: "No model provider requirement declared."
          },
          taskCount: 1,
          metadata: {},
          validationErrors: [],
          createdAt: new Date(0).toISOString(),
          updatedAt: new Date(0).toISOString()
        }))
      };
    },
    async instantiate() {
      throw new Error("not used");
    }
  } as WorkflowTemplateCatalogService;
}

function capabilityService(): CapabilityService {
  return {
    async getCapabilities() {
      return {
        executionBackend: "local",
        stateStore: "file",
        supportsPods: false,
        supportsCpuMemMetrics: false,
        supportsSandbox: false,
        supportsA2ABus: true
      };
    }
  };
}
