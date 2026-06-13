import type { AthenaConfig } from "../../shared/config.js";
import type {
  AgentCatalogAgentListQuery,
  AgentCatalogAgentListResult,
  AgentCatalogCertification,
  AgentCatalogAgentMetadata,
  AgentCatalogAgentSummary,
  AgentCatalogConnectorReadinessEntry,
  AgentCatalogConnectorReadinessListResult,
  EvalResultRecord,
  EvalRunRecord,
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
    certification?: {
      securityOwner?: string;
      ownershipRecord?: string;
      evidenceLinks?: Array<Record<string, unknown>>;
    };
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
        .map((agent) => mapAgentSummary(agent, pluginsByKey.get(pluginKey(agent.pluginId, agent.pluginVersion)), providers, appState))
        .filter((agent): agent is AgentCatalogAgentSummary => Boolean(agent));

      return {
        agents,
        total: agents.length,
        filters: requiredCapabilities.length > 0 ? { capabilities: requiredCapabilities } : {}
      };
    });
  }

  async listConnectorReadiness(): Promise<AgentCatalogConnectorReadinessListResult> {
    return this.withAppState((appState) => {
      const connectors = appState.plugins
        .list()
        .map((plugin) => mapConnectorReadinessEntry(plugin, appState))
        .filter((entry): entry is AgentCatalogConnectorReadinessEntry => entry !== undefined);
      return {
        connectors,
        total: connectors.length
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
        binding: connectorBinding,
        grantedScopes: manifest.plugin.connector.readiness?.grantedScopes,
        rateLimitedOperationIds: manifest.plugin.connector.readiness?.rateLimitedOperationIds,
        degraded: manifest.plugin.connector.readiness?.degraded,
        blockedReasons: manifest.plugin.connector.readiness?.blockedReasons
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

function mapConnectorReadinessEntry(
  plugin: PluginIndexRecord,
  appState: AppStateDatabase
): AgentCatalogConnectorReadinessEntry | undefined {
  const manifest = normalizePluginManifest(plugin.manifest);
  const connector = manifest.plugin?.connector;
  if (!connector) {
    return undefined;
  }
  const binding = appState.connectorCredentialBindings.get(plugin.id, plugin.version, connector.service.id);
  return {
    plugin: {
      id: plugin.id,
      version: plugin.version,
      name: manifest.plugin?.name ?? plugin.id,
      enabled: plugin.enabled,
      status: plugin.status,
      sourceType: plugin.sourceType,
      sourceScope: resolveSourceScope(plugin.sourceType)
    },
    connector,
    readiness: evaluateConnectorReadiness({
      pluginId: plugin.id,
      pluginVersion: plugin.version,
      connector,
      binding,
      grantedScopes: connector.readiness?.grantedScopes,
      rateLimitedOperationIds: connector.readiness?.rateLimitedOperationIds,
      degraded: connector.readiness?.degraded,
      blockedReasons: connector.readiness?.blockedReasons
    })
  };
}

function mapAgentSummary(
  agent: AgentIndexRecord,
  plugin: PluginIndexRecord | undefined,
  providers: ReturnType<AppStateDatabase["modelProviderConfigs"]["list"]>,
  appState: AppStateDatabase
): AgentCatalogAgentSummary | undefined {
  if (!plugin) {
    return undefined;
  }
  const pluginManifest = normalizePluginManifest(plugin.manifest);
  const agentManifest = normalizeAgentManifest(agent.manifest);
  const providerRequirement = normalizeModelProviderRequirement(agentManifest.agent?.runtime?.modelProvider);
  const certification = evaluateAgentCertification(agent, plugin, pluginManifest, agentManifest, appState);
  const lifecycleStatus = resolveAgentLifecycleStatus(agent, certification);
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
    status: lifecycleStatus,
    available: isAgentAvailable(plugin, agent, lifecycleStatus, certification),
    providerReadiness: evaluateProviderReadiness(providerRequirement ? [providerRequirement] : [], providers),
    certification,
    metadata: mapAgentMetadata(agentManifest),
    validationErrors: [],
    createdAt: agent.createdAt,
    updatedAt: agent.updatedAt
  };
}

function evaluateAgentCertification(
  agent: AgentIndexRecord,
  plugin: PluginIndexRecord,
  pluginManifest: PluginManifestDocument,
  agentManifest: AgentManifestDocument,
  appState: AppStateDatabase
): AgentCatalogCertification {
  const declaredMaturity = pluginManifest.plugin?.pack?.maturity;
  const declaredEvidence = normalizeCertificationEvidence(agentManifest);
  const required = isFirstPartyPlugin(plugin) && declaredMaturity === "certified";
  if (!required) {
    return {
      status: "not-required",
      required: false,
      ...(declaredMaturity ? { declaredMaturity } : {}),
      effectiveMaturity: declaredMaturity ?? "unknown",
      evalResultIds: [],
      expectedArtifactUris: [],
      actualArtifactUris: [],
      ...declaredEvidence,
      reasons: [],
      message: "Certification gate is not required for this agent."
    };
  }

  const candidate = findPassingCertificationRun(appState, agent);
  const evidenceReasons = certificationEvidenceBlockReasons(declaredEvidence);
  if (candidate && evidenceReasons.length === 0) {
    return {
      status: "certified",
      required: true,
      declaredMaturity,
      effectiveMaturity: "certified",
      evalRunId: candidate.run.id,
      evalResultIds: candidate.results.map((result) => result.id),
      expectedArtifactUris: candidate.results.map((result) => result.expectedArtifactUri!).filter(Boolean),
      actualArtifactUris: candidate.results.map((result) => result.actualArtifactUri!).filter(Boolean),
      ...declaredEvidence,
      evidenceLinks: [
        ...declaredEvidence.evidenceLinks,
        { kind: "eval-run", uri: `eval-run:${candidate.run.id}`, label: candidate.run.id },
        ...candidate.results.map((result) => ({ kind: "eval-result", uri: `eval-result:${result.id}`, label: result.caseId }))
      ],
      reasons: [],
      message: "Certified by passing eval results with expected and actual artifact links plus security and ownership evidence."
    };
  }

  return {
    status: "blocked",
    required: true,
    declaredMaturity,
    effectiveMaturity: "preview",
    evalResultIds: [],
    expectedArtifactUris: [],
    actualArtifactUris: [],
    ...declaredEvidence,
    reasons: [...certificationBlockReasons(appState, agent), ...evidenceReasons],
    message:
      "Declared certified maturity is blocked until a completed passing eval run records artifact links and security/ownership evidence."
  };
}

function resolveAgentLifecycleStatus(agent: AgentIndexRecord, certification: AgentCatalogCertification): AgentCatalogAgentSummary["status"] {
  if (agent.lifecycleStatus === "certified" && certification.status !== "certified") {
    return "approved";
  }
  if (certification.status === "certified") {
    return "certified";
  }
  return agent.lifecycleStatus;
}

function isAgentAvailable(
  plugin: PluginIndexRecord,
  agent: AgentIndexRecord,
  lifecycleStatus: AgentCatalogAgentSummary["status"],
  certification: AgentCatalogCertification
): boolean {
  if (!plugin.enabled || plugin.status !== "loaded" || agent.status !== "loaded") {
    return false;
  }
  if (lifecycleStatus === "draft" || lifecycleStatus === "deprecated") {
    return false;
  }
  if (certification.required && certification.status !== "certified") {
    return false;
  }
  return true;
}

function findPassingCertificationRun(
  appState: AppStateDatabase,
  agent: AgentIndexRecord
): { run: EvalRunRecord; results: EvalResultRecord[] } | undefined {
  const runs = appState.evals.listRuns({
    agentId: agent.id,
    agentVersion: agent.version,
    status: "completed",
    limit: 1000
  });
  for (const run of runs) {
    const results = appState.evals.listResults({ evalRunId: run.id, limit: 1000 });
    if (
      results.length > 0 &&
      results.every(
        (result) =>
          result.status === "passed" &&
          typeof result.expectedArtifactUri === "string" &&
          result.expectedArtifactUri.length > 0 &&
          typeof result.actualArtifactUri === "string" &&
          result.actualArtifactUri.length > 0
      )
    ) {
      return { run, results };
    }
  }
  return undefined;
}

function certificationBlockReasons(appState: AppStateDatabase, agent: AgentIndexRecord): string[] {
  const runs = appState.evals.listRuns({
    agentId: agent.id,
    agentVersion: agent.version,
    limit: 1000
  });
  if (runs.length === 0) {
    return ["missing-eval-run"];
  }
  if (!runs.some((run) => run.status === "completed")) {
    return ["missing-completed-eval-run"];
  }
  const completedRuns = runs.filter((run) => run.status === "completed");
  const completedResults = completedRuns.flatMap((run) => appState.evals.listResults({ evalRunId: run.id, limit: 1000 }));
  if (completedResults.length === 0) {
    return ["missing-eval-results"];
  }
  if (completedResults.some((result) => result.status !== "passed")) {
    return ["failing-eval-results"];
  }
  return ["missing-eval-artifact-links"];
}

function normalizeCertificationEvidence(agentManifest: AgentManifestDocument): {
  securityOwner?: string;
  ownershipRecord?: string;
  evidenceLinks: AgentCatalogCertification["evidenceLinks"];
} {
  const certification = agentManifest.agent?.certification;
  const securityOwner = readNonEmptyString(certification?.securityOwner);
  const ownershipRecord = readNonEmptyString(certification?.ownershipRecord);
  const evidenceLinks = Array.isArray(certification?.evidenceLinks)
    ? certification.evidenceLinks
        .map((link) => {
          const kind = readNonEmptyString(link.kind);
          const uri = readNonEmptyString(link.uri);
          if (!kind || !uri) {
            return undefined;
          }
          const label = readNonEmptyString(link.label);
          return {
            kind,
            uri,
            ...(label ? { label } : {})
          };
        })
        .filter((link): link is AgentCatalogCertification["evidenceLinks"][number] => link !== undefined)
    : [];
  return {
    ...(securityOwner ? { securityOwner } : {}),
    ...(ownershipRecord ? { ownershipRecord } : {}),
    evidenceLinks: [
      ...evidenceLinks,
      ...(securityOwner ? [{ kind: "security-owner", uri: `owner:${securityOwner}`, label: securityOwner }] : []),
      ...(ownershipRecord ? [{ kind: "ownership-record", uri: ownershipRecord, label: "Ownership record" }] : [])
    ]
  };
}

function certificationEvidenceBlockReasons(evidence: {
  securityOwner?: string;
  ownershipRecord?: string;
  evidenceLinks: AgentCatalogCertification["evidenceLinks"];
}): string[] {
  const reasons: string[] = [];
  if (!evidence.securityOwner) {
    reasons.push("missing-security-owner");
  }
  if (!evidence.ownershipRecord) {
    reasons.push("missing-ownership-record");
  }
  return reasons;
}

function readNonEmptyString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function isFirstPartyPlugin(plugin: PluginIndexRecord): boolean {
  return plugin.sourceType === "system" || plugin.id.startsWith("team-orchestrator.bundled.");
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
