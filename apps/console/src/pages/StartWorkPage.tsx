import {
  ClipboardCheck,
  FileSearch,
  GitPullRequest,
  ListChecks,
  Rocket,
  SearchCheck,
  Sparkles,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  useAgentCatalogAgentsQuery,
  useAgentCatalogPluginsQuery,
  type AgentCatalogAgentSummary,
  type ProviderReadiness,
} from "../features/agent-catalog";
import {
  connectedRepositoryReadinessMessage,
  useConnectedRepositoriesQuery,
} from "../features/connected-repositories";
import { useWorkflowTemplatesQuery, type WorkflowTemplateSummary } from "../features/workflow-templates";
import styles from "./PageScaffold.module.css";
import {
  buildStartWorkOutcomes,
  startWorkBlockedReasons,
  startWorkHrefWithContext,
  type StartWorkOutcome,
} from "./startWorkModel";

const RUN_MODES = ["read-only", "propose-changes", "approved-write"] as const;

export function StartWorkPage() {
  const pluginsQuery = useAgentCatalogPluginsQuery();
  const agentsQuery = useAgentCatalogAgentsQuery();
  const templatesQuery = useWorkflowTemplatesQuery({ includeUnavailable: true });
  const repositoriesQuery = useConnectedRepositoriesQuery();
  const [selectedRepositoryId, setSelectedRepositoryId] = useState("");
  const [runMode, setRunMode] = useState<(typeof RUN_MODES)[number]>("read-only");
  const outcomes = buildStartWorkOutcomes(pluginsQuery.data?.plugins ?? []);
  const agents = agentsQuery.data?.agents ?? [];
  const templates = templatesQuery.data?.templates ?? [];
  const repositories = repositoriesQuery.data?.repositories ?? [];
  const selectedRepository = repositories.find((repository) => repository.id === selectedRepositoryId);
  const repositoryReadinessMessage = connectedRepositoryReadinessMessage(selectedRepository);
  const repositoryReady = Boolean(selectedRepository && !repositoryReadinessMessage);

  useEffect(() => {
    if (selectedRepositoryId || repositoriesQuery.isLoading) {
      return;
    }
    const readyRepository = repositories.find((repository) => repository.status === "ready");
    if (readyRepository) {
      setSelectedRepositoryId(readyRepository.id);
    }
  }, [repositories, repositoriesQuery.isLoading, selectedRepositoryId]);

  return (
    <section className={styles.page}>
      <div className={styles.pageHeader}>
        <div>
          <p className={styles.panelMeta}>Start Work</p>
          <h2 className={styles.pageTitle}>Choose what you want done</h2>
        </div>
        <div className={styles.headerActions}>
          <Link to="/resources" className={styles.secondaryCta}>
            <Sparkles size={16} /> Resources
          </Link>
          <Link to="/runs" className={styles.secondaryCta}>
            <ListChecks size={16} /> Work History
          </Link>
        </div>
      </div>

      <p className={styles.lead}>
        Start from an outcome. Team Orchestrator will still show the backing agent or workflow before execution, but you do not need to choose that primitive first.
      </p>

      <section className={styles.createWorkPanel}>
        <div className={styles.createWorkHeader}>
          <div>
            <p className={styles.key}>Capabilities</p>
            <h3 className={styles.resourceTitle}>Bundled starting points</h3>
          </div>
          <div className={styles.startWorkControls}>
            <label className={styles.startWorkControl}>
              <span>Repository</span>
              <select value={selectedRepositoryId} onChange={(event) => setSelectedRepositoryId(event.target.value)}>
                <option value="">No repository selected</option>
                {repositories.map((repository) => (
                  <option key={repository.id} value={repository.id}>
                    {repository.name} ({repository.status})
                  </option>
                ))}
              </select>
            </label>
            <label className={styles.startWorkControl}>
              <span>Run mode</span>
              <select value={runMode} onChange={(event) => setRunMode(event.target.value as (typeof RUN_MODES)[number])}>
                {RUN_MODES.map((mode) => (
                  <option key={mode} value={mode}>
                    {runModeLabel(mode)}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
        {repositoryReadinessMessage ? <p className={styles.settingsMuted}>{repositoryReadinessMessage}</p> : null}
        <div className={styles.createWorkGrid}>
          {pluginsQuery.isLoading || agentsQuery.isLoading || templatesQuery.isLoading || repositoriesQuery.isLoading ? (
            <p className={styles.settingsMuted}>Loading starting points...</p>
          ) : null}
          {pluginsQuery.error instanceof Error ? <p>{pluginsQuery.error.message}</p> : null}
          {agentsQuery.error instanceof Error ? <p>{agentsQuery.error.message}</p> : null}
          {templatesQuery.error instanceof Error ? <p>{templatesQuery.error.message}</p> : null}
          {repositoriesQuery.error instanceof Error ? <p>{repositoriesQuery.error.message}</p> : null}
          {outcomes.map((outcome) => {
            const readiness = outcomeReadiness(outcome, agents, templates, repositoryReady);
            const href = startWorkHrefWithContext(outcome, { repositoryId: selectedRepositoryId, runMode });
            return <StartWorkCard key={outcome.id} outcome={outcome} href={href} blockedReasons={readiness.blockedReasons} />;
          })}
          {!pluginsQuery.isLoading && outcomes.length === 0 ? (
            <p className={styles.settingsMuted}>No packaged starting points are available yet.</p>
          ) : null}
        </div>
      </section>

      <section className={styles.advancedNotice}>
        <h3>Need the lower-level surfaces?</h3>
        <p>
          Tasks, workflows, agents, schedules, and run templates are still available. Start Work is the operator path; the primitive screens remain useful for authors, diagnostics, and direct inspection.
        </p>
        <div className={styles.headerActions}>
          <Link to="/tasks" className={styles.inlineAction}>Tasks</Link>
          <Link to="/workflows" className={styles.inlineAction}>Workflows</Link>
          <Link to="/agents" className={styles.inlineAction}>Agents</Link>
          <Link to="/run-templates" className={styles.inlineAction}>Run Templates</Link>
        </div>
      </section>
    </section>
  );
}

function StartWorkCard({
  blockedReasons,
  href,
  outcome,
}: {
  blockedReasons: string[];
  href: string;
  outcome: StartWorkOutcome;
}) {
  const content = (
    <>
      <span className={styles.stepIcon}>{iconForOutcome(outcome)}</span>
      <span className={styles.value}>{outcome.title}</span>
      <span className={styles.settingsMuted}>{outcome.body}</span>
      <span className={styles.panelMeta}>{outcome.meta}</span>
      {blockedReasons.length > 0 ? <span className={styles.startWorkBlocked}>{blockedReasons.join(" ")}</span> : null}
    </>
  );

  if (blockedReasons.length > 0) {
    return (
      <article className={`${styles.createWorkEntry} ${styles.createWorkEntryDisabled}`} aria-disabled="true">
        {content}
      </article>
    );
  }

  return (
    <Link to={href} className={styles.createWorkEntry}>
      {content}
    </Link>
  );
}

function outcomeReadiness(
  outcome: StartWorkOutcome,
  agents: AgentCatalogAgentSummary[],
  templates: WorkflowTemplateSummary[],
  repositoryReady: boolean,
): { blockedReasons: string[] } {
  const target = outcome.target.kind === "agent"
    ? agents?.find((agent) => agent.id === outcome.target.id && (!outcome.target.version || agent.version === outcome.target.version))
    : outcome.target.kind === "workflow"
      ? templates?.find((template) => template.id === outcome.target.id && (!outcome.target.version || template.version === outcome.target.version))
      : undefined;
  const providerReadiness = target?.providerReadiness as ProviderReadiness | undefined;
  const providerReady = providerReadiness ? !isProviderReadinessBlocking(providerReadiness) : outcome.target.kind === "link";
  return {
    blockedReasons: startWorkBlockedReasons(outcome, {
      backingReady: outcome.target.kind === "link" || Boolean(target),
      repositoryReady,
      providerReady,
    }),
  };
}

function isProviderReadinessBlocking(readiness: ProviderReadiness): boolean {
  return Boolean(readiness.required && (readiness.status === "missing" || readiness.status === "invalid"));
}

function runModeLabel(mode: (typeof RUN_MODES)[number]): string {
  if (mode === "read-only") {
    return "Read-only";
  }
  if (mode === "propose-changes") {
    return "Propose changes";
  }
  return "Approved write";
}

function iconForOutcome(outcome: StartWorkOutcome): JSX.Element {
  if (outcome.icon === "rocket") {
    return <Rocket size={18} />;
  }
  if (outcome.icon === "file-search" || outcome.icon === "folder-search") {
    return <FileSearch size={18} />;
  }
  if (outcome.icon === "search-check") {
    return <SearchCheck size={18} />;
  }
  if (outcome.icon === "clipboard-check" || outcome.icon === "list-checks") {
    return <ClipboardCheck size={18} />;
  }
  if (outcome.icon === "git-pull-request" || outcome.icon === "github") {
    return <GitPullRequest size={18} />;
  }
  if (outcome.icon === "list-checks-alt") {
    return <ListChecks size={18} />;
  }
  return <Sparkles size={18} />;
}
