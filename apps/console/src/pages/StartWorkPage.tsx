import {
  ClipboardCheck,
  FileSearch,
  GitPullRequest,
  ListChecks,
  Rocket,
  SearchCheck,
  Sparkles,
} from "lucide-react";
import { Link } from "react-router-dom";
import styles from "./PageScaffold.module.css";

type WorkOutcome = {
  id: string;
  title: string;
  body: string;
  href: string;
  icon: JSX.Element;
  meta: string;
};

const outcomes: WorkOutcome[] = [
  {
    id: "first-run",
    title: "Run the first-run demo",
    body: "Instantiate the deterministic sample workflow and inspect its run evidence.",
    href: "/workflows?templateId=first-run.demo.workflow&capability=Run%20the%20first-run%20demo",
    icon: <Rocket size={18} />,
    meta: "No credentials",
  },
  {
    id: "repo-summary",
    title: "Summarize a repository",
    body: "Use the bundled software-team pack to describe structure, risks, and next steps.",
    href: "/tasks?agentId=bundled.software-team.repo-summary.local&version=0.1.0&capability=Summarize%20a%20repository",
    icon: <FileSearch size={18} />,
    meta: "Repo context",
  },
  {
    id: "code-review",
    title: "Review code changes",
    body: "Start a focused code review task using an existing local repository.",
    href: "/tasks?agentId=bundled.software-team.code-review.local&version=0.1.0&capability=Review%20code%20changes",
    icon: <SearchCheck size={18} />,
    meta: "Read-only",
  },
  {
    id: "release-readiness",
    title: "Check release readiness",
    body: "Run the bundled release workflow to collect readiness notes and evidence.",
    href: "/workflows?templateId=bundled.software-team.release-readiness.workflow&capability=Check%20release%20readiness",
    icon: <ClipboardCheck size={18} />,
    meta: "Workflow",
  },
  {
    id: "test-failure",
    title: "Explain a test failure",
    body: "Create a task that turns failure output into a concise debugging brief.",
    href: "/tasks?agentId=bundled.software-team.test-failure-explain.local&version=0.1.0&capability=Explain%20a%20test%20failure",
    icon: <ListChecks size={18} />,
    meta: "Local analysis",
  },
  {
    id: "github-pr",
    title: "Prepare a GitHub PR brief",
    body: "Use the GitHub connector pack when credentials and fixture context are ready.",
    href: "/workflows?templateId=bundled.github.pr-review-brief.workflow&capability=Prepare%20a%20GitHub%20PR%20brief",
    icon: <GitPullRequest size={18} />,
    meta: "Connector",
  },
];

export function StartWorkPage() {
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
        <div>
          <p className={styles.key}>Capabilities</p>
          <h3 className={styles.resourceTitle}>Bundled starting points</h3>
        </div>
        <div className={styles.createWorkGrid}>
          {outcomes.map((outcome) => (
            <Link key={outcome.id} to={outcome.href} className={styles.createWorkEntry}>
              <span className={styles.stepIcon}>{outcome.icon}</span>
              <span className={styles.value}>{outcome.title}</span>
              <span className={styles.settingsMuted}>{outcome.body}</span>
              <span className={styles.panelMeta}>{outcome.meta}</span>
            </Link>
          ))}
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
