import {
  CalendarClock,
  Pause,
  Play,
  Plus,
  RefreshCw,
  RotateCw,
  Timer,
  Trash2,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import type { TaskInputField, TaskInputValues } from "../features/task-workbench";
import {
  buildCreateScheduleRequest,
  defaultTimezone,
  formatScheduleCadence,
  formatScheduleDate,
  hasScheduleValidationErrors,
  scheduleStatusTone,
  summarizeScheduleRunResult,
  useCreateScheduleMutation,
  useDeleteScheduleMutation,
  useDisableScheduleMutation,
  useEnableScheduleMutation,
  useRunScheduleMutation,
  useSchedulesQuery,
  useTickSchedulesMutation,
  validateScheduleForm,
  type ScheduleFormDraft,
  type ScheduleRunResult,
  type ScheduleStatus,
  type ScheduledTask,
} from "../features/schedules";
import { useTasksQuery, type TaskWorkbenchTask } from "../features/task-workbench";
import {
  buildWorkflowTemplateInstantiateRequest,
  hasWorkflowTemplateInputErrors,
  initialWorkflowTemplateInputValues,
  useWorkflowTemplatesQuery,
  validateWorkflowTemplateInputs,
  workflowTemplateInputFields,
  type WorkflowTemplateSummary,
} from "../features/workflow-templates";
import styles from "./SchedulesPage.module.css";

const EMPTY_TASKS: TaskWorkbenchTask[] = [];
const EMPTY_TEMPLATES: WorkflowTemplateSummary[] = [];

function defaultRunAtLocal(): string {
  const next = new Date(Date.now() + 60 * 60_000);
  next.setMinutes(0, 0, 0);
  const offsetMs = next.getTimezoneOffset() * 60_000;
  return new Date(next.getTime() - offsetMs).toISOString().slice(0, 16);
}

function createInitialDraft(): ScheduleFormDraft {
  return {
    id: "",
    name: "",
    targetType: "task",
    targetId: "",
    mode: "one-shot",
    runAtLocal: defaultRunAtLocal(),
    frequency: "DAILY",
    interval: "1",
    timezone: defaultTimezone(),
  };
}

function statusClass(status: ScheduleStatus | undefined): string {
  const tone = scheduleStatusTone(status);
  if (tone === "success") {
    return styles.badgeSuccess ?? "";
  }
  if (tone === "warning") {
    return styles.badgeWarning ?? "";
  }
  if (tone === "danger") {
    return styles.badgeDanger ?? "";
  }
  return styles.badge ?? "";
}

function targetLabel(schedule: ScheduledTask, tasks: TaskWorkbenchTask[], templates: WorkflowTemplateSummary[]): string {
  const targetId = schedule.targetId ?? schedule.sessionId;
  if (schedule.targetType === "workflow-template") {
    const template = templates.find((item) => item.id === targetId);
    return template ? `${template.name} (${template.id})` : targetId;
  }
  const task = tasks.find((item) => item.id === targetId);
  return task ? `${task.title} (${task.id})` : targetId;
}

function templateKey(template: WorkflowTemplateSummary): string {
  return `${template.id}@${template.version}:${template.plugin.id}@${template.plugin.version}`;
}

function inputMeta(fields: TaskInputField[]): string {
  const required = fields.filter((field) => field.required).length;
  if (fields.length === 0) {
    return "No inputs";
  }
  return required > 0 ? `${fields.length} inputs, ${required} required` : `${fields.length} inputs`;
}

function workflowScheduleBindings(
  template: WorkflowTemplateSummary,
  fields: TaskInputField[],
  values: TaskInputValues,
): Record<string, unknown> {
  const request = buildWorkflowTemplateInstantiateRequest(template, fields, values);
  return Object.fromEntries(Object.entries(request).filter(([key]) => key !== "createdBy"));
}

function mutationError(...errors: unknown[]): Error | undefined {
  return errors.find((error): error is Error => error instanceof Error);
}

export function SchedulesPage() {
  const schedulesQuery = useSchedulesQuery();
  const tasksQuery = useTasksQuery();
  const workflowTemplatesQuery = useWorkflowTemplatesQuery();
  const createScheduleMutation = useCreateScheduleMutation();
  const enableScheduleMutation = useEnableScheduleMutation();
  const disableScheduleMutation = useDisableScheduleMutation();
  const deleteScheduleMutation = useDeleteScheduleMutation();
  const runScheduleMutation = useRunScheduleMutation();
  const tickSchedulesMutation = useTickSchedulesMutation();
  const [draft, setDraft] = useState<ScheduleFormDraft>(() => createInitialDraft());
  const [workflowInputValues, setWorkflowInputValues] = useState<TaskInputValues>({});
  const [hasAttemptedCreate, setHasAttemptedCreate] = useState(false);
  const [runResults, setRunResults] = useState<ScheduleRunResult[]>([]);
  const [skippedCount, setSkippedCount] = useState<number | undefined>();
  const tasks = tasksQuery.data?.tasks ?? EMPTY_TASKS;
  const readyTasks = useMemo(() => tasks.filter((task) => task.status === "ready"), [tasks]);
  const workflowTemplates = workflowTemplatesQuery.data?.templates ?? EMPTY_TEMPLATES;
  const availableWorkflowTemplates = useMemo(() => workflowTemplates.filter((template) => template.available), [workflowTemplates]);
  const selectedWorkflowTemplate = useMemo(() => {
    if (draft.targetType !== "workflow-template") {
      return undefined;
    }
    return availableWorkflowTemplates.find((template) => template.id === draft.targetId) ?? availableWorkflowTemplates[0];
  }, [availableWorkflowTemplates, draft.targetId, draft.targetType]);
  const workflowInputFields = useMemo(() => workflowTemplateInputFields(selectedWorkflowTemplate), [selectedWorkflowTemplate]);
  const workflowInputValidation = validateWorkflowTemplateInputs(workflowInputFields, workflowInputValues);
  const validation = validateScheduleForm(draft);
  const displayedValidation = hasAttemptedCreate ? validation : {};
  const displayedWorkflowValidation = hasAttemptedCreate ? workflowInputValidation : {};
  const isRefreshing = schedulesQuery.isFetching || tasksQuery.isFetching || workflowTemplatesQuery.isFetching;
  const actionError = mutationError(
    createScheduleMutation.error,
    enableScheduleMutation.error,
    disableScheduleMutation.error,
    deleteScheduleMutation.error,
    runScheduleMutation.error,
    tickSchedulesMutation.error,
  );
  const sortedSchedules = useMemo(
    () => [...(schedulesQuery.data?.items ?? [])].sort((left, right) => left.id.localeCompare(right.id)),
    [schedulesQuery.data?.items],
  );
  const dataError = mutationError(schedulesQuery.error, tasksQuery.error, workflowTemplatesQuery.error);

  useEffect(() => {
    if (draft.targetType !== "workflow-template") {
      return;
    }
    if (!selectedWorkflowTemplate) {
      if (draft.targetId) {
        updateDraft("targetId", "");
      }
      return;
    }
    if (draft.targetId !== selectedWorkflowTemplate.id) {
      updateDraft("targetId", selectedWorkflowTemplate.id);
    }
  }, [draft.targetId, draft.targetType, selectedWorkflowTemplate]);

  useEffect(() => {
    setWorkflowInputValues(initialWorkflowTemplateInputValues(selectedWorkflowTemplate));
  }, [selectedWorkflowTemplate]);

  function updateDraft<K extends keyof ScheduleFormDraft>(key: K, value: ScheduleFormDraft[K]): void {
    setDraft((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function selectTargetType(targetType: ScheduleFormDraft["targetType"]): void {
    setDraft((current) => ({
      ...current,
      targetType,
      targetId: "",
    }));
    setHasAttemptedCreate(false);
  }

  function selectWorkflowTemplate(value: string): void {
    const template = availableWorkflowTemplates.find((item) => templateKey(item) === value);
    setDraft((current) => ({
      ...current,
      targetId: template?.id ?? "",
    }));
  }

  function updateWorkflowInput(key: string, value: string | boolean): void {
    setWorkflowInputValues((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function createSchedule(): void {
    setHasAttemptedCreate(true);
    if (hasScheduleValidationErrors(validation)) {
      return;
    }
    if (draft.targetType === "workflow-template" && (!selectedWorkflowTemplate || hasWorkflowTemplateInputErrors(workflowInputValidation))) {
      return;
    }
    const inputBindings =
      draft.targetType === "workflow-template" && selectedWorkflowTemplate
        ? workflowScheduleBindings(selectedWorkflowTemplate, workflowInputFields, workflowInputValues)
        : undefined;
    createScheduleMutation.mutate(buildCreateScheduleRequest(draft, { inputBindings }), {
      onSuccess: () => {
        setDraft(createInitialDraft());
        setWorkflowInputValues({});
        setHasAttemptedCreate(false);
      },
    });
  }

  function runNow(id: string): void {
    runScheduleMutation.mutate(id, {
      onSuccess: (result) => {
        setSkippedCount(undefined);
        setRunResults([result]);
      },
    });
  }

  function tickDue(): void {
    tickSchedulesMutation.mutate(undefined, {
      onSuccess: (result) => {
        setSkippedCount(result.skipped);
        setRunResults(result.run);
      },
    });
  }

  async function refresh(): Promise<void> {
    await Promise.all([schedulesQuery.refetch(), tasksQuery.refetch(), workflowTemplatesQuery.refetch()]);
  }

  return (
    <section className={styles.page}>
      <div className={styles.pageHeader}>
        <div>
          <p className={styles.panelMeta}>Task & Workflow Schedules</p>
          <h2 className={styles.pageTitle}>Schedules</h2>
        </div>
        <div className={styles.headerActions}>
          <button
            type="button"
            className={styles.secondaryButton}
            onClick={() => tickDue()}
            disabled={tickSchedulesMutation.isPending}
          >
            <Timer size={16} /> Tick Due
          </button>
          <button
            type="button"
            className={styles.iconButton}
            onClick={() => void refresh()}
            disabled={isRefreshing}
            aria-label="Refresh schedules"
            title="Refresh schedules"
          >
            <RefreshCw size={16} />
          </button>
        </div>
      </div>

      {dataError ? (
        <div className={styles.state}>
          <p className={styles.stateTitle}>Schedule Data Unavailable</p>
          <p className={styles.errorText}>{dataError.message}</p>
        </div>
      ) : null}

      {actionError ? (
        <div className={styles.state}>
          <p className={styles.stateTitle}>Schedule Action Failed</p>
          <p className={styles.errorText}>{actionError.message}</p>
        </div>
      ) : null}

      {runResults.length > 0 || skippedCount !== undefined ? (
        <section className={styles.resultPanel}>
          <div className={styles.sectionHeader}>
            <div>
              <p className={styles.panelTitle}>Run Result</p>
              <p className={styles.panelMeta}>{skippedCount !== undefined ? `${skippedCount} skipped` : "Manual run"}</p>
            </div>
          </div>
          {runResults.length === 0 ? (
            <p className={styles.description}>No due schedules ran.</p>
          ) : (
            <ul className={styles.resultList}>
              {runResults.map((result) => (
                <li key={`${result.id}-${result.startedAt}`} className={styles.resultItem}>
                  <span className={result.status === "ok" ? styles.badgeSuccess : result.status === "already-running" ? styles.badgeWarning : styles.badgeDanger}>
                    {result.status}
                  </span>
                  <span>{summarizeScheduleRunResult(result)}</span>
                  {result.missionId ? (
                    <Link className={styles.inlineLink} to={`/missions?missionId=${encodeURIComponent(result.missionId)}`}>
                      {result.missionId}
                    </Link>
                  ) : result.runId ? (
                    <Link className={styles.inlineLink} to={`/tasks/runs/${encodeURIComponent(result.runId)}`}>
                      {result.runId}
                    </Link>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      <div className={styles.layout}>
        <section className={styles.scheduleListPanel}>
          <div className={styles.sectionHeader}>
            <div>
              <p className={styles.panelTitle}>Configured Schedules</p>
              <p className={styles.panelMeta}>{sortedSchedules.length} total</p>
            </div>
          </div>

          {schedulesQuery.isLoading ? (
            <p className={styles.description}>Loading schedules.</p>
          ) : sortedSchedules.length === 0 ? (
            <p className={styles.description}>No schedules configured.</p>
          ) : (
            <div className={styles.scheduleTable}>
              <div className={styles.tableHeader}>
                <span>Schedule</span>
                <span>Target</span>
                <span>Timing</span>
                <span>Runs</span>
                <span>Actions</span>
              </div>
              {sortedSchedules.map((schedule) => (
                <article key={schedule.id} className={styles.tableRow}>
                  <div className={styles.identityCell}>
                    <span className={statusClass(schedule.status)}>{schedule.status ?? (schedule.enabled ? "active" : "paused")}</span>
                    <div>
                      <p className={styles.rowTitle}>{schedule.name ?? schedule.id}</p>
                      <p className={styles.mono}>{schedule.id}</p>
                    </div>
                  </div>
                  <div>
                    <p className={styles.rowTitle}>{targetLabel(schedule, tasks, workflowTemplates)}</p>
                    <p className={styles.panelMeta}>{schedule.targetType ?? "legacy"}</p>
                  </div>
                  <dl className={styles.compactKv}>
                    <div>
                      <dt>{formatScheduleCadence(schedule)}</dt>
                      <dd>{formatScheduleDate(schedule.nextRunAt)}</dd>
                    </div>
                    <div>
                      <dt>Timezone</dt>
                      <dd>{schedule.timezone ?? "local"}</dd>
                    </div>
                  </dl>
                  <dl className={styles.compactKv}>
                    <div>
                      <dt>Last run</dt>
                      <dd>
                        {schedule.targetType === "workflow-template" && schedule.lastMissionId ? (
                          <Link className={styles.inlineLink} to={`/missions?missionId=${encodeURIComponent(schedule.lastMissionId)}`}>
                            {schedule.lastMissionId}
                          </Link>
                        ) : schedule.lastRunId ? (
                          <Link className={styles.inlineLink} to={`/tasks/runs/${encodeURIComponent(schedule.lastRunId)}`}>
                            {schedule.lastRunId}
                          </Link>
                        ) : (
                          "none"
                        )}
                      </dd>
                    </div>
                    <div>
                      <dt>Updated</dt>
                      <dd>{formatScheduleDate(schedule.updatedAt)}</dd>
                    </div>
                  </dl>
                  <div className={styles.rowActions}>
                    {schedule.status === "active" || schedule.enabled ? (
                      <button
                        type="button"
                        className={styles.iconButton}
                        onClick={() => disableScheduleMutation.mutate(schedule.id)}
                        disabled={disableScheduleMutation.isPending}
                        aria-label={`Pause ${schedule.id}`}
                        title="Pause schedule"
                      >
                        <Pause size={16} />
                      </button>
                    ) : (
                      <button
                        type="button"
                        className={styles.iconButton}
                        onClick={() => enableScheduleMutation.mutate(schedule.id)}
                        disabled={enableScheduleMutation.isPending}
                        aria-label={`Resume ${schedule.id}`}
                        title="Resume schedule"
                      >
                        <Play size={16} />
                      </button>
                    )}
                    <button
                      type="button"
                      className={styles.iconButton}
                      onClick={() => runNow(schedule.id)}
                      disabled={runScheduleMutation.isPending}
                      aria-label={`Run ${schedule.id}`}
                      title="Run schedule"
                    >
                      <RotateCw size={16} />
                    </button>
                    <button
                      type="button"
                      className={styles.iconButtonDanger}
                      onClick={() => deleteScheduleMutation.mutate(schedule.id)}
                      disabled={deleteScheduleMutation.isPending}
                      aria-label={`Delete ${schedule.id}`}
                      title="Delete schedule"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <aside className={styles.formPanel}>
          <div className={styles.sectionHeader}>
            <div>
              <p className={styles.panelTitle}>New Schedule</p>
              <p className={styles.panelMeta}>
                {readyTasks.length} ready tasks, {availableWorkflowTemplates.length} workflows
              </p>
            </div>
            <CalendarClock size={18} aria-hidden="true" />
          </div>

          <label className={styles.field}>
            <span className={styles.fieldLabel}>ID</span>
            <input
              className={styles.input}
              value={draft.id}
              onChange={(event) => updateDraft("id", event.target.value)}
              placeholder="daily-report"
            />
            {displayedValidation.id ? <span className={styles.fieldError}>{displayedValidation.id}</span> : null}
          </label>

          <label className={styles.field}>
            <span className={styles.fieldLabel}>Name</span>
            <input
              className={styles.input}
              value={draft.name}
              onChange={(event) => updateDraft("name", event.target.value)}
              placeholder="Daily report"
            />
          </label>

          <div className={styles.segmentedControl} role="group" aria-label="Schedule target type">
            <button
              type="button"
              className={draft.targetType === "task" ? styles.segmentActive : styles.segment}
              onClick={() => selectTargetType("task")}
            >
              Task
            </button>
            <button
              type="button"
              className={draft.targetType === "workflow-template" ? styles.segmentActive : styles.segment}
              onClick={() => selectTargetType("workflow-template")}
            >
              Workflow
            </button>
          </div>

          {draft.targetType === "task" ? (
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Ready Task</span>
            <select
              className={styles.select}
              value={draft.targetId}
              onChange={(event) => updateDraft("targetId", event.target.value)}
            >
              <option value="">Select task</option>
              {readyTasks.map((task) => (
                <option key={task.id} value={task.id}>
                  {task.title} ({task.id})
                </option>
              ))}
            </select>
            {displayedValidation.targetId ? <span className={styles.fieldError}>{displayedValidation.targetId}</span> : null}
          </label>
          ) : (
            <>
              <label className={styles.field}>
                <span className={styles.fieldLabel}>Workflow Template</span>
                <select
                  className={styles.select}
                  value={selectedWorkflowTemplate ? templateKey(selectedWorkflowTemplate) : ""}
                  onChange={(event) => selectWorkflowTemplate(event.target.value)}
                >
                  <option value="">Select workflow</option>
                  {availableWorkflowTemplates.map((template) => (
                    <option key={templateKey(template)} value={templateKey(template)}>
                      {template.name} ({template.id}@{template.version})
                    </option>
                  ))}
                </select>
                {displayedValidation.targetId ? <span className={styles.fieldError}>{displayedValidation.targetId}</span> : null}
              </label>
              {selectedWorkflowTemplate ? (
                <section className={styles.inputPanel}>
                  <div className={styles.sectionHeader}>
                    <div>
                      <p className={styles.panelTitle}>Inputs</p>
                      <p className={styles.panelMeta}>{inputMeta(workflowInputFields)}</p>
                    </div>
                  </div>
                  {workflowInputFields.length === 0 ? (
                    <p className={styles.description}>This template does not declare operator inputs.</p>
                  ) : (
                    <div className={styles.inputGrid}>
                      {workflowInputFields.map((field) =>
                        renderInputField(field, workflowInputValues, updateWorkflowInput, displayedWorkflowValidation),
                      )}
                    </div>
                  )}
                  {hasAttemptedCreate && hasWorkflowTemplateInputErrors(workflowInputValidation) ? (
                    <p className={styles.errorText}>Review the highlighted inputs before creating the schedule.</p>
                  ) : null}
                </section>
              ) : null}
            </>
          )}

          <div className={styles.segmentedControl} role="group" aria-label="Schedule mode">
            <button
              type="button"
              className={draft.mode === "one-shot" ? styles.segmentActive : styles.segment}
              onClick={() => updateDraft("mode", "one-shot")}
            >
              One Shot
            </button>
            <button
              type="button"
              className={draft.mode === "recurring" ? styles.segmentActive : styles.segment}
              onClick={() => updateDraft("mode", "recurring")}
            >
              Recurring
            </button>
          </div>

          {draft.mode === "one-shot" ? (
            <label className={styles.field}>
              <span className={styles.fieldLabel}>Run At</span>
              <input
                className={styles.input}
                type="datetime-local"
                value={draft.runAtLocal}
                onChange={(event) => updateDraft("runAtLocal", event.target.value)}
              />
              {displayedValidation.runAtLocal ? <span className={styles.fieldError}>{displayedValidation.runAtLocal}</span> : null}
            </label>
          ) : (
            <div className={styles.recurrenceGrid}>
              <label className={styles.field}>
                <span className={styles.fieldLabel}>Every</span>
                <input
                  className={styles.input}
                  type="number"
                  min="1"
                  step="1"
                  value={draft.interval}
                  onChange={(event) => updateDraft("interval", event.target.value)}
                />
                {displayedValidation.interval ? <span className={styles.fieldError}>{displayedValidation.interval}</span> : null}
              </label>
              <label className={styles.field}>
                <span className={styles.fieldLabel}>Unit</span>
                <select
                  className={styles.select}
                  value={draft.frequency}
                  onChange={(event) => updateDraft("frequency", event.target.value as ScheduleFormDraft["frequency"])}
                >
                  <option value="HOURLY">Hours</option>
                  <option value="DAILY">Days</option>
                  <option value="WEEKLY">Weeks</option>
                </select>
              </label>
            </div>
          )}

          <label className={styles.field}>
            <span className={styles.fieldLabel}>Timezone</span>
            <input
              className={styles.input}
              value={draft.timezone}
              onChange={(event) => updateDraft("timezone", event.target.value)}
            />
          </label>

          <button
            type="button"
            className={styles.primaryButton}
            onClick={() => createSchedule()}
            disabled={createScheduleMutation.isPending}
          >
            <Plus size={16} /> Create Schedule
          </button>
        </aside>
      </div>
    </section>
  );
}

function renderInputField(
  field: TaskInputField,
  values: TaskInputValues,
  updateInput: (key: string, value: string | boolean) => void,
  validation: Record<string, string>,
): JSX.Element {
  return (
    <label key={field.key} className={styles.field}>
      <span className={styles.fieldLabel}>
        {field.label}
        {field.required ? <span className={styles.required}>Required</span> : null}
      </span>
      {field.type === "markdown" || field.type === "json" ? (
        <textarea
          className={styles.textarea}
          value={String(values[field.key] ?? "")}
          onChange={(event) => updateInput(field.key, event.target.value)}
          rows={field.type === "markdown" ? 5 : 4}
        />
      ) : field.type === "boolean" ? (
        <span className={styles.toggleRow}>
          <input
            type="checkbox"
            checked={Boolean(values[field.key])}
            onChange={(event) => updateInput(field.key, event.target.checked)}
          />
          <span>{values[field.key] ? "True" : "False"}</span>
        </span>
      ) : (
        <input
          className={styles.input}
          type={field.type === "integer" || field.type === "number" ? "number" : "text"}
          value={String(values[field.key] ?? "")}
          onChange={(event) => updateInput(field.key, event.target.value)}
        />
      )}
      {validation[field.key] ? <span className={styles.fieldError}>{validation[field.key]}</span> : null}
    </label>
  );
}
