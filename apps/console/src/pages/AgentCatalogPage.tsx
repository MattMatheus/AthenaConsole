import { FileCode2, FolderCog, RefreshCw, Search, Wrench } from "lucide-react";
import { useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  useAgentCatalogAgentsQuery,
  useAgentCatalogPluginsQuery,
  type AgentCatalogValidationIssue,
  type AgentCatalogAgentSummary,
  type AgentCatalogPluginSourceScope,
  type AgentCatalogPluginSummary,
  type ProviderReadiness,
} from "../features/agent-catalog";
import styles from "./AgentCatalogPage.module.css";

type AvailabilityFilter = "all" | "available" | "warnings";
type SourceFilter = "all" | AgentCatalogPluginSourceScope;

const EMPTY_PLUGINS: AgentCatalogPluginSummary[] = [];
const EMPTY_AGENTS: AgentCatalogAgentSummary[] = [];

function asText(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

function formatLimit(value: unknown): string {
  return typeof value === "number" && Number.isFinite(value) ? String(value) : "-";
}

function implementationType(agent: AgentCatalogAgentSummary): string {
  return asText(agent.metadata.implementation?.type) ?? "unspecified";
}

function observabilityMode(agent: AgentCatalogAgentSummary): string {
  return asText(agent.metadata.observability?.mode) ?? "unspecified";
}

function runtimeLimitLabel(agent: AgentCatalogAgentSummary): string {
  const runtimeSeconds = formatLimit(agent.metadata.limits?.maxRuntimeSeconds);
  const toolCalls = formatLimit(agent.metadata.limits?.maxToolCalls);
  return `${runtimeSeconds}s / ${toolCalls} calls`;
}

function providerReadinessClass(readiness: ProviderReadiness): string {
  if (readiness.status === "configured") {
    return styles.badgeSuccess ?? "";
  }
  if (readiness.status === "missing" || readiness.status === "invalid") {
    return styles.badgeWarning ?? "";
  }
  return styles.badgeMuted ?? "";
}

function providerReadinessLabel(readiness: ProviderReadiness): string {
  if (readiness.status === "untested") {
    return "No provider required";
  }
  return readiness.providerName ?? readiness.providerId ?? readiness.providerKind ?? readiness.status;
}

function matchesSearch(agent: AgentCatalogAgentSummary, search: string): boolean {
  if (!search) {
    return true;
  }
  const lower = search.toLowerCase();
  return [
    agent.id,
    agent.name,
    agent.version,
    agent.plugin.id,
    agent.plugin.name,
    implementationType(agent),
    observabilityMode(agent),
    ...agent.capabilities,
  ].some((value) => value.toLowerCase().includes(lower));
}

function statusBadgeClass(status: string, available = true): string {
  if (!available || status === "invalid") {
    return styles.badgeDanger ?? "";
  }
  if (status === "loaded") {
    return styles.badgeSuccess ?? "";
  }
  return styles.badgeWarning ?? "";
}

function sourceLabel(sourceScope: AgentCatalogPluginSourceScope): string {
  return sourceScope === "system" ? "System" : "Workspace";
}

function uniqueCapabilities(agents: AgentCatalogAgentSummary[]): string[] {
  return Array.from(new Set(agents.flatMap((agent) => agent.capabilities))).sort((left, right) =>
    left.localeCompare(right),
  );
}

function countValidationIssues(plugins: AgentCatalogPluginSummary[]): number {
  return plugins.reduce((total, plugin) => total + plugin.validationErrors.length, 0);
}

function isDuplicateIdIssue(issue: AgentCatalogValidationIssue): boolean {
  return issue.message.toLowerCase().includes("duplicate") && issue.message.toLowerCase().includes("id/version");
}

function countDuplicateIdIssues(plugins: AgentCatalogPluginSummary[]): number {
  return plugins.reduce((total, plugin) => total + plugin.validationErrors.filter(isDuplicateIdIssue).length, 0);
}

function parseSourceFilter(value: string | null): SourceFilter {
  return value === "workspace" || value === "system" ? value : "all";
}

function parseAvailabilityFilter(value: string | null): AvailabilityFilter {
  return value === "available" || value === "warnings" ? value : "all";
}

function agentDetailSearch(agent: AgentCatalogAgentSummary, currentSearchParams: URLSearchParams): string {
  const next = new URLSearchParams(currentSearchParams);
  next.set("version", agent.version);
  return `?${next.toString()}`;
}

function renderPluginValidation(plugin: AgentCatalogPluginSummary): JSX.Element | null {
  if (plugin.validationErrors.length === 0) {
    return null;
  }
  return (
    <ul className={styles.validationList}>
      {plugin.validationErrors.slice(0, 3).map((issue, index) => (
        <li key={`${plugin.id}-${issue.path}-${index}`} className={styles.validationItem}>
          <strong>{issue.resourceType}</strong> {issue.path}: {issue.message}
          {issue.file ? <span className={styles.validationFile}>{issue.file}</span> : null}
        </li>
      ))}
      {plugin.validationErrors.length > 3 ? (
        <li className={styles.validationItem}>{plugin.validationErrors.length - 3} more validation issues</li>
      ) : null}
      <li className={styles.validationHelp}>
        Fix the plugin manifest or referenced source files on disk, then refresh the catalog.
      </li>
    </ul>
  );
}

export function AgentCatalogPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const capability = searchParams.get("capability") ?? "";
  const search = searchParams.get("q") ?? "";
  const source = parseSourceFilter(searchParams.get("source"));
  const availability = parseAvailabilityFilter(searchParams.get("state"));
  const capabilityQuery = capability ? { capabilities: [capability] } : {};
  const pluginsQuery = useAgentCatalogPluginsQuery();
  const allAgentsQuery = useAgentCatalogAgentsQuery();
  const agentsQuery = useAgentCatalogAgentsQuery(capabilityQuery);

  const plugins = pluginsQuery.data?.plugins ?? EMPTY_PLUGINS;
  const allAgents = allAgentsQuery.data?.agents ?? EMPTY_AGENTS;
  const agents = agentsQuery.data?.agents ?? EMPTY_AGENTS;
  const capabilityOptions = useMemo(() => uniqueCapabilities(allAgents), [allAgents]);
  const visibleAgents = useMemo(
    () =>
      agents.filter((agent) => {
        if (source !== "all" && agent.plugin.sourceScope !== source) {
          return false;
        }
        if (availability === "available" && !agent.available) {
          return false;
        }
        if (availability === "warnings" && agent.available && agent.validationErrors.length === 0 && agent.plugin.status === "loaded") {
          return false;
        }
        return matchesSearch(agent, search.trim());
      }),
    [agents, availability, search, source],
  );

  const isLoading = pluginsQuery.isLoading || allAgentsQuery.isLoading || agentsQuery.isLoading;
  const error = pluginsQuery.error ?? allAgentsQuery.error ?? agentsQuery.error;
  const workspacePlugins = plugins.filter((plugin) => plugin.sourceScope === "workspace").length;
  const systemPlugins = plugins.filter((plugin) => plugin.sourceScope === "system").length;
  const validationIssues = countValidationIssues(plugins);
  const duplicateIdIssues = countDuplicateIdIssues(plugins);

  async function handleRefresh(): Promise<void> {
    await Promise.all([pluginsQuery.refetch(), agentsQuery.refetch()]);
  }

  function updateFilter(key: "capability" | "q" | "source" | "state", value: string): void {
    const next = new URLSearchParams(searchParams);
    if (!value || value === "all") {
      next.delete(key);
    } else {
      next.set(key, value);
    }
    setSearchParams(next, { replace: true });
  }

  return (
    <section className={styles.page}>
      <div className={styles.pageHeader}>
        <p className={styles.lead}>
          Browse plugin-backed agents loaded from local manifests, inspect catalog readiness, and choose an existing capability for tasks or workflows.
        </p>
        <button
          type="button"
          className={styles.iconButton}
          onClick={() => void handleRefresh()}
          disabled={pluginsQuery.isFetching || agentsQuery.isFetching}
          aria-label="Refresh agent catalog"
          title="Refresh agent catalog"
        >
          <RefreshCw size={16} />
        </button>
      </div>

      <section className={styles.guidanceBand} aria-labelledby="agent-catalog-operating-model">
        <div>
          <p id="agent-catalog-operating-model" className={styles.panelTitle}>How agents arrive here</p>
          <p className={styles.description}>
            Agents are provided by local plugin packages discovered from configured plugin paths. To add or change agents, update plugin files on disk and refresh the catalog.
          </p>
          <Link className={styles.detailLink} to="/resources">
            Repo wiring guidance
          </Link>
        </div>
        <div className={styles.guidanceGrid}>
          <div className={styles.guidanceItem}>
            <FolderCog size={18} />
            <span>Workspace plugin paths provide operator-local agents.</span>
          </div>
          <div className={styles.guidanceItem}>
            <FileCode2 size={18} />
            <span>Manifests define capabilities, inputs, permissions, and runtime contracts.</span>
          </div>
          <div className={styles.guidanceItem}>
            <Wrench size={18} />
            <span>Run context, including target repo details, is supplied when work starts.</span>
          </div>
        </div>
      </section>

      {duplicateIdIssues > 0 ? (
        <section className={styles.warningBand} aria-labelledby="agent-catalog-duplicate-id-warning">
          <div>
            <p id="agent-catalog-duplicate-id-warning" className={styles.panelTitle}>Duplicate Plugin Or Agent Ids</p>
            <p className={styles.description}>
              {duplicateIdIssues} duplicate id issue{duplicateIdIssues === 1 ? "" : "s"} found. Copied plugins need unique plugin ids and agent ids before their agents can be indexed.
            </p>
          </div>
          <Link className={styles.detailLink} to="/docs">
            Agent docs
          </Link>
        </section>
      ) : null}

      <div className={styles.summaryGrid}>
        <div className={styles.metric}>
          <span className={styles.metricLabel}>Agents</span>
          <span className={styles.metricValue}>{allAgents.length}</span>
        </div>
        <div className={styles.metric}>
          <span className={styles.metricLabel}>Workspace Plugins</span>
          <span className={styles.metricValue}>{workspacePlugins}</span>
        </div>
        <div className={styles.metric}>
          <span className={styles.metricLabel}>System Plugins</span>
          <span className={styles.metricValue}>{systemPlugins}</span>
        </div>
        <div className={styles.metric}>
          <span className={styles.metricLabel}>Validation Issues</span>
          <span className={styles.metricValue}>{validationIssues}</span>
        </div>
        <div className={styles.metric}>
          <span className={styles.metricLabel}>Provider Issues</span>
          <span className={styles.metricValue}>
            {allAgents.filter((agent) => agent.providerReadiness.status === "missing" || agent.providerReadiness.status === "invalid").length}
          </span>
        </div>
      </div>

      <div className={styles.filters}>
        <label className={styles.field}>
          <span className={styles.fieldLabel}>Search</span>
          <span className={styles.inputWrap}>
            <Search size={15} />
            <input
              className={styles.input}
              value={search}
              onChange={(event) => updateFilter("q", event.target.value)}
              placeholder="agent, plugin, capability"
              type="search"
            />
          </span>
        </label>
        <label className={styles.field}>
          <span className={styles.fieldLabel}>Capability</span>
          <select className={styles.select} value={capability} onChange={(event) => updateFilter("capability", event.target.value)}>
            <option value="">All capabilities</option>
            {capabilityOptions.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
        <label className={styles.field}>
          <span className={styles.fieldLabel}>Source</span>
          <select className={styles.select} value={source} onChange={(event) => updateFilter("source", event.target.value)}>
            <option value="all">All sources</option>
            <option value="workspace">Workspace</option>
            <option value="system">System</option>
          </select>
        </label>
        <label className={styles.field}>
          <span className={styles.fieldLabel}>State</span>
          <select
            className={styles.select}
            value={availability}
            onChange={(event) => updateFilter("state", event.target.value)}
          >
            <option value="all">All states</option>
            <option value="available">Available</option>
            <option value="warnings">Warnings</option>
          </select>
        </label>
      </div>

      {isLoading ? (
        <div className={styles.state}>
          <p className={styles.stateTitle}>Loading Agent Catalog</p>
          <p className={styles.description}>Reading indexed plugins and agents from the local catalog API.</p>
        </div>
      ) : null}

      {error instanceof Error ? (
        <div className={styles.state}>
          <p className={styles.stateTitle}>Unable To Load Agent Catalog</p>
          <p className={styles.errorText}>{error.message}</p>
          <p className={styles.description}>Check that local plugin paths are readable and manifests are valid, then refresh the catalog.</p>
        </div>
      ) : null}

      {!isLoading && !error && plugins.length === 0 && allAgents.length === 0 ? (
        <div className={styles.state}>
          <p className={styles.stateTitle}>No Agents Indexed</p>
          <p className={styles.description}>
            Add plugin packages to the configured workspace or system plugin paths, then refresh the catalog. Sample agents are also loaded this way.
          </p>
          <div className={styles.actionBarStart}>
            <Link className={styles.detailLink} to="/workflows">
              Workflow templates
            </Link>
          </div>
        </div>
      ) : null}

      {!isLoading && !error && (plugins.length > 0 || agents.length > 0) ? (
        <div className={styles.layout}>
          <section className={styles.panel}>
            <div className={styles.panelHeader}>
              <div>
                <p className={styles.panelTitle}>Plugins</p>
                <p className={styles.panelMeta}>{plugins.length} indexed</p>
              </div>
            </div>
            <ul className={styles.pluginList}>
              {plugins.map((plugin) => (
                <li
                  key={`${plugin.id}@${plugin.version}`}
                  className={`${styles.pluginItem} ${plugin.validationErrors.length > 0 ? styles.pluginItemWarning : ""}`}
                >
                  <div className={styles.rowBetween}>
                    <div>
                      <p className={styles.pluginName}>{plugin.metadata.name}</p>
                      <p className={styles.mono}>{plugin.id}@{plugin.version}</p>
                    </div>
                    <span className={statusBadgeClass(plugin.status, plugin.enabled)}>{plugin.status}</span>
                  </div>
                  {plugin.metadata.description ? <p className={styles.description}>{plugin.metadata.description}</p> : null}
                  <div className={styles.badgeRow}>
                    <span className={styles.badge}>{sourceLabel(plugin.sourceScope)}</span>
                    <span className={plugin.enabled ? styles.badgeSuccess : styles.badgeDanger}>
                      {plugin.enabled ? "Enabled" : "Disabled"}
                    </span>
                    <span className={styles.badgeMuted}>{plugin.agentCount} agents</span>
                  </div>
                  {renderPluginValidation(plugin)}
                </li>
              ))}
            </ul>
          </section>

          <section className={styles.panel}>
            <div className={styles.panelHeader}>
              <div>
                <p className={styles.panelTitle}>Agents</p>
                <p className={styles.panelMeta}>{visibleAgents.length} shown from {agents.length} loaded</p>
              </div>
            </div>
            {visibleAgents.length === 0 ? (
              <div className={styles.state}>
                <p className={styles.stateTitle}>No Agents Match Filters</p>
                <p className={styles.description}>
                  Adjust the search, source, state, or capability filter. If an expected agent is missing, confirm its plugin path and manifest validation status.
                </p>
              </div>
            ) : (
              <div className={styles.tableWrap}>
                <table className={styles.agentTable}>
                  <thead>
                    <tr>
                      <th>Agent</th>
                      <th>Capabilities</th>
                      <th>Implementation</th>
                      <th>Observability</th>
                      <th>Safety Limits</th>
                      <th>Provider</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleAgents.map((agent) => (
                      <tr key={`${agent.id}@${agent.version}`}>
                        <td>
                          <div className={styles.agentPrimary}>
                            <span className={styles.agentName}>{agent.name}</span>
                            <Link
                              className={styles.detailLink}
                              to={{
                                pathname: `/agents/${encodeURIComponent(agent.id)}`,
                                search: agentDetailSearch(agent, searchParams),
                              }}
                            >
                              {agent.id}@{agent.version}
                            </Link>
                            <span className={styles.agentSecondary}>{agent.plugin.name}</span>
                          </div>
                        </td>
                        <td>
                          <div className={styles.capabilityList}>
                            {agent.capabilities.map((item) => (
                              <span key={item} className={styles.badge}>
                                {item}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td><span className={styles.mono}>{implementationType(agent)}</span></td>
                        <td><span className={styles.mono}>{observabilityMode(agent)}</span></td>
                        <td><span className={styles.mono}>{runtimeLimitLabel(agent)}</span></td>
                        <td>
                          <div className={styles.providerReadinessCell}>
                            <span className={providerReadinessClass(agent.providerReadiness)}>{agent.providerReadiness.status}</span>
                            <span className={styles.agentSecondary}>{providerReadinessLabel(agent.providerReadiness)}</span>
                          </div>
                        </td>
                        <td>
                          <div className={styles.badgeRow}>
                            <span className={statusBadgeClass(agent.status, agent.available)}>{agent.status}</span>
                            <span className={agent.available ? styles.badgeSuccess : styles.badgeWarning}>
                              {agent.available ? "Available" : "Unavailable"}
                            </span>
                            <span className={styles.badgeMuted}>{sourceLabel(agent.plugin.sourceScope)}</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      ) : null}
    </section>
  );
}
