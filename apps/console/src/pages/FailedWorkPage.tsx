import { useEffect, useMemo, useState } from "react";
import {
  useDiscardFailedWorkItemMutation,
  useFailedWorkListQuery,
  useRetryFailedWorkItemMutation,
  type FailedWorkItem,
  type FailedWorkStatus,
} from "../features/failed-work";
import { ApiClientError } from "../services";
import styles from "./PageScaffold.module.css";

function renderStackTrace(item: FailedWorkItem | undefined): string | undefined {
  if (!item) {
    return undefined;
  }
  const payload = item.payload as Record<string, unknown>;
  const error = payload.error as Record<string, unknown> | undefined;
  if (error && typeof error.stack === "string" && error.stack.trim().length > 0) {
    return error.stack;
  }
  if (typeof payload.stack === "string" && payload.stack.trim().length > 0) {
    return payload.stack;
  }
  return undefined;
}

function matchesSearch(item: FailedWorkItem, search: string): boolean {
  if (!search) {
    return true;
  }
  const lower = search.toLowerCase();
  const serializedPayload = JSON.stringify(item.payload).toLowerCase();
  return (
    item.id.toLowerCase().includes(lower) ||
    (item.reason ?? "").toLowerCase().includes(lower) ||
    serializedPayload.includes(lower)
  );
}

export function FailedWorkPage() {
  const [status, setStatus] = useState<"all" | FailedWorkStatus>("pending");
  const [search, setSearch] = useState("");
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [items, setItems] = useState<FailedWorkItem[]>([]);
  const [selectedId, setSelectedId] = useState<string>();
  const [discardNote, setDiscardNote] = useState("");
  const [actionMessage, setActionMessage] = useState<string>();
  const [activeMutationItemId, setActiveMutationItemId] = useState<string>();

  const query = useMemo(
    () => ({
      limit: 50,
      ...(cursor ? { cursor } : {}),
      ...(status === "all" ? {} : { status }),
    }),
    [cursor, status],
  );
  const failedWorkQuery = useFailedWorkListQuery(query);
  const retryMutation = useRetryFailedWorkItemMutation();
  const discardMutation = useDiscardFailedWorkItemMutation();

  const readDenied = failedWorkQuery.error instanceof ApiClientError && failedWorkQuery.error.status === 403;
  const writeDenied =
    (retryMutation.error instanceof ApiClientError && retryMutation.error.status === 403) ||
    (discardMutation.error instanceof ApiClientError && discardMutation.error.status === 403);

  useEffect(() => {
    if (!failedWorkQuery.data) {
      return;
    }
    if (!cursor) {
      setItems(failedWorkQuery.data.items);
      if (!selectedId && failedWorkQuery.data.items.length > 0) {
        setSelectedId(failedWorkQuery.data.items[0]?.id);
      }
      return;
    }
    setItems((previous) => [...previous, ...failedWorkQuery.data.items]);
  }, [cursor, failedWorkQuery.data, selectedId]);

  useEffect(() => {
    setCursor(undefined);
    setItems([]);
    setSelectedId(undefined);
  }, [status]);

  const visibleItems = useMemo(() => items.filter((item) => matchesSearch(item, search.trim())), [items, search]);
  const selectedItem = useMemo(() => items.find((item) => item.id === selectedId), [items, selectedId]);
  const stackTrace = useMemo(() => renderStackTrace(selectedItem), [selectedItem]);
  const isMutating = retryMutation.isPending || discardMutation.isPending;

  async function refreshAfterMutation(targetId: string): Promise<void> {
    setCursor(undefined);
    setItems([]);
    setSelectedId(targetId);
    await failedWorkQuery.refetch();
  }

  async function handleRetry(id: string): Promise<void> {
    setActiveMutationItemId(id);
    setActionMessage(undefined);
    try {
      const result = await retryMutation.mutateAsync(id);
      setActionMessage(result.updated ? `Retry requested for ${id}.` : `Failed work item ${id} was not found.`);
      await refreshAfterMutation(id);
    } catch (error) {
      setActionMessage(error instanceof Error ? error.message : "Failed to retry work item.");
    } finally {
      setActiveMutationItemId(undefined);
    }
  }

  async function handleDiscard(id: string): Promise<void> {
    const trimmedNote = discardNote.trim();
    if (!trimmedNote) {
      setActionMessage("Discard requires an audit note.");
      return;
    }
    setActiveMutationItemId(id);
    setActionMessage(undefined);
    try {
      const result = await discardMutation.mutateAsync({
        id,
        request: { auditNote: trimmedNote },
      });
      setActionMessage(result.updated ? `Discarded ${id}.` : `Failed work item ${id} was not found.`);
      await refreshAfterMutation(id);
    } catch (error) {
      setActionMessage(error instanceof Error ? error.message : "Failed to discard work item.");
    } finally {
      setActiveMutationItemId(undefined);
    }
  }

  return (
    <section className={styles.page}>
      <h2>Failed Work Recovery</h2>
      <p className={styles.lead}>
        Inspect failed work items, request a retry for recoverable failures, and discard terminal failures with audit
        notes.
      </p>
      {readDenied ? <p>Failed work visibility is restricted to authorized Viewer, Operator, or Admin identities.</p> : null}
      {writeDenied ? <p>Failed work retry and discard operations require Operator or Admin privileges.</p> : null}

      <div className={styles.settingsPanel}>
        <div className={styles.settingsHeader}>
          <h3>Recovery Filters</h3>
        </div>
        <div className={styles.failedWorkFilterGrid}>
          <label className={styles.policyField}>
            <span>Status</span>
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value as "all" | FailedWorkStatus)}
              className={styles.settingsInput}
            >
              <option value="all">All</option>
              <option value="pending">Pending</option>
              <option value="retried">Retried</option>
              <option value="discarded">Discarded</option>
            </select>
          </label>
          <label className={styles.policyField}>
            <span>Search</span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className={styles.settingsInput}
              placeholder="id, reason, payload text"
            />
          </label>
        </div>
      </div>

      <div className={styles.settingsPanel}>
        <div className={styles.settingsHeader}>
          <h3>Failed Work</h3>
        </div>
        {failedWorkQuery.isLoading ? <p>Loading failed work items...</p> : null}
        {failedWorkQuery.error instanceof Error && !readDenied ? <p>{failedWorkQuery.error.message}</p> : null}
        {visibleItems.length === 0 && !failedWorkQuery.isLoading && !failedWorkQuery.error ? (
          <p className={styles.settingsMuted}>No failed work records found for the selected filters.</p>
        ) : null}
        <div className={styles.tableWrapper}>
          <table className={styles.settingsTable}>
            <thead>
              <tr>
                <th>ID</th>
                <th>Status</th>
                <th>Reason</th>
                <th>Created</th>
                <th>Updated</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {visibleItems.map((item) => (
                <tr key={item.id}>
                  <td className={styles.mono}>{item.id}</td>
                  <td>{item.status}</td>
                  <td>{item.reason ?? "-"}</td>
                  <td className={styles.mono}>{item.createdAt}</td>
                  <td className={styles.mono}>{item.updatedAt}</td>
                  <td>
                    <button
                      type="button"
                      className={styles.settingsButton}
                      onClick={() => {
                        setSelectedId(item.id);
                      }}
                    >
                      Inspect
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {failedWorkQuery.data?.nextCursor ? (
          <div className={styles.settingsActions}>
            <button
              type="button"
              className={styles.settingsButton}
              onClick={() => {
                setCursor(failedWorkQuery.data?.nextCursor);
              }}
              disabled={failedWorkQuery.isPending}
            >
              Load More
            </button>
          </div>
        ) : null}
      </div>

      <div className={styles.settingsPanel}>
        <div className={styles.settingsHeader}>
          <h3>Inspect Item</h3>
        </div>
        {!selectedItem ? <p>Select a failed work item to inspect payload and failure details.</p> : null}
        {selectedItem ? (
          <div className={styles.stack}>
            <p className={styles.settingsMuted}>
              ID: <span className={styles.mono}>{selectedItem.id}</span> | Status:{" "}
              <span className={styles.mono}>{selectedItem.status}</span>
            </p>
            <p className={styles.settingsMuted}>Reason: {selectedItem.reason ?? "No reason provided."}</p>
            {stackTrace ? (
              <div className={styles.failedWorkInspectBlock}>
                <p className={styles.key}>Error Stack</p>
                <pre className={styles.failedWorkPre}>{stackTrace}</pre>
              </div>
            ) : null}
            <div className={styles.failedWorkInspectBlock}>
              <p className={styles.key}>Raw Payload</p>
              <pre className={styles.failedWorkPre}>{JSON.stringify(selectedItem.payload, null, 2)}</pre>
            </div>
            <label className={styles.policyAuditField}>
              <span>Discard Audit Note</span>
              <textarea
                value={discardNote}
                onChange={(event) => setDiscardNote(event.target.value)}
                className={styles.policyAuditInput}
                placeholder="why this item is being discarded"
              />
            </label>
            <div className={styles.settingsActionsStart}>
              <button
                type="button"
                className={styles.settingsButtonPrimary}
                onClick={() => {
                  void handleRetry(selectedItem.id);
                }}
                disabled={readDenied || writeDenied || isMutating || activeMutationItemId === selectedItem.id}
              >
                {retryMutation.isPending && activeMutationItemId === selectedItem.id ? "Retrying..." : "Retry"}
              </button>
              <button
                type="button"
                className={styles.settingsButton}
                onClick={() => {
                  void handleDiscard(selectedItem.id);
                }}
                disabled={readDenied || writeDenied || isMutating || activeMutationItemId === selectedItem.id}
              >
                {discardMutation.isPending && activeMutationItemId === selectedItem.id ? "Discarding..." : "Discard"}
              </button>
            </div>
          </div>
        ) : null}
        {actionMessage ? <p className={styles.settingsMuted}>{actionMessage}</p> : null}
      </div>
    </section>
  );
}
