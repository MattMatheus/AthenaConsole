import { CheckCircle2, FileSearch, Play, RefreshCw, Save } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  useAgentCatalogAgentsQuery,
  type AgentCatalogAgentSummary,
  type ProviderReadiness,
} from "../features/agent-catalog";
import {
  connectedRepositoryReadinessMessage,
  mergeConnectedRepositoryContext,
  useConnectedRepositoriesQuery,
} from "../features/connected-repositories";
import {
  buildCreateTaskRequest,
  buildTaskInputs,
  filterCompatibleAgents,
  hasValidationErrors,
  initialInputValues,
  normalizeInputFields,
  taskActionState,
  useCreateTaskMutation,
  useRunTaskMutation,
  useTasksQuery,
  useTaskWorkbenchMetadataQuery,
  validateTaskForm,
  type TaskInputValues,
  type TaskWorkbenchRunMode,
  type TaskWorkbenchTask,
  type TaskWorkbenchTaskStatus,
} from "../features/task-workbench";
import styles from "./TaskCreatePage.module.css";

const EMPTY_AGENTS: AgentCatalogAgentSummary[] = [];
const DEFAULT_RUN_MODES: TaskWorkbenchRunMode[] = ["read-only", "propose-changes", "approved-write"];
const TASK_STATUS_FILTERS: Array<"all" | TaskWorkbenchTaskStatus> = ["all", "ready", "running", "completed", "failed", "cancelled"];

function agentKey(agent: AgentCatalogAgentSummary): string {
  return `${agent.id}@${agent.version}`;
}

function uniqueCapabilities(agents: AgentCatalogAgentSummary[]): string[] {
  return Array.from(new Set(agents.filter((agent) => agent.available).flatMap((agent) => agent.capabilities))).sort(
    (left, right) => left.localeCompare(right),
  );
}

function findAgent(agents: AgentCatalogAgentSummary[], key: string): AgentCatalogAgentSummary | undefined {
  return agents.find((agent) => agentKey(agent) === key);
}

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function isProviderReadinessBlocking(readiness: ProviderReadiness | undefined): boolean {
  return Boolean(readiness?.required && (readiness.status === "missing" || readiness.status === "invalid"));
}

function providerReadinessClass(readiness: ProviderReadiness): string {
  if (readiness.status === "configured") {
    return styles.badgeSuccess ?? "";
  }
  if (readiness.status === "missing" || readiness.status === "invalid") {
    return styles.badgeWarning ?? "";
  }
  return styles.badge ?? "";
}

function taskStatusClass(status: TaskWorkbenchTaskStatus): string {
  if (status === "ready" || status === "completed") {
    return styles.badgeSuccess ?? "";
  }
  if (status === "failed" || status === "cancelled") {
    return styles.badgeWarning ?? "";
  }
  return styles.badge ?? "";
}

function taskAgentLabel(task: TaskWorkbenchTask): string {
  return task.assignedAgentId ? `${task.assignedAgentId}@${task.assignedAgentVersion ?? "latest"}` : "Unassigned";
}

export function TaskCreatePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const missionIdFilter = searchParams.get("missionId")?.trim() ?? "";
  const agentIdParam = searchParams.get("agentId")?.trim() ?? "";
  const agentVersionParam = searchParams.get("version")?.trim() ?? "";
  const agentsQuery = useAgentCatalogAgentsQuery();
  const metadataQuery = useTaskWorkbenchMetadataQuery();
  const repositoriesQuery = useConnectedRepositoriesQuery();
  const createTaskMutation = useCreateTaskMutation();
  const runTaskMutation = useRunTaskMutation();
  const agents = agentsQuery.data?.agents ?? EMPTY_AGENTS;
  const repositories = repositoriesQuery.data?.repositories ?? [];
  const capabilityOptions = useMemo(() => uniqueCapabilities(agents), [agents]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [capabilityRequirements, setCapabilityRequirements] = useState<string[]>([]);
  const [selectedAgentKey, setSelectedAgentKey] = useState("");
  const [selectedRepositoryId, setSelectedRepositoryId] = useState("");
  const [inputValues, setInputValues] = useState<TaskInputValues>({});
  const [runMode, setRunMode] = useState<TaskWorkbenchRunMode>("read-only");
  const [useRawInputs, setUseRawInputs] = useState(false);
  const [rawInputJson, setRawInputJson] = useState("{}");
  const [validationStatus, setValidationStatus] = useState<TaskWorkbenchTaskStatus>("draft");
  const [hasAttemptedSave, setHasAttemptedSave] = useState(false);
  const [taskStatusFilter, setTaskStatusFilter] = useState<"all" | TaskWorkbenchTaskStatus>("all");
  const taskListQuery = missionIdFilter
    ? { missionId: missionIdFilter }
    : taskStatusFilter === "all"
      ? {}
      : { status: taskStatusFilter };
  const tasksQuery = useTasksQuery(taskListQuery);
  const compatibleAgents = useMemo(
    () => filterCompatibleAgents(agents, capabilityRequirements),
    [agents, capabilityRequirements],
  );
  const selectedAgent = findAgent(compatibleAgents, selectedAgentKey);
  const selectedRepository = repositories.find((repository) => repository.id === selectedRepositoryId);
  const repoReadinessMessage = connectedRepositoryReadinessMessage(selectedRepository);
  const providerReadinessBlocking = isProviderReadinessBlocking(selectedAgent?.providerReadiness);
  const inputFields = useMemo(
    () => normalizeInputFields(selectedAgent?.metadata.inputs),
    [selectedAgent],
  );
  const validation = validateTaskForm({
    title,
    description,
    status: validationStatus,
    ...(selectedAgent ? { selectedAgent } : {}),
    capabilityRequirements,
    inputFields,
    inputValues,
    useRawInputs,
    rawInputJson,
    repoContextAvailable: Boolean(selectedRepository),
  });
  const hasErrors = hasValidationErrors(validation);
  const displayedValidation = hasAttemptedSave ? validation : { inputs: {} };
  const isLoading = agentsQuery.isLoading || metadataQuery.isLoading || repositoriesQuery.isLoading;
  const error = agentsQuery.error ?? metadataQuery.error ?? repositoriesQuery.error;
  const createdTask = createTaskMutation.data;
  const listedTasks = tasksQuery.data?.tasks ?? [];
  const visibleTasks = listedTasks.slice(0, 12);
  const runModes = metadataQuery.data?.runModes?.length ? metadataQuery.data.runModes : DEFAULT_RUN_MODES;
  const selectedRunMode = runModes.includes(runMode) ? runMode : metadataQuery.data?.defaultRunMode ?? "read-only";

  useEffect(() => {
    if (selectedAgentKey && !agentsQuery.isLoading && !compatibleAgents.some((agent) => agentKey(agent) === selectedAgentKey)) {
      setSelectedAgentKey("");
    }
  }, [agentsQuery.isLoading, compatibleAgents, selectedAgentKey]);

  useEffect(() => {
    if (!agentIdParam || agentsQuery.isLoading || selectedAgentKey) {
      return;
    }
    const queryAgent = compatibleAgents.find(
      (agent) => agent.id === agentIdParam && (!agentVersionParam || agent.version === agentVersionParam),
    );
    if (queryAgent) {
      setSelectedAgentKey(agentKey(queryAgent));
    }
  }, [agentIdParam, agentVersionParam, agentsQuery.isLoading, compatibleAgents, selectedAgentKey]);

  useEffect(() => {
    const nextValues = initialInputValues(inputFields);
    setInputValues(nextValues);
    setRawInputJson(JSON.stringify(buildTaskInputs(inputFields, nextValues), null, 2));
    setUseRawInputs(false);
  }, [inputFields]);

  function toggleCapability(capability: string): void {
    setCapabilityRequirements((current) =>
      current.includes(capability)
        ? current.filter((item) => item !== capability)
        : [...current, capability].sort((left, right) => left.localeCompare(right)),
    );
  }

  function updateInput(key: string, value: string | boolean): void {
    setInputValues((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function saveTask(status: TaskWorkbenchTaskStatus): void {
    setValidationStatus(status);
    setHasAttemptedSave(true);
    if (status === "ready" && repoReadinessMessage) {
      return;
    }
    if (status === "ready" && providerReadinessBlocking) {
      return;
    }
    const nextValidation = validateTaskForm({
      title,
      description,
      status,
      ...(selectedAgent ? { selectedAgent } : {}),
      capabilityRequirements,
      inputFields,
      inputValues,
      useRawInputs,
      rawInputJson,
      repoContextAvailable: Boolean(selectedRepository),
    });
    if (hasValidationErrors(nextValidation)) {
      return;
    }
    const request = buildCreateTaskRequest({
        title,
        description,
        status,
        ...(selectedAgent ? { selectedAgent } : {}),
        capabilityRequirements,
        inputFields,
        inputValues,
        runMode: selectedRunMode,
        useRawInputs,
        rawInputJson,
    });
    request.inputs = mergeConnectedRepositoryContext(
      typeof request.inputs === "object" && request.inputs !== null && !Array.isArray(request.inputs)
        ? (request.inputs as Record<string, unknown>)
        : {},
      selectedRepository,
    );
    createTaskMutation.mutate(request);
  }

  function runTaskById(taskId: string): void {
    if (!taskId) {
      return;
    }
    runTaskMutation.mutate(taskId, {
      onSuccess: (run) => navigate(`/tasks/runs/${encodeURIComponent(run.id)}`),
    });
  }

  async function refresh(): Promise<void> {
    await Promise.all([
      agentsQuery.refetch(),
      metadataQuery.refetch(),
      repositoriesQuery.refetch(),
      tasksQuery.refetch(),
    ]);
  }

  return (
    <section className={styles.page}>
      <div className={styles.pageHeader}>
        <div>
          <p className={styles.panelMeta}>Task Workbench</p>
          <h2 className={styles.pageTitle}>New Task</h2>
        </div>
        <button
          type="button"
          className={styles.iconButton}
          onClick={() => void refresh()}
          disabled={agentsQuery.isFetching || metadataQuery.isFetching}
          aria-label="Refresh task data"
          title="Refresh task data"
        >
          <RefreshCw size={16} />
        </button>
      </div>

      <section className={styles.guidancePanel}>
        <div>
          <p className={styles.panelTitle}>Use a task for one clear unit of work</p>
          <p className={styles.description}>
            Pick an existing plugin-backed agent, describe the objective, and provide manifest inputs such as repo path, files, branch, or other run context.
          </p>
        </div>
        {agentIdParam ? (
          <p className={styles.mono}>Requested agent: {agentIdParam}{agentVersionParam ? `@${agentVersionParam}` : ""}</p>
        ) : null}
      </section>

      {error instanceof Error ? (
        <div className={styles.state}>
          <p className={styles.stateTitle}>Task Data Unavailable</p>
          <p className={styles.errorText}>{error.message}</p>
        </div>
      ) : null}

      {isLoading ? (
        <div className={styles.state}>
          <p className={styles.stateTitle}>Loading Task Data</p>
          <p className={styles.description}>Reading agent manifests and task metadata.</p>
        </div>
      ) : null}

      {!isLoading && !error ? (
        <>
        <section className={styles.panelSection}>
          <div className={styles.sectionHeader}>
            <div>
              <p className={styles.panelTitle}>{missionIdFilter ? "Mission Tasks" : "Existing Tasks"}</p>
              <p className={styles.panelMeta}>{tasksQuery.data?.total ?? 0} found</p>
            </div>
          </div>
          {!missionIdFilter ? (
            <div className={styles.segmentedControl} role="tablist" aria-label="Task status filter">
              {TASK_STATUS_FILTERS.map((status) => (
                <button
                  key={status}
                  type="button"
                  className={taskStatusFilter === status ? styles.segmentActive : styles.segment}
                  onClick={() => setTaskStatusFilter(status)}
                >
                  {status === "all" ? "All" : status}
                </button>
              ))}
            </div>
          ) : (
            <p className={styles.mono}>{missionIdFilter}</p>
          )}
          {tasksQuery.error instanceof Error ? <p className={styles.errorText}>{tasksQuery.error.message}</p> : null}
          {tasksQuery.isLoading ? <p className={styles.description}>Loading tasks.</p> : null}
          {!tasksQuery.isLoading && visibleTasks.length === 0 ? (
            <p className={styles.description}>
              {missionIdFilter ? "No tasks found for this mission." : "No tasks match the selected status."}
            </p>
          ) : null}
          {visibleTasks.length > 0 ? (
            <div className={styles.taskList}>
              {visibleTasks.map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  isRunning={runTaskMutation.isPending}
                  onOpenRun={(runId) => navigate(`/tasks/runs/${encodeURIComponent(runId)}`)}
                  onRun={runTaskById}
                />
              ))}
            </div>
          ) : null}
        </section>

        <div className={styles.layout}>
          <form
            className={styles.formPanel}
            onSubmit={(event) => {
              event.preventDefault();
              saveTask("draft");
            }}
          >
            <section className={styles.panelSection}>
              <div className={styles.sectionHeader}>
                <div>
                  <p className={styles.panelTitle}>Task</p>
                  <p className={styles.panelMeta}>Draft details</p>
                </div>
              </div>
              <label className={styles.field}>
                <span className={styles.fieldLabel}>Title</span>
                <input
                  className={styles.input}
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="Prepare release notes"
                />
                {displayedValidation.title ? <span className={styles.fieldError}>{displayedValidation.title}</span> : null}
              </label>
              <label className={styles.field}>
                <span className={styles.fieldLabel}>Description</span>
                <textarea
                  className={styles.textarea}
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="Summarize the release scope and known risks."
                  rows={4}
                />
              </label>
            </section>

            <section className={styles.panelSection}>
              <div className={styles.sectionHeader}>
                <div>
                  <p className={styles.panelTitle}>Run Mode</p>
                  <p className={styles.panelMeta}>{selectedRunMode}</p>
                </div>
              </div>
              <label className={styles.field}>
                <span className={styles.fieldLabel}>Mode</span>
                <select
                  className={styles.select}
                  value={selectedRunMode}
                  onChange={(event) => setRunMode(event.target.value as TaskWorkbenchRunMode)}
                >
                  {runModes.map((mode) => (
                    <option key={mode} value={mode}>
                      {runModeLabel(mode)}
                    </option>
                  ))}
                </select>
              </label>
              <p className={selectedRunMode === "approved-write" ? styles.fieldError : styles.description}>
                {runModeDescription(selectedRunMode)}
              </p>
            </section>

            <section className={styles.panelSection}>
              <div className={styles.sectionHeader}>
                <div>
                  <p className={styles.panelTitle}>Requirements</p>
                  <p className={styles.panelMeta}>{capabilityRequirements.length} selected</p>
                </div>
              </div>
              <div className={styles.capabilityGrid}>
                {capabilityOptions.map((capability) => (
                  <label key={capability} className={styles.checkChip}>
                    <input
                      type="checkbox"
                      checked={capabilityRequirements.includes(capability)}
                      onChange={() => toggleCapability(capability)}
                    />
                    <span>{capability}</span>
                  </label>
                ))}
              </div>
            </section>

            <section className={styles.panelSection}>
              <div className={styles.sectionHeader}>
                <div>
                  <p className={styles.panelTitle}>Inputs</p>
                  <p className={styles.panelMeta}>{useRawInputs ? "Raw JSON" : selectedAgent ? selectedAgent.name : "No agent selected"}</p>
                </div>
                {selectedAgent ? (
                  <label className={styles.checkChip}>
                    <input
                      type="checkbox"
                      checked={useRawInputs}
                      onChange={(event) => setUseRawInputs(event.target.checked)}
                    />
                    <span>Raw JSON</span>
                  </label>
                ) : null}
              </div>
              {!selectedAgent ? (
                <p className={styles.description}>Select an agent to load its manifest inputs.</p>
              ) : useRawInputs ? (
                <label className={styles.field}>
                  <span className={styles.fieldLabel}>Inputs JSON</span>
                  <textarea
                    className={styles.textarea}
                    value={rawInputJson}
                    onChange={(event) => setRawInputJson(event.target.value)}
                    rows={8}
                  />
                  {displayedValidation.inputs.__raw ? (
                    <span className={styles.fieldError}>{displayedValidation.inputs.__raw}</span>
                  ) : null}
                </label>
              ) : inputFields.length === 0 ? (
                <p className={styles.description}>No manifest inputs declared.</p>
              ) : (
                <div className={styles.inputGrid}>
                  {inputFields.map((field) => (
                    <label key={field.key} className={styles.field}>
                      <span className={styles.fieldLabel}>
                        {field.label}
                        {field.required ? <span className={styles.required}>Required</span> : null}
                      </span>
                      {field.description ? <span className={styles.description}>{field.description}</span> : null}
                      {field.type === "repo" ? (
                        <span className={styles.repoInputHint}>
                          {selectedRepository
                            ? `${selectedRepository.name}: ${selectedRepository.workspacePath}`
                            : "Select repo context in the Repository panel, or switch to raw JSON for manual input."}
                        </span>
                      ) : field.type === "markdown" || field.type === "json" ? (
                        <textarea
                          className={styles.textarea}
                          value={String(inputValues[field.key] ?? "")}
                          onChange={(event) => updateInput(field.key, event.target.value)}
                          rows={field.type === "markdown" ? 5 : 3}
                        />
                      ) : field.type === "enum" ? (
                        <select
                          className={styles.select}
                          value={String(inputValues[field.key] ?? "")}
                          onChange={(event) => updateInput(field.key, event.target.value)}
                        >
                          <option value="">Select {field.label}</option>
                          {field.enumValues.map((value) => (
                            <option key={value} value={value}>
                              {value}
                            </option>
                          ))}
                        </select>
                      ) : field.type === "boolean" ? (
                        <span className={styles.toggleRow}>
                          <input
                            type="checkbox"
                            checked={Boolean(inputValues[field.key])}
                            onChange={(event) => updateInput(field.key, event.target.checked)}
                          />
                          <span>{inputValues[field.key] ? "True" : "False"}</span>
                        </span>
                      ) : (
                        <input
                          className={styles.input}
                          type={field.type === "integer" || field.type === "number" ? "number" : field.type === "url" ? "url" : "text"}
                          value={String(inputValues[field.key] ?? "")}
                          onChange={(event) => updateInput(field.key, event.target.value)}
                        />
                      )}
                      {displayedValidation.inputs[field.key] ? (
                        <span className={styles.fieldError}>{displayedValidation.inputs[field.key]}</span>
                      ) : null}
                    </label>
                  ))}
                </div>
              )}
            </section>

            {createTaskMutation.error instanceof Error ? (
              <p className={styles.errorText}>{createTaskMutation.error.message}</p>
            ) : null}

            <div className={styles.actionBar}>
              <button
                type="button"
                className={styles.secondaryButton}
                onClick={() => saveTask("draft")}
                disabled={createTaskMutation.isPending}
              >
                <Save size={16} /> Save Draft
              </button>
              <button
                type="button"
                className={styles.primaryButton}
                onClick={() => saveTask("ready")}
                disabled={createTaskMutation.isPending}
              >
                <CheckCircle2 size={16} /> Save Ready
              </button>
            </div>
            {hasAttemptedSave && hasErrors ? <p className={styles.validationSummary}>Review the highlighted fields before saving.</p> : null}
          </form>

          <aside className={styles.sidePanel}>
            <section className={styles.panelSection}>
              <div className={styles.sectionHeader}>
                <div>
                  <p className={styles.panelTitle}>Repository</p>
                  <p className={styles.panelMeta}>{selectedRepository ? selectedRepository.status : "Optional"}</p>
                </div>
              </div>
              <label className={styles.field}>
                <span className={styles.fieldLabel}>Repo context</span>
                <select
                  className={styles.select}
                  value={selectedRepositoryId}
                  onChange={(event) => setSelectedRepositoryId(event.target.value)}
                >
                  <option value="">No connected repo</option>
                  {repositories.map((repository) => (
                    <option key={repository.id} value={repository.id}>
                      {repository.name} ({repository.status})
                    </option>
                  ))}
                </select>
              </label>
              {repositories.length === 0 ? (
                <p className={styles.description}>Connect a repository in Resource Controls to pass structured repo context.</p>
              ) : null}
              {selectedRepository ? (
                <dl className={styles.kvList}>
                  <div>
                    <dt>Workspace</dt>
                    <dd className={styles.mono}>{selectedRepository.workspacePath}</dd>
                  </div>
                  <div>
                    <dt>Branch</dt>
                    <dd>{selectedRepository.currentBranch ?? selectedRepository.defaultBranch ?? "Unknown"}</dd>
                  </div>
                  <div>
                    <dt>Dirty</dt>
                    <dd>
                      <span className={selectedRepository.dirtyState === "clean" ? styles.badgeSuccess : styles.badgeWarning}>
                        {selectedRepository.dirtyState}
                      </span>
                    </dd>
                  </div>
                </dl>
              ) : null}
              {hasAttemptedSave && validationStatus === "ready" && repoReadinessMessage ? (
                <p className={styles.fieldError}>{repoReadinessMessage}</p>
              ) : null}
            </section>

            <section className={styles.panelSection}>
              <div className={styles.sectionHeader}>
                <div>
                  <p className={styles.panelTitle}>Agent</p>
                  <p className={styles.panelMeta}>{compatibleAgents.length} compatible</p>
                </div>
              </div>
              <label className={styles.field}>
                <span className={styles.fieldLabel}>Assignment</span>
                <select
                  className={styles.select}
                  value={selectedAgentKey}
                  onChange={(event) => setSelectedAgentKey(event.target.value)}
                >
                  <option value="">Unassigned</option>
                  {compatibleAgents.map((agent) => (
                    <option key={agentKey(agent)} value={agentKey(agent)}>
                      {agent.name} ({agent.id}@{agent.version})
                    </option>
                  ))}
                </select>
                {displayedValidation.assignedAgent ? (
                  <span className={styles.fieldError}>{displayedValidation.assignedAgent}</span>
                ) : null}
              </label>

              {selectedAgent ? (
                <div className={styles.agentSummary}>
                  <p className={styles.agentName}>{selectedAgent.name}</p>
                  <p className={styles.mono}>{selectedAgent.id}@{selectedAgent.version}</p>
                  <p className={styles.description}>{selectedAgent.metadata.description ?? "No description declared."}</p>
                  <div className={styles.badgeRow}>
                    <span className={providerReadinessClass(selectedAgent.providerReadiness)}>
                      provider {selectedAgent.providerReadiness.status}
                    </span>
                    {selectedAgent.providerReadiness.providerName ? (
                      <span className={styles.badgeMuted}>{selectedAgent.providerReadiness.providerName}</span>
                    ) : null}
                  </div>
                  <p className={styles.description}>{selectedAgent.providerReadiness.message}</p>
                  {hasAttemptedSave && validationStatus === "ready" && providerReadinessBlocking ? (
                    <p className={styles.fieldError}>Configure a valid model provider in Settings before saving this task as ready.</p>
                  ) : null}
                  <div className={styles.badgeRow}>
                    {selectedAgent.capabilities.map((capability) => (
                      <span key={capability} className={styles.badge}>
                        {capability}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}
            </section>

            <section className={styles.panelSection}>
              <div className={styles.sectionHeader}>
                <div>
                  <p className={styles.panelTitle}>Saved Task</p>
                  <p className={styles.panelMeta}>{createdTask ? createdTask.status : "None"}</p>
                </div>
              </div>
              {createdTask ? (
                <>
                  <dl className={styles.kvList}>
                    <div>
                      <dt>ID</dt>
                      <dd className={styles.mono}>{createdTask.id}</dd>
                    </div>
                    <div>
                      <dt>Status</dt>
                      <dd><span className={createdTask.status === "ready" ? styles.badgeSuccess : styles.badge}>{createdTask.status}</span></dd>
                    </div>
                    <div>
                      <dt>Run mode</dt>
                      <dd>{taskRunMode(createdTask.inputs)}</dd>
                    </div>
                    <div>
                      <dt>Agent</dt>
                      <dd>{createdTask.assignedAgentId ? `${createdTask.assignedAgentId}@${createdTask.assignedAgentVersion ?? "latest"}` : "Unassigned"}</dd>
                    </div>
                    <div>
                      <dt>Updated</dt>
                      <dd>{formatDate(createdTask.updatedAt)}</dd>
                    </div>
                  </dl>
                  {createdTask.status === "ready" ? (
                    <div className={styles.actionBar}>
                      <button
                        className={styles.primaryButton}
                        type="button"
                        onClick={() => runTaskById(createdTask.id)}
                        disabled={runTaskMutation.isPending}
                      >
                        <Play size={16} /> Run Task
                      </button>
                    </div>
                  ) : null}
                  {runTaskMutation.error instanceof Error ? <p className={styles.errorText}>{runTaskMutation.error.message}</p> : null}
                </>
              ) : (
                <p className={styles.description}>No task saved in this session.</p>
              )}
            </section>

          </aside>
        </div>
        </>
      ) : null}
    </section>
  );
}

function TaskRow({
  isRunning,
  onOpenRun,
  onRun,
  task,
}: {
  isRunning: boolean;
  onOpenRun: (runId: string) => void;
  onRun: (taskId: string) => void;
  task: TaskWorkbenchTask;
}) {
  const actions = taskActionState(task);
  return (
    <article className={styles.taskItem}>
      <div className={styles.taskItemHeader}>
        <div>
          <p className={styles.taskTitle}>{task.title}</p>
          <p className={styles.mono}>{task.id}</p>
        </div>
        <span className={taskStatusClass(task.status)}>{task.status}</span>
      </div>
      <dl className={styles.taskFacts}>
        <div>
          <dt>Agent</dt>
          <dd>{taskAgentLabel(task)}</dd>
        </div>
        <div>
          <dt>Updated</dt>
          <dd>{formatDate(task.updatedAt)}</dd>
        </div>
        <div>
          <dt>Latest run</dt>
          <dd>{task.latestRun ? `${task.latestRun.id} (${task.latestRun.status})` : "none"}</dd>
        </div>
      </dl>
      <div className={styles.taskActions}>
        {actions.canRun ? (
          <button
            aria-label={`Run ${task.title}`}
            className={styles.primaryButton}
            disabled={isRunning}
            onClick={() => onRun(task.id)}
            type="button"
          >
            <Play size={16} aria-hidden="true" /> Run
          </button>
        ) : null}
        {actions.latestRunId ? (
          <button
            aria-label={`Open latest run for ${task.title}`}
            className={styles.secondaryButton}
            onClick={() => onOpenRun(actions.latestRunId ?? "")}
            type="button"
          >
            <FileSearch size={16} aria-hidden="true" /> Open Run
          </button>
        ) : null}
      </div>
    </article>
  );
}

function runModeLabel(mode: TaskWorkbenchRunMode): string {
  if (mode === "read-only") {
    return "Read-only";
  }
  if (mode === "propose-changes") {
    return "Propose changes";
  }
  return "Approved write (unavailable)";
}

function runModeDescription(mode: TaskWorkbenchRunMode): string {
  if (mode === "read-only") {
    return "Runs default to read-only. File mutations are not applied automatically.";
  }
  if (mode === "propose-changes") {
    return "Agents may return proposed diffs as artifacts for review; the console will not apply them.";
  }
  return "Write/apply mode is unavailable until approval handling exists.";
}

function taskRunMode(inputs: unknown): string {
  if (typeof inputs === "object" && inputs !== null && !Array.isArray(inputs) && typeof (inputs as { runMode?: unknown }).runMode === "string") {
    return (inputs as { runMode: string }).runMode;
  }
  return "read-only";
}
