import { CheckCircle2, Play, RefreshCw, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { buildWorkPreflightItems, GuidanceNote, WorkPreflightPanel } from "../components";
import type { CapabilityPackMetadata, ProviderReadiness } from "../features/agent-catalog";
import {
  connectedRepositoryReadinessMessage,
  mergeConnectedRepositoryContext,
  type ConnectedRepository,
  useConnectedRepositoriesQuery,
} from "../features/connected-repositories";
import { buildTaskInputs, type TaskInputField, type TaskInputValues, type TaskWorkbenchRunMode } from "../features/task-workbench";
import { useExecuteWorkflowRunMutation } from "../features/workflow-runs";
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
const RUN_MODES: TaskWorkbenchRunMode[] = ["read-only", "propose-changes", "approved-write"];

type AvailabilityFilter = "all" | "available" | "unavailable";
type SourceFilter = "all" | "workspace" | "system";

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
    template.plugin.pack?.category ?? "",
    template.plugin.pack?.maturity ?? "",
    template.plugin.pack?.safety.posture ?? "",
    template.metadata.goal ?? "",
  ].some((value) => value.toLowerCase().includes(lower));
}

function sourceScope(sourceType: string): "workspace" | "system" {
  return sourceType === "system" ? "system" : "workspace";
}

function sourceLabel(sourceType: string): string {
  return sourceScope(sourceType) === "system" ? "System" : "Workspace";
}

function packLabel(pack: CapabilityPackMetadata | undefined): string {
  return pack ? `${pack.category} / ${pack.maturity}` : "Unpackaged";
}

function requirementLabels(pack: CapabilityPackMetadata | undefined): string[] {
  if (!pack) {
    return [];
  }
  return [
    ...pack.credentialRequirements.map((item) => `credential ${item}`),
    ...pack.memoryRequirements.map((item) => `memory ${item}`),
    pack.safety.externalWrites ? "external writes" : "no external writes",
    pack.safety.posture,
  ];
}

function uniquePackCategories(templates: WorkflowTemplateSummary[]): string[] {
  return Array.from(
    new Set(templates.map((template) => template.plugin.pack?.category).filter((item): item is string => Boolean(item))),
  ).sort((left, right) => left.localeCompare(right));
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

function hasInputValue(field: TaskInputField, values: TaskInputValues, repoContextAvailable: boolean): boolean {
  if (field.type === "repo") {
    return repoContextAvailable || Boolean(values[field.key]);
  }
  const value = values[field.key];
  return typeof value === "boolean" ? true : String(value ?? "").trim().length > 0;
}

function missingRequiredInputCount(fields: TaskInputField[], values: TaskInputValues, repoContextAvailable: boolean): number {
  return fields.filter((field) => field.required && !hasInputValue(field, values, repoContextAvailable)).length;
}

function templateKey(template: WorkflowTemplateSummary): string {
  return `${template.id}@${template.version}:${template.plugin.id}@${template.plugin.version}`;
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
  return styles.badgeMuted ?? "";
}

function runReadinessClass(status: "ready" | "ready-with-warnings" | "blocked" | undefined): string {
  if (status === "ready") {
    return styles.badgeSuccess ?? "";
  }
  if (status === "blocked") {
    return styles.badgeWarning ?? "";
  }
  return styles.badgeMuted ?? "";
}

export function WorkflowsPage() {
  const [searchParams] = useSearchParams();
  const templateIdParam = searchParams.get("templateId")?.trim() ?? "";
  const capabilityParam = searchParams.get("capability")?.trim() ?? "";
  const initialSearch = searchParams.get("q")?.trim() ?? "";
  const repoIdParam = searchParams.get("repoId")?.trim() ?? "";
  const runModeParam = searchParams.get("runMode")?.trim() ?? "";
  const [search, setSearch] = useState(initialSearch);
  const [availability, setAvailability] = useState<AvailabilityFilter>("all");
  const [source, setSource] = useState<SourceFilter>("all");
  const [pack, setPack] = useState("all");
  const [selectedTemplateKey, setSelectedTemplateKey] = useState("");
  const [selectedRepositoryId, setSelectedRepositoryId] = useState("");
  const [inputValues, setInputValues] = useState<TaskInputValues>({});
  const [runMode, setRunMode] = useState<TaskWorkbenchRunMode>("read-only");
  const [useRawInputs, setUseRawInputs] = useState(false);
  const [rawInputJson, setRawInputJson] = useState("{}");
  const [hasAttemptedInstantiate, setHasAttemptedInstantiate] = useState(false);
  const [showCatalog, setShowCatalog] = useState(!templateIdParam);
  const templatesQuery = useWorkflowTemplatesQuery({ includeUnavailable: true });
  const repositoriesQuery = useConnectedRepositoriesQuery();
  const instantiateMutation = useInstantiateWorkflowTemplateMutation();
  const executeWorkflowRunMutation = useExecuteWorkflowRunMutation();
  const templates = templatesQuery.data?.templates ?? EMPTY_TEMPLATES;
  const repositories = repositoriesQuery.data?.repositories ?? [];
  const visibleTemplates = useMemo(
    () =>
      templates.filter((template) => {
        if (availability === "available" && !template.available) {
          return false;
        }
        if (availability === "unavailable" && template.available) {
          return false;
        }
        if (source !== "all" && sourceScope(template.plugin.sourceType) !== source) {
          return false;
        }
        if (pack !== "all" && template.plugin.pack?.category !== pack) {
          return false;
        }
        return matchesSearch(template, search.trim());
      }),
    [availability, pack, search, source, templates],
  );
  const selectedTemplate = useMemo(
    () =>
      templates.find((template) => templateKey(template) === selectedTemplateKey) ??
      templates.find((template) => template.id === templateIdParam) ??
      visibleTemplates[0],
    [selectedTemplateKey, templateIdParam, templates, visibleTemplates],
  );
  const selectedRepository = repositories.find((repository) => repository.id === selectedRepositoryId);
  const repoReadinessMessage = connectedRepositoryReadinessMessage(selectedRepository);
  const providerReadinessBlocking = isProviderReadinessBlocking(selectedTemplate?.providerReadiness);
  const instantiatedReadinessChecks =
    instantiateMutation.data?.tasks.flatMap((task) =>
      task.runReadiness?.checks
        .filter((check) => check.status === "blocked" || check.status === "warning")
        .map((check) => ({ task, check })) ?? [],
    ) ?? [];
  const instantiatedReadinessBlocked = instantiatedReadinessChecks.some(({ check }) => check.status === "blocked");
  const inputFields = useMemo(() => workflowTemplateInputFields(selectedTemplate), [selectedTemplate]);
  const inputValidation = validateWorkflowTemplateInputs(inputFields, inputValues, {
    useRawInputs,
    rawInputJson,
    repoContextAvailable: Boolean(selectedRepository),
  });
  const displayedValidation = hasAttemptedInstantiate ? inputValidation : {};
  const availableCount = templates.filter((template) => template.available).length;
  const unavailableCount = templates.length - availableCount;
  const packCategories = useMemo(() => uniquePackCategories(templates), [templates]);
  const isCapabilityFlow = Boolean(templateIdParam);
  const missingInputs = missingRequiredInputCount(inputFields, inputValues, Boolean(selectedRepository));
  const preflightItems = buildWorkPreflightItems({
    backingLabel: "Backing workflow",
    backingName: selectedTemplate?.name,
    backingResolving: Boolean(templateIdParam),
    backingEmptyLabel: "Choose a workflow",
    repositoryName: selectedRepository?.name,
    repositoryDetail: repoReadinessMessage || selectedRepository?.workspacePath,
    repositoryBlocked: Boolean(repoReadinessMessage),
    providerReadiness: selectedTemplate?.providerReadiness,
    providerBlocking: providerReadinessBlocking,
    pack: selectedTemplate?.plugin.pack,
    runModeLabel: runModeLabel(runMode),
    runModeSummary: runModeSafetySummary(runMode),
    policyWarning: runMode === "approved-write",
    missingInputs,
    requiredInputCount: inputFields.filter((field) => field.required).length,
  });

  useEffect(() => {
    if (!selectedTemplate && selectedTemplateKey) {
      setSelectedTemplateKey("");
    }
    if (selectedTemplate && templateKey(selectedTemplate) !== selectedTemplateKey) {
      setSelectedTemplateKey(templateKey(selectedTemplate));
    }
  }, [selectedTemplate, selectedTemplateKey]);

  useEffect(() => {
    if (!repoIdParam || repositoriesQuery.isLoading || selectedRepositoryId) {
      return;
    }
    if (repositories.some((repository) => repository.id === repoIdParam)) {
      setSelectedRepositoryId(repoIdParam);
    }
  }, [repoIdParam, repositories, repositoriesQuery.isLoading, selectedRepositoryId]);

  useEffect(() => {
    if (!RUN_MODES.includes(runModeParam as TaskWorkbenchRunMode)) {
      return;
    }
    setRunMode(runModeParam as TaskWorkbenchRunMode);
  }, [runModeParam]);

  useEffect(() => {
    const nextValues = initialWorkflowTemplateInputValues(selectedTemplate);
    setInputValues(nextValues);
    setRawInputJson(JSON.stringify(buildTaskInputs(workflowTemplateInputFields(selectedTemplate), nextValues), null, 2));
    setUseRawInputs(false);
    setHasAttemptedInstantiate(false);
  }, [selectedTemplate]);

  function updateInput(key: string, value: string | boolean): void {
    setInputValues((current) => ({
      ...current,
      [key]: value,
    }));
  }

  async function refresh(): Promise<void> {
    await Promise.all([templatesQuery.refetch(), repositoriesQuery.refetch()]);
  }

  function instantiateSelected(): void {
    if (!selectedTemplate) {
      return;
    }
    setHasAttemptedInstantiate(true);
    if (repoReadinessMessage) {
      return;
    }
    if (providerReadinessBlocking) {
      return;
    }
    if (hasWorkflowTemplateInputErrors(inputValidation)) {
      return;
    }
    const request = buildWorkflowTemplateInstantiateRequest(selectedTemplate, inputFields, inputValues, {
      useRawInputs,
      rawInputJson,
      repoContextAvailable: Boolean(selectedRepository),
      runMode,
    });
    request.inputs = mergeConnectedRepositoryContext(request.inputs ?? {}, selectedRepository);
    instantiateMutation.mutate({
      templateId: selectedTemplate.id,
      request,
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

      <GuidanceNote title="When to use a workflow">
        <p>
          Workflow templates come from plugins. Instantiating one creates a mission, tasks, and a workflow run; provide repo path or objective inputs when the template asks for run context.
        </p>
        <Link className={styles.inlineLink} to="/tasks">
          Create a one-off task instead
        </Link>
      </GuidanceNote>

      {isCapabilityFlow ? (
        <section className={styles.guidancePanel}>
          <div>
            <p className={styles.panelMeta}>Selected capability</p>
            <p className={styles.panelTitle}>{capabilityParam || selectedTemplate?.name || templateIdParam}</p>
            <p className={styles.description}>
              Team Orchestrator selected the backing workflow for this outcome. Review the template, repository context, run mode, and inputs before instantiating it.
            </p>
          </div>
          <button type="button" className={styles.secondaryButton} onClick={() => setShowCatalog((current) => !current)}>
            {showCatalog ? "Hide catalog" : "Browse other workflows"}
          </button>
        </section>
      ) : null}

      <WorkPreflightPanel badge="Workflow" title="Review before instantiating" items={preflightItems} />

      {!isCapabilityFlow ? (
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
      ) : null}

      {showCatalog ? (
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
        <label className={styles.field}>
          <span className={styles.fieldLabel}>Source</span>
          <select className={styles.select} value={source} onChange={(event) => setSource(event.target.value as SourceFilter)}>
            <option value="all">All sources</option>
            <option value="workspace">Workspace</option>
            <option value="system">System</option>
          </select>
        </label>
        <label className={styles.field}>
          <span className={styles.fieldLabel}>Pack</span>
          <select className={styles.select} value={pack} onChange={(event) => setPack(event.target.value)}>
            <option value="all">All packs</option>
            {packCategories.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
      </div>
      ) : null}

      {templatesQuery.isLoading || repositoriesQuery.isLoading ? (
        <div className={styles.state}>
          <p className={styles.stateTitle}>Loading Workflow Templates</p>
          <p className={styles.description}>Reading indexed workflow templates and connected repositories from local APIs.</p>
        </div>
      ) : null}

      {(templatesQuery.error ?? repositoriesQuery.error) instanceof Error ? (
        <div className={styles.state}>
          <p className={styles.stateTitle}>Unable To Load Workflow Templates</p>
          <p className={styles.errorText}>{((templatesQuery.error ?? repositoriesQuery.error) as Error).message}</p>
        </div>
      ) : null}

      {!templatesQuery.isLoading && !repositoriesQuery.isLoading && !templatesQuery.error && !repositoriesQuery.error && templates.length === 0 ? (
        <div className={styles.state}>
          <p className={styles.stateTitle}>No Workflow Templates Indexed</p>
          <p className={styles.description}>Open the agent catalog to confirm plugins are loaded, then refresh this page.</p>
          <div className={styles.actionBarStart}>
            <Link className={styles.inlineLink} to="/agents">
              Check agents
            </Link>
          </div>
        </div>
      ) : null}

      {!templatesQuery.isLoading && !repositoriesQuery.isLoading && !templatesQuery.error && !repositoriesQuery.error && templates.length > 0 ? (
        <div className={showCatalog ? styles.layout : styles.layoutFocused}>
          {showCatalog ? (
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
                      <span className={styles.badgeMuted}>{sourceLabel(template.plugin.sourceType)}</span>
                      <span className={template.plugin.pack ? styles.badge : styles.badgeMuted}>
                        {packLabel(template.plugin.pack)}
                      </span>
                      <span className={styles.badgeMuted}>{inputMeta(workflowTemplateInputFields(template))}</span>
                      <span className={providerReadinessClass(template.providerReadiness)}>
                        provider {template.providerReadiness.status}
                      </span>
                      {requirementLabels(template.plugin.pack).map((item) => (
                        <span key={`${templateKey(template)}-${item}`} className={styles.badgeMuted}>
                          {item}
                        </span>
                      ))}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </section>
          ) : null}

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
                  <div className={styles.badgeRow}>
                    <span className={styles.badgeMuted}>{sourceLabel(selectedTemplate.plugin.sourceType)}</span>
                    <span className={selectedTemplate.plugin.pack ? styles.badge : styles.badgeMuted}>
                      {packLabel(selectedTemplate.plugin.pack)}
                    </span>
                    <span className={providerReadinessClass(selectedTemplate.providerReadiness)}>
                      provider {selectedTemplate.providerReadiness.status}
                    </span>
                    {selectedTemplate.providerReadiness.providerName ? (
                      <span className={styles.badgeMuted}>{selectedTemplate.providerReadiness.providerName}</span>
                    ) : null}
                  </div>
                  {requirementLabels(selectedTemplate.plugin.pack).length > 0 ? (
                    <div className={styles.badgeRow}>
                      {requirementLabels(selectedTemplate.plugin.pack).map((item) => (
                        <span key={`${templateKey(selectedTemplate)}-selected-${item}`} className={styles.badgeMuted}>
                          {item}
                        </span>
                      ))}
                    </div>
                  ) : null}
                  <p className={styles.description}>{selectedTemplate.providerReadiness.message}</p>
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
                      <p className={styles.sectionTitle}>Run Mode</p>
                      <p className={styles.panelMeta}>{runMode}</p>
                    </div>
                  </div>
                  <label className={styles.field}>
                    <span className={styles.fieldLabel}>Mode</span>
                    <select
                      className={styles.select}
                      value={runMode}
                      onChange={(event) => setRunMode(event.target.value as TaskWorkbenchRunMode)}
                    >
                      {RUN_MODES.map((mode) => (
                        <option key={mode} value={mode}>
                          {runModeLabel(mode)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <p className={runMode === "approved-write" ? styles.errorText : styles.description}>
                    {runModeDescription(runMode)}
                  </p>
                </section>

                <section className={styles.section}>
                  <div className={styles.sectionHeader}>
                    <div>
                      <p className={styles.sectionTitle}>Inputs</p>
                      <p className={styles.panelMeta}>{useRawInputs ? "Raw JSON" : inputMeta(inputFields)}</p>
                    </div>
                    {inputFields.length > 0 ? (
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
                  {inputFields.length === 0 ? (
                    <p className={styles.description}>This template does not declare operator inputs.</p>
                  ) : useRawInputs ? (
                    <label className={styles.field}>
                      <span className={styles.fieldLabel}>Inputs JSON</span>
                      <textarea
                        className={styles.textarea}
                        value={rawInputJson}
                        onChange={(event) => setRawInputJson(event.target.value)}
                        rows={8}
                      />
                      {displayedValidation.__raw ? <span className={styles.fieldError}>{displayedValidation.__raw}</span> : null}
                    </label>
                  ) : (
                    <div className={styles.inputGrid}>
                      {inputFields.map((field) => renderInputField(field, inputValues, updateInput, displayedValidation, selectedRepository))}
                    </div>
                  )}
                </section>

                <section className={styles.section}>
                  <div className={styles.sectionHeader}>
                    <div>
                      <p className={styles.sectionTitle}>Repository</p>
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
                        <dd>{selectedRepository.workspacePath}</dd>
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
                  {hasAttemptedInstantiate && repoReadinessMessage ? (
                    <p className={styles.errorText}>{repoReadinessMessage}</p>
                  ) : null}
                </section>

                {instantiateMutation.error instanceof Error ? (
                  <p className={styles.errorText}>{preflightErrorMessage(instantiateMutation.error) ?? instantiateMutation.error.message}</p>
                ) : null}
                {hasAttemptedInstantiate && providerReadinessBlocking ? (
                  <p className={styles.errorText}>Configure a valid model provider in Settings before instantiating this workflow.</p>
                ) : null}
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
                  <Link className={styles.inlineLink} to={`/missions?missionId=${encodeURIComponent(instantiateMutation.data.mission.id)}`}>
                    Open mission
                  </Link>
                  {instantiateMutation.data.workflowDagRun ? (
                    <div className={styles.actionBarStart}>
                      <button
                        type="button"
                        className={styles.primaryButton}
                        onClick={() => executeWorkflowRunMutation.mutate(instantiateMutation.data.workflowDagRun!.id)}
                        disabled={executeWorkflowRunMutation.isPending || instantiatedReadinessBlocked}
                      >
                        <Play size={16} /> Run workflow
                      </button>
                      <Link
                        className={styles.inlineLink}
                        to={`/workflows/runs/${encodeURIComponent(instantiateMutation.data.workflowDagRun.id)}`}
                      >
                        Open workflow run
                      </Link>
                    </div>
                  ) : null}
                  {executeWorkflowRunMutation.error instanceof Error ? (
                    <p className={styles.errorText}>{executeWorkflowRunMutation.error.message}</p>
                  ) : null}
                  {instantiatedReadinessBlocked ? (
                    <p className={styles.errorText}>Resolve blocked task readiness checks before running this workflow.</p>
                  ) : null}
                  {executeWorkflowRunMutation.data ? (
                    <p className={styles.description}>
                      Executed {executeWorkflowRunMutation.data.executedStepIds.length} steps. Status: {executeWorkflowRunMutation.data.status}.
                    </p>
                  ) : null}
                  <dl className={styles.kvList}>
                    <div>
                      <dt>Template</dt>
                      <dd>{instantiateMutation.data.template.name}</dd>
                    </div>
                    {instantiateMutation.data.workflowDagRun ? (
                      <div>
                        <dt>Workflow run</dt>
                        <dd>{instantiateMutation.data.workflowDagRun.id}</dd>
                      </div>
                    ) : null}
                    <div>
                      <dt>Tasks</dt>
                      <dd>{instantiateMutation.data.tasks.length}</dd>
                    </div>
                  </dl>
                  {instantiatedReadinessChecks.length > 0 ? (
                    <div className={styles.taskList}>
                      {instantiatedReadinessChecks.slice(0, 6).map(({ task, check }) => (
                        <div key={`${task.id}-${check.id}`} className={styles.taskItem}>
                          <p className={styles.templateName}>{check.label}</p>
                          <p className={styles.mono}>{task.id}</p>
                          <p className={styles.description}>{check.message}</p>
                          <p className={styles.description}>{check.nextStep}</p>
                          <span className={runReadinessClass(check.status === "blocked" ? "blocked" : "ready-with-warnings")}>
                            {check.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : null}
                  <div className={styles.taskList}>
                    {instantiateMutation.data.tasks.map((task) => (
                      <div key={task.id} className={styles.taskItem}>
                        <p className={styles.templateName}>{task.title}</p>
                        <p className={styles.mono}>{task.id}</p>
                        <div className={styles.badgeRow}>
                          <span className={task.status === "ready" ? styles.badgeSuccess : styles.badgeMuted}>{task.status}</span>
                          <span className={taskRunMode(task.inputs) === "approved-write" ? styles.badgeWarning : styles.badgeMuted}>
                            {taskRunMode(task.inputs)}
                          </span>
                          {task.runReadiness ? (
                            <span className={runReadinessClass(task.runReadiness.status)}>run {task.runReadiness.status}</span>
                          ) : null}
                          {task.dependsOn.length > 0 ? <span className={styles.badgeMuted}>depends on {task.dependsOn.join(", ")}</span> : null}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              ) : (
                <div className={styles.stateInline}>
                  <p className={styles.stateTitle}>No Workflow Created Yet</p>
                  <p className={styles.description}>Select an available template and instantiate it to create a mission and workflow run.</p>
                </div>
              )}
            </div>
          </aside>
        </div>
      ) : null}
    </section>
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
    return "Workflow tasks default to read-only. File mutations are not applied automatically.";
  }
  if (mode === "propose-changes") {
    return "Workflow tasks may return proposed diffs as artifacts for review; the console will not apply them.";
  }
  return "Write/apply mode is unavailable until approval handling exists.";
}

function runModeSafetySummary(mode: TaskWorkbenchRunMode): string {
  if (mode === "read-only") {
    return "No automatic file mutations.";
  }
  if (mode === "propose-changes") {
    return "Outputs proposals for review.";
  }
  return "Requires explicit approval support.";
}

function taskRunMode(inputs: unknown): string {
  if (typeof inputs === "object" && inputs !== null && !Array.isArray(inputs) && typeof (inputs as { runMode?: unknown }).runMode === "string") {
    return (inputs as { runMode: string }).runMode;
  }
  return "read-only";
}

function preflightErrorMessage(error: Error): string | undefined {
  const readiness = readReadinessDetails(error);
  if (!readiness) {
    return undefined;
  }
  const blocked = readiness.checks.find((check) => check.status === "blocked");
  if (!blocked) {
    return undefined;
  }
  return `${readiness.summary} ${blocked.label}: ${blocked.message} ${blocked.nextStep}`;
}

function readReadinessDetails(error: Error): { summary: string; checks: Array<{ status: string; label: string; message: string; nextStep: string }> } | undefined {
  const details = (error as { details?: unknown }).details;
  if (typeof details !== "object" || details === null || !("readiness" in details)) {
    return undefined;
  }
  const readiness = (details as { readiness?: unknown }).readiness;
  if (typeof readiness !== "object" || readiness === null || !Array.isArray((readiness as { checks?: unknown }).checks)) {
    return undefined;
  }
  const summary = typeof (readiness as { summary?: unknown }).summary === "string" ? (readiness as { summary: string }).summary : error.message;
  const checks = (readiness as { checks: unknown[] }).checks
    .filter((check): check is Record<string, unknown> => typeof check === "object" && check !== null)
    .map((check) => ({
      status: typeof check.status === "string" ? check.status : "",
      label: typeof check.label === "string" ? check.label : "Readiness",
      message: typeof check.message === "string" ? check.message : "",
      nextStep: typeof check.nextStep === "string" ? check.nextStep : "",
    }));
  return { summary, checks };
}

function renderInputField(
  field: TaskInputField,
  values: TaskInputValues,
  updateInput: (key: string, value: string | boolean) => void,
  validation: Record<string, string>,
  selectedRepository: ConnectedRepository | undefined,
): JSX.Element {
  return (
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
            : "Select repo context in the Repository section, or switch to raw JSON for manual input."}
        </span>
      ) : field.type === "markdown" || field.type === "json" ? (
        <textarea
          className={styles.textarea}
          value={String(values[field.key] ?? "")}
          onChange={(event) => updateInput(field.key, event.target.value)}
          rows={field.type === "markdown" ? 5 : 4}
        />
      ) : field.type === "enum" ? (
        <select
          className={styles.select}
          value={String(values[field.key] ?? "")}
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
            checked={Boolean(values[field.key])}
            onChange={(event) => updateInput(field.key, event.target.checked)}
          />
          <span>{values[field.key] ? "True" : "False"}</span>
        </span>
      ) : (
        <input
          className={styles.input}
          type={field.type === "integer" || field.type === "number" ? "number" : field.type === "url" ? "url" : "text"}
          value={String(values[field.key] ?? "")}
          onChange={(event) => updateInput(field.key, event.target.value)}
        />
      )}
      {validation[field.key] ? <span className={styles.fieldError}>{validation[field.key]}</span> : null}
    </label>
  );
}
