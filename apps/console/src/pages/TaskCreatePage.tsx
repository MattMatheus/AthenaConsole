import { CheckCircle2, RefreshCw, Save } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  useAgentCatalogAgentsQuery,
  type AgentCatalogAgentSummary,
} from "../features/agent-catalog";
import {
  buildCreateTaskRequest,
  filterCompatibleAgents,
  hasValidationErrors,
  initialInputValues,
  normalizeInputFields,
  useCreateTaskMutation,
  useTasksQuery,
  useTaskWorkbenchMetadataQuery,
  validateTaskForm,
  type TaskInputValues,
  type TaskWorkbenchTaskStatus,
} from "../features/task-workbench";
import styles from "./TaskCreatePage.module.css";

const EMPTY_AGENTS: AgentCatalogAgentSummary[] = [];

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

export function TaskCreatePage() {
  const [searchParams] = useSearchParams();
  const missionIdFilter = searchParams.get("missionId")?.trim() ?? "";
  const agentsQuery = useAgentCatalogAgentsQuery();
  const metadataQuery = useTaskWorkbenchMetadataQuery();
  const missionTasksQuery = useTasksQuery(missionIdFilter ? { missionId: missionIdFilter } : {});
  const createTaskMutation = useCreateTaskMutation();
  const agents = agentsQuery.data?.agents ?? EMPTY_AGENTS;
  const capabilityOptions = useMemo(() => uniqueCapabilities(agents), [agents]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [capabilityRequirements, setCapabilityRequirements] = useState<string[]>([]);
  const [selectedAgentKey, setSelectedAgentKey] = useState("");
  const [inputValues, setInputValues] = useState<TaskInputValues>({});
  const [validationStatus, setValidationStatus] = useState<TaskWorkbenchTaskStatus>("draft");
  const [hasAttemptedSave, setHasAttemptedSave] = useState(false);
  const compatibleAgents = useMemo(
    () => filterCompatibleAgents(agents, capabilityRequirements),
    [agents, capabilityRequirements],
  );
  const selectedAgent = findAgent(compatibleAgents, selectedAgentKey);
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
  });
  const hasErrors = hasValidationErrors(validation);
  const displayedValidation = hasAttemptedSave ? validation : { inputs: {} };
  const isLoading = agentsQuery.isLoading || metadataQuery.isLoading;
  const error = agentsQuery.error ?? metadataQuery.error;
  const createdTask = createTaskMutation.data;
  const missionTasks = missionIdFilter ? missionTasksQuery.data?.tasks ?? [] : [];

  useEffect(() => {
    if (selectedAgentKey && !compatibleAgents.some((agent) => agentKey(agent) === selectedAgentKey)) {
      setSelectedAgentKey("");
    }
  }, [compatibleAgents, selectedAgentKey]);

  useEffect(() => {
    setInputValues(initialInputValues(inputFields));
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
    const nextValidation = validateTaskForm({
      title,
      description,
      status,
      ...(selectedAgent ? { selectedAgent } : {}),
      capabilityRequirements,
      inputFields,
      inputValues,
    });
    if (hasValidationErrors(nextValidation)) {
      return;
    }
    createTaskMutation.mutate(
      buildCreateTaskRequest({
        title,
        description,
        status,
        ...(selectedAgent ? { selectedAgent } : {}),
        capabilityRequirements,
        inputFields,
        inputValues,
      }),
    );
  }

  async function refresh(): Promise<void> {
    await Promise.all([agentsQuery.refetch(), metadataQuery.refetch(), missionIdFilter ? missionTasksQuery.refetch() : Promise.resolve()]);
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
                  <p className={styles.panelMeta}>{selectedAgent ? selectedAgent.name : "No agent selected"}</p>
                </div>
              </div>
              {!selectedAgent ? (
                <p className={styles.description}>Select an agent to load its manifest inputs.</p>
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
                      {field.type === "markdown" || field.type === "json" ? (
                        <textarea
                          className={styles.textarea}
                          value={String(inputValues[field.key] ?? "")}
                          onChange={(event) => updateInput(field.key, event.target.value)}
                          rows={field.type === "markdown" ? 5 : 3}
                        />
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
                          type={field.type === "integer" || field.type === "number" ? "number" : "text"}
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
                    <dt>Agent</dt>
                    <dd>{createdTask.assignedAgentId ? `${createdTask.assignedAgentId}@${createdTask.assignedAgentVersion ?? "latest"}` : "Unassigned"}</dd>
                  </div>
                  <div>
                    <dt>Updated</dt>
                    <dd>{formatDate(createdTask.updatedAt)}</dd>
                  </div>
                </dl>
              ) : (
                <p className={styles.description}>No task saved in this session.</p>
              )}
            </section>

            {missionIdFilter ? (
              <section className={styles.panelSection}>
                <div className={styles.sectionHeader}>
                  <div>
                    <p className={styles.panelTitle}>Mission Tasks</p>
                    <p className={styles.panelMeta}>{missionTasks.length} for selected mission</p>
                  </div>
                </div>
                <p className={styles.mono}>{missionIdFilter}</p>
                {missionTasksQuery.error instanceof Error ? <p className={styles.errorText}>{missionTasksQuery.error.message}</p> : null}
                {missionTasksQuery.isLoading ? <p className={styles.description}>Loading mission tasks.</p> : null}
                {!missionTasksQuery.isLoading && missionTasks.length === 0 ? (
                  <p className={styles.description}>No tasks found for this mission.</p>
                ) : (
                  <dl className={styles.kvList}>
                    {missionTasks.map((task) => (
                      <div key={task.id}>
                        <dt>{task.title}</dt>
                        <dd>
                          <span className={styles.mono}>{task.id}</span>
                          <span className={task.status === "ready" ? styles.badgeSuccess : styles.badge}>{task.status}</span>
                        </dd>
                      </div>
                    ))}
                  </dl>
                )}
              </section>
            ) : null}
          </aside>
        </div>
      ) : null}
    </section>
  );
}
