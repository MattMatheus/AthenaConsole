import { CheckCircle2, Database, FolderGit2, GitBranch, ListChecks, PlugZap, RefreshCw, Route, Save } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  useConnectedRepositoriesQuery,
  useCreateConnectedRepositoryMutation,
  useInspectConnectedRepositoryMutation,
  type ConnectedRepository,
  type ConnectedRepositoryCreateRequest,
} from "../features/connected-repositories";
import styles from "./PageScaffold.module.css";

type ManagedCloneFormState = {
  name: string;
  remoteUrl: string;
  defaultBranch: string;
};

type ExistingPathFormState = {
  name: string;
  workspacePath: string;
  hostPath: string;
};

const initialManagedCloneForm: ManagedCloneFormState = {
  name: "",
  remoteUrl: "",
  defaultBranch: "",
};

const initialExistingPathForm: ExistingPathFormState = {
  name: "",
  workspacePath: "",
  hostPath: "",
};

function trimOptional(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function formatDate(value: string | undefined): string {
  if (!value) {
    return "Not inspected";
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function shortCommit(value: string | undefined): string {
  return value ? value.slice(0, 12) : "No commit";
}

function sourceLabel(repository: ConnectedRepository): string {
  return repository.sourceType === "managed-clone" ? "Managed clone" : "Existing path";
}

function statusClass(repository: ConnectedRepository): string {
  if (repository.status === "ready") {
    return styles.statusReady ?? "";
  }
  if (repository.status === "missing" || repository.status === "invalid" || repository.status === "error") {
    return styles.statusFailed ?? "";
  }
  return styles.statusDegraded ?? "";
}

export function ResourcesPage() {
  const repositoriesQuery = useConnectedRepositoriesQuery();
  const createRepositoryMutation = useCreateConnectedRepositoryMutation();
  const inspectRepositoryMutation = useInspectConnectedRepositoryMutation();
  const repositories = useMemo(() => repositoriesQuery.data?.repositories ?? [], [repositoriesQuery.data?.repositories]);
  const [selectedRepositoryId, setSelectedRepositoryId] = useState("");
  const [managedCloneForm, setManagedCloneForm] = useState<ManagedCloneFormState>(initialManagedCloneForm);
  const [existingPathForm, setExistingPathForm] = useState<ExistingPathFormState>(initialExistingPathForm);
  const [formError, setFormError] = useState<string | null>(null);
  const selectedRepository = useMemo(
    () => repositories.find((repository) => repository.id === selectedRepositoryId) ?? repositories[0],
    [repositories, selectedRepositoryId],
  );
  const activeError = formError ?? mutationError(createRepositoryMutation.error) ?? mutationError(inspectRepositoryMutation.error);

  function createRepository(request: ConnectedRepositoryCreateRequest, clearForm: () => void): void {
    setFormError(null);
    createRepositoryMutation.mutate(request, {
      onSuccess: (repository) => {
        setSelectedRepositoryId(repository.id);
        clearForm();
      },
    });
  }

  function submitManagedClone(): void {
    const name = managedCloneForm.name.trim();
    const remoteUrl = managedCloneForm.remoteUrl.trim();
    if (!name || !remoteUrl) {
      setFormError("Managed clones need a name and a public HTTP(S) Git URL.");
      return;
    }
    const defaultBranch = trimOptional(managedCloneForm.defaultBranch);
    createRepository(
      {
        name,
        sourceType: "managed-clone",
        remoteUrl,
        ...(defaultBranch ? { defaultBranch } : {}),
      },
      () => setManagedCloneForm(initialManagedCloneForm),
    );
  }

  function submitExistingPath(): void {
    const name = existingPathForm.name.trim();
    const workspacePath = existingPathForm.workspacePath.trim();
    if (!name || !workspacePath) {
      setFormError("Existing-path repositories need a name and an absolute workspace path.");
      return;
    }
    const hostPath = trimOptional(existingPathForm.hostPath);
    createRepository(
      {
        name,
        sourceType: "existing-path",
        workspacePath,
        ...(hostPath ? { hostPath } : {}),
      },
      () => setExistingPathForm(initialExistingPathForm),
    );
  }

  async function refreshAll(): Promise<void> {
    await repositoriesQuery.refetch();
  }

  return (
    <section className={styles.page}>
      <div className={styles.pageHeader}>
        <h2 className={styles.pageTitle}>Repositories</h2>
        <div className={styles.headerActions}>
          <button
            type="button"
            className={styles.secondaryCta}
            onClick={() => void refreshAll()}
            disabled={repositoriesQuery.isFetching}
          >
            <RefreshCw size={16} /> Refresh
          </button>
          <Link to="/agents" className={styles.secondaryCta}>
            <PlugZap size={16} /> Agents
          </Link>
          <Link to="/tasks" className={styles.primaryCta}>
            <Route size={16} /> New Task
          </Link>
        </div>
      </div>

      <p className={styles.lead}>
        Connect the local or cloned Git repositories that agents will inspect and modify during work.
      </p>

      <section className={styles.repoSummaryGrid}>
        <StatusTile label="Connected" value={String(repositories.length)} />
        <StatusTile label="Ready" value={String(repositories.filter((repository) => repository.status === "ready").length)} />
        <StatusTile label="Dirty" value={String(repositories.filter((repository) => repository.dirtyState === "dirty").length)} />
        <StatusTile label="Selected" value={selectedRepository?.name ?? "None"} />
      </section>

      <section className={styles.settingsPanel}>
        <div className={styles.settingsHeader}>
          <div>
            <p className={styles.key}>Advanced Runtime Diagnostics</p>
            <h3 className={styles.resourceTitle}>Work queues and retained context</h3>
          </div>
          <ListChecks size={18} />
        </div>
        <div className={styles.providerGuidanceGrid}>
          <article className={styles.providerGuidanceItem}>
            <span className={styles.stepIcon}>
              <ListChecks size={16} />
            </span>
            <div>
              <p className={styles.value}>Work queue inspection</p>
              <p className={styles.settingsMuted}>
                Session-backed work queues are retained as an advanced diagnostic for stuck or compatibility runs, not as a primary task workflow.
              </p>
              <p className={styles.mono}>GET /api/v1/sessions/&lt;id&gt;/work-queue</p>
            </div>
          </article>
          <article className={styles.providerGuidanceItem}>
            <span className={styles.stepIcon}>
              <Database size={16} />
            </span>
            <div>
              <p className={styles.value}>Memory search</p>
              <p className={styles.settingsMuted}>
                Memory search is retained for local context debugging when memory indexing is enabled.
              </p>
              <p className={styles.mono}>GET /api/v1/memory/search</p>
            </div>
          </article>
        </div>
      </section>

      <div className={styles.repoConnectionGrid}>
        <form
          className={styles.settingsPanel}
          onSubmit={(event) => {
            event.preventDefault();
            submitManagedClone();
          }}
        >
          <div className={styles.settingsHeader}>
            <div>
              <p className={styles.key}>Managed Clone</p>
              <h3 className={styles.resourceTitle}>Clone a public repo</h3>
            </div>
            <FolderGit2 size={18} />
          </div>
          <label className={styles.repoField}>
            <span>Name</span>
            <input
              className={styles.settingsInput}
              value={managedCloneForm.name}
              onChange={(event) => setManagedCloneForm((current) => ({ ...current, name: event.target.value }))}
              placeholder="Docs site"
            />
          </label>
          <label className={styles.repoField}>
            <span>Git URL</span>
            <input
              className={styles.settingsInput}
              value={managedCloneForm.remoteUrl}
              onChange={(event) => setManagedCloneForm((current) => ({ ...current, remoteUrl: event.target.value }))}
              placeholder="https://github.com/team/repo.git"
            />
          </label>
          <label className={styles.repoField}>
            <span>Default branch</span>
            <input
              className={styles.settingsInput}
              value={managedCloneForm.defaultBranch}
              onChange={(event) => setManagedCloneForm((current) => ({ ...current, defaultBranch: event.target.value }))}
              placeholder="main"
            />
          </label>
          <div className={styles.settingsActions}>
            <button type="submit" className={styles.settingsButtonPrimary} disabled={createRepositoryMutation.isPending}>
              <Save size={16} /> Clone
            </button>
          </div>
        </form>

        <form
          className={styles.settingsPanel}
          onSubmit={(event) => {
            event.preventDefault();
            submitExistingPath();
          }}
        >
          <div className={styles.settingsHeader}>
            <div>
              <p className={styles.key}>Existing Path</p>
              <h3 className={styles.resourceTitle}>Register a local repo</h3>
            </div>
            <GitBranch size={18} />
          </div>
          <label className={styles.repoField}>
            <span>Name</span>
            <input
              className={styles.settingsInput}
              value={existingPathForm.name}
              onChange={(event) => setExistingPathForm((current) => ({ ...current, name: event.target.value }))}
              placeholder="Team Orchestrator"
            />
          </label>
          <label className={styles.repoField}>
            <span>Workspace path</span>
            <input
              className={styles.settingsInput}
              value={existingPathForm.workspacePath}
              onChange={(event) => setExistingPathForm((current) => ({ ...current, workspacePath: event.target.value }))}
              placeholder="/workspace/target-repo"
            />
          </label>
          <label className={styles.repoField}>
            <span>Host path</span>
            <input
              className={styles.settingsInput}
              value={existingPathForm.hostPath}
              onChange={(event) => setExistingPathForm((current) => ({ ...current, hostPath: event.target.value }))}
              placeholder="/Users/me/project"
            />
          </label>
          <div className={styles.settingsActions}>
            <button type="submit" className={styles.settingsButtonPrimary} disabled={createRepositoryMutation.isPending}>
              <Save size={16} /> Add Path
            </button>
          </div>
        </form>
      </div>

      {activeError ? (
        <section className={styles.resourceCallout}>
          <CheckCircle2 size={18} />
          <div>
            <p className={styles.value}>Repository action failed</p>
            <p className={styles.settingsMuted}>{activeError}</p>
          </div>
        </section>
      ) : null}

      <section className={styles.settingsPanel}>
        <div className={styles.settingsHeader}>
          <div>
            <p className={styles.key}>Connected Repositories</p>
            <h3 className={styles.resourceTitle}>Select repo context</h3>
          </div>
          <span className={styles.settingsMuted}>{repositoriesQuery.isFetching ? "Refreshing" : `${repositories.length} total`}</span>
        </div>

        {repositoriesQuery.error instanceof Error ? (
          <div className={styles.repoEmptyState}>
            <p className={styles.value}>Repository API unavailable</p>
            <p className={styles.settingsMuted}>{repositoriesQuery.error.message}</p>
          </div>
        ) : null}

        {repositoriesQuery.isLoading ? (
          <div className={styles.repoEmptyState}>
            <p className={styles.value}>Loading repositories</p>
            <p className={styles.settingsMuted}>Reading connected repo records from local app state.</p>
          </div>
        ) : null}

        {!repositoriesQuery.isLoading && !repositoriesQuery.error && repositories.length === 0 ? (
          <div className={styles.repoEmptyState}>
            <p className={styles.value}>No repositories connected</p>
            <p className={styles.settingsMuted}>
              Add a public HTTP(S) Git clone or register an absolute local path. Private Git auth and credential collection are not enabled yet.
            </p>
          </div>
        ) : null}

        {repositories.length > 0 ? (
          <div className={styles.repoList}>
            {repositories.map((repository) => (
              <article
                key={repository.id}
                className={`${styles.repoRow} ${selectedRepository?.id === repository.id ? styles.repoRowSelected : ""}`}
              >
                <div className={styles.repoRowMain}>
                  <label className={styles.repoSelect}>
                    <input
                      type="radio"
                      name="selectedRepository"
                      checked={selectedRepository?.id === repository.id}
                      onChange={() => setSelectedRepositoryId(repository.id)}
                    />
                    <span>
                      <span className={styles.repoName}>{repository.name}</span>
                      <span className={styles.settingsMuted}>{sourceLabel(repository)}</span>
                    </span>
                  </label>
                  <span className={statusClass(repository)}>{repository.status}</span>
                </div>
                <dl className={styles.repoMetaGrid}>
                  <Meta label="Branch" value={repository.currentBranch ?? repository.defaultBranch ?? "No branch"} />
                  <Meta label="Commit" value={shortCommit(repository.headCommit)} />
                  <Meta label="Dirty" value={repository.dirtyState} />
                  <Meta label="Inspected" value={formatDate(repository.lastInspectedAt)} />
                  <Meta label="Workspace" value={repository.workspacePath} />
                  <Meta label="Source" value={repository.remoteUrl ?? repository.hostPath ?? "Local path"} />
                </dl>
                {repository.statusMessage ? <p className={styles.repoStatusMessage}>{repository.statusMessage}</p> : null}
                <div className={styles.settingsActionsStart}>
                  <button
                    type="button"
                    className={styles.settingsButton}
                    onClick={() => inspectRepositoryMutation.mutate(repository.id)}
                    disabled={inspectRepositoryMutation.isPending}
                  >
                    <RefreshCw size={16} /> Inspect
                  </button>
                  <button
                    type="button"
                    className={styles.settingsButton}
                    onClick={() => setSelectedRepositoryId(repository.id)}
                  >
                    <CheckCircle2 size={16} /> Select
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : null}
      </section>

      <section className={styles.resourceCallout}>
        <PlugZap size={18} />
        <div>
          <p className={styles.value}>Current boundary</p>
          <p className={styles.settingsMuted}>
            Connected repositories are local app-state records. Public HTTP(S) clones and absolute paths are supported; private provider auth, credential storage, and remote pushes are deferred.
          </p>
        </div>
      </section>
    </section>
  );
}

function mutationError(error: unknown): string | undefined {
  return error instanceof Error ? error.message : undefined;
}

function StatusTile({ label, value }: { label: string; value: string }) {
  return (
    <article className={styles.resourceTerm}>
      <p className={styles.key}>{label}</p>
      <p className={styles.repoMetricValue}>{value}</p>
    </article>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.repoMetaItem}>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
