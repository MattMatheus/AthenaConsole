import { CheckCircle2, CircleAlert, FolderGit2, RefreshCw, Route, Workflow } from "lucide-react";
import { Link } from "react-router-dom";
import { FleetDashboard } from "../features/fleet";
import { useReadinessQuery } from "../features/readiness";
import type { ReadinessCheck } from "../features/readiness";
import styles from "./PageScaffold.module.css";

export function DashboardPage() {
  const readinessQuery = useReadinessQuery();
  const readiness = readinessQuery.data;
  const sampleDemo = readiness?.checks.find((check) => check.id === "sample-demo");
  const blockedChecks = readiness?.checks.filter((check) => check.status !== "ok") ?? [];

  return (
    <section className={styles.page}>
      <div className={styles.pageHeader}>
        <p className={styles.lead}>
          Local orchestration readiness, active work, and recent operator activity in one place.
        </p>
        <div className={styles.headerActions}>
          <Link to="/workflows" className={styles.secondaryCta}>
            <Workflow size={16} /> Workflows
          </Link>
          <Link to="/tasks" className={styles.primaryCta}>
            <Route size={16} /> New Task
          </Link>
        </div>
      </div>
      <section className={styles.createWorkPanel}>
        <div>
          <p className={styles.key}>Create Work</p>
          <h2 className={styles.onboardingTitle}>Choose the right primitive</h2>
        </div>
        <div className={styles.createWorkGrid}>
          <WorkEntry to="/tasks" title="Task" body="One agent, one concrete unit of work." />
          <WorkEntry to="/workflows" title="Workflow" body="A plugin template that creates coordinated tasks." />
          <WorkEntry to="/schedules" title="Schedule" body="Repeat a ready task or workflow over time." />
          <WorkEntry to="/run-templates" title="Run preset" body="Advanced directive preset for repeatable local runs." />
        </div>
      </section>
      <section className={styles.createWorkPanel}>
        <div>
          <p className={styles.key}>After First-Run</p>
          <h2 className={styles.onboardingTitle}>Move from demo to your repo</h2>
          <p className={styles.settingsMuted}>
            The demo proves the local runtime. For real work, wire a target repo, confirm plugin-backed agents, then create a task or workflow with repo context.
          </p>
        </div>
        <div className={styles.createWorkGrid}>
          <WorkEntry to="/workflows" title="Run the demo" body="Validate the sample plugin and workflow path first." />
          <WorkEntry to="/resources" title="Wire repo" body="Review target repo, plugin path, and run-context guidance." />
          <WorkEntry to="/agents" title="Confirm agents" body="Check which plugin-backed capabilities are loaded." />
          <WorkEntry to="/tasks" title="Start real work" body="Create one clear task with repo path or objective inputs." />
        </div>
      </section>
      <FleetDashboard />
      <section className={styles.onboardingPanel}>
        <div className={styles.onboardingHeader}>
          <div>
            <p className={styles.key}>Next Actions</p>
            <h2 className={styles.onboardingTitle}>Keep the local console ready</h2>
          </div>
          <span className={readiness?.status === "ready" ? styles.statusReady : readiness?.status === "not-ready" ? styles.statusFailed : styles.statusDegraded}>
            {readinessQuery.isLoading ? "checking" : readiness?.status ?? "unavailable"}
          </span>
        </div>
        <div className={styles.onboardingGrid}>
          <OnboardingStep
            icon={<CheckCircle2 size={18} />}
            title="Check readiness"
            body={
              readinessQuery.error instanceof Error
                ? readinessQuery.error.message
                : blockedChecks[0]?.nextStep ?? "API, local state, plugins, and runtime checks are available."
            }
          />
          <OnboardingStep
            icon={<Workflow size={18} />}
            title="Run the demo"
            body={sampleDemo?.status === "ok" ? "Open workflow templates and instantiate the first-run demo." : sampleDemo?.nextStep ?? "Open workflow templates after the catalog loads."}
          />
          <OnboardingStep
            icon={<CircleAlert size={18} />}
            title="Inspect agents"
            body="Review indexed agents and plugins before assigning or resuming work."
          />
          <OnboardingStep
            icon={<FolderGit2 size={18} />}
            title="Wire a repo"
            body="Open Resource Controls for the current local repo wiring model and validation checklist."
          />
        </div>
        <div className={styles.readinessList} aria-label="Deployment readiness checks">
          {(readiness?.checks ?? []).map((check) => (
            <ReadinessItem key={check.id} check={check} />
          ))}
          {!readinessQuery.isLoading && !readiness?.checks.length ? (
            <p className={styles.settingsMuted}>Readiness checks are unavailable until the API responds.</p>
          ) : null}
        </div>
        <div className={styles.onboardingActions}>
          <button
            type="button"
            className={styles.settingsButton}
            onClick={() => void readinessQuery.refetch()}
            disabled={readinessQuery.isFetching}
          >
            <RefreshCw size={16} /> Refresh
          </button>
          <Link to="/agents" className={styles.inlineAction}>
            Agents
          </Link>
          <Link to="/resources" className={styles.inlineAction}>
            Repo wiring
          </Link>
          <Link to="/workflows" className={styles.inlineAction}>
            Workflow templates
          </Link>
        </div>
      </section>
    </section>
  );
}

function ReadinessItem({ check }: { check: ReadinessCheck }) {
  const statusLabel = check.status === "ok" ? "pass" : check.status === "degraded" ? "warn" : "fail";
  const statusClass =
    check.status === "ok" ? styles.readinessPass : check.status === "degraded" ? styles.readinessWarn : styles.readinessFail;

  return (
    <article className={styles.readinessItem}>
      <div className={styles.readinessItemHeader}>
        <div>
          <p className={styles.value}>{check.label}</p>
          <p className={styles.readinessMeta}>
            {check.category} · {check.required ? "required" : "optional"}
          </p>
        </div>
        <span className={`${styles.readinessBadge} ${statusClass}`}>{statusLabel}</span>
      </div>
      <p className={styles.settingsMuted}>{check.message}</p>
      {check.nextStep ? <p className={styles.readinessNextStep}>Next step: {check.nextStep}</p> : null}
    </article>
  );
}

function WorkEntry({ to, title, body }: { to: string; title: string; body: string }) {
  return (
    <Link to={to} className={styles.createWorkEntry}>
      <span className={styles.value}>{title}</span>
      <span className={styles.settingsMuted}>{body}</span>
    </Link>
  );
}

function OnboardingStep({ icon, title, body }: { icon: JSX.Element; title: string; body: string }) {
  return (
    <article className={styles.onboardingStep}>
      <span className={styles.stepIcon}>{icon}</span>
      <div>
        <p className={styles.value}>{title}</p>
        <p className={styles.settingsMuted}>{body}</p>
      </div>
    </article>
  );
}
