import { CheckCircle2, Play, Plus, RefreshCw, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  buildRunTemplateCreateRequest,
  buildTemplateRunRequest,
  extractDirectivePlaceholders,
  formatKeyValueLines,
  summarizeParams,
  templateSearchText,
  useCreateRunTemplateMutation,
  useHarnessProfilesQuery,
  useRunTemplateMutation,
  useRunTemplatesQuery,
  type HarnessProfile,
  type RunTemplate,
} from "../features/run-templates";
import styles from "./RunTemplatesPage.module.css";

const EMPTY_TEMPLATES: RunTemplate[] = [];
const EMPTY_PROFILES: HarnessProfile[] = [];

function matchesSearch(template: RunTemplate, search: string): boolean {
  return search ? templateSearchText(template).toLowerCase().includes(search.toLowerCase()) : true;
}

function profileLabel(profile: HarnessProfile): string {
  return `${profile.displayName} (${profile.id})`;
}

function formatParams(value: Record<string, string>): string {
  return Object.keys(value).length > 0 ? JSON.stringify(value, null, 2) : "{}";
}

export function RunTemplatesPage() {
  const [search, setSearch] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [createAttempted, setCreateAttempted] = useState(false);
  const [runAttempted, setRunAttempted] = useState(false);
  const [harnessProfileId, setHarnessProfileId] = useState("");
  const [manualHarnessProfileId, setManualHarnessProfileId] = useState("");
  const [directiveTemplate, setDirectiveTemplate] = useState("Review {{HEAD_REF}} against {{BASE_REF}}");
  const [defaultParamsText, setDefaultParamsText] = useState("HEAD_REF=main\nBASE_REF=origin/main");
  const [sessionId, setSessionId] = useState("");
  const [overrideParamsText, setOverrideParamsText] = useState("");

  const templatesQuery = useRunTemplatesQuery();
  const profilesQuery = useHarnessProfilesQuery();
  const createMutation = useCreateRunTemplateMutation();
  const runMutation = useRunTemplateMutation();

  const templates = templatesQuery.data?.items ?? EMPTY_TEMPLATES;
  const profiles = profilesQuery.data?.items ?? EMPTY_PROFILES;
  const selectedTemplate = useMemo(
    () => templates.find((template) => template.id === selectedTemplateId) ?? templates.filter((template) => matchesSearch(template, search.trim()))[0],
    [search, selectedTemplateId, templates],
  );
  const visibleTemplates = useMemo(
    () => templates.filter((template) => matchesSearch(template, search.trim())),
    [search, templates],
  );
  const selectedProfile = profiles.find((profile) => profile.id === selectedTemplate?.harnessProfileId);
  const defaultParamCount = templates.reduce((total, template) => total + Object.keys(template.defaultParams).length, 0);
  const createModel = buildRunTemplateCreateRequest({
    harnessProfileId: harnessProfileId === "__manual" ? manualHarnessProfileId : harnessProfileId,
    directiveTemplate,
    defaultParamsText,
  });
  const runModel = buildTemplateRunRequest({ sessionId, overrideParamsText });
  const createErrors = createAttempted ? createModel.errors : {};
  const runErrors = runAttempted ? runModel.errors : {};
  const placeholders = extractDirectivePlaceholders(directiveTemplate);

  useEffect(() => {
    if (!harnessProfileId && profiles[0]) {
      setHarnessProfileId(profiles[0].id);
    }
  }, [harnessProfileId, profiles]);

  useEffect(() => {
    if (!selectedTemplate && selectedTemplateId) {
      setSelectedTemplateId("");
    }
    if (selectedTemplate && selectedTemplate.id !== selectedTemplateId) {
      setSelectedTemplateId(selectedTemplate.id);
    }
  }, [selectedTemplate, selectedTemplateId]);

  useEffect(() => {
    setOverrideParamsText(formatKeyValueLines(selectedTemplate?.defaultParams));
    setRunAttempted(false);
  }, [selectedTemplate]);

  async function refresh(): Promise<void> {
    await Promise.all([templatesQuery.refetch(), profilesQuery.refetch()]);
  }

  function createTemplate(): void {
    setCreateAttempted(true);
    if (!createModel.request) {
      return;
    }
    createMutation.mutate(createModel.request, {
      onSuccess: (template) => {
        setSelectedTemplateId(template.id);
        setCreateAttempted(false);
      },
    });
  }

  function runSelectedTemplate(): void {
    if (!selectedTemplate) {
      return;
    }
    setRunAttempted(true);
    if (!runModel.request) {
      return;
    }
    runMutation.mutate({ id: selectedTemplate.id, request: runModel.request });
  }

  return (
    <section className={styles.page}>
      <div className={styles.pageHeader}>
        <div>
          <p className={styles.panelMeta}>Run Templates</p>
          <h2 className={styles.pageTitle}>Trigger Saved Run Presets</h2>
        </div>
        <button
          type="button"
          className={styles.iconButton}
          onClick={() => void refresh()}
          disabled={templatesQuery.isFetching || profilesQuery.isFetching}
          aria-label="Refresh run templates"
          title="Refresh run templates"
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
          <span className={styles.metricLabel}>Harness Profiles</span>
          <span className={styles.metricValue}>{profiles.length}</span>
        </div>
        <div className={styles.metric}>
          <span className={styles.metricLabel}>Default Params</span>
          <span className={styles.metricValue}>{defaultParamCount}</span>
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
              placeholder="template, harness profile, param"
              type="search"
            />
          </span>
        </label>
        <label className={styles.field}>
          <span className={styles.fieldLabel}>Create Harness Profile</span>
          <select className={styles.select} value={harnessProfileId} onChange={(event) => setHarnessProfileId(event.target.value)}>
            {profiles.map((profile) => (
              <option key={profile.id} value={profile.id}>
                {profileLabel(profile)}
              </option>
            ))}
            <option value="__manual">Enter profile id</option>
          </select>
        </label>
      </div>

      {templatesQuery.isLoading ? (
        <div className={styles.state}>
          <p className={styles.stateTitle}>Loading Run Templates</p>
          <p className={styles.description}>Reading saved run presets from the local API.</p>
        </div>
      ) : null}

      {templatesQuery.error instanceof Error ? (
        <div className={styles.state}>
          <p className={styles.stateTitle}>Unable To Load Run Templates</p>
          <p className={styles.errorText}>{templatesQuery.error.message}</p>
        </div>
      ) : null}

      {!templatesQuery.isLoading && !templatesQuery.error ? (
        <div className={styles.layout}>
          <section className={styles.panel}>
            <div className={styles.panelHeader}>
              <div>
                <p className={styles.panelTitle}>Saved Presets</p>
                <p className={styles.panelMeta}>{visibleTemplates.length} shown</p>
              </div>
            </div>
            {templates.length === 0 ? (
              <div className={styles.stateInline}>
                <p className={styles.stateTitle}>No Run Templates Saved</p>
                <p className={styles.description}>Create a preset, then trigger it with parameter overrides.</p>
              </div>
            ) : visibleTemplates.length === 0 ? (
              <div className={styles.stateInline}>
                <p className={styles.stateTitle}>No Templates Match Filters</p>
                <p className={styles.description}>Adjust the search filter.</p>
              </div>
            ) : (
              <div className={styles.templateList}>
                {visibleTemplates.map((template) => (
                  <button
                    key={template.id}
                    type="button"
                    className={`${styles.templateRow} ${selectedTemplate?.id === template.id ? styles.templateRowActive : ""}`}
                    onClick={() => setSelectedTemplateId(template.id)}
                  >
                    <span className={styles.rowTop}>
                      <span>
                        <span className={styles.templateName}>{template.id}</span>
                        <span className={styles.mono}>{template.harnessProfileId}</span>
                      </span>
                      <span className={styles.badge}>{summarizeParams(template.defaultParams)}</span>
                    </span>
                    <span className={styles.description}>{template.directiveTemplate}</span>
                  </button>
                ))}
              </div>
            )}
          </section>

          <div className={styles.panel}>
            <div className={styles.panelHeader}>
              <div>
                <p className={styles.panelTitle}>Create</p>
                <p className={styles.panelMeta}>Directive preset</p>
              </div>
            </div>
            <form
              className={styles.panelBody}
              onSubmit={(event) => {
                event.preventDefault();
                createTemplate();
              }}
            >
              <div className={styles.formGrid}>
                {harnessProfileId === "__manual" ? (
                  <label className={styles.field}>
                    <span className={styles.fieldLabel}>Harness Profile Id</span>
                    <input className={styles.input} value={manualHarnessProfileId} onChange={(event) => setManualHarnessProfileId(event.target.value)} />
                    {createErrors.harnessProfileId ? <span className={styles.fieldError}>{createErrors.harnessProfileId}</span> : null}
                  </label>
                ) : (
                  <label className={styles.field}>
                    <span className={styles.fieldLabel}>Harness Profile</span>
                    <select className={styles.select} value={harnessProfileId} onChange={(event) => setHarnessProfileId(event.target.value)}>
                      {profiles.map((profile) => (
                        <option key={profile.id} value={profile.id}>
                          {profileLabel(profile)}
                        </option>
                      ))}
                    </select>
                    {profilesQuery.error instanceof Error ? <span className={styles.fieldError}>{profilesQuery.error.message}</span> : null}
                  </label>
                )}
                <label className={styles.field}>
                  <span className={styles.fieldLabel}>Placeholders</span>
                  <input className={styles.input} value={placeholders.join(", ") || "None"} readOnly />
                </label>
                <label className={styles.field}>
                  <span className={styles.fieldLabel}>Directive Template</span>
                  <textarea
                    className={styles.textarea}
                    value={directiveTemplate}
                    onChange={(event) => setDirectiveTemplate(event.target.value)}
                    rows={5}
                  />
                  {createErrors.directiveTemplate ? <span className={styles.fieldError}>{createErrors.directiveTemplate}</span> : null}
                </label>
                <label className={styles.field}>
                  <span className={styles.fieldLabel}>Default Params</span>
                  <textarea
                    className={styles.textarea}
                    value={defaultParamsText}
                    onChange={(event) => setDefaultParamsText(event.target.value)}
                    rows={5}
                  />
                  {createErrors.defaultParams ? <span className={styles.fieldError}>{createErrors.defaultParams}</span> : null}
                </label>
              </div>
              {createMutation.error instanceof Error ? <p className={styles.errorText}>{createMutation.error.message}</p> : null}
              <div className={styles.actionBar}>
                <button className={styles.primaryButton} type="submit" disabled={createMutation.isPending}>
                  <Plus size={16} /> Create Template
                </button>
              </div>
            </form>
          </div>

          <aside className={styles.panel}>
            <div className={styles.panelHeader}>
              <div>
                <p className={styles.panelTitle}>Trigger</p>
                <p className={styles.panelMeta}>{selectedTemplate ? selectedTemplate.id : "No template"}</p>
              </div>
            </div>
            {selectedTemplate ? (
              <form
                className={styles.panelBody}
                onSubmit={(event) => {
                  event.preventDefault();
                  runSelectedTemplate();
                }}
              >
                <section className={styles.section}>
                  <p className={styles.sectionTitle}>{selectedTemplate.id}</p>
                  <p className={styles.description}>{selectedTemplate.directiveTemplate}</p>
                  <dl className={styles.kvList}>
                    <div>
                      <dt>Harness Profile</dt>
                      <dd>{selectedProfile ? profileLabel(selectedProfile) : selectedTemplate.harnessProfileId}</dd>
                    </div>
                    <div>
                      <dt>Default Params</dt>
                      <dd>{summarizeParams(selectedTemplate.defaultParams)}</dd>
                    </div>
                  </dl>
                  <pre className={styles.codeBlock}>{formatParams(selectedTemplate.defaultParams)}</pre>
                </section>

                <div className={styles.paramGrid}>
                  <label className={styles.field}>
                    <span className={styles.fieldLabel}>Session Id</span>
                    <input
                      className={styles.input}
                      value={sessionId}
                      onChange={(event) => setSessionId(event.target.value)}
                      placeholder="optional; generated if blank"
                    />
                  </label>
                  <label className={styles.field}>
                    <span className={styles.fieldLabel}>Override Params</span>
                    <textarea
                      className={styles.textarea}
                      value={overrideParamsText}
                      onChange={(event) => setOverrideParamsText(event.target.value)}
                      rows={5}
                    />
                    {runErrors.overrideParams ? <span className={styles.fieldError}>{runErrors.overrideParams}</span> : null}
                  </label>
                </div>

                {runMutation.error instanceof Error ? <p className={styles.errorText}>{runMutation.error.message}</p> : null}
                <div className={styles.actionBar}>
                  <button className={styles.primaryButton} type="submit" disabled={runMutation.isPending}>
                    <Play size={16} /> Run Template
                  </button>
                </div>

                {runMutation.data ? (
                  <section className={styles.section}>
                    <div className={styles.successHeader}>
                      <CheckCircle2 size={18} />
                      <div>
                        <p className={styles.sectionTitle}>Run Created</p>
                        <p className={styles.mono}>{runMutation.data.runId ?? runMutation.data.sessionId}</p>
                      </div>
                    </div>
                    {runMutation.data.runId ? (
                      <Link className={styles.inlineLink} to={`/tasks/runs/${encodeURIComponent(runMutation.data.runId)}`}>
                        Open run
                      </Link>
                    ) : null}
                    <dl className={styles.kvList}>
                      <div>
                        <dt>Session</dt>
                        <dd>{runMutation.data.sessionId}</dd>
                      </div>
                      <div>
                        <dt>Provider</dt>
                        <dd>{runMutation.data.provider || "n/a"}</dd>
                      </div>
                      <div>
                        <dt>Model</dt>
                        <dd>{runMutation.data.model || "n/a"}</dd>
                      </div>
                    </dl>
                    {runMutation.data.template ? <pre className={styles.codeBlock}>{formatParams(runMutation.data.template.effectiveParams)}</pre> : null}
                  </section>
                ) : null}
              </form>
            ) : (
              <div className={styles.stateInline}>
                <p className={styles.stateTitle}>No Template Selected</p>
                <p className={styles.description}>Create or select a run template before triggering a run.</p>
              </div>
            )}
          </aside>
        </div>
      ) : null}
    </section>
  );
}
