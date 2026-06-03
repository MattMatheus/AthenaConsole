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

export interface CapabilityPackMetadata {
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
}

export type ConnectorReadinessStatus =
  | "configured"
  | "missing-credentials"
  | "missing-scopes"
  | "rate-limited"
  | "degraded"
  | "blocked";

export interface ConnectorMetadata {
  service: {
    id: string;
    name: string;
    homepage?: string;
    dataResidency?: string;
  };
  auth: {
    type: "none" | "api-token" | "oauth" | "local-secret";
    credentialBinding: "none" | "required" | "optional";
    instructions?: string;
  };
  scopes: Array<{
    id: string;
    label: string;
    required: boolean;
    access: "read" | "write" | "read-write";
    reason?: string;
  }>;
  rateLimits?: Array<{
    id: string;
    limit: number;
    windowSeconds: number;
    appliesTo?: string[];
  }>;
  retry?: {
    maxAttempts?: number;
    backoff?: "none" | "linear" | "exponential";
  };
  operations: Array<{
    id: string;
    class: "read" | "external-write";
    label?: string;
    scopes: string[];
    approvalRequired?: boolean;
  }>;
}

export interface ConnectorReadinessSummary {
  status: ConnectorReadinessStatus;
  serviceId?: string;
  serviceName?: string;
  credentialState: "not-required" | "missing" | "bound" | "invalid";
  missingScopes: string[];
  requiredScopes: string[];
  rateLimitedOperations: string[];
  reasons: string[];
  nextStep: string;
}

export interface AgentCatalogPluginMetadata {
  name: string;
  description?: string;
  pack?: CapabilityPackMetadata;
  connector?: ConnectorMetadata;
  connectorReadiness?: ConnectorReadinessSummary;
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
  pack?: CapabilityPackMetadata;
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
