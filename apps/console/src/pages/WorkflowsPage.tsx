import { CheckCircle2, Play, RefreshCw, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import type { TaskInputField, TaskInputValues } from "../features/task-workbench";
import {
  buildWorkflowTemplateInstantiateRequest,
  hasWorkflowTemplateInputErrors,
  initialWorkflowTemplateInputValues,
  useInstantiateWorkflowTemplateMutation,
  useWorkflowTemplatesQuery,
  validateWorkflowTemplateInputs,
  workflowTemplateInputFields,
  type WorkflowTemplateSummary,
} from "../features/workflow-templates";
import styles from "./WorkflowsPage.module.css";

const EMPTY_TEMPLATES: WorkflowTemplateSummary[] = [];

type AvailabilityFilter = "all" | "available" | "unavailable";

function statusClass(template: WorkflowTemplateSummary): string {
  if (!template.available || template.status === "invalid") {
    return styles.badgeWarning ?? "";
  }
  if (template.status === "loaded") {
    return styles.badgeSuccess ?? "";
  }
  return styles.badgeMuted ?? "";
}

function matchesSearch(template: WorkflowTemplateSummary, search: string): boolean {
  if (!search) {
    return true;
  }
  const lower = search.toLowerCase();
  return [
    template.id,
    template.version,
    template.name,
    template.description,
    template.plugin.id,
    template.plugin.name,
    template.metadata.goal ?? "",
  ].some((value) => value.toLowerCase().includes(lower));
}

function formatJson(value: unknown): string {
  if (value === undefined) {
    return "";
  }
  if (typeof value === "string") {
    return value;
  }
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function inputMeta(fields: TaskInputField[]): string {
  const required = fields.filter((field) => field.required).length;
  if (fields.length === 0) {
    return "No inputs";
  }
  return required > 0 ? `${fields.length} inputs, ${required} required` : `${fields.length} inputs`;
}

function templateKey(template: WorkflowTemplateSummary): string {
  return `${template.id}@${template.version}:${template.plugin.id}@${template.plugin.version}`;
}

export function WorkflowsPage() {
  const [search, setSearch] = useState("");
  const [availability, setAvailability] = useState<AvailabilityFilter>("all");
  const [selectedTemplateKey, setSelectedTemplateKey] = useState("");
  const [inputValues, setInputValues] = useState<TaskInputValues>({});
  const [hasAttemptedInstantiate, setHasAttemptedInstantiate] = useState(false);
  const templatesQuery = useWorkflowTemplatesQuery({ includeUnavailable: true });
  const instantiateMutation = useInstantiateWorkflowTemplateMutation();
  const templates = templatesQuery.data?.templates ?? EMPTY_TEMPLATES;
  const visibleTemplates = useMemo(
    () =>
      templates.filter((template) => {
        if (availability === "available" && !template.available) {
          return false;
        }
        if (availability === "unavailable" && template.available) {
          return false;
        }
        return matchesSearch(template, search.trim());
      }),
    [availability, search, templates],
  );
  const selectedTemplate = useMemo(
    () => templates.find((template) => templateKey(template) === selectedTemplateKey) ?? visibleTemplates[0],
    [selectedTemplateKey, templates, visibleTemplates],
  );
  const inputFields = useMemo(() => workflowTemplateInputFields(selectedTemplate), [selectedTemplate]);
  const inputValidation = validateWorkflowTemplateInputs(inputFields, inputValues);
  const displayedValidation = hasAttemptedInstantiate ? inputValidation : {};
  const availableCount = templates.filter((template) => template.available).length;
  const unavailableCount = templates.length - availableCount;

  useEffect(() => {
    if (!selectedTemplate && selectedTemplateKey) {
      setSelectedTemplateKey("");
    }
    if (selectedTemplate && templateKey(selectedTemplate) !== selectedTemplateKey) {
      setSelectedTemplateKey(templateKey(selectedTemplate));
    }
  }, [selectedTemplate, selectedTemplateKey]);

  useEffect(() => {
    setInputValues(initialWorkflowTemplateInputValues(selectedTemplate));
    setHasAttemptedInstantiate(false);
  }, [selectedTemplate]);

  function updateInput(key: string, value: string | boolean): void {
    setInputValues((current) => ({
      ...current,
      [key]: value,
    }));
  }

  async function refresh(): Promise<void> {
    await templatesQuery.refetch();
  }

  function instantiateSelected(): void {
    if (!selectedTemplate) {
      return;
    }
    setHasAttemptedInstantiate(true);
    if (hasWorkflowTemplateInputErrors(inputValidation)) {
      return;
    }
    instantiateMutation.mutate({
      templateId: selectedTemplate.id,
      request: buildWorkflowTemplateInstantiateRequest(selectedTemplate, inputFields, inputValues),
    });
  }

  return (
    <section className={styles.page}>
      <div className={styles.pageHeader}>
        <div>
          <p className={styles.panelMeta}>Workflow Templates</p>
          <h2 className={styles.pageTitle}>Instantiate Workflows</h2>
        </div>
        <button
          type="button"
          className={styles.iconButton}
          onClick={() => void refresh()}
          disabled={templatesQuery.isFetching}
          aria-label="Refresh workflow templates"
          title="Refresh workflow templates"
        >
          <RefreshCw size={16} />
        </button>
      </div>

      <div className={styles.summaryGrid}>
        <div className={styles.metric}>
          <span className={styles.metricLabel}>Templates</span>
          <span className={styles.metricValue}>{templates.length}</span>
        </div>
        <div className={styles.metric}>
          <span className={styles.metricLabel}>Available</span>
          <span className={styles.metricValue}>{availableCount}</span>
        </div>
        <div className={styles.metric}>
          <span className={styles.metricLabel}>Unavailable</span>
          <span className={styles.metricValue}>{unavailableCount}</span>
        </div>
        <div className={styles.metric}>
          <span className={styles.metricLabel}>Visible</span>
          <span className={styles.metricValue}>{visibleTemplates.length}</span>
        </div>
      </div>

      <div className={styles.filters}>
        <label className={styles.field}>
          <span className={styles.fieldLabel}>Search</span>
          <span className={styles.inputWrap}>
            <Search size={15} />
            <input
              className={styles.input}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="template, plugin, goal"
              type="search"
            />
          </span>
        </label>
        <label className={styles.field}>
          <span className={styles.fieldLabel}>State</span>
          <select className={styles.select} value={availability} onChange={(event) => setAvailability(event.target.value as AvailabilityFilter)}>
            <option value="all">All states</option>
            <option value="available">Available</option>
            <option value="unavailable">Unavailable</option>
          </select>
        </label>
      </div>

      {templatesQuery.isLoading ? (
        <div className={styles.state}>
          <p className={styles.stateTitle}>Loading Workflow Templates</p>
          <p className={styles.description}>Reading indexed workflow templates from the local catalog API.</p>
        </div>
      ) : null}

      {templatesQuery.error instanceof Error ? (
        <div className={styles.state}>
          <p className={styles.stateTitle}>Unable To Load Workflow Templates</p>
          <p className={styles.errorText}>{templatesQuery.error.message}</p>
        </div>
      ) : null}

      {!templatesQuery.isLoading && !templatesQuery.error && templates.length === 0 ? (
        <div className={styles.state}>
          <p className={styles.stateTitle}>No Workflow Templates Indexed</p>
          <p className={styles.description}>Install or configure plugins with workflow templates, then refresh the catalog.</p>
        </div>
      ) : null}

      {!templatesQuery.isLoading && !templatesQuery.error && templates.length > 0 ? (
        <div className={styles.layout}>
          <section className={styles.panel}>
            <div className={styles.panelHeader}>
              <div>
                <p className={styles.panelTitle}>Catalog</p>
                <p className={styles.panelMeta}>{visibleTemplates.length} shown</p>
              </div>
            </div>
            {visibleTemplates.length === 0 ? (
              <div className={styles.stateInline}>
                <p className={styles.stateTitle}>No Templates Match Filters</p>
                <p className={styles.description}>Adjust the search or state filter.</p>
              </div>
            ) : (
              <div className={styles.templateList}>
                {visibleTemplates.map((template) => (
                  <button
                    type="button"
                    key={templateKey(template)}
                    className={`${styles.templateRow} ${selectedTemplate && templateKey(selectedTemplate) === templateKey(template) ? styles.templateRowActive : ""}`}
                    onClick={() => setSelectedTemplateKey(templateKey(template))}
                  >
                    <span className={styles.rowTop}>
                      <span>
                        <span className={styles.templateName}>{template.name}</span>
                        <span className={styles.mono}>{template.id}@{template.version}</span>
                      </span>
                      <span className={statusClass(template)}>{template.available ? "Available" : "Unavailable"}</span>
                    </span>
                    <span className={styles.description}>{template.description || template.metadata.goal || "No description declared."}</span>
                    <span className={styles.badgeRow}>
                      <span className={styles.badge}>{template.taskCount} tasks</span>
                      <span className={styles.badgeMuted}>{template.plugin.name}</span>
                      <span className={styles.badgeMuted}>{inputMeta(workflowTemplateInputFields(template))}</span>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </section>

          <form
            className={styles.panel}
            onSubmit={(event) => {
              event.preventDefault();
              instantiateSelected();
            }}
          >
            <div className={styles.panelHeader}>
              <div>
                <p className={styles.panelTitle}>Instantiate</p>
                <p className={styles.panelMeta}>{selectedTemplate ? selectedTemplate.plugin.name : "No template selected"}</p>
              </div>
            </div>

            {selectedTemplate ? (
              <div className={styles.panelBody}>
                <section className={styles.section}>
                  <div className={styles.sectionHeader}>
                    <div>
                      <p className={styles.sectionTitle}>{selectedTemplate.name}</p>
                      <p className={styles.mono}>{selectedTemplate.plugin.id}@{selectedTemplate.plugin.version}</p>
                    </div>
                    <span className={statusClass(selectedTemplate)}>{selectedTemplate.status}</span>
                  </div>
                  <p className={styles.description}>{selectedTemplate.description || "No description declared."}</p>
                  {selectedTemplate.metadata.goal ? (
                    <dl className={styles.kvList}>
                      <div>
                        <dt>Goal</dt>
                        <dd>{selectedTemplate.metadata.goal}</dd>
                      </div>
                    </dl>
                  ) : null}
                  {selectedTemplate.metadata.context !== undefined ? (
                    <details className={styles.details}>
                      <summary>Context Preview</summary>
                      <pre className={styles.codeBlock}>{formatJson(selectedTemplate.metadata.context)}</pre>
                    </details>
                  ) : null}
                  {selectedTemplate.validationErrors.length > 0 ? (
                    <ul className={styles.validationList}>
                      {selectedTemplate.validationErrors.slice(0, 4).map((issue, index) => (
                        <li key={`${issue.path}-${index}`}>
                          <strong>{issue.resourceType}</strong> {issue.path}: {issue.message}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </section>

                <section className={styles.section}>
                  <div className={styles.sectionHeader}>
                    <div>
                      <p className={styles.sectionTitle}>Inputs</p>
                      <p className={styles.panelMeta}>{inputMeta(inputFields)}</p>
                    </div>
                  </div>
                  {inputFields.length === 0 ? (
                    <p className={styles.description}>This template does not declare operator inputs.</p>
                  ) : (
                    <div className={styles.inputGrid}>
                      {inputFields.map((field) => renderInputField(field, inputValues, updateInput, displayedValidation))}
                    </div>
                  )}
                </section>

                {instantiateMutation.error instanceof Error ? <p className={styles.errorText}>{instantiateMutation.error.message}</p> : null}
                {hasAttemptedInstantiate && hasWorkflowTemplateInputErrors(inputValidation) ? (
                  <p className={styles.errorText}>Review the highlighted inputs before instantiating.</p>
                ) : null}

                <div className={styles.actionBar}>
                  <button
                    type="submit"
                    className={styles.primaryButton}
                    disabled={!selectedTemplate.available || instantiateMutation.isPending}
                  >
                    <Play size={16} /> Instantiate
                  </button>
                </div>
              </div>
            ) : (
              <div className={styles.stateInline}>
                <p className={styles.stateTitle}>No Template Selected</p>
                <p className={styles.description}>Select a workflow template from the catalog.</p>
              </div>
            )}
          </form>

          <aside className={styles.panel}>
            <div className={styles.panelHeader}>
              <div>
                <p className={styles.panelTitle}>Created Work</p>
                <p className={styles.panelMeta}>{instantiateMutation.data ? instantiateMutation.data.mission.status : "None"}</p>
              </div>
            </div>
            <div className={styles.panelBody}>
              {instantiateMutation.data ? (
                <section className={styles.section}>
                  <div className={styles.successHeader}>
                    <CheckCircle2 size={18} />
                    <div>
                      <p className={styles.sectionTitle}>{instantiateMutation.data.mission.title}</p>
                      <p className={styles.mono}>{instantiateMutation.data.mission.id}</p>
                    </div>
                  </div>
                  <Link className={styles.inlineLink} to={`/tasks?missionId=${encodeURIComponent(instantiateMutation.data.mission.id)}`}>
                    View mission tasks
                  </Link>
                  <dl className={styles.kvList}>
                    <div>
                      <dt>Template</dt>
                      <dd>{instantiateMutation.data.template.name}</dd>
                    </div>
                    <div>
                      <dt>Tasks</dt>
                      <dd>{instantiateMutation.data.tasks.length}</dd>
                    </div>
                  </dl>
                  <div className={styles.taskList}>
                    {instantiateMutation.data.tasks.map((task) => (
                      <div key={task.id} className={styles.taskItem}>
                        <p className={styles.templateName}>{task.title}</p>
                        <p className={styles.mono}>{task.id}</p>
                        <div className={styles.badgeRow}>
                          <span className={task.status === "ready" ? styles.badgeSuccess : styles.badgeMuted}>{task.status}</span>
                          {task.dependsOn.length > 0 ? <span className={styles.badgeMuted}>depends on {task.dependsOn.join(", ")}</span> : null}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              ) : (
                <p className={styles.description}>No workflow template instantiated in this session.</p>
              )}
            </div>
          </aside>
        </div>
      ) : null}
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
