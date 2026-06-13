import type { AgentCatalogPluginSummary, CapabilityPackOutcome } from "../features/agent-catalog";

export type StartWorkOutcome = {
  id: string;
  title: string;
  body: string;
  href: string;
  icon: string;
  meta: string;
  target: CapabilityPackOutcome["target"];
  contextRequirements: string[];
  expectedArtifacts: string[];
  executionMode: string;
};

export type StartWorkLaunchContext = {
  repositoryId?: string;
  runMode?: string;
};

export type StartWorkReadinessContext = {
  backingReady: boolean;
  repositoryReady: boolean;
  providerReady: boolean;
  connectorReady?: boolean;
};

export function buildStartWorkOutcomes(plugins: AgentCatalogPluginSummary[]): StartWorkOutcome[] {
  return plugins
    .filter((plugin) => plugin.enabled && plugin.status === "loaded")
    .flatMap((plugin) => (plugin.metadata.pack?.outcomes ?? []).map((outcome) => mapOutcome(plugin, outcome)))
    .filter((outcome): outcome is StartWorkOutcome => outcome !== undefined)
    .sort((left, right) => {
      const leftOrder = readOrder(left.id, plugins);
      const rightOrder = readOrder(right.id, plugins);
      if (leftOrder !== rightOrder) {
        return leftOrder - rightOrder;
      }
      return left.title.localeCompare(right.title);
    });
}

function mapOutcome(plugin: AgentCatalogPluginSummary, outcome: CapabilityPackOutcome): StartWorkOutcome | undefined {
  const href = buildOutcomeHref(outcome);
  if (!href) {
    return undefined;
  }
  const contextRequirements = outcome.contextRequirements.length > 0 ? outcome.contextRequirements : ["none"];
  return {
    id: `${plugin.id}:${outcome.id}`,
    title: outcome.title,
    body: outcome.description,
    href,
    icon: outcome.ui?.icon ?? readString(plugin.metadata.ui?.icon) ?? "sparkles",
    meta: outcome.ui?.badge ?? formatMeta(contextRequirements, outcome.executionMode),
    target: outcome.target,
    contextRequirements,
    expectedArtifacts: outcome.expectedArtifacts.map((artifact) => `${artifact.label} (${artifact.format})`),
    executionMode: outcome.executionMode,
  };
}

export function startWorkHrefWithContext(outcome: StartWorkOutcome, context: StartWorkLaunchContext): string {
  if (!outcome.href.startsWith("/")) {
    return outcome.href;
  }
  const url = new URL(outcome.href, "http://team-orchestrator.local");
  if (context.repositoryId) {
    url.searchParams.set("repoId", context.repositoryId);
  }
  if (context.runMode) {
    url.searchParams.set("runMode", context.runMode);
  }
  return `${url.pathname}${url.search}`;
}

export function startWorkBlockedReasons(outcome: StartWorkOutcome, context: StartWorkReadinessContext): string[] {
  const reasons: string[] = [];
  if (!context.backingReady) {
    reasons.push("Backing target is not available.");
  }
  if (outcome.contextRequirements.includes("repository") && !context.repositoryReady) {
    reasons.push("Select a ready repository.");
  }
  if (!context.providerReady) {
    reasons.push("Configure the required model provider.");
  }
  if (outcome.contextRequirements.includes("connector-account") && context.connectorReady === false) {
    reasons.push("Connect the required account.");
  }
  return reasons;
}

function buildOutcomeHref(outcome: CapabilityPackOutcome): string | undefined {
  const capability = encodeURIComponent(outcome.title);
  if (outcome.target.kind === "agent") {
    const params = new URLSearchParams({
      agentId: outcome.target.id,
      capability: outcome.title,
    });
    if (outcome.target.version) {
      params.set("version", outcome.target.version);
    }
    return `/tasks?${params.toString()}`;
  }
  if (outcome.target.kind === "workflow") {
    return `/workflows?templateId=${encodeURIComponent(outcome.target.id)}&capability=${capability}`;
  }
  return outcome.target.href;
}

function formatMeta(contextRequirements: string[], executionMode: string): string {
  const context = contextRequirements.includes("none") ? "No credentials" : contextRequirements.join(", ");
  return `${context} / ${executionMode}`;
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

function readOrder(outcomeId: string, plugins: AgentCatalogPluginSummary[]): number {
  for (const plugin of plugins) {
    for (const outcome of plugin.metadata.pack?.outcomes ?? []) {
      if (`${plugin.id}:${outcome.id}` === outcomeId) {
        return typeof outcome.ui?.order === "number" ? outcome.ui.order : Number.MAX_SAFE_INTEGER;
      }
    }
  }
  return Number.MAX_SAFE_INTEGER;
}
