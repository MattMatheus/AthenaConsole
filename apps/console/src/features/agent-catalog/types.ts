export type AgentCatalogPluginSourceScope = "workspace" | "system";
export type ProviderReadinessStatus = "configured" | "missing" | "invalid" | "untested";

export type ModelProviderRequirement = {
  required: boolean;
  providerKind?: "openai-compatible";
  providerId?: string;
  model?: string;
  label?: string;
};

export type ProviderReadiness = {
  status: ProviderReadinessStatus;
  required: boolean;
  requirements: ModelProviderRequirement[];
  providerId?: string;
  providerName?: string;
  providerKind?: "openai-compatible";
  model?: string;
  message: string;
};

export type AgentCatalogValidationIssue = {
  file?: string;
  path: string;
  message: string;
  keyword?: string;
  resourceType: "plugin" | "agent" | "unknown";
};

export type CapabilityPackMetadata = {
  category: string;
  maturity: string;
  credentialRequirements: string[];
  memoryRequirements: string[];
  safety: {
    posture: string;
    externalWrites: boolean;
    approvalRequiredFor?: string[];
    notes?: string;
  };
  exampleWorkflows?: Array<Record<string, unknown>>;
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
    pack?: CapabilityPackMetadata;
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
    pack?: CapabilityPackMetadata;
  };
  capabilities: string[];
  status: string;
  available: boolean;
  providerReadiness: ProviderReadiness;
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
