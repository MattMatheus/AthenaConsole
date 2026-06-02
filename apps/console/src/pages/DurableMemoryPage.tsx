import { DatabaseZap, FileClock, Layers3, RefreshCw, Search, ShieldCheck } from "lucide-react";
import { useMemo, useState } from "react";
import {
  durableMemoryStatusLabel,
  durableMemoryStatusTone,
  inspectorCounts,
  memoryPreview,
  namespaceFromParts,
  namespaceLabel,
  provenanceSummary,
  useDurableMemoryInspectorQuery,
  type DurableMemoryNamespaceScope,
  type DurableMemoryProposal,
  type DurableMemoryRecord,
  type DurableMemorySnapshot,
} from "../features/durable-memory";
import styles from "./PageScaffold.module.css";

const NAMESPACE_SCOPES: DurableMemoryNamespaceScope[] = [
  "workspace",
  "repository",
  "project",
  "team",
  "agent",
  "task",
  "run",
  "operator",
  "account",
  "artifact",
];

function formatDate(value: string | undefined): string {
  if (!value) {
    return "Not recorded";
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function badgeClass(tone: "pass" | "warn" | "fail"): string {
  if (tone === "pass") {
    return styles.readinessPass ?? "";
  }
  if (tone === "fail") {
    return styles.readinessFail ?? "";
  }
  return styles.readinessWarn ?? "";
}

function mutationError(error: unknown): string | null {
  return error instanceof Error ? error.message : null;
}

function textPreview(value: string, maxLength = 180): string {
  const trimmed = value.trim();
  if (trimmed.length <= maxLength) {
    return trimmed;
  }
  return `${trimmed.slice(0, Math.max(0, maxLength - 3)).trimEnd()}...`;
}

export function DurableMemoryPage() {
  const [scope, setScope] = useState<DurableMemoryNamespaceScope>("workspace");
  const [namespaceId, setNamespaceId] = useState("default");
  const [queryText, setQueryText] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");
  const namespace = useMemo(() => namespaceFromParts(scope, namespaceId), [namespaceId, scope]);
  const inspectorQuery = useDurableMemoryInspectorQuery(namespace, submittedQuery);
  const summary = inspectorQuery.data;
  const counts = summary ? inspectorCounts(summary) : [];
  const statusTone = summary ? durableMemoryStatusTone(summary.health.operatorStatus) : "warn";
  const activeError = mutationError(inspectorQuery.error);

  return (
    <section className={styles.page}>
      <div className={styles.pageHeader}>
        <div>
          <p className={styles.key}>Durable Memory</p>
          <h2 className={styles.pageTitle}>Memory Inspector</h2>
        </div>
        <div className={styles.headerActions}>
          <button
            type="button"
            className={styles.secondaryCta}
            onClick={() => void inspectorQuery.refetch()}
            disabled={inspectorQuery.isFetching}
          >
            <RefreshCw size={16} /> Refresh
          </button>
        </div>
      </div>

      <p className={styles.lead}>
        Inspect durable product memory records, provenance, proposals, snapshots, and provider posture.
      </p>

      <section className={styles.settingsPanel}>
        <div className={styles.settingsHeader}>
          <div>
            <p className={styles.key}>Provider Status</p>
            <h3 className={styles.resourceTitle}>{summary?.health.providerId ?? "durable-memory"}</h3>
          </div>
          <DatabaseZap size={18} />
        </div>
        <div className={styles.repoSummaryGrid}>
          <StatusTile
            label="Provider"
            value={summary ? durableMemoryStatusLabel(summary.health.status) : "Loading"}
            tone={summary ? durableMemoryStatusTone(summary.health.status) : "warn"}
          />
          <StatusTile
            label="Operator"
            value={summary ? durableMemoryStatusLabel(summary.health.operatorStatus) : "Loading"}
            tone={statusTone}
          />
          <StatusTile label="Checked" value={formatDate(summary?.health.checkedAt)} />
          <StatusTile label="Query" value={submittedQuery || "List"} />
        </div>
        {summary?.health.message ? <p className={styles.readinessNextStep}>{summary.health.message}</p> : null}
        <p className={styles.readinessMeta}>
          Legacy `/api/v1/memory/*` search remains local context debugging; this page uses `/api/v1/durable-memory/*`.
        </p>
      </section>

      <form
        className={styles.settingsPanel}
        onSubmit={(event) => {
          event.preventDefault();
          setSubmittedQuery(queryText.trim());
        }}
      >
        <div className={styles.settingsHeader}>
          <div>
            <p className={styles.key}>Scope And Search</p>
            <h3 className={styles.resourceTitle}>{namespaceLabel(namespace)}</h3>
          </div>
          <Search size={18} />
        </div>
        <div className={styles.repoConnectionGrid}>
          <label className={styles.repoField}>
            Namespace scope
            <select value={scope} onChange={(event) => setScope(event.target.value as DurableMemoryNamespaceScope)}>
              {NAMESPACE_SCOPES.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.repoField}>
            Namespace id
            <input value={namespaceId} onChange={(event) => setNamespaceId(event.target.value)} />
          </label>
        </div>
        <label className={styles.repoField}>
          Search records
          <input
            type="search"
            value={queryText}
            onChange={(event) => setQueryText(event.target.value)}
            placeholder="Search summaries, bodies, memory type, or provenance"
          />
        </label>
        <div className={styles.headerActions}>
          <button type="submit" className={styles.primaryCta}>
            <Search size={16} /> Search
          </button>
          <button
            type="button"
            className={styles.secondaryCta}
            onClick={() => {
              setQueryText("");
              setSubmittedQuery("");
            }}
          >
            Clear
          </button>
        </div>
      </form>

      {activeError ? <p className={styles.repoStatusMessage}>{activeError}</p> : null}

      {summary ? (
        <section className={styles.repoSummaryGrid}>
          {counts.map((item) => (
            <StatusTile key={item.label} label={item.label} value={item.value} />
          ))}
        </section>
      ) : null}

      <section className={styles.repoConnectionGrid}>
        <MemoryRecordsPanel records={summary?.records ?? []} isLoading={inspectorQuery.isLoading} />
        <ProposalPanel proposals={summary?.proposals ?? []} />
      </section>

      <SnapshotPanel snapshots={summary?.snapshots ?? []} />
    </section>
  );
}

function StatusTile(props: { label: string; value: string; tone?: "pass" | "warn" | "fail" }) {
  return (
    <article className={styles.resourceTerm}>
      <p className={styles.key}>{props.label}</p>
      <p className={styles.repoMetricValue}>{props.value}</p>
      {props.tone ? (
        <span className={`${styles.readinessMiniBadge} ${badgeClass(props.tone)}`}>
          {props.tone === "pass" ? "clean" : props.tone}
        </span>
      ) : null}
    </article>
  );
}

function MemoryRecordsPanel(props: { records: DurableMemoryRecord[]; isLoading: boolean }) {
  return (
    <section className={styles.settingsPanel}>
      <div className={styles.settingsHeader}>
        <div>
          <p className={styles.key}>Records</p>
          <h3 className={styles.resourceTitle}>Durable records</h3>
        </div>
        <Layers3 size={18} />
      </div>
      {props.isLoading ? <p className={styles.readinessNextStep}>Loading durable memory records.</p> : null}
      {!props.isLoading && props.records.length === 0 ? (
        <div className={styles.repoEmptyState}>
          <p className={styles.value}>No durable records found for this namespace.</p>
          <p className={styles.readinessMeta}>Empty durable memory is distinct from legacy diagnostic memory search.</p>
        </div>
      ) : null}
      <div className={styles.repoList}>
        {props.records.map((record) => (
          <article key={record.id} className={styles.repoRow}>
            <div className={styles.repoRowMain}>
              <div>
                <p className={styles.repoName}>{record.memoryType}</p>
                <p className={styles.readinessMeta}>{record.id}</p>
              </div>
              <span className={`${styles.readinessMiniBadge} ${badgeClass(durableMemoryStatusTone(record.provider?.operatorStatus ?? "diagnostic-only"))}`}>
                {durableMemoryStatusLabel(record.provider?.operatorStatus ?? "diagnostic-only")}
              </span>
            </div>
            <p className={styles.readinessNextStep}>{memoryPreview(record)}</p>
            <dl className={styles.repoMetaGrid}>
              <Meta label="Namespace" value={namespaceLabel(record.namespace)} />
              <Meta label="Status" value={record.status} />
              <Meta label="Sensitivity" value={record.sensitivity} />
              <Meta label="Provenance" value={provenanceSummary(record.provenance)} />
              <Meta label="Action" value={record.provenance.createdByAction} />
              <Meta label="Updated" value={formatDate(record.updatedAt)} />
            </dl>
          </article>
        ))}
      </div>
    </section>
  );
}

function ProposalPanel(props: { proposals: DurableMemoryProposal[] }) {
  return (
    <section className={styles.settingsPanel}>
      <div className={styles.settingsHeader}>
        <div>
          <p className={styles.key}>Proposals</p>
          <h3 className={styles.resourceTitle}>Pending and reviewed memory</h3>
        </div>
        <ShieldCheck size={18} />
      </div>
      {props.proposals.length === 0 ? (
        <div className={styles.repoEmptyState}>
          <p className={styles.value}>No durable memory proposals are in this namespace.</p>
          <p className={styles.readinessMeta}>Approval and rejection controls are intentionally deferred.</p>
        </div>
      ) : null}
      <div className={styles.repoList}>
        {props.proposals.map((proposal) => (
          <article key={proposal.id} className={styles.repoRow}>
            <div className={styles.repoRowMain}>
              <div>
                <p className={styles.repoName}>{proposal.memoryType}</p>
                <p className={styles.readinessMeta}>{proposal.id}</p>
              </div>
              <span className={`${styles.readinessMiniBadge} ${proposal.status === "pending" ? styles.readinessWarn : styles.readinessPass}`}>
                {proposal.status}
              </span>
            </div>
            <p className={styles.readinessNextStep}>{proposal.reason || textPreview(proposal.proposedBody)}</p>
            <dl className={styles.repoMetaGrid}>
              <Meta label="Namespace" value={namespaceLabel(proposal.targetNamespace)} />
              <Meta label="Provenance" value={provenanceSummary(proposal.provenance)} />
              <Meta label="Created" value={formatDate(proposal.createdAt)} />
            </dl>
          </article>
        ))}
      </div>
    </section>
  );
}

function SnapshotPanel(props: { snapshots: DurableMemorySnapshot[] }) {
  return (
    <section className={styles.settingsPanel}>
      <div className={styles.settingsHeader}>
        <div>
          <p className={styles.key}>Snapshots</p>
          <h3 className={styles.resourceTitle}>Restore points</h3>
        </div>
        <FileClock size={18} />
      </div>
      {props.snapshots.length === 0 ? (
        <div className={styles.repoEmptyState}>
          <p className={styles.value}>No snapshots exist for this namespace.</p>
          <p className={styles.readinessMeta}>Snapshot restore remains a follow-on workflow.</p>
        </div>
      ) : null}
      <div className={styles.repoList}>
        {props.snapshots.map((snapshot) => (
          <article key={snapshot.id} className={styles.repoRow}>
            <div className={styles.repoRowMain}>
              <div>
                <p className={styles.repoName}>{snapshot.reason || "Snapshot"}</p>
                <p className={styles.readinessMeta}>{snapshot.id}</p>
              </div>
              <span className={`${styles.readinessMiniBadge} ${styles.readinessPass}`}>
                {snapshot.recordIds.length} records
              </span>
            </div>
            <dl className={styles.repoMetaGrid}>
              <Meta label="Namespace" value={namespaceLabel(snapshot.namespace)} />
              <Meta label="Provenance" value={provenanceSummary(snapshot.provenance)} />
              <Meta label="Created" value={formatDate(snapshot.createdAt)} />
            </dl>
          </article>
        ))}
      </div>
    </section>
  );
}

function Meta(props: { label: string; value: string }) {
  return (
    <div className={styles.repoMetaItem}>
      <dt>{props.label}</dt>
      <dd>{props.value || "Not recorded"}</dd>
    </div>
  );
}
