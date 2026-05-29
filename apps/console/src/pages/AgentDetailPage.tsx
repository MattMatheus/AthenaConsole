import { ArrowLeft, FileText, Play, ShieldCheck } from "lucide-react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import {
  useAgentCatalogAgentsQuery,
  useAgentCatalogPluginsQuery,
  type AgentCatalogAgentSummary,
  type AgentCatalogPluginSummary,
} from "../features/agent-catalog";
import styles from "./AgentCatalogPage.module.css";

const EMPTY_AGENTS: AgentCatalogAgentSummary[] = [];
const EMPTY_PLUGINS: AgentCatalogPluginSummary[] = [];

function asText(value: unknown): string {
  return typeof value === "string" && value.trim().length > 0 ? value : "unspecified";
}

function asNumberText(value: unknown): string {
  return typeof value === "number" && Number.isFinite(value) ? String(value) : "not declared";
}

function toEntries(record: Record<string, unknown> | undefined): Array<[string, unknown]> {
  return record ? Object.entries(record) : [];
}

function toCatalogSearch(searchParams: URLSearchParams): string {
  const next = new URLSearchParams(searchParams);
  next.delete("version");
  const query = next.toString();
  return query ? `?${query}` : "";
}

function permissionRiskLabels(permissions: Record<string, unknown> | undefined): string[] {
  const labels: string[] = [];
  if (permissions?.network === "write" || permissions?.network === "allow") {
    labels.push("network-write");
  } else if (permissions?.network === "read") {
    labels.push("network-read");
  }
  if (permissions?.filesystem === "write") {
    labels.push("filesystem-write");
  } else if (permissions?.filesystem === "scoped") {
    labels.push("local-write");
  }
  if (permissions?.shell === "allow") {
    labels.push("shell-command");
  }
  if (permissions?.containers === "allow") {
    labels.push("container-control");
  }
  if (permissions?.credentials === "scoped") {
    labels.push("credential-access");
  }
  const approvals = Array.isArray(permissions?.approvalRequiredFor)
    ? permissions.approvalRequiredFor.filter((item): item is string => typeof item === "string")
    : [];
  return Array.from(new Set([...labels, ...approvals])).sort((left, right) => left.localeCompare(right));
}

function renderKvList(entries: Array<[string, unknown]>, emptyText: string): JSX.Element {
  if (entries.length === 0) {
    return <p className={styles.description}>{emptyText}</p>;
  }
  return (
    <dl className={styles.detailKvList}>
      {entries.map(([key, value]) => (
        <div key={key} className={styles.detailKvRow}>
          <dt>{key}</dt>
          <dd>{renderValue(value)}</dd>
        </div>
      ))}
    </dl>
  );
}

function renderValue(value: unknown): JSX.Element | string {
  if (value === null || value === undefined) {
    return "not declared";
  }
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return <code className={styles.inlineJson}>{JSON.stringify(value)}</code>;
}

function findAgent(
  agents: AgentCatalogAgentSummary[],
  agentId: string | undefined,
  version: string | null,
): AgentCatalogAgentSummary | undefined {
  if (!agentId) {
    return undefined;
  }
  return agents.find((agent) => agent.id === agentId && (!version || agent.version === version));
}

export function AgentDetailPage() {
  const params = useParams<{ agentId: string }>();
  const [searchParams] = useSearchParams();
  const version = searchParams.get("version");
  const agentsQuery = useAgentCatalogAgentsQuery();
  const pluginsQuery = useAgentCatalogPluginsQuery();
  const agents = agentsQuery.data?.agents ?? EMPTY_AGENTS;
  const plugins = pluginsQuery.data?.plugins ?? EMPTY_PLUGINS;
  const agent = findAgent(agents, params.agentId, version);
  const plugin = agent
    ? plugins.find((candidate) => candidate.id === agent.plugin.id && candidate.version === agent.plugin.version)
    : undefined;
  const isLoading = agentsQuery.isLoading || pluginsQuery.isLoading;
  const error = agentsQuery.error ?? pluginsQuery.error;
  const catalogHref = `/agents${toCatalogSearch(searchParams)}`;

  if (isLoading) {
    return (
      <section className={styles.page}>
        <Link className={styles.backLink} to={catalogHref}>
          <ArrowLeft size={16} /> Catalog
        </Link>
        <div className={styles.state}>
          <p className={styles.stateTitle}>Loading Agent</p>
          <p className={styles.description}>Reading the agent manifest contract from the catalog API.</p>
        </div>
      </section>
    );
  }

  if (error instanceof Error) {
    return (
      <section className={styles.page}>
        <Link className={styles.backLink} to={catalogHref}>
          <ArrowLeft size={16} /> Catalog
        </Link>
        <div className={styles.state}>
          <p className={styles.stateTitle}>Unable To Load Agent</p>
          <p className={styles.errorText}>{error.message}</p>
        </div>
      </section>
    );
  }

  if (!agent) {
    return (
      <section className={styles.page}>
        <Link className={styles.backLink} to={catalogHref}>
          <ArrowLeft size={16} /> Catalog
        </Link>
        <div className={styles.state}>
          <p className={styles.stateTitle}>Agent Not Found</p>
          <p className={styles.description}>The requested agent is not present in the indexed local catalog.</p>
        </div>
      </section>
    );
  }

  const riskLabels = permissionRiskLabels(agent.metadata.permissions);
  const artifactHints = Array.isArray(agent.metadata.outputs?.artifacts) ? agent.metadata.outputs.artifacts : [];

  return (
    <section className={styles.page}>
      <div className={styles.detailHeader}>
        <Link className={styles.backLink} to={catalogHref}>
          <ArrowLeft size={16} /> Catalog
        </Link>
        <div className={styles.detailTitleBlock}>
          <p className={styles.panelMeta}>Agent Detail</p>
          <h2 className={styles.detailTitle}>{agent.name}</h2>
          <p className={styles.mono}>{agent.id}@{agent.version}</p>
        </div>
        <div className={styles.badgeRow}>
          <span className={agent.available ? styles.badgeSuccess : styles.badgeWarning}>
            {agent.available ? "Available" : "Unavailable"}
          </span>
          <span className={styles.badge}>{agent.plugin.sourceScope === "system" ? "System" : "Workspace"}</span>
          <span className={styles.badgeMuted}>{agent.status}</span>
        </div>
      </div>

      {agent.metadata.description ? <p className={styles.lead}>{agent.metadata.description}</p> : null}

      <section className={styles.nextActionPanel}>
        <div>
          <p className={styles.panelTitle}>Use this agent</p>
          <p className={styles.description}>
            This agent is supplied by {agent.plugin.name}. Start work by creating a task with run context or by choosing a workflow template that uses compatible capabilities.
          </p>
        </div>
        <div className={styles.actionBarEnd}>
          <Link className={styles.primaryLink} to="/tasks">
            <Play size={15} /> New task
          </Link>
          <Link className={styles.detailLink} to="/workflows">
            Workflow templates
          </Link>
        </div>
      </section>

      <div className={styles.detailGrid}>
        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <p className={styles.panelTitle}>Runtime Contract</p>
              <p className={styles.panelMeta}>Implementation and observability</p>
            </div>
            <FileText size={18} />
          </div>
          <div className={styles.detailBody}>
            {renderKvList(
              [
                ["implementation", asText(agent.metadata.implementation?.type)],
                ["command", asText(agent.metadata.implementation?.command)],
                ["preferredBackend", asText(agent.metadata.runtime?.preferredBackend)],
                ["observability", asText(agent.metadata.observability?.mode)],
                ["maxRuntimeSeconds", asNumberText(agent.metadata.limits?.maxRuntimeSeconds)],
                ["maxToolCalls", asNumberText(agent.metadata.limits?.maxToolCalls)],
                ["maxRetries", asNumberText(agent.metadata.limits?.maxRetries)],
              ],
              "No runtime contract metadata declared.",
            )}
          </div>
        </section>

        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <p className={styles.panelTitle}>Source Plugin</p>
              <p className={styles.panelMeta}>Indexed package metadata</p>
            </div>
          </div>
          <div className={styles.detailBody}>
            <p className={styles.pluginName}>{agent.plugin.name}</p>
            <p className={styles.mono}>{agent.plugin.id}@{agent.plugin.version}</p>
            {plugin?.metadata.description ? <p className={styles.description}>{plugin.metadata.description}</p> : null}
            <p className={styles.description}>
              Plugin manifests on disk define this agent's capabilities, inputs, permissions, and runtime contract.
            </p>
            <div className={styles.badgeRow}>
              <span className={agent.plugin.enabled ? styles.badgeSuccess : styles.badgeDanger}>
                {agent.plugin.enabled ? "Enabled" : "Disabled"}
              </span>
              <span className={agent.plugin.status === "loaded" ? styles.badgeSuccess : styles.badgeWarning}>
                {agent.plugin.status}
              </span>
              <span className={styles.badgeMuted}>{agent.plugin.sourceType}</span>
            </div>
            {plugin ? (
              <p className={styles.description}>
                Path: <span className={styles.mono}>{plugin.path}</span>
              </p>
            ) : null}
          </div>
        </section>
      </div>

      <div className={styles.detailGrid}>
        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <p className={styles.panelTitle}>Inputs</p>
              <p className={styles.panelMeta}>Declared task fields</p>
            </div>
          </div>
          <div className={styles.detailBody}>
            {renderKvList(toEntries(agent.metadata.inputs), "No input fields declared in catalog metadata.")}
          </div>
        </section>

        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <p className={styles.panelTitle}>Outputs</p>
              <p className={styles.panelMeta}>Mode and artifact hints</p>
            </div>
          </div>
          <div className={styles.detailBody}>
            {renderKvList(toEntries(agent.metadata.outputs), "No output contract declared in catalog metadata.")}
            {artifactHints.length > 0 ? (
              <div className={styles.artifactHintList}>
                {artifactHints.map((hint, index) => (
                  <code key={index} className={styles.inlineJson}>{JSON.stringify(hint)}</code>
                ))}
              </div>
            ) : null}
          </div>
        </section>
      </div>

      <section className={styles.panel}>
        <div className={styles.panelHeader}>
          <div>
            <p className={styles.panelTitle}>Permissions And Safety</p>
            <p className={styles.panelMeta}>Risk classes, approvals, and declared limits</p>
          </div>
          <ShieldCheck size={18} />
        </div>
        <div className={styles.detailBody}>
          <div className={styles.badgeRow}>
            {riskLabels.length > 0 ? (
              riskLabels.map((label) => (
                <span key={label} className={styles.badgeWarning}>{label}</span>
              ))
            ) : (
              <span className={styles.badgeSuccess}>read-only or undeclared</span>
            )}
          </div>
          {renderKvList(toEntries(agent.metadata.permissions), "No permissions metadata declared.")}
        </div>
      </section>

      <section className={styles.panel}>
        <div className={styles.panelHeader}>
          <div>
            <p className={styles.panelTitle}>Capabilities</p>
            <p className={styles.panelMeta}>Assignment matching signals</p>
          </div>
        </div>
        <div className={styles.detailBody}>
          <div className={styles.capabilityList}>
            {agent.capabilities.map((capability) => (
              <span key={capability} className={styles.badge}>{capability}</span>
            ))}
          </div>
        </div>
      </section>
    </section>
  );
}
