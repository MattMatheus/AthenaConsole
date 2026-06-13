export type AgentCatalogPluginSourceScope = "workspace" | "system";
export type AgentCatalogAgentStatus = "draft" | "verified" | "approved" | "certified" | "deprecated";
export type ProviderReadinessStatus = "configured" | "missing" | "invalid" | "untested";
export type ConnectorReadinessStatus =
  | "configured"
  | "missing-credentials"
  | "missing-scopes"
  | "rate-limited"
  | "degraded"
  | "blocked";

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

export type ConnectorReadiness = {
  status: ConnectorReadinessStatus;
  serviceId?: string;
  serviceName?: string;
  credentialState: "not-required" | "missing" | "bound" | "invalid";
  missingScopes: string[];
  requiredScopes: string[];
  rateLimitedOperations: string[];
  reasons: string[];
  nextStep: string;
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
  outcomes?: CapabilityPackOutcome[];
};

export type CapabilityPackOutcome = {
  id: string;
  title: string;
  description: string;
  target: {
    kind: "agent" | "workflow" | "link";
    id: string;
    version?: string;
    href?: string;
  };
  contextRequirements: string[];
  expectedArtifacts: Array<{
    label: string;
    format: string;
  }>;
  executionMode: "deterministic" | "model-backed" | "connector-backed" | string;
  ui?: {
    icon?: string;
    badge?: string;
    order?: number;
  };
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
    connectorReadiness?: ConnectorReadiness;
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
  status: AgentCatalogAgentStatus;
  available: boolean;
  providerReadiness: ProviderReadiness;
  certification: {
    status: "certified" | "blocked" | "not-required";
    required: boolean;
    declaredMaturity?: string;
    effectiveMaturity: string;
    evalRunId?: string;
    evalResultIds: string[];
    expectedArtifactUris: string[];
    actualArtifactUris: string[];
    securityOwner?: string;
    ownershipRecord?: string;
    evidenceLinks: Array<{
      kind: string;
      uri: string;
      label?: string;
    }>;
    reasons: string[];
    message: string;
  };
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
