import { CheckCircle2, FolderGit2, PlugZap, Route, Settings2 } from "lucide-react";
import { Link } from "react-router-dom";
import styles from "./PageScaffold.module.css";

export function ResourcesPage() {
  return (
    <section className={styles.page}>
      <div className={styles.pageHeader}>
        <div>
          <p className={styles.key}>Resource Controls</p>
          <h2 className={styles.pageTitle}>Repo Wiring</h2>
        </div>
        <div className={styles.headerActions}>
          <Link to="/agents" className={styles.secondaryCta}>
            <PlugZap size={16} /> Agents
          </Link>
          <Link to="/tasks" className={styles.primaryCta}>
            <Route size={16} /> New Task
          </Link>
        </div>
      </div>

      <p className={styles.lead}>
        Wire a local target repo through configuration or run context, then use plugin-backed agents and workflow templates against that repo.
      </p>

      <section className={styles.resourceHero}>
        <div>
          <p className={styles.key}>Operating Model</p>
          <h3 className={styles.resourceTitle}>Team Orchestrator does not save repositories yet</h3>
          <p className={styles.settingsMuted}>
            The workspace owns app state and plugin discovery. The target repo is the local project path you expose to the runtime and pass into work when an agent or workflow needs it.
          </p>
        </div>
        <div className={styles.resourceTermGrid}>
          <TermCard title="Workspace" body="Owns .athena state, local config, relative plugin paths, and artifacts." />
          <TermCard title="Plugin path" body="Contains plugin packages that provide agents and workflow templates." />
          <TermCard title="Target repo" body="The local codebase agents should inspect or modify during a run." />
          <TermCard title="Run context" body="Task or workflow inputs that name the repo, files, branch, or objective." />
        </div>
      </section>

      <div className={styles.resourceGrid}>
        <section className={styles.settingsPanel}>
          <div className={styles.settingsHeader}>
            <div>
              <p className={styles.key}>Local Compose</p>
              <h3 className={styles.resourceTitle}>Mount the target repo</h3>
            </div>
            <FolderGit2 size={18} />
          </div>
          <p className={styles.settingsMuted}>
            For Docker Compose, expose a host repo path to the services and use the container path as the repo value in task or workflow inputs.
          </p>
          <dl className={styles.resourceKvList}>
            <Kv label="Host repo path" value="ATHENA_REPO_HOST_PATH" />
            <Kv label="Container repo path" value="ATHENA_REPO_CONTAINER_PATH" />
            <Kv label="Default container path" value="/workspace/target-repo" />
            <Kv label="Sandbox host path" value="ATHENA_SANDBOX_WORKSPACE_HOST_PATH" />
          </dl>
        </section>

        <section className={styles.settingsPanel}>
          <div className={styles.settingsHeader}>
            <div>
              <p className={styles.key}>Agent Supply</p>
              <h3 className={styles.resourceTitle}>Load plugins separately</h3>
            </div>
            <PlugZap size={18} />
          </div>
          <p className={styles.settingsMuted}>
            Plugin directories provide agents. They can live in the workspace, system paths, or another configured local directory; they are not the same thing as the target repo.
          </p>
          <dl className={styles.resourceKvList}>
            <Kv label="Workspace plugins" value="ATHENA_PLUGIN_PATHS" />
            <Kv label="System plugins" value="ATHENA_SYSTEM_PLUGIN_PATHS" />
            <Kv label="Catalog action" value="Refresh Agents after changing plugin files." />
          </dl>
        </section>
      </div>

      <section className={styles.settingsPanel}>
        <div className={styles.settingsHeader}>
          <div>
            <p className={styles.key}>Checklist</p>
            <h3 className={styles.resourceTitle}>First real repo run</h3>
          </div>
          <CheckCircle2 size={18} />
        </div>
        <ol className={styles.resourceSteps}>
          <li>Choose the local repository path you want agents to operate on.</li>
          <li>For Docker Compose, set `ATHENA_REPO_HOST_PATH`; use `ATHENA_REPO_CONTAINER_PATH` or `/workspace/target-repo` inside run inputs.</li>
          <li>Add or update plugin packages through configured plugin paths, then refresh the Agents catalog.</li>
          <li>Confirm the selected agent or workflow template declares inputs for repo path, files, branch, or objective.</li>
          <li>Create a task or instantiate a workflow and provide the target repo as run context.</li>
        </ol>
      </section>

      <section className={styles.resourceCallout}>
        <Settings2 size={18} />
        <div>
          <p className={styles.value}>Current boundary</p>
          <p className={styles.settingsMuted}>
            This guidance uses today&apos;s configuration and runtime behavior. Repository CRUD, remote clone, Git provider auth, and console-native agent authoring are intentionally outside this flow.
          </p>
        </div>
      </section>
    </section>
  );
}

function TermCard({ title, body }: { title: string; body: string }) {
  return (
    <article className={styles.resourceTerm}>
      <p className={styles.value}>{title}</p>
      <p className={styles.settingsMuted}>{body}</p>
    </article>
  );
}

function Kv({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.resourceKvRow}>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
