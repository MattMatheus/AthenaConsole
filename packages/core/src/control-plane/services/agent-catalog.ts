import type { AthenaConfig } from "../../shared/config.js";
import type {
  AgentCatalogAgentListQuery,
  AgentCatalogAgentListResult,
  AgentCatalogAgentMetadata,
  AgentCatalogAgentSummary,
  AgentCatalogPluginListResult,
  AgentCatalogPluginMetadata,
  AgentCatalogPluginSummary,
  AgentCatalogValidationIssue
} from "../../shared/contracts.js";
import type { AgentCatalogService } from "../interfaces.js";
import type { AppStateDatabase, AgentIndexRecord, PluginIndexRecord } from "../app-state/index.js";
import { openAppStateDatabase } from "../app-state/index.js";
import { evaluateConnectorReadiness } from "../connectors.js";
import { evaluateProviderReadiness, normalizeModelProviderRequirement } from "./provider-readiness.js";

interface AgentManifestDocument {
  agent?: {
    description?: string;
    inputs?: Record<string, unknown>;
    outputs?: Record<string, unknown>;
    implementation?: Record<string, unknown>;
    runtime?: Record<string, unknown>;
    permissions?: Record<string, unknown>;
    limits?: Record<string, unknown>;
    observability?: Record<string, unknown>;
    compatibility?: Record<string, unknown>;
    ui?: Record<string, unknown>;
  };
}

interface PluginManifestDocument {
  plugin?: {
    name?: string;
    description?: string;
    pack?: import("../../shared/contracts.js").CapabilityPackMetadata;
    connector?: import("../../shared/contracts.js").ConnectorMetadata;
    authors?: unknown[];
    docs?: Record<string, unknown>;
    compatibility?: Record<string, unknown>;
    permissions?: Record<string, unknown>;
    ui?: Record<string, unknown>;
  };
}

export interface LocalAgentCatalogServiceOptions {
  appState?: AppStateDatabase;
}

export class LocalAgentCatalogService implements AgentCatalogService {
  constructor(
    private readonly config: AthenaConfig,
    private readonly options: LocalAgentCatalogServiceOptions = {}
  ) {}

  async listPlugins(): Promise<AgentCatalogPluginListResult> {
    return this.withAppState((appState) => {
      const agentsByPlugin = groupAgentsByPlugin(appState.agents.list());
      const plugins = appState.plugins.list().map((plugin) =>
        mapPluginSummary(plugin, agentsByPlugin.get(pluginKey(plugin.id, plugin.version)) ?? [], appState)
      );
      return {
        plugins,
        total: plugins.length
      };
    });
  }

  async listAgents(query: AgentCatalogAgentListQuery = {}): Promise<AgentCatalogAgentListResult> {
    return this.withAppState((appState) => {
      const pluginsByKey = new Map(appState.plugins.list().map((plugin) => [pluginKey(plugin.id, plugin.version), plugin]));
      const requiredCapabilities = normalizeCapabilities(query.capabilities);
      const providers = appState.modelProviderConfigs.list();
      const agents = appState.agents
        .list()
        .filter((agent) => hasRequiredCapabilities(agent.capabilities, requiredCapabilities))
        .map((agent) => mapAgentSummary(agent, pluginsByKey.get(pluginKey(agent.pluginId, agent.pluginVersion)), providers))
        .filter((agent): agent is AgentCatalogAgentSummary => Boolean(agent));

      return {
        agents,
        total: agents.length,
        filters: requiredCapabilities.length > 0 ? { capabilities: requiredCapabilities } : {}
      };
    });
  }

  private withAppState<T>(read: (appState: AppStateDatabase) => T): T {
    if (this.options.appState) {
      return read(this.options.appState);
    }
    const appState = openAppStateDatabase(this.config);
    try {
      return read(appState);
    } finally {
      appState.close();
    }
  }
}

function mapPluginSummary(plugin: PluginIndexRecord, agents: AgentIndexRecord[], appState: AppStateDatabase): AgentCatalogPluginSummary {
  const manifest = normalizePluginManifest(plugin.manifest);
  const connectorBinding = manifest.plugin?.connector
    ? appState.connectorCredentialBindings.get(plugin.id, plugin.version, manifest.plugin.connector.service.id)
    : undefined;
  const connectorReadiness = manifest.plugin?.connector
    ? evaluateConnectorReadiness({
        pluginId: plugin.id,
        pluginVersion: plugin.version,
        connector: manifest.plugin.connector,
        binding: connectorBinding
      })
    : undefined;
  return {
    id: plugin.id,
    version: plugin.version,
    path: plugin.path,
    enabled: plugin.enabled,
    status: plugin.status,
    sourceType: plugin.sourceType,
    sourceScope: resolveSourceScope(plugin.sourceType),
    metadata: {
      name: manifest.plugin?.name ?? plugin.id,
      ...(manifest.plugin?.description ? { description: manifest.plugin.description } : {}),
      ...(manifest.plugin?.pack ? { pack: manifest.plugin.pack } : {}),
      ...(manifest.plugin?.connector ? { connector: manifest.plugin.connector } : {}),
      ...(connectorReadiness ? { connectorReadiness } : {}),
      ...(manifest.plugin?.authors ? { authors: manifest.plugin.authors } : {}),
      ...(manifest.plugin?.docs ? { docs: manifest.plugin.docs } : {}),
      ...(manifest.plugin?.compatibility ? { compatibility: manifest.plugin.compatibility } : {}),
      ...(manifest.plugin?.permissions ? { permissions: manifest.plugin.permissions } : {}),
      ...(manifest.plugin?.ui ? { ui: manifest.plugin.ui } : {})
    },
    validationErrors: normalizeValidationIssues(plugin.validationErrors),
    agentCount: agents.length,
    createdAt: plugin.createdAt,
    updatedAt: plugin.updatedAt
  };
}

function mapAgentSummary(
  agent: AgentIndexRecord,
  plugin: PluginIndexRecord | undefined,
  providers: ReturnType<AppStateDatabase["modelProviderConfigs"]["list"]>
): AgentCatalogAgentSummary | undefined {
  if (!plugin) {
    return undefined;
  }
  const pluginManifest = normalizePluginManifest(plugin.manifest);
  const agentManifest = normalizeAgentManifest(agent.manifest);
  const providerRequirement = normalizeModelProviderRequirement(agentManifest.agent?.runtime?.modelProvider);
  return {
    id: agent.id,
    version: agent.version,
    name: agent.name,
    plugin: {
      id: plugin.id,
      version: plugin.version,
      name: pluginManifest.plugin?.name ?? plugin.id,
      sourceType: plugin.sourceType,
      sourceScope: resolveSourceScope(plugin.sourceType),
      enabled: plugin.enabled,
      status: plugin.status,
      ...(pluginManifest.plugin?.pack ? { pack: pluginManifest.plugin.pack } : {})
    },
    capabilities: agent.capabilities,
    status: agent.status,
    available: plugin.enabled && plugin.status === "loaded" && agent.status === "loaded",
    providerReadiness: evaluateProviderReadiness(providerRequirement ? [providerRequirement] : [], providers),
    metadata: mapAgentMetadata(agentManifest),
    validationErrors: [],
    createdAt: agent.createdAt,
    updatedAt: agent.updatedAt
  };
}

function mapAgentMetadata(manifest: AgentManifestDocument): AgentCatalogAgentMetadata {
  const agent = manifest.agent;
  return {
    ...(agent?.description ? { description: agent.description } : {}),
    ...(agent?.inputs ? { inputs: agent.inputs } : {}),
    ...(agent?.outputs ? { outputs: agent.outputs } : {}),
    ...(agent?.implementation ? { implementation: agent.implementation } : {}),
    ...(agent?.runtime ? { runtime: agent.runtime } : {}),
    ...(agent?.permissions ? { permissions: agent.permissions } : {}),
    ...(agent?.limits ? { limits: agent.limits } : {}),
    ...(agent?.observability ? { observability: agent.observability } : {}),
    ...(agent?.compatibility ? { compatibility: agent.compatibility } : {}),
    ...(agent?.ui ? { ui: agent.ui } : {})
  };
}

function groupAgentsByPlugin(agents: AgentIndexRecord[]): Map<string, AgentIndexRecord[]> {
  const grouped = new Map<string, AgentIndexRecord[]>();
  for (const agent of agents) {
    const key = pluginKey(agent.pluginId, agent.pluginVersion);
    grouped.set(key, [...(grouped.get(key) ?? []), agent]);
  }
  return grouped;
}

function pluginKey(id: string, version: string): string {
  return `${id}@${version}`;
}

function resolveSourceScope(sourceType: string): "workspace" | "system" {
  return sourceType === "system" ? "system" : "workspace";
}

function hasRequiredCapabilities(agentCapabilities: string[], requiredCapabilities: string[]): boolean {
  return requiredCapabilities.every((capability) => agentCapabilities.includes(capability));
}

function normalizeCapabilities(capabilities: string[] | undefined): string[] {
  return Array.from(
    new Set(
      (capabilities ?? [])
        .flatMap((capability) => capability.split(","))
        .map((capability) => capability.trim())
        .filter((capability) => capability.length > 0)
    )
  ).sort();
}

function normalizePluginManifest(manifest: unknown): PluginManifestDocument {
  return isRecord(manifest) ? (manifest as PluginManifestDocument) : {};
}

function normalizeAgentManifest(manifest: unknown): AgentManifestDocument {
  return isRecord(manifest) ? (manifest as AgentManifestDocument) : {};
}

function normalizeValidationIssues(issues: unknown[]): AgentCatalogValidationIssue[] {
  return issues.map((issue) => {
    const record = isRecord(issue) ? issue : {};
    const file = typeof record.file === "string" ? record.file : undefined;
    const path = typeof record.path === "string" ? record.path : "$";
    const message = typeof record.message === "string" ? record.message : "unknown validation error";
    const keyword = typeof record.keyword === "string" ? record.keyword : undefined;
    return {
      ...(file ? { file } : {}),
      path,
      message,
      ...(keyword ? { keyword } : {}),
      resourceType: inferIssueResourceType(file)
    };
  });
}

function inferIssueResourceType(file: string | undefined): AgentCatalogValidationIssue["resourceType"] {
  if (!file) {
    return "unknown";
  }
  if (file.endsWith(".agent.yaml") || file.endsWith(".agent.yml")) {
    return "agent";
  }
  if (file.endsWith("plugin.yaml") || file.endsWith("plugin.yml")) {
    return "plugin";
  }
  return "unknown";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
