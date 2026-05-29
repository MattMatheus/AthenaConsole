import { CheckCircle2, CircleAlert, FolderGit2, RefreshCw, Route, Workflow } from "lucide-react";
import { Link } from "react-router-dom";
import { FleetDashboard } from "../features/fleet";
import { useReadinessQuery } from "../features/readiness";
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
