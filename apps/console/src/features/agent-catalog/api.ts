import { apiClient } from "../../services";
import type {
  AgentCatalogAgentListQuery,
  AgentCatalogAgentListResult,
  AgentCatalogAgentSummary,
  AgentCatalogPluginListResult,
  AgentCatalogPluginSourceScope,
  AgentCatalogPluginSummary,
  AgentCatalogValidationIssue,
} from "./types";

type RecordValue = Record<string, unknown>;

function isRecord(value: unknown): value is RecordValue {
  return typeof value === "object" && value !== null;
}

function toSourceScope(value: unknown): AgentCatalogPluginSourceScope {
  return value === "system" ? "system" : "workspace";
}

function toStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.length > 0)
    : [];
}

function toRecord(value: unknown): Record<string, unknown> | undefined {
  return isRecord(value) ? value : undefined;
}

function parseValidationIssue(value: unknown): AgentCatalogValidationIssue | undefined {
  if (!isRecord(value) || typeof value.path !== "string" || typeof value.message !== "string") {
    return undefined;
  }
  const resourceType =
    value.resourceType === "plugin" || value.resourceType === "agent" || value.resourceType === "unknown"
      ? value.resourceType
      : "unknown";
  return {
    ...(typeof value.file === "string" ? { file: value.file } : {}),
    path: value.path,
    message: value.message,
    ...(typeof value.keyword === "string" ? { keyword: value.keyword } : {}),
    resourceType,
  };
}

function parsePlugin(value: unknown): AgentCatalogPluginSummary | undefined {
  if (!isRecord(value) || typeof value.id !== "string" || typeof value.version !== "string") {
    return undefined;
  }
  const metadata = isRecord(value.metadata) ? value.metadata : {};
  const ui = toRecord(metadata.ui);
  const compatibility = toRecord(metadata.compatibility);
  const permissions = toRecord(metadata.permissions);
  return {
    id: value.id,
    version: value.version,
    path: typeof value.path === "string" ? value.path : "",
    enabled: Boolean(value.enabled),
    status: typeof value.status === "string" ? value.status : "unknown",
    sourceType: typeof value.sourceType === "string" ? value.sourceType : "local",
    sourceScope: toSourceScope(value.sourceScope),
    metadata: {
      name: typeof metadata.name === "string" ? metadata.name : value.id,
      ...(typeof metadata.description === "string" ? { description: metadata.description } : {}),
      ...(ui ? { ui } : {}),
      ...(compatibility ? { compatibility } : {}),
      ...(permissions ? { permissions } : {}),
    },
    validationErrors: Array.isArray(value.validationErrors)
      ? value.validationErrors.map(parseValidationIssue).filter((issue): issue is AgentCatalogValidationIssue => issue !== undefined)
      : [],
    agentCount: typeof value.agentCount === "number" ? value.agentCount : 0,
    createdAt: typeof value.createdAt === "string" ? value.createdAt : new Date(0).toISOString(),
    updatedAt: typeof value.updatedAt === "string" ? value.updatedAt : new Date(0).toISOString(),
  };
}

function parseAgent(value: unknown): AgentCatalogAgentSummary | undefined {
  if (!isRecord(value) || typeof value.id !== "string" || typeof value.version !== "string" || !isRecord(value.plugin)) {
    return undefined;
  }
  const metadata = isRecord(value.metadata) ? value.metadata : {};
  const inputs = toRecord(metadata.inputs);
  const outputs = toRecord(metadata.outputs);
  const implementation = toRecord(metadata.implementation);
  const runtime = toRecord(metadata.runtime);
  const observability = toRecord(metadata.observability);
  const permissions = toRecord(metadata.permissions);
  const limits = toRecord(metadata.limits);
  const compatibility = toRecord(metadata.compatibility);
  const ui = toRecord(metadata.ui);
  return {
    id: value.id,
    version: value.version,
    name: typeof value.name === "string" ? value.name : value.id,
    plugin: {
      id: typeof value.plugin.id === "string" ? value.plugin.id : "",
      version: typeof value.plugin.version === "string" ? value.plugin.version : "",
      name: typeof value.plugin.name === "string" ? value.plugin.name : "Unknown plugin",
      sourceType: typeof value.plugin.sourceType === "string" ? value.plugin.sourceType : "local",
      sourceScope: toSourceScope(value.plugin.sourceScope),
      enabled: Boolean(value.plugin.enabled),
      status: typeof value.plugin.status === "string" ? value.plugin.status : "unknown",
    },
    capabilities: toStringArray(value.capabilities),
    status: typeof value.status === "string" ? value.status : "unknown",
    available: Boolean(value.available),
    metadata: {
      ...(typeof metadata.description === "string" ? { description: metadata.description } : {}),
      ...(inputs ? { inputs } : {}),
      ...(outputs ? { outputs } : {}),
      ...(implementation ? { implementation } : {}),
      ...(runtime ? { runtime } : {}),
      ...(observability ? { observability } : {}),
      ...(permissions ? { permissions } : {}),
      ...(limits ? { limits } : {}),
      ...(compatibility ? { compatibility } : {}),
      ...(ui ? { ui } : {}),
    },
    validationErrors: Array.isArray(value.validationErrors)
      ? value.validationErrors.map(parseValidationIssue).filter((issue): issue is AgentCatalogValidationIssue => issue !== undefined)
      : [],
    createdAt: typeof value.createdAt === "string" ? value.createdAt : new Date(0).toISOString(),
    updatedAt: typeof value.updatedAt === "string" ? value.updatedAt : new Date(0).toISOString(),
  };
}

function toAgentCatalogQueryString(query: AgentCatalogAgentListQuery = {}): string {
  const params = new URLSearchParams();
  for (const capability of query.capabilities ?? []) {
    const trimmed = capability.trim();
    if (trimmed) {
      params.append("capability", trimmed);
    }
  }
  const suffix = params.toString();
  return suffix ? `?${suffix}` : "";
}

export async function fetchAgentCatalogPlugins(): Promise<AgentCatalogPluginListResult> {
  const payload = await apiClient.get<unknown>("/v1/agent-catalog/plugins");
  if (!isRecord(payload)) {
    throw new Error("Agent catalog plugin payload is invalid.");
  }
  const plugins = Array.isArray(payload.plugins)
    ? payload.plugins.map(parsePlugin).filter((plugin): plugin is AgentCatalogPluginSummary => plugin !== undefined)
    : [];
  return {
    plugins,
    total: typeof payload.total === "number" ? payload.total : plugins.length,
  };
}

export async function fetchAgentCatalogAgents(
  query: AgentCatalogAgentListQuery = {},
): Promise<AgentCatalogAgentListResult> {
  const payload = await apiClient.get<unknown>(`/v1/agent-catalog/agents${toAgentCatalogQueryString(query)}`);
  if (!isRecord(payload)) {
    throw new Error("Agent catalog agent payload is invalid.");
  }
  const agents = Array.isArray(payload.agents)
    ? payload.agents.map(parseAgent).filter((agent): agent is AgentCatalogAgentSummary => agent !== undefined)
    : [];
  return {
    agents,
    total: typeof payload.total === "number" ? payload.total : agents.length,
    filters: isRecord(payload.filters)
      ? {
          capabilities: toStringArray(payload.filters.capabilities),
        }
      : {},
  };
}
