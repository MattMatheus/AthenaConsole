export type AgentCatalogPluginSourceType = "local" | "system" | string;
export type AgentCatalogPluginSourceScope = "workspace" | "system";
export type AgentCatalogPluginStatus = "loaded" | "invalid" | string;
export type AgentCatalogAgentStatus = "loaded" | string;

export interface AgentCatalogProviderRequirement {
  required: boolean;
  providerKind?: import("./model-providers.js").ModelProviderKind;
  providerId?: string;
  model?: string;
  label?: string;
}

export interface AgentCatalogProviderReadiness {
  status: "configured" | "missing" | "invalid" | "untested";
  required: boolean;
  requirements: AgentCatalogProviderRequirement[];
  providerId?: string;
  providerName?: string;
  providerKind?: import("./model-providers.js").ModelProviderKind;
  model?: string;
  message: string;
}

export interface AgentCatalogValidationIssue {
  file?: string;
  path: string;
  message: string;
  keyword?: string;
  resourceType: "plugin" | "agent" | "unknown";
}

export interface AgentCatalogPluginMetadata {
  name: string;
  description?: string;
  authors?: unknown[];
  docs?: Record<string, unknown>;
  compatibility?: Record<string, unknown>;
  permissions?: Record<string, unknown>;
  ui?: Record<string, unknown>;
}

export interface AgentCatalogAgentPluginReference {
  id: string;
  version: string;
  name: string;
  sourceType: AgentCatalogPluginSourceType;
  sourceScope: AgentCatalogPluginSourceScope;
  enabled: boolean;
  status: AgentCatalogPluginStatus;
}

export interface AgentCatalogPluginSummary {
  id: string;
  version: string;
  path: string;
  enabled: boolean;
  status: AgentCatalogPluginStatus;
  sourceType: AgentCatalogPluginSourceType;
  sourceScope: AgentCatalogPluginSourceScope;
  metadata: AgentCatalogPluginMetadata;
  validationErrors: AgentCatalogValidationIssue[];
  agentCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface AgentCatalogAgentMetadata {
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
}

export interface AgentCatalogAgentSummary {
  id: string;
  version: string;
  name: string;
  plugin: AgentCatalogAgentPluginReference;
  capabilities: string[];
  status: AgentCatalogAgentStatus;
  available: boolean;
  providerReadiness: AgentCatalogProviderReadiness;
  metadata: AgentCatalogAgentMetadata;
  validationErrors: AgentCatalogValidationIssue[];
  createdAt: string;
  updatedAt: string;
}

export interface AgentCatalogPluginListResult {
  plugins: AgentCatalogPluginSummary[];
  total: number;
}

export interface AgentCatalogAgentListQuery {
  capabilities?: string[];
}

export interface AgentCatalogAgentListResult {
  agents: AgentCatalogAgentSummary[];
  total: number;
  filters: AgentCatalogAgentListQuery;
}
