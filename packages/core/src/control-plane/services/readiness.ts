import type { AthenaConfig } from "../../shared/config.js";
import type {
  AgentCatalogService,
  CapabilityService,
  ReadinessCheck,
  ReadinessReport,
  ReadinessService,
  StateDiagnosticsService,
  WorkflowTemplateCatalogService
} from "../interfaces.js";

interface LocalReadinessServiceOptions {
  stateDiagnosticsService: StateDiagnosticsService;
  agentCatalogService: AgentCatalogService;
  workflowTemplateCatalogService: WorkflowTemplateCatalogService;
  capabilityService: CapabilityService;
}

export class LocalReadinessService implements ReadinessService {
  constructor(
    private readonly config: AthenaConfig,
    private readonly options: LocalReadinessServiceOptions
  ) {}

  async getReadiness(): Promise<ReadinessReport> {
    const checks = await Promise.all([
      Promise.resolve(buildApiCheck()),
      Promise.resolve(this.buildAppStateCheck()),
      this.buildPluginIndexCheck(),
      this.buildRuntimeCheck(),
      this.buildSampleDemoCheck()
    ]);
    const requiredFailed = checks.filter((check) => check.required && check.status === "failed").length;
    const degraded = checks.filter((check) => check.status === "degraded").length;
    const optionalUnavailable = checks.filter((check) => !check.required && check.status !== "ok").length;
    const status = requiredFailed > 0 ? "not-ready" : degraded > 0 ? "degraded" : "ready";
    return {
      status,
      generatedAt: new Date().toISOString(),
      summary: {
        ready: status === "ready",
        requiredFailed,
        degraded,
        optionalUnavailable
      },
      checks
    };
  }

  private buildAppStateCheck(): ReadinessCheck {
    try {
      const diagnostics = this.options.stateDiagnosticsService.getDiagnostics();
      const blockingStores = diagnostics.stores.filter(
        (store) => store.category === "migration-candidate" || store.category === "deprecated-file-backed-state"
      );
      if (!diagnostics.sqlite.appStatePath) {
        return failedCheck({
          id: "app-state",
          label: "SQLite app-state",
          category: "app-state",
          required: true,
          message: "SQLite app-state path is not configured.",
          nextStep: "Check ATHENA_STATE_DIR and restart the API.",
          details: {}
        });
      }
      if (blockingStores.length > 0) {
        return degradedCheck({
          id: "app-state",
          label: "SQLite app-state",
          category: "app-state",
          required: true,
          message: "Some control-plane stores still need ownership review.",
          nextStep: "Review docs/product/architecture/state-ownership-map.md before relying on first-run state.",
          details: {
            appStatePath: diagnostics.sqlite.appStatePath,
            reviewStoreCount: blockingStores.length
          }
        });
      }
      return okCheck({
        id: "app-state",
        label: "SQLite app-state",
        category: "app-state",
        required: true,
        message: "SQLite app-state is configured and ownership diagnostics are clean.",
        nextStep: "No action needed.",
        details: {
          appStatePath: diagnostics.sqlite.appStatePath,
          storeCount: diagnostics.stores.length
        }
      });
    } catch {
      return failedCheck({
        id: "app-state",
        label: "SQLite app-state",
        category: "app-state",
        required: true,
        message: "SQLite app-state diagnostics could not be read.",
        nextStep: "Check local filesystem permissions and restart the API.",
        details: {}
      });
    }
  }

  private async buildPluginIndexCheck(): Promise<ReadinessCheck> {
    try {
      const pluginIndex = await this.options.agentCatalogService.listPlugins();
      const unavailable = pluginIndex.plugins.filter((plugin) => !plugin.enabled || plugin.status !== "loaded");
      if (pluginIndex.total === 0) {
        return degradedCheck({
          id: "plugins",
          label: "Plugin index",
          category: "plugins",
          required: true,
          message: "No plugins are indexed for local development.",
          nextStep: "Add a plugin to a configured plugin search path, then restart or re-index the API.",
          details: {
            totalPlugins: 0,
            unavailablePlugins: 0
          }
        });
      }
      if (unavailable.length > 0) {
        return degradedCheck({
          id: "plugins",
          label: "Plugin index",
          category: "plugins",
          required: true,
          message: "Some indexed plugins are unavailable.",
          nextStep: "Inspect /api/v1/agent-catalog/plugins for plugin IDs and validation errors.",
          details: {
            totalPlugins: pluginIndex.total,
            unavailablePlugins: unavailable.length
          }
        });
      }
      return okCheck({
        id: "plugins",
        label: "Plugin index",
        category: "plugins",
        required: true,
        message: "Plugin index is available.",
        nextStep: "No action needed.",
        details: {
          totalPlugins: pluginIndex.total,
          unavailablePlugins: 0
        }
      });
    } catch {
      return failedCheck({
        id: "plugins",
        label: "Plugin index",
        category: "plugins",
        required: true,
        message: "Plugin index could not be read.",
        nextStep: "Check plugin manifest paths and API logs, then restart the API.",
        details: {}
      });
    }
  }

  private async buildRuntimeCheck(): Promise<ReadinessCheck> {
    try {
      const capabilities = await this.options.capabilityService.getCapabilities();
      const provider = resolveProviderPosture(this.config);
      const details = {
        executionBackend: capabilities.executionBackend,
        defaultProvider: this.config.defaultProvider,
        supportsSandbox: capabilities.supportsSandbox,
        providerConfigured: provider.configured
      };
      if (!provider.configured) {
        return degradedCheck({
          id: "runtime",
          label: "Runtime provider",
          category: "runtime",
          required: true,
          message: provider.message,
          nextStep: provider.nextStep,
          details
        });
      }
      return okCheck({
        id: "runtime",
        label: "Runtime provider",
        category: "runtime",
        required: true,
        message: provider.message,
        nextStep: "No action needed.",
        details
      });
    } catch {
      return failedCheck({
        id: "runtime",
        label: "Runtime provider",
        category: "runtime",
        required: true,
        message: "Runtime capabilities could not be read.",
        nextStep: "Check runtime backend configuration and API logs.",
        details: {}
      });
    }
  }

  private async buildSampleDemoCheck(): Promise<ReadinessCheck> {
    try {
      const templates = await this.options.workflowTemplateCatalogService.list({ includeUnavailable: true });
      const availableTemplates = templates.templates.filter((template) => template.available).length;
      if (availableTemplates === 0) {
        return degradedCheck({
          id: "sample-demo",
          label: "Sample/demo workflow",
          category: "sample-demo",
          required: false,
          message: "No available workflow template is ready for a first-run demo yet.",
          nextStep: "Continue with the sample plugin workflow demo story before documenting a demo run.",
          details: {
            totalWorkflowTemplates: templates.total,
            availableWorkflowTemplates: availableTemplates
          }
        });
      }
      return okCheck({
        id: "sample-demo",
        label: "Sample/demo workflow",
        category: "sample-demo",
        required: false,
        message: "At least one workflow template is available for a local demo path.",
        nextStep: "Use /api/v1/workflow-templates to choose a demo template.",
        details: {
          totalWorkflowTemplates: templates.total,
          availableWorkflowTemplates: availableTemplates
        }
      });
    } catch {
      return degradedCheck({
        id: "sample-demo",
        label: "Sample/demo workflow",
        category: "sample-demo",
        required: false,
        message: "Workflow template catalog could not be read.",
        nextStep: "Check plugin/template indexing before running a first-run demo.",
        details: {}
      });
    }
  }
}

function buildApiCheck(): ReadinessCheck {
  return okCheck({
    id: "api",
    label: "API",
    category: "api",
    required: true,
    message: "API is responding.",
    nextStep: "No action needed.",
    details: {}
  });
}

function okCheck(input: Omit<ReadinessCheck, "status">): ReadinessCheck {
  return { ...input, status: "ok" };
}

function degradedCheck(input: Omit<ReadinessCheck, "status">): ReadinessCheck {
  return { ...input, status: "degraded" };
}

function failedCheck(input: Omit<ReadinessCheck, "status">): ReadinessCheck {
  return { ...input, status: "failed" };
}

function resolveProviderPosture(config: AthenaConfig): { configured: boolean; message: string; nextStep: string } {
  switch (config.defaultProvider) {
    case "mock":
      return {
        configured: true,
        message: "Mock provider is configured for local development.",
        nextStep: "No action needed."
      };
    case "openai":
      return config.openaiApiKey
        ? {
            configured: true,
            message: "OpenAI provider is configured.",
            nextStep: "No action needed."
          }
        : {
            configured: false,
            message: "OpenAI provider is selected but no API key is configured.",
            nextStep: "Set OPENAI_API_KEY or select the mock provider for local-only readiness."
          };
    case "foundry":
      return config.foundry?.enabled && config.foundry.projectEndpoint && config.foundry.deployment
        ? {
            configured: true,
            message: "Azure Foundry provider is configured.",
            nextStep: "No action needed."
          }
        : {
            configured: false,
            message: "Azure Foundry provider is selected but endpoint/deployment settings are incomplete.",
            nextStep: "Set the Foundry endpoint and deployment settings or select the mock provider."
          };
    case "http":
      return config.httpProviderUrl
        ? {
            configured: true,
            message: "HTTP provider endpoint is configured.",
            nextStep: "No action needed."
          }
        : {
            configured: false,
            message: "HTTP provider is selected but no provider URL is configured.",
            nextStep: "Set ATHENA_HTTP_PROVIDER_URL or select the mock provider."
          };
    case "local":
      return config.localProviderCommand
        ? {
            configured: true,
            message: "Local provider command is configured.",
            nextStep: "No action needed."
          }
        : {
            configured: false,
            message: "Local provider is selected but no command is configured.",
            nextStep: "Set the local provider command or select the mock provider."
          };
    default:
      return {
        configured: false,
        message: "Selected provider is not recognized by readiness checks.",
        nextStep: "Select mock, openai, foundry, http, or local as the default provider."
      };
  }
}
