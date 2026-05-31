import { useEffect, useMemo, useState } from "react";
import { useGovernanceAuditHistoryQuery, type GovernanceAuditCategory, type GovernanceAuditEntry } from "../features/governance-audit";
import { ApiClientError } from "../services";
import { resolveAdvancedSurfaceNotice } from "./advancedSurfaceState";
import styles from "./PageScaffold.module.css";

const CATEGORY_OPTIONS: Array<{ value: GovernanceAuditCategory; label: string }> = [
  { value: "policy", label: "Policy" },
  { value: "rbac-role", label: "Access Roles" },
  { value: "identity-assignment", label: "Identity Assignments" }
];

export function AuditTrailPage() {
  const [actor, setActor] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<GovernanceAuditCategory[]>([
    "policy",
    "rbac-role",
    "identity-assignment"
  ]);
  const [createdAfter, setCreatedAfter] = useState("");
  const [createdBefore, setCreatedBefore] = useState("");
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [items, setItems] = useState<GovernanceAuditEntry[]>([]);

  const query = useMemo(
    () => ({
      limit: 50,
      ...(cursor ? { cursor } : {}),
      ...(actor.trim().length > 0 ? { actor: actor.trim() } : {}),
      ...(selectedCategories.length > 0 ? { categories: selectedCategories } : {}),
      ...(createdAfter ? { createdAfter: new Date(createdAfter).toISOString() } : {}),
      ...(createdBefore ? { createdBefore: new Date(createdBefore).toISOString() } : {})
    }),
    [actor, createdAfter, createdBefore, cursor, selectedCategories]
  );

  const auditQuery = useGovernanceAuditHistoryQuery(query);

  const adminDenied = auditQuery.error instanceof ApiClientError && auditQuery.error.status === 403;
  const unavailableNotice = resolveAdvancedSurfaceNotice(auditQuery.error, "audit-trail");

  useEffect(() => {
    if (!auditQuery.data) {
      return;
    }
    if (!cursor) {
      setItems(auditQuery.data.items);
      return;
    }
    setItems((previous) => [...previous, ...auditQuery.data.items]);
  }, [auditQuery.data, cursor]);

  useEffect(() => {
    setCursor(undefined);
    setItems([]);
  }, [actor, createdAfter, createdBefore]);

  function toggleCategory(category: GovernanceAuditCategory): void {
    setCursor(undefined);
    setItems([]);
    setSelectedCategories((previous) => {
      if (previous.includes(category)) {
        const next = previous.filter((item) => item !== category);
        return next.length > 0 ? next : previous;
      }
      return [...previous, category];
    });
  }

  function applyFilters(): void {
    setCursor(undefined);
    setItems([]);
    void auditQuery.refetch();
  }

  const sortedItems = useMemo(
    () => [...items].sort((left, right) => right.timestamp.localeCompare(left.timestamp)),
    [items]
  );

  return (
    <section className={styles.page}>
      <h2>Audit Trail</h2>
      <p className={styles.lead}>Immutable policy and access-control history from the local event store.</p>
      {unavailableNotice ? (
        <div className={styles.advancedNotice}>
          <h3>{unavailableNotice.title}</h3>
          <p>{unavailableNotice.body}</p>
          <p>{unavailableNotice.detail}</p>
        </div>
      ) : null}
      {adminDenied && !unavailableNotice ? <p>Audit Trail is restricted to bootstrap or high-privilege administrators.</p> : null}

      {!unavailableNotice ? <div className={styles.settingsPanel}>
        <div className={styles.settingsHeader}>
          <h3>Filters</h3>
        </div>
        <div className={styles.auditFilterGrid}>
          <label className={styles.policyField}>
            <span>Actor</span>
            <input
              value={actor}
              onChange={(event) => setActor(event.target.value)}
              className={styles.settingsInput}
              placeholder="bootstrap-admin"
            />
          </label>
          <label className={styles.policyField}>
            <span>Created After</span>
            <input type="datetime-local" value={createdAfter} onChange={(event) => setCreatedAfter(event.target.value)} className={styles.settingsInput} />
          </label>
          <label className={styles.policyField}>
            <span>Created Before</span>
            <input
              type="datetime-local"
              value={createdBefore}
              onChange={(event) => setCreatedBefore(event.target.value)}
              className={styles.settingsInput}
            />
          </label>
        </div>

        <div className={styles.auditCategoryRow}>
          {CATEGORY_OPTIONS.map((option) => (
            <label key={option.value} className={styles.auditCategoryOption}>
              <input
                type="checkbox"
                checked={selectedCategories.includes(option.value)}
                onChange={() => {
                  toggleCategory(option.value);
                }}
              />
              <span>{option.label}</span>
            </label>
          ))}
        </div>

        <div className={styles.settingsActions}>
          <button
            type="button"
            className={styles.settingsButtonPrimary}
            onClick={applyFilters}
            disabled={adminDenied || auditQuery.isPending}
          >
            Apply Filters
          </button>
        </div>
      </div> : null}

      {!unavailableNotice ? <div className={styles.settingsPanel}>
        <div className={styles.settingsHeader}>
          <h3>Event History</h3>
        </div>
        {auditQuery.isLoading ? <p>Loading audit history...</p> : null}
        {auditQuery.error instanceof Error && !adminDenied ? <p>{auditQuery.error.message}</p> : null}
        {sortedItems.length === 0 && !auditQuery.isLoading && !auditQuery.error ? <p className={styles.settingsMuted}>No audit records found for the selected filters.</p> : null}

        <div className={styles.auditList}>
          {sortedItems.map((item) => (
            <article key={item.id} className={styles.auditEntry}>
              <div className={styles.auditEntryHead}>
                <p className={styles.auditTitle}>{item.summary}</p>
                <p className={styles.auditMeta}>
                  <span className={styles.mono}>{item.timestamp}</span>
                  <span>Actor: <span className={styles.mono}>{item.actor.subject}</span></span>
                  <span>Category: <span className={styles.mono}>{item.category}</span></span>
                </p>
              </div>
              {item.reason ? (
                <p className={styles.settingsMuted}>
                  Reason: <span className={styles.mono}>{item.reason}</span>
                </p>
              ) : null}
              {item.diffs.length > 0 ? (
                <ul className={styles.policyDiffList}>
                  {item.diffs.map((diff) => (
                    <li key={`${item.id}-${diff.key}`} className={styles.policyDiffRow}>
                      <span className={styles.policyDiffLabel}>{diff.label}</span>
                      <span className={styles.policyDiffValues}>
                        <span className={styles.policyDiffBefore}>{diff.before ?? "n/a"}</span>
                        <span className={styles.policyDiffArrow}>{"->"}</span>
                        <span className={styles.policyDiffAfter}>{diff.after ?? "n/a"}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className={styles.settingsMuted}>No field-level diff captured for this entry.</p>
              )}
            </article>
          ))}
        </div>

        {auditQuery.data?.nextCursor ? (
          <div className={styles.settingsActions}>
            <button
              type="button"
              className={styles.settingsButton}
              onClick={() => {
                setCursor(auditQuery.data?.nextCursor);
              }}
              disabled={auditQuery.isPending}
            >
              Load More
            </button>
          </div>
        ) : null}
      </div> : null}
    </section>
  );
}
