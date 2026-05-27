export type AgentCatalogPluginSourceScope = "workspace" | "system";

export type AgentCatalogValidationIssue = {
  file?: string;
  path: string;
  message: string;
  keyword?: string;
  resourceType: "plugin" | "agent" | "unknown";
};

export type AgentCatalogPluginSummary = {
  id: string;
  version: string;
  path: string;
  enabled: boolean;
  status: string;
  sourceType: string;
  sourceScope: AgentCatalogPluginSourceScope;
  metadata: {
    name: string;
    description?: string;
    ui?: Record<string, unknown>;
    compatibility?: Record<string, unknown>;
    permissions?: Record<string, unknown>;
  };
  validationErrors: AgentCatalogValidationIssue[];
  agentCount: number;
  createdAt: string;
  updatedAt: string;
};

export type AgentCatalogAgentSummary = {
  id: string;
  version: string;
  name: string;
  plugin: {
    id: string;
    version: string;
    name: string;
    sourceType: string;
    sourceScope: AgentCatalogPluginSourceScope;
    enabled: boolean;
    status: string;
  };
  capabilities: string[];
  status: string;
  available: boolean;
  metadata: {
    description?: string;
    inputs?: Record<string, unknown>;
    outputs?: Record<string, unknown>;
    implementation?: Record<string, unknown>;
    runtime?: Record<string, unknown>;
    observability?: Record<string, unknown>;
    permissions?: Record<string, unknown>;
    limits?: Record<string, unknown>;
    compatibility?: Record<string, unknown>;
    ui?: Record<string, unknown>;
  };
  validationErrors: AgentCatalogValidationIssue[];
  createdAt: string;
  updatedAt: string;
};

export type AgentCatalogPluginListResult = {
  plugins: AgentCatalogPluginSummary[];
  total: number;
};

export type AgentCatalogAgentListQuery = {
  capabilities?: string[];
};

export type AgentCatalogAgentListResult = {
  agents: AgentCatalogAgentSummary[];
  total: number;
  filters: AgentCatalogAgentListQuery;
};
