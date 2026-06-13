import { apiClient } from "../../services";
import type {
  AgentCatalogAgentListQuery,
  AgentCatalogAgentListResult,
  AgentCatalogAgentStatus,
  AgentCatalogAgentSummary,
  CapabilityPackOutcome,
  CapabilityPackMetadata,
  AgentCatalogPluginListResult,
  AgentCatalogPluginSourceScope,
  AgentCatalogPluginSummary,
  AgentCatalogValidationIssue,
  ConnectorReadiness,
  ProviderReadiness,
} from "./types";

type RecordValue = Record<string, unknown>;

function isRecord(value: unknown): value is RecordValue {
  return typeof value === "object" && value !== null;
}

function toSourceScope(value: unknown): AgentCatalogPluginSourceScope {
  return value === "system" ? "system" : "workspace";
}

function toAgentStatus(value: unknown): AgentCatalogAgentStatus {
  return value === "draft" || value === "verified" || value === "approved" || value === "certified" || value === "deprecated"
    ? value
    : "draft";
}

function toStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.length > 0)
    : [];
}

function toRecord(value: unknown): Record<string, unknown> | undefined {
  return isRecord(value) ? value : undefined;
}

function parsePackMetadata(value: unknown): CapabilityPackMetadata | undefined {
  if (!isRecord(value) || typeof value.category !== "string" || typeof value.maturity !== "string" || !isRecord(value.safety)) {
    return undefined;
  }
  return {
    category: value.category,
    maturity: value.maturity,
    credentialRequirements: toStringArray(value.credentialRequirements),
    memoryRequirements: toStringArray(value.memoryRequirements),
    safety: {
      posture: typeof value.safety.posture === "string" ? value.safety.posture : "unspecified",
      externalWrites: Boolean(value.safety.externalWrites),
      ...(Array.isArray(value.safety.approvalRequiredFor)
        ? { approvalRequiredFor: toStringArray(value.safety.approvalRequiredFor) }
        : {}),
      ...(typeof value.safety.notes === "string" ? { notes: value.safety.notes } : {}),
    },
    ...(Array.isArray(value.exampleWorkflows)
      ? { exampleWorkflows: value.exampleWorkflows.filter(isRecord) as Array<Record<string, unknown>> }
      : {}),
    ...(Array.isArray(value.outcomes)
      ? { outcomes: value.outcomes.map(parsePackOutcome).filter((item): item is CapabilityPackOutcome => item !== undefined) }
      : {}),
  };
}

function parsePackOutcome(value: unknown): CapabilityPackOutcome | undefined {
  if (!isRecord(value) || !isRecord(value.target) || typeof value.id !== "string" || typeof value.title !== "string") {
    return undefined;
  }
  const kind =
    value.target.kind === "agent" || value.target.kind === "workflow" || value.target.kind === "link"
      ? value.target.kind
      : undefined;
  if (!kind || typeof value.target.id !== "string" || typeof value.description !== "string") {
    return undefined;
  }
  const ui = toRecord(value.ui);
  return {
    id: value.id,
    title: value.title,
    description: value.description,
    target: {
      kind,
      id: value.target.id,
      ...(typeof value.target.version === "string" ? { version: value.target.version } : {}),
      ...(typeof value.target.href === "string" ? { href: value.target.href } : {}),
    },
    contextRequirements: toStringArray(value.contextRequirements),
    expectedArtifacts: Array.isArray(value.expectedArtifacts)
      ? value.expectedArtifacts.filter(isRecord).map((artifact) => ({
          label: typeof artifact.label === "string" ? artifact.label : "Artifact",
          format: typeof artifact.format === "string" ? artifact.format : "markdown",
        }))
      : [],
    executionMode: typeof value.executionMode === "string" ? value.executionMode : "deterministic",
    ...(ui
      ? {
          ui: {
            ...(typeof ui.icon === "string" ? { icon: ui.icon } : {}),
            ...(typeof ui.badge === "string" ? { badge: ui.badge } : {}),
            ...(typeof ui.order === "number" ? { order: ui.order } : {}),
          },
        }
      : {}),
  };
}

function parseProviderReadiness(value: unknown): ProviderReadiness {
  const record = isRecord(value) ? value : {};
  const requirements = Array.isArray(record.requirements)
    ? record.requirements.filter(isRecord).map((requirement) => ({
        required: requirement.required !== false,
        ...(requirement.providerKind === "openai-compatible" ? { providerKind: "openai-compatible" as const } : {}),
        ...(typeof requirement.providerId === "string" ? { providerId: requirement.providerId } : {}),
        ...(typeof requirement.model === "string" ? { model: requirement.model } : {}),
        ...(typeof requirement.label === "string" ? { label: requirement.label } : {}),
      }))
    : [];
  const status =
    record.status === "configured" || record.status === "missing" || record.status === "invalid" || record.status === "untested"
      ? record.status
      : "untested";
  return {
    status,
    required: Boolean(record.required),
    requirements,
    ...(typeof record.providerId === "string" ? { providerId: record.providerId } : {}),
    ...(typeof record.providerName === "string" ? { providerName: record.providerName } : {}),
    ...(record.providerKind === "openai-compatible" ? { providerKind: "openai-compatible" } : {}),
    ...(typeof record.model === "string" ? { model: record.model } : {}),
    message: typeof record.message === "string" ? record.message : "No model provider requirement declared.",
  };
}

function parseConnectorReadiness(value: unknown): ConnectorReadiness | undefined {
  if (!isRecord(value)) {
    return undefined;
  }
  const status =
    value.status === "configured" ||
    value.status === "missing-credentials" ||
    value.status === "missing-scopes" ||
    value.status === "rate-limited" ||
    value.status === "degraded" ||
    value.status === "blocked"
      ? value.status
      : undefined;
  const credentialState =
    value.credentialState === "not-required" ||
    value.credentialState === "missing" ||
    value.credentialState === "bound" ||
    value.credentialState === "invalid"
      ? value.credentialState
      : undefined;
  if (!status || !credentialState) {
    return undefined;
  }
  return {
    status,
    ...(typeof value.serviceId === "string" ? { serviceId: value.serviceId } : {}),
    ...(typeof value.serviceName === "string" ? { serviceName: value.serviceName } : {}),
    credentialState,
    missingScopes: toStringArray(value.missingScopes),
    requiredScopes: toStringArray(value.requiredScopes),
    rateLimitedOperations: toStringArray(value.rateLimitedOperations),
    reasons: toStringArray(value.reasons),
    nextStep: typeof value.nextStep === "string" ? value.nextStep : "Review connector readiness before running connector-backed work.",
  };
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
  const pack = parsePackMetadata(metadata.pack);
  const connectorReadiness = parseConnectorReadiness(metadata.connectorReadiness);
  return {
    id: value.id,
    version: value.version,
    path: typeof value.path === "string" ? value.path : "",
    enabled: Boolean(value.enabled),
    status: toAgentStatus(value.status),
    sourceType: typeof value.sourceType === "string" ? value.sourceType : "local",
    sourceScope: toSourceScope(value.sourceScope),
    metadata: {
      name: typeof metadata.name === "string" ? metadata.name : value.id,
      ...(typeof metadata.description === "string" ? { description: metadata.description } : {}),
      ...(pack ? { pack } : {}),
      ...(connectorReadiness ? { connectorReadiness } : {}),
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
  const pack = parsePackMetadata(value.plugin.pack);
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
      ...(pack ? { pack } : {}),
    },
    capabilities: toStringArray(value.capabilities),
    status: toAgentStatus(value.status),
    available: Boolean(value.available),
    providerReadiness: parseProviderReadiness(value.providerReadiness),
    certification: parseCertification(value.certification),
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

function parseCertification(value: unknown): AgentCatalogAgentSummary["certification"] {
  const record = isRecord(value) ? value : {};
  const status =
    record.status === "certified" || record.status === "blocked" || record.status === "not-required" ? record.status : "not-required";
  const evidenceLinks = Array.isArray(record.evidenceLinks)
    ? record.evidenceLinks
        .filter(isRecord)
        .map((link) => ({
          kind: typeof link.kind === "string" ? link.kind : "",
          uri: typeof link.uri === "string" ? link.uri : "",
          ...(typeof link.label === "string" ? { label: link.label } : {}),
        }))
        .filter((link) => link.kind.length > 0 && link.uri.length > 0)
    : [];
  return {
    status,
    required: Boolean(record.required),
    ...(typeof record.declaredMaturity === "string" ? { declaredMaturity: record.declaredMaturity } : {}),
    effectiveMaturity: typeof record.effectiveMaturity === "string" ? record.effectiveMaturity : "unknown",
    ...(typeof record.evalRunId === "string" ? { evalRunId: record.evalRunId } : {}),
    evalResultIds: toStringArray(record.evalResultIds),
    expectedArtifactUris: toStringArray(record.expectedArtifactUris),
    actualArtifactUris: toStringArray(record.actualArtifactUris),
    ...(typeof record.securityOwner === "string" ? { securityOwner: record.securityOwner } : {}),
    ...(typeof record.ownershipRecord === "string" ? { ownershipRecord: record.ownershipRecord } : {}),
    evidenceLinks,
    reasons: toStringArray(record.reasons),
    message: typeof record.message === "string" ? record.message : "",
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
