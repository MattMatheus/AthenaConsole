import { accessSync, constants, existsSync, mkdirSync, statSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";
import type { AthenaConfig } from "../../shared/config.js";
import type {
  AgentCatalogService,
  CapabilityService,
  ModelProviderConfigService,
  ReadinessCheck,
  ReadinessLane,
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
  modelProviderConfigService: ModelProviderConfigService;
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
      Promise.resolve(this.buildArtifactStorageCheck()),
      Promise.resolve(this.buildManagedRepoRootCheck()),
      Promise.resolve(this.buildPluginPathCheck()),
      Promise.resolve(this.buildSecretRootCheck()),
      this.buildModelProviderCheck(),
      Promise.resolve(this.buildDurableMemoryCheck()),
      this.buildPluginIndexCheck(),
      this.buildRuntimeCheck(),
      Promise.resolve(this.buildServerExposureCheck()),
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
      lanes: buildReadinessLanes(checks),
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
          nextStep: "Check the configured state directory and restart the API.",
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

  private buildArtifactStorageCheck(): ReadinessCheck {
    try {
      const diagnostics = this.options.stateDiagnosticsService.getDiagnostics();
      const artifactStores = diagnostics.stores.filter((store) => store.category === "intentional-file-artifact");
      const unavailable = artifactStores.filter((store) => !isWritableDirectory(store.path));
      if (artifactStores.length === 0) {
        return degradedCheck({
          id: "artifact-storage",
          label: "Artifact storage",
          category: "storage",
          required: true,
          message: "No artifact storage roots are reported by diagnostics.",
          nextStep: "Check state diagnostics and server volume mounts.",
          details: {
            artifactStoreCount: 0
          }
        });
      }
      if (unavailable.length > 0) {
        return failedCheck({
          id: "artifact-storage",
          label: "Artifact storage",
          category: "storage",
          required: true,
          message: "One or more artifact storage roots are not writable.",
          nextStep: "Fix host volume ownership for artifact paths, then restart the API container.",
          details: {
            artifactStoreCount: artifactStores.length,
            unavailableArtifactStores: unavailable.length
          }
        });
      }
      return okCheck({
        id: "artifact-storage",
        label: "Artifact storage",
        category: "storage",
        required: true,
        message: "Artifact storage roots are writable.",
        nextStep: "No action needed.",
        details: {
          artifactStoreCount: artifactStores.length,
          writableArtifactStores: artifactStores.length
        }
      });
    } catch {
      return failedCheck({
        id: "artifact-storage",
        label: "Artifact storage",
        category: "storage",
        required: true,
        message: "Artifact storage diagnostics could not be read.",
        nextStep: "Check filesystem permissions and state diagnostics.",
        details: {}
      });
    }
  }

  private buildManagedRepoRootCheck(): ReadinessCheck {
    const managedRoot = resolve(this.config.workspaceRoot, "repos", "managed");
    if (!isWritableDirectory(managedRoot)) {
      return failedCheck({
        id: "managed-repo-root",
        label: "Managed repo root",
        category: "repos",
        required: true,
        message: "Managed repository root is not writable.",
        nextStep: "Fix managed repository volume ownership or mount it at the workspace repos path.",
        details: {
          managedRepoRoot: managedRoot
        }
      });
    }
    return okCheck({
      id: "managed-repo-root",
      label: "Managed repo root",
      category: "repos",
      required: true,
      message: "Managed repository root is writable.",
      nextStep: "No action needed.",
      details: {
        managedRepoRoot: managedRoot
      }
    });
  }

  private buildPluginPathCheck(): ReadinessCheck {
    const paths = (this.config.plugins?.searchPaths ?? []).map((path) => resolveConfiguredPath(this.config.workspaceRoot, path));
    const existing = paths.filter((path) => isReadableDirectory(path));
    if (paths.length === 0) {
      return failedCheck({
        id: "plugin-paths",
        label: "Plugin paths",
        category: "plugins",
        required: true,
        message: "No plugin search paths are configured.",
        nextStep: "Configure at least one plugin directory before expecting agents or workflows to load.",
        details: {}
      });
    }
    if (existing.length === 0) {
      return degradedCheck({
        id: "plugin-paths",
        label: "Plugin paths",
        category: "plugins",
        required: true,
        message: "Configured plugin search paths are not readable yet.",
        nextStep: "Create or mount the configured plugin directories, then restart or re-index the API.",
        details: {
          configuredPluginPaths: paths.length,
          readablePluginPaths: 0
        }
      });
    }
    return okCheck({
      id: "plugin-paths",
      label: "Plugin paths",
      category: "plugins",
      required: true,
      message: "At least one configured plugin path is readable.",
      nextStep: "No action needed.",
      details: {
        configuredPluginPaths: paths.length,
        readablePluginPaths: existing.length
      }
    });
  }

  private buildSecretRootCheck(): ReadinessCheck {
    const secretRoot = "/run/secrets/athena";
    if (!isReadableDirectory(secretRoot)) {
      return degradedCheck({
        id: "secret-root",
        label: "Local secret root",
        category: "providers",
        required: false,
        message: "Local secret root is not mounted or readable.",
        nextStep: "Mount the server secret directory at /run/secrets/athena when using local-file provider secrets.",
        details: {
          secretRootMounted: false
        }
      });
    }
    return okCheck({
      id: "secret-root",
      label: "Local secret root",
      category: "providers",
      required: false,
      message: "Local secret root is mounted and readable.",
      nextStep: "Configure provider secrets as local-file references when needed.",
      details: {
        secretRootMounted: true
      }
    });
  }

  private async buildModelProviderCheck(): Promise<ReadinessCheck> {
    try {
      const providers = await this.options.modelProviderConfigService.list();
      const unavailable = providers.providers.filter((provider) => provider.status !== "configured");
      if (providers.total === 0) {
        return degradedCheck({
          id: "model-providers",
          label: "Model providers",
          category: "providers",
          required: false,
          message: "No model provider configs are saved.",
          nextStep: "Open Settings and add a model provider before running model-backed agents.",
          details: {
            totalProviders: 0,
            unavailableProviders: 0
          }
        });
      }
      if (unavailable.length > 0) {
        return degradedCheck({
          id: "model-providers",
          label: "Model providers",
          category: "providers",
          required: false,
          message: "Some model provider configs are missing or invalid.",
          nextStep: "Open Settings and test each provider without exposing secret values.",
          details: {
            totalProviders: providers.total,
            unavailableProviders: unavailable.length
          }
        });
      }
      return okCheck({
        id: "model-providers",
        label: "Model providers",
        category: "providers",
        required: false,
        message: "Saved model provider configs are configured.",
        nextStep: "No action needed.",
        details: {
          totalProviders: providers.total,
          unavailableProviders: 0
        }
      });
    } catch {
      return degradedCheck({
        id: "model-providers",
        label: "Model providers",
        category: "providers",
        required: false,
        message: "Model provider configs could not be read.",
        nextStep: "Check provider settings storage and API logs.",
        details: {}
      });
    }
  }

  private buildDurableMemoryCheck(): ReadinessCheck {
    const durable = this.config.durableMemory;
    const mode = durable?.mode ?? "disabled";
    const provider = durable?.provider;
    const operatorStatus = durable?.operatorStatus ?? defaultDurableMemoryOperatorStatus(mode);
    const token = resolveDurableMemoryTokenPosture(provider);
    const details = {
      mode,
      providerKind: provider?.kind ?? "local-dev",
      cacheMode: provider?.cacheMode ?? "disabled",
      operatorStatus,
      tokenRefConfigured: token.configured,
      tokenRefAvailable: token.available,
      legacyDiagnosticMemorySeparate: true
    };

    if (mode === "disabled") {
      return degradedCheck({
        id: "durable-memory",
        label: "Durable memory",
        category: "providers",
        required: false,
        message: "Durable memory is disabled; legacy diagnostic memory search remains separate.",
        nextStep: "Enable durable memory when cross-machine memory continuity is needed.",
        details
      });
    }

    if (mode === "local-dev") {
      return degradedCheck({
        id: "durable-memory",
        label: "Durable memory",
        category: "providers",
        required: false,
        message: "Durable memory is local-dev-only and will not travel across machines.",
        nextStep: "Use server-mode or remote-http durable memory for laptop/server continuity.",
        details: {
          ...details,
          operatorStatus: "local-dev-only"
        }
      });
    }

    if (mode === "server-mode") {
      return okCheck({
        id: "durable-memory",
        label: "Durable memory",
        category: "providers",
        required: false,
        message: "Durable memory is configured for server-mode storage.",
        nextStep: "Confirm server backups include the durable-memory SQLite/app-state volume.",
        details: {
          ...details,
          operatorStatus: operatorStatus === "diagnostic-only" ? "remote-current" : operatorStatus
        }
      });
    }

    if (!provider?.baseUrl) {
      return degradedCheck({
        id: "durable-memory",
        label: "Durable memory",
        category: "providers",
        required: false,
        message: "Remote durable memory is selected but no server URL is configured.",
        nextStep: "Configure the remote durable-memory server URL before relying on shared memory.",
        details: {
          ...details,
          operatorStatus: "remote-unavailable"
        }
      });
    }

    if (token.configured && !token.available) {
      return degradedCheck({
        id: "durable-memory",
        label: "Durable memory",
        category: "providers",
        required: false,
        message: "Remote durable memory token reference is configured but unavailable.",
        nextStep: "Fix the durable-memory token reference before connecting to the remote server.",
        details: {
          ...details,
          operatorStatus: "remote-unavailable",
          authStatus: "unauthorized"
        }
      });
    }

    if (operatorStatus === "remote-current" || operatorStatus === "cache-current") {
      return okCheck({
        id: "durable-memory",
        label: "Durable memory",
        category: "providers",
        required: false,
        message: "Remote durable memory is configured and current.",
        nextStep: "No action needed.",
        details
      });
    }

    return degradedCheck({
      id: "durable-memory",
      label: "Durable memory",
      category: "providers",
      required: false,
      message: durableMemoryStatusMessage(operatorStatus),
      nextStep: durableMemoryStatusNextStep(operatorStatus),
      details
    });
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

  private buildServerExposureCheck(): ReadinessCheck {
    const apiHost = process.env.ATHENA_DEV_API_HOST ?? "127.0.0.1";
    const externallyReachable = isExternallyReachableHost(apiHost);
    const authEnabled = this.config.auth?.enabled === true && Boolean(this.config.auth.apiToken);
    const explicitLocalOverride = this.config.auth?.allowExternalUnauthenticated === true;
    const trustedProxyConfigured = this.config.auth?.trustedProxyConfigured === true;
    const identityHeader = this.config.auth?.identityHeader ?? "x-athena-identity";
    if (authEnabled && !trustedProxyConfigured) {
      return degradedCheck({
        id: "trusted-proxy-auth",
        label: "Trusted identity proxy",
        category: "security",
        required: true,
        message: "Trusted identity header auth is enabled without a declared header-stripping proxy.",
        nextStep:
          "Place the API behind a reverse proxy that strips inbound identity headers and injects authenticated identities, then set ATHENA_AUTH_TRUSTED_PROXY_CONFIGURED=true.",
        details: {
          identityHeader,
          trustedProxyConfigured: false
        }
      });
    }
    if (externallyReachable && !authEnabled && explicitLocalOverride) {
      return degradedCheck({
        id: "server-exposure",
        label: "Server exposure",
        category: "security",
        required: true,
        message: "API is externally bound with unauthenticated access explicitly allowed.",
        nextStep: "Use this only for local development. Enable API token auth before exposing a local-server deployment on a LAN.",
        details: {
          externallyReachable,
          authEnabled: false,
          explicitLocalOverride: true
        }
      });
    }
    if (externallyReachable && !authEnabled) {
      return failedCheck({
        id: "server-exposure",
        label: "Server exposure",
        category: "security",
        required: true,
        message: "API is externally bound without server-side token auth.",
        nextStep: "Enable API token auth, or bind the API to 127.0.0.1.",
        details: {
          externallyReachable,
          authEnabled: false,
          explicitLocalOverride: false
        }
      });
    }
    return okCheck({
      id: "server-exposure",
      label: "Server exposure",
      category: "security",
      required: true,
      message: externallyReachable ? "API is externally bound with token auth enabled." : "API bind address is loopback/local.",
      nextStep: "No action needed.",
      details: {
        externallyReachable,
        authEnabled,
        explicitLocalOverride,
        trustedProxyConfigured
      }
    });
  }
}

function buildReadinessLanes(checks: ReadinessCheck[]): ReadinessLane[] {
  return [
    buildFirstRunDemoLane(checks),
    buildRealWorkLane(checks),
    buildProviderSetupLane(checks),
    buildServerHardeningLane(checks)
  ];
}

function buildFirstRunDemoLane(checks: ReadinessCheck[]): ReadinessLane {
  const checkIds = ["api", "app-state", "artifact-storage", "plugin-paths", "plugins", "runtime", "sample-demo"];
  const laneChecks = checksById(checks, checkIds);
  if (laneChecks.some((check) => check.required && check.status === "failed")) {
    return {
      id: "first-run-demo",
      label: "First-run demo",
      status: "blocked",
      message: "Required local services are blocked before the demo can run.",
      nextStep: firstNextStep(laneChecks, "Fix required local readiness failures, then run the demo workflow."),
      checkIds
    };
  }
  const sampleDemo = laneChecks.find((check) => check.id === "sample-demo");
  if (sampleDemo?.status !== "ok") {
    return {
      id: "first-run-demo",
      label: "First-run demo",
      status: "degraded",
      message: "The local stack is mostly usable, but the sample workflow is not ready yet.",
      nextStep: sampleDemo?.nextStep ?? "Check plugin/template indexing before running the first-run demo.",
      checkIds
    };
  }
  return {
    id: "first-run-demo",
    label: "First-run demo",
    status: "ready",
    message: "The credential-free first-run demo can run now.",
    nextStep: "Open Workflows and instantiate the first-run demo workflow.",
    checkIds
  };
}

function buildRealWorkLane(checks: ReadinessCheck[]): ReadinessLane {
  const checkIds = [
    "api",
    "app-state",
    "artifact-storage",
    "managed-repo-root",
    "plugin-paths",
    "plugins",
    "runtime",
    "durable-memory"
  ];
  const laneChecks = checksById(checks, checkIds);
  if (laneChecks.some((check) => check.required && check.status === "failed")) {
    return {
      id: "real-work",
      label: "Real repo work",
      status: "blocked",
      message: "Required local work services need attention before reliable repo-backed runs.",
      nextStep: firstNextStep(laneChecks, "Fix required local readiness failures before creating real repo work."),
      checkIds
    };
  }
  if (laneChecks.some((check) => check.status === "degraded")) {
    return {
      id: "real-work",
      label: "Real repo work",
      status: "degraded",
      message: "Repo-backed work is available with local readiness warnings.",
      nextStep: firstNextStep(laneChecks, "Review degraded local work checks before running long-lived work."),
      checkIds
    };
  }
  return {
    id: "real-work",
    label: "Real repo work",
    status: "ready",
    message: "Local state, plugins, runtime, artifacts, and repo storage are ready for real work.",
    nextStep: "Open Resource Controls to connect or confirm a repository, then create a task.",
    checkIds
  };
}

function buildProviderSetupLane(checks: ReadinessCheck[]): ReadinessLane {
  const checkIds = ["model-providers", "secret-root", "runtime", "durable-memory"];
  const laneChecks = checksById(checks, checkIds);
  if (laneChecks.some((check) => check.required && check.status === "failed")) {
    return {
      id: "provider-setup",
      label: "Model-backed agents",
      status: "blocked",
      message: "Runtime readiness is blocked for provider-backed work.",
      nextStep: firstNextStep(laneChecks, "Fix runtime readiness before running model-backed agents."),
      checkIds
    };
  }
  if (laneChecks.some((check) => check.status !== "ok")) {
    return {
      id: "provider-setup",
      label: "Model-backed agents",
      status: "degraded",
      message: "The demo can run without credentials, but model-backed agents still need provider or secret setup.",
      nextStep: firstNextStep(laneChecks, "Open Settings to configure model providers when you need model-backed agents."),
      checkIds
    };
  }
  return {
    id: "provider-setup",
    label: "Model-backed agents",
    status: "ready",
    message: "Provider and secret readiness checks are clean for model-backed agents.",
    nextStep: "No action needed.",
    checkIds
  };
}

function buildServerHardeningLane(checks: ReadinessCheck[]): ReadinessLane {
  const checkIds = ["server-exposure", "secret-root", "durable-memory"];
  const laneChecks = checksById(checks, checkIds);
  if (laneChecks.some((check) => check.id === "server-exposure" && check.status === "failed")) {
    return {
      id: "server-hardening",
      label: "Server hardening",
      status: "blocked",
      message: "Server exposure settings are unsafe for a LAN/server deployment.",
      nextStep: firstNextStep(laneChecks, "Enable token auth or bind the API to loopback before server exposure."),
      checkIds
    };
  }
  if (laneChecks.some((check) => check.status !== "ok")) {
    return {
      id: "server-hardening",
      label: "Server hardening",
      status: "degraded",
      message: "Local demo use is okay, but server deployment hardening still has warnings.",
      nextStep: firstNextStep(laneChecks, "Resolve server hardening warnings before trusted-LAN exposure."),
      checkIds
    };
  }
  return {
    id: "server-hardening",
    label: "Server hardening",
    status: "ready",
    message: "Server exposure and local secret checks are clean.",
    nextStep: "No action needed.",
    checkIds
  };
}

function checksById(checks: ReadinessCheck[], checkIds: string[]): ReadinessCheck[] {
  return checkIds.map((id) => checks.find((check) => check.id === id)).filter((check): check is ReadinessCheck => check !== undefined);
}

function firstNextStep(checks: ReadinessCheck[], fallback: string): string {
  return checks.find((check) => check.status !== "ok" && check.nextStep)?.nextStep ?? fallback;
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

function isWritableDirectory(path: string): boolean {
  try {
    mkdirSync(path, { recursive: true });
    const stats = statSync(path);
    if (!stats.isDirectory()) {
      return false;
    }
    accessSync(path, constants.R_OK | constants.W_OK);
    return true;
  } catch {
    return false;
  }
}

function isReadableDirectory(path: string): boolean {
  try {
    const stats = statSync(path);
    if (!stats.isDirectory()) {
      return false;
    }
    accessSync(path, constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

function isReadableFile(path: string): boolean {
  try {
    const stats = statSync(path);
    if (!stats.isFile()) {
      return false;
    }
    accessSync(path, constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

function resolveConfiguredPath(workspaceRoot: string, path: string): string {
  return isAbsolute(path) ? path : resolve(workspaceRoot, path);
}

function isExternallyReachableHost(host: string): boolean {
  const normalized = host.trim().toLowerCase();
  return normalized === "0.0.0.0" || normalized === "::" || normalized === "" || normalized === "*";
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

function defaultDurableMemoryOperatorStatus(mode: string): string {
  if (mode === "server-mode" || mode === "remote-http") {
    return "remote-current";
  }
  if (mode === "local-dev") {
    return "local-dev-only";
  }
  return "diagnostic-only";
}

function resolveDurableMemoryTokenPosture(provider: NonNullable<AthenaConfig["durableMemory"]>["provider"] | undefined): {
  configured: boolean;
  available: boolean;
} {
  const ref = provider?.tokenRef;
  if (!ref) {
    return { configured: false, available: false };
  }
  if (ref.kind === "env") {
    return { configured: true, available: Boolean(process.env[ref.name]?.trim()) };
  }
  return { configured: true, available: existsSync(ref.name) && isReadableFile(ref.name) };
}

function durableMemoryStatusMessage(status: string): string {
  switch (status) {
    case "remote-unavailable":
      return "Remote durable memory is configured but currently unavailable.";
    case "cache-stale":
      return "Durable memory is serving stale cached state.";
    case "queued-intent":
      return "Durable memory has queued write intent waiting for remote replay.";
    case "conflict-review-required":
      return "Durable memory has a conflict that requires operator review.";
    case "local-dev-only":
      return "Durable memory is local-dev-only and will not travel across machines.";
    case "diagnostic-only":
      return "Only legacy diagnostic memory is available; durable product memory is not enabled.";
    default:
      return "Durable memory is configured with a degraded operator-visible status.";
  }
}

function durableMemoryStatusNextStep(status: string): string {
  switch (status) {
    case "remote-unavailable":
      return "Check remote durable-memory server reachability and auth configuration.";
    case "cache-stale":
      return "Reconnect to the remote durable-memory server before trusting stale cached context.";
    case "queued-intent":
      return "Reconnect to the remote durable-memory server so queued memory writes can replay.";
    case "conflict-review-required":
      return "Review memory conflicts before running agents that depend on durable memory.";
    case "local-dev-only":
      return "Use server-mode or remote-http durable memory for laptop/server continuity.";
    case "diagnostic-only":
      return "Enable durable memory when cross-machine memory continuity is needed.";
    default:
      return "Inspect durable-memory configuration before relying on shared memory.";
  }
}
