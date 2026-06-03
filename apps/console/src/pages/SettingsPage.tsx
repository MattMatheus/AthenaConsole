import { useEffect, useMemo, useState } from "react";
import { FlaskConical, Plus, Save, Trash2 } from "lucide-react";
import { useProviderCostSettingsQuery, useUpdateProviderCostSettingsMutation } from "../features/operations/queries";
import {
  buildProviderCreateRequest,
  draftFromProvider,
  emptyModelProviderDraft,
  modelProviderStatusTone,
  secretReferenceLabel,
  useCreateModelProviderMutation,
  useDeleteModelProviderMutation,
  useModelProvidersQuery,
  useTestModelProviderMutation,
  useUpdateModelProviderMutation,
  type ModelProviderConfig,
  type ModelProviderFormDraft,
  type ModelProviderSecretReferenceKind,
} from "../features/model-providers";
import { usePolicyQuery, useUpdatePolicyMutation, type PolicyDocument } from "../features/policy";
import { ApiClientError } from "../services";
import styles from "./PageScaffold.module.css";

type PricingRow = {
  provider: string;
  inputCostPer1kTokensUsd: string;
  outputCostPer1kTokensUsd: string;
};

type PolicyDraft = {
  schemaVersion: string;
  maxConcurrentRuns: string;
  defaultRunTimeoutMs: string;
  defaultScheduleTimeoutMs: string;
  retryBudgetPerRun: string;
  costBudgetDailyUsd: string;
};

type PolicyFieldKey = keyof Omit<PolicyDraft, "schemaVersion">;

type PolicyDiffRow = {
  label: string;
  previous: string;
  proposed: string;
};

const POLICY_FIELD_META: Array<{ key: PolicyFieldKey; label: string; help: string; mode: "integer" | "decimal" }> = [
  {
    key: "maxConcurrentRuns",
    label: "Max concurrent runs",
    help: "Positive integer. Empty means service default.",
    mode: "integer"
  },
  {
    key: "defaultRunTimeoutMs",
    label: "Default run timeout (ms)",
    help: "Positive integer in milliseconds.",
    mode: "integer"
  },
  {
    key: "defaultScheduleTimeoutMs",
    label: "Default schedule timeout (ms)",
    help: "Positive integer in milliseconds.",
    mode: "integer"
  },
  {
    key: "retryBudgetPerRun",
    label: "Retry budget per run",
    help: "Non-negative integer retries allowed.",
    mode: "integer"
  },
  {
    key: "costBudgetDailyUsd",
    label: "Daily cost budget (USD)",
    help: "Non-negative decimal budget cap.",
    mode: "decimal"
  }
];

function toDraft(policy: PolicyDocument | null): PolicyDraft {
  return {
    schemaVersion: String(policy?.schemaVersion ?? 1),
    maxConcurrentRuns: policy?.maxConcurrentRuns !== undefined ? String(policy.maxConcurrentRuns) : "",
    defaultRunTimeoutMs: policy?.defaultRunTimeoutMs !== undefined ? String(policy.defaultRunTimeoutMs) : "",
    defaultScheduleTimeoutMs:
      policy?.defaultScheduleTimeoutMs !== undefined ? String(policy.defaultScheduleTimeoutMs) : "",
    retryBudgetPerRun: policy?.retryBudgetPerRun !== undefined ? String(policy.retryBudgetPerRun) : "",
    costBudgetDailyUsd: policy?.costBudgetDailyUsd !== undefined ? String(policy.costBudgetDailyUsd) : ""
  };
}

function toNumericLabel(value: number | undefined): string {
  return value === undefined ? "not set" : String(value);
}

function parsePolicyDraft(draft: PolicyDraft): {
  policy?: {
    schemaVersion: number;
    maxConcurrentRuns?: number;
    defaultRunTimeoutMs?: number;
    defaultScheduleTimeoutMs?: number;
    retryBudgetPerRun?: number;
    costBudgetDailyUsd?: number;
  };
  errors: Partial<Record<keyof PolicyDraft, string>>;
} {
  const errors: Partial<Record<keyof PolicyDraft, string>> = {};

  const schemaVersionRaw = draft.schemaVersion.trim();
  const schemaVersionNumber = Number(schemaVersionRaw);
  if (
    schemaVersionRaw.length === 0 ||
    !Number.isInteger(schemaVersionNumber) ||
    !Number.isFinite(schemaVersionNumber) ||
    schemaVersionNumber <= 0
  ) {
    errors.schemaVersion = "Schema version must be a positive integer.";
  }

  const parsed: {
    schemaVersion: number;
    maxConcurrentRuns?: number;
    defaultRunTimeoutMs?: number;
    defaultScheduleTimeoutMs?: number;
    retryBudgetPerRun?: number;
    costBudgetDailyUsd?: number;
  } = {
    schemaVersion: schemaVersionNumber
  };

  for (const field of POLICY_FIELD_META) {
    const value = draft[field.key].trim();
    if (value.length === 0) {
      continue;
    }
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
      errors[field.key] = `${field.label} must be numeric.`;
      continue;
    }

    if (field.mode === "integer" && !Number.isInteger(numeric)) {
      errors[field.key] = `${field.label} must be an integer.`;
      continue;
    }

    if (field.key === "retryBudgetPerRun") {
      if (numeric < 0) {
        errors[field.key] = `${field.label} must be zero or greater.`;
        continue;
      }
      parsed.retryBudgetPerRun = Math.floor(numeric);
      continue;
    }

    if (field.key === "costBudgetDailyUsd") {
      if (numeric < 0) {
        errors[field.key] = `${field.label} must be zero or greater.`;
        continue;
      }
      parsed.costBudgetDailyUsd = numeric;
      continue;
    }

    if (numeric <= 0) {
      errors[field.key] = `${field.label} must be greater than zero.`;
      continue;
    }

    if (field.key === "maxConcurrentRuns") {
      parsed.maxConcurrentRuns = Math.floor(numeric);
    }
    if (field.key === "defaultRunTimeoutMs") {
      parsed.defaultRunTimeoutMs = Math.floor(numeric);
    }
    if (field.key === "defaultScheduleTimeoutMs") {
      parsed.defaultScheduleTimeoutMs = Math.floor(numeric);
    }
  }

  if (Object.keys(errors).length > 0) {
    return { errors };
  }

  return {
    policy: parsed,
    errors
  };
}

function buildPolicyDiff(current: PolicyDocument | null, proposed: NonNullable<ReturnType<typeof parsePolicyDraft>["policy"]>): PolicyDiffRow[] {
  const rows: PolicyDiffRow[] = [
    {
      label: "Schema version",
      previous: String(current?.schemaVersion ?? 1),
      proposed: String(proposed.schemaVersion)
    },
    {
      label: "Max concurrent runs",
      previous: toNumericLabel(current?.maxConcurrentRuns),
      proposed: toNumericLabel(proposed.maxConcurrentRuns)
    },
    {
      label: "Default run timeout (ms)",
      previous: toNumericLabel(current?.defaultRunTimeoutMs),
      proposed: toNumericLabel(proposed.defaultRunTimeoutMs)
    },
    {
      label: "Default schedule timeout (ms)",
      previous: toNumericLabel(current?.defaultScheduleTimeoutMs),
      proposed: toNumericLabel(proposed.defaultScheduleTimeoutMs)
    },
    {
      label: "Retry budget per run",
      previous: toNumericLabel(current?.retryBudgetPerRun),
      proposed: toNumericLabel(proposed.retryBudgetPerRun)
    },
    {
      label: "Daily cost budget (USD)",
      previous: toNumericLabel(current?.costBudgetDailyUsd),
      proposed: toNumericLabel(proposed.costBudgetDailyUsd)
    }
  ];

  return rows.filter((row) => row.previous !== row.proposed);
}

export function SettingsPage() {
  const settingsQuery = useProviderCostSettingsQuery();
  const updateMutation = useUpdateProviderCostSettingsMutation();
  const policyQuery = usePolicyQuery();
  const policyUpdateMutation = useUpdatePolicyMutation();
  const modelProvidersQuery = useModelProvidersQuery();
  const createModelProviderMutation = useCreateModelProviderMutation();
  const updateModelProviderMutation = useUpdateModelProviderMutation();
  const deleteModelProviderMutation = useDeleteModelProviderMutation();
  const testModelProviderMutation = useTestModelProviderMutation();

  const [rows, setRows] = useState<PricingRow[]>([]);
  const [selectedProviderId, setSelectedProviderId] = useState<string | null>(null);
  const [providerDraft, setProviderDraft] = useState<ModelProviderFormDraft>(() => emptyModelProviderDraft());
  const [providerSaveAttempted, setProviderSaveAttempted] = useState(false);
  const [providerSaveError, setProviderSaveError] = useState<string | null>(null);
  const [providerActionMessage, setProviderActionMessage] = useState<string | null>(null);
  const [policyDraft, setPolicyDraft] = useState<PolicyDraft>(() => toDraft(null));
  const [auditComment, setAuditComment] = useState("");
  const [showPreview, setShowPreview] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (!settingsQuery.data) {
      return;
    }
    setRows(
      settingsQuery.data.providers.map((row) => ({
        provider: row.provider,
        inputCostPer1kTokensUsd: String(row.inputCostPer1kTokensUsd),
        outputCostPer1kTokensUsd: String(row.outputCostPer1kTokensUsd)
      }))
    );
  }, [settingsQuery.data]);

  useEffect(() => {
    if (policyQuery.data === undefined) {
      return;
    }
    setPolicyDraft(toDraft(policyQuery.data));
    setAuditComment("");
    setShowPreview(false);
    setSaveError(null);
  }, [policyQuery.data]);

  const parsedPolicy = useMemo(() => parsePolicyDraft(policyDraft), [policyDraft]);
  const policyDiff = useMemo(
    () => (parsedPolicy.policy ? buildPolicyDiff(policyQuery.data ?? null, parsedPolicy.policy) : []),
    [parsedPolicy.policy, policyQuery.data]
  );
  const selectedProvider = useMemo(
    () => modelProvidersQuery.data?.providers.find((provider) => provider.id === selectedProviderId),
    [modelProvidersQuery.data?.providers, selectedProviderId]
  );
  const parsedProvider = useMemo(() => buildProviderCreateRequest(providerDraft), [providerDraft]);

  function updateRow(index: number, key: keyof PricingRow, value: string): void {
    setRows((previous) => previous.map((row, rowIndex) => (rowIndex === index ? { ...row, [key]: value } : row)));
  }

  function updateProviderField(key: keyof ModelProviderFormDraft, value: string): void {
    setProviderDraft((previous) => ({
      ...previous,
      [key]: value,
    }));
    setProviderSaveError(null);
    setProviderActionMessage(null);
  }

  function startNewProvider(): void {
    setSelectedProviderId(null);
    setProviderDraft(emptyModelProviderDraft());
    setProviderSaveAttempted(false);
    setProviderSaveError(null);
    setProviderActionMessage(null);
  }

  function editProvider(provider: ModelProviderConfig): void {
    setSelectedProviderId(provider.id);
    setProviderDraft(draftFromProvider(provider));
    setProviderSaveAttempted(false);
    setProviderSaveError(null);
    setProviderActionMessage(null);
  }

  function updatePolicyField(key: keyof PolicyDraft, value: string): void {
    setPolicyDraft((previous) => ({
      ...previous,
      [key]: value
    }));
    setSaveError(null);
  }

  function addRow(): void {
    setRows((previous) => [
      ...previous,
      {
        provider: "",
        inputCostPer1kTokensUsd: "0",
        outputCostPer1kTokensUsd: "0"
      }
    ]);
  }

  async function savePricing(): Promise<void> {
    const providers = rows
      .map((row) => ({
        provider: row.provider.trim(),
        inputCostPer1kTokensUsd: Number(row.inputCostPer1kTokensUsd),
        outputCostPer1kTokensUsd: Number(row.outputCostPer1kTokensUsd)
      }))
      .filter((row) => row.provider.length > 0);

    await updateMutation.mutateAsync({ providers });
  }

  async function saveProvider(): Promise<void> {
    setProviderSaveAttempted(true);
    setProviderSaveError(null);
    setProviderActionMessage(null);

    if (!parsedProvider.request || Object.keys(parsedProvider.errors).length > 0) {
      setProviderSaveError("Resolve provider setup errors before saving.");
      return;
    }

    try {
      if (selectedProvider) {
        const updated = await updateModelProviderMutation.mutateAsync({
          id: selectedProvider.id,
          request: parsedProvider.request,
        });
        editProvider(updated);
        setProviderActionMessage("Provider updated. Secret reference metadata is visible; raw key values are not stored here.");
        return;
      }
      const created = await createModelProviderMutation.mutateAsync(parsedProvider.request);
      editProvider(created);
      setProviderActionMessage("Provider saved. The console keeps only the secret reference.");
    } catch (error) {
      setProviderSaveError(error instanceof Error ? error.message : "Failed to save model provider.");
    }
  }

  async function deleteSelectedProvider(): Promise<void> {
    if (!selectedProvider) {
      return;
    }
    setProviderSaveError(null);
    setProviderActionMessage(null);
    try {
      await deleteModelProviderMutation.mutateAsync(selectedProvider.id);
      startNewProvider();
      setProviderActionMessage("Provider deleted.");
    } catch (error) {
      setProviderSaveError(error instanceof Error ? error.message : "Failed to delete model provider.");
    }
  }

  async function testSelectedProvider(): Promise<void> {
    if (!selectedProvider) {
      setProviderSaveError("Save a provider before testing the connection.");
      return;
    }
    setProviderSaveError(null);
    setProviderActionMessage(null);
    try {
      const result = await testModelProviderMutation.mutateAsync(selectedProvider.id);
      setProviderActionMessage(`${result.status}: ${result.message}`);
    } catch (error) {
      setProviderSaveError(error instanceof Error ? error.message : "Failed to test model provider.");
    }
  }

  async function savePolicy(): Promise<void> {
    setSaveError(null);

    if (!parsedPolicy.policy || Object.keys(parsedPolicy.errors).length > 0) {
      setSaveError("Resolve validation errors before saving policy updates.");
      return;
    }

    const trimmedAuditComment = auditComment.trim();
    if (trimmedAuditComment.length === 0) {
      setSaveError("An audit comment is required for policy updates.");
      return;
    }

    if (policyDiff.length === 0) {
      setSaveError("No policy changes detected. Update at least one value before saving.");
      return;
    }

    try {
      await policyUpdateMutation.mutateAsync({
        policy: parsedPolicy.policy,
        auditComment: trimmedAuditComment
      });
      setAuditComment("");
    } catch (error) {
      if (error instanceof ApiClientError && error.status === 403) {
        setSaveError("Only Admin identities can persist policy changes.");
        return;
      }
      setSaveError(error instanceof Error ? error.message : "Failed to save policy changes.");
    }
  }

  return (
    <section className={styles.page}>
      <p className={styles.lead}>Configure runtime model providers, usage pricing, and policy guardrails for local Team Orchestrator runs.</p>

      <div className={styles.settingsPanel}>
        <div className={styles.settingsHeader}>
          <div>
            <h3>Model Provider Setup</h3>
            <p className={styles.settingsMuted}>Connect OpenAI-compatible runtime providers with env or local-file secret references.</p>
          </div>
          <button type="button" className={styles.settingsButton} onClick={startNewProvider}>
            <Plus size={16} aria-hidden="true" />
            New
          </button>
        </div>

        <div className={styles.providerGuidanceGrid}>
          <div className={styles.providerGuidanceItem}>
            <strong>Secret handling</strong>
            <span>Use an environment variable name or an absolute path to a local secret file. Do not paste API keys into this form.</span>
          </div>
          <div className={styles.providerGuidanceItem}>
            <strong>Codex subscriptions</strong>
            <span>Subscription reuse is research-only until a supported integration exists. Configure an API-compatible provider for runtime work.</span>
          </div>
        </div>

        {modelProvidersQuery.isLoading ? <p>Loading model providers...</p> : null}
        {modelProvidersQuery.error instanceof Error ? <p className={styles.policyFieldError}>{modelProvidersQuery.error.message}</p> : null}

        <div className={styles.providerSettingsGrid}>
          <form
            className={styles.providerForm}
            onSubmit={(event) => {
              event.preventDefault();
              void saveProvider();
            }}
          >
            <label className={styles.policyField}>
              <span>Provider name</span>
              <input
                value={providerDraft.name}
                onChange={(event) => updateProviderField("name", event.target.value)}
                className={styles.settingsInput}
                placeholder="OpenAI production"
              />
              {providerSaveAttempted && parsedProvider.errors.name ? (
                <small className={styles.policyFieldError}>{parsedProvider.errors.name}</small>
              ) : null}
            </label>

            <label className={styles.policyField}>
              <span>Provider ID</span>
              <input
                value={providerDraft.id}
                onChange={(event) => updateProviderField("id", event.target.value)}
                className={styles.settingsInput}
                placeholder="generated if blank"
                disabled={Boolean(selectedProvider)}
              />
            </label>

            <label className={styles.policyField}>
              <span>Base URL</span>
              <input
                value={providerDraft.baseUrl}
                onChange={(event) => updateProviderField("baseUrl", event.target.value)}
                className={styles.settingsInput}
                placeholder="https://api.openai.com/v1"
              />
              {providerSaveAttempted && parsedProvider.errors.baseUrl ? (
                <small className={styles.policyFieldError}>{parsedProvider.errors.baseUrl}</small>
              ) : null}
            </label>

            <label className={styles.policyField}>
              <span>Default model</span>
              <input
                value={providerDraft.defaultModel}
                onChange={(event) => updateProviderField("defaultModel", event.target.value)}
                className={styles.settingsInput}
                placeholder="gpt-4.1-mini"
              />
              {providerSaveAttempted && parsedProvider.errors.defaultModel ? (
                <small className={styles.policyFieldError}>{parsedProvider.errors.defaultModel}</small>
              ) : null}
            </label>

            <label className={styles.policyField}>
              <span>Secret reference type</span>
              <select
                value={providerDraft.secretKind}
                onChange={(event) =>
                  updateProviderField("secretKind", event.target.value as ModelProviderSecretReferenceKind)
                }
                className={styles.settingsInput}
              >
                <option value="env">Environment variable</option>
                <option value="local-file">Local secret file</option>
              </select>
            </label>

            <label className={styles.policyField}>
              <span>{providerDraft.secretKind === "env" ? "Environment variable name" : "Absolute secret file path"}</span>
              <input
                value={providerDraft.secretName}
                onChange={(event) => updateProviderField("secretName", event.target.value)}
                className={styles.settingsInput}
                placeholder={providerDraft.secretKind === "env" ? "OPENAI_API_KEY" : "/run/secrets/openai_api_key"}
              />
              <small className={styles.policyFieldHelp}>
                Saved providers show this reference only; the raw secret value is never rendered by the console.
              </small>
              {providerSaveAttempted && parsedProvider.errors.secretName ? (
                <small className={styles.policyFieldError}>{parsedProvider.errors.secretName}</small>
              ) : null}
            </label>

            {providerSaveError ? <p className={styles.policyFieldError}>{providerSaveError}</p> : null}
            {providerActionMessage ? <p className={styles.policySuccess}>{providerActionMessage}</p> : null}

            <div className={styles.settingsActionsStart}>
              <button
                type="submit"
                className={styles.settingsButtonPrimary}
                disabled={createModelProviderMutation.isPending || updateModelProviderMutation.isPending}
              >
                <Save size={16} aria-hidden="true" />
                {selectedProvider ? "Save Provider" : "Create Provider"}
              </button>
              <button
                type="button"
                className={styles.settingsButton}
                onClick={() => void testSelectedProvider()}
                disabled={!selectedProvider || testModelProviderMutation.isPending}
              >
                <FlaskConical size={16} aria-hidden="true" />
                {testModelProviderMutation.isPending ? "Testing" : "Test"}
              </button>
              <button
                type="button"
                className={styles.settingsButton}
                onClick={() => void deleteSelectedProvider()}
                disabled={!selectedProvider || deleteModelProviderMutation.isPending}
              >
                <Trash2 size={16} aria-hidden="true" />
                Delete
              </button>
            </div>
          </form>

          <div className={styles.providerList}>
            {(modelProvidersQuery.data?.providers.length ?? 0) === 0 && !modelProvidersQuery.isLoading ? (
              <div className={styles.repoEmptyState}>
                <strong>No model providers configured.</strong>
                <p className={styles.settingsMuted}>Add one provider so agents have an explicit runtime model target.</p>
              </div>
            ) : null}
            {modelProvidersQuery.data?.providers.map((provider) => {
              const tone = modelProviderStatusTone(provider.status);
              return (
                <button
                  key={provider.id}
                  type="button"
                  className={`${styles.providerRow} ${selectedProviderId === provider.id ? styles.providerRowSelected : ""}`}
                  onClick={() => editProvider(provider)}
                >
                  <span className={styles.providerRowHeader}>
                    <strong>{provider.name}</strong>
                    <span className={styles[tone === "ready" ? "statusReady" : tone === "degraded" ? "statusDegraded" : "statusFailed"]}>
                      {provider.status}
                    </span>
                  </span>
                  <span className={styles.providerMetaLine}>{provider.defaultModel}</span>
                  <span className={styles.providerMetaLine}>{provider.baseUrl}</span>
                  <span className={styles.providerMetaLine}>
                    {secretReferenceLabel(provider.secret.kind, provider.secret.name)}
                  </span>
                  {provider.statusMessage ? <span className={styles.providerStatusMessage}>{provider.statusMessage}</span> : null}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className={styles.settingsPanel}>
        <div className={styles.settingsHeader}>
          <h3>Policy Editor</h3>
          <button type="button" className={styles.settingsButton} onClick={() => setShowPreview((value) => !value)}>
            {showPreview ? "Hide Preview" : "Preview Changes"}
          </button>
        </div>
        <p className={styles.settingsMuted}>
          Current snapshot updated at: <span className={styles.mono}>{policyQuery.data?.updatedAt ?? "no persisted policy"}</span>
        </p>

        {policyQuery.isLoading ? <p>Loading policy...</p> : null}
        {policyQuery.error instanceof Error ? <p>{policyQuery.error.message}</p> : null}

        <div className={styles.policyEditorGrid}>
          <label className={styles.policyField}>
            <span>Schema version</span>
            <input
              value={policyDraft.schemaVersion}
              onChange={(event) => updatePolicyField("schemaVersion", event.target.value)}
              className={styles.settingsInput}
              inputMode="numeric"
            />
            {parsedPolicy.errors.schemaVersion ? <small className={styles.policyFieldError}>{parsedPolicy.errors.schemaVersion}</small> : null}
          </label>

          {POLICY_FIELD_META.map((field) => (
            <label key={field.key} className={styles.policyField}>
              <span>{field.label}</span>
              <input
                value={policyDraft[field.key]}
                onChange={(event) => updatePolicyField(field.key, event.target.value)}
                className={styles.settingsInput}
                inputMode={field.mode === "decimal" ? "decimal" : "numeric"}
                placeholder="optional"
              />
              <small className={styles.policyFieldHelp}>{field.help}</small>
              {parsedPolicy.errors[field.key] ? (
                <small className={styles.policyFieldError}>{parsedPolicy.errors[field.key]}</small>
              ) : null}
            </label>
          ))}
        </div>

        {showPreview ? (
          <div className={styles.policyPreviewPanel}>
            <h4>Proposed Policy Diff</h4>
            {parsedPolicy.policy ? (
              policyDiff.length > 0 ? (
                <ul className={styles.policyDiffList}>
                  {policyDiff.map((row) => (
                    <li key={row.label} className={styles.policyDiffRow}>
                      <span className={styles.policyDiffLabel}>{row.label}</span>
                      <span className={styles.policyDiffValues}>
                        <span className={styles.policyDiffBefore}>{row.previous}</span>
                        <span className={styles.policyDiffArrow}>{"->"}</span>
                        <span className={styles.policyDiffAfter}>{row.proposed}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className={styles.settingsMuted}>No field changes detected between current and proposed policy.</p>
              )
            ) : (
              <p className={styles.settingsMuted}>Preview unavailable while validation errors are present.</p>
            )}
          </div>
        ) : null}

        <label className={styles.policyAuditField}>
          <span>Audit comment (required)</span>
          <textarea
            className={styles.policyAuditInput}
            value={auditComment}
            onChange={(event) => {
              setAuditComment(event.target.value);
              setSaveError(null);
            }}
            rows={3}
            placeholder="Document why these policy settings are changing."
          />
        </label>

        {saveError ? <p className={styles.policyFieldError}>{saveError}</p> : null}
        {policyUpdateMutation.isSuccess ? <p className={styles.policySuccess}>Policy changes saved.</p> : null}

        <div className={styles.settingsActions}>
          <button
            type="button"
            className={styles.settingsButtonPrimary}
            onClick={() => void savePolicy()}
            disabled={policyUpdateMutation.isPending || policyQuery.isLoading}
          >
            <Save size={16} aria-hidden="true" />
            {policyUpdateMutation.isPending ? "Saving..." : "Save Policy"}
          </button>
        </div>
      </div>

      {settingsQuery.isLoading ? <p>Loading provider pricing...</p> : null}
      {settingsQuery.error instanceof Error ? <p>{settingsQuery.error.message}</p> : null}

      <div className={styles.settingsPanel}>
        <div className={styles.settingsHeader}>
          <h3>Usage Pricing per 1K Tokens (USD)</h3>
          <button type="button" className={styles.settingsButton} onClick={addRow}>
            <Plus size={16} aria-hidden="true" />
            Add Provider
          </button>
        </div>

        <table className={styles.settingsTable}>
          <thead>
            <tr>
              <th>Provider</th>
              <th>Input cost / 1K</th>
              <th>Output cost / 1K</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={`${row.provider}-${index}`}>
                <td>
                  <input
                    value={row.provider}
                    onChange={(event) => updateRow(index, "provider", event.target.value)}
                    className={styles.settingsInput}
                    placeholder="openai"
                  />
                </td>
                <td>
                  <input
                    value={row.inputCostPer1kTokensUsd}
                    onChange={(event) => updateRow(index, "inputCostPer1kTokensUsd", event.target.value)}
                    className={styles.settingsInput}
                    inputMode="decimal"
                  />
                </td>
                <td>
                  <input
                    value={row.outputCostPer1kTokensUsd}
                    onChange={(event) => updateRow(index, "outputCostPer1kTokensUsd", event.target.value)}
                    className={styles.settingsInput}
                    inputMode="decimal"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className={styles.settingsActions}>
          <button
            type="button"
            className={styles.settingsButtonPrimary}
            onClick={() => void savePricing()}
            disabled={updateMutation.isPending}
          >
            <Save size={16} aria-hidden="true" />
            {updateMutation.isPending ? "Saving..." : "Save Pricing"}
          </button>
        </div>
      </div>
    </section>
  );
}
