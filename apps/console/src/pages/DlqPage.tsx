import { useEffect, useMemo, useState } from "react";
import {
  useA2aDlqListQuery,
  useDiscardA2aDlqItemMutation,
  useRequeueA2aDlqItemMutation,
  type A2aDlqItem,
  type A2aDlqStatus,
} from "../features/dlq";
import { ApiClientError } from "../services";
import styles from "./PageScaffold.module.css";

function renderStackTrace(item: A2aDlqItem | undefined): string | undefined {
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

function matchesSearch(item: A2aDlqItem, search: string): boolean {
  if (!search) {
    return true;
  }
  const lower = search.toLowerCase();
  const serializedPayload = JSON.stringify(item.payload).toLowerCase();
  return item.id.toLowerCase().includes(lower) || (item.reason ?? "").toLowerCase().includes(lower) || serializedPayload.includes(lower);
}

export function DlqPage() {
  const [status, setStatus] = useState<"all" | A2aDlqStatus>("pending");
  const [search, setSearch] = useState("");
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [items, setItems] = useState<A2aDlqItem[]>([]);
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
  const dlqQuery = useA2aDlqListQuery(query);
  const requeueMutation = useRequeueA2aDlqItemMutation();
  const discardMutation = useDiscardA2aDlqItemMutation();

  const readDenied = dlqQuery.error instanceof ApiClientError && dlqQuery.error.status === 403;
  const writeDenied =
    (requeueMutation.error instanceof ApiClientError && requeueMutation.error.status === 403) ||
    (discardMutation.error instanceof ApiClientError && discardMutation.error.status === 403);

  useEffect(() => {
    if (!dlqQuery.data) {
      return;
    }
    if (!cursor) {
      setItems(dlqQuery.data.items);
      if (!selectedId && dlqQuery.data.items.length > 0) {
        setSelectedId(dlqQuery.data.items[0]?.id);
      }
      return;
    }
    setItems((previous) => [...previous, ...dlqQuery.data.items]);
  }, [cursor, dlqQuery.data, selectedId]);

  useEffect(() => {
    setCursor(undefined);
    setItems([]);
    setSelectedId(undefined);
  }, [status]);

  const visibleItems = useMemo(() => items.filter((item) => matchesSearch(item, search.trim())), [items, search]);
  const selectedItem = useMemo(() => items.find((item) => item.id === selectedId), [items, selectedId]);
  const stackTrace = useMemo(() => renderStackTrace(selectedItem), [selectedItem]);
  const isMutating = requeueMutation.isPending || discardMutation.isPending;

  async function refreshAfterMutation(targetId: string): Promise<void> {
    setCursor(undefined);
    setItems([]);
    setSelectedId(targetId);
    await dlqQuery.refetch();
  }

  async function handleRequeue(id: string): Promise<void> {
    setActiveMutationItemId(id);
    setActionMessage(undefined);
    try {
      const result = await requeueMutation.mutateAsync(id);
      setActionMessage(result.updated ? `Re-queued ${id}.` : `DLQ item ${id} was not found.`);
      await refreshAfterMutation(id);
    } catch (error) {
      setActionMessage(error instanceof Error ? error.message : "Failed to re-queue DLQ item.");
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
      setActionMessage(result.updated ? `Discarded ${id}.` : `DLQ item ${id} was not found.`);
      await refreshAfterMutation(id);
    } catch (error) {
      setActionMessage(error instanceof Error ? error.message : "Failed to discard DLQ item.");
    } finally {
      setActiveMutationItemId(undefined);
    }
  }

  return (
    <section className={styles.page}>
      <h2>DLQ Console</h2>
      <p className={styles.lead}>Inspect failed A2A deliveries, re-queue recoverable messages, and discard with auditable notes.</p>
      {readDenied ? <p>DLQ visibility is restricted to authorized Viewer, Operator, or Admin identities.</p> : null}
      {writeDenied ? <p>DLQ write operations require Operator or Admin privileges.</p> : null}

      <div className={styles.settingsPanel}>
        <div className={styles.settingsHeader}>
          <h3>Queue Filters</h3>
        </div>
        <div className={styles.dlqFilterGrid}>
          <label className={styles.policyField}>
            <span>Status</span>
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value as "all" | A2aDlqStatus)}
              className={styles.settingsInput}
            >
              <option value="all">All</option>
              <option value="pending">Pending</option>
              <option value="requeued">Requeued</option>
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
          <h3>Queue</h3>
        </div>
        {dlqQuery.isLoading ? <p>Loading DLQ items...</p> : null}
        {dlqQuery.error instanceof Error && !readDenied ? <p>{dlqQuery.error.message}</p> : null}
        {visibleItems.length === 0 && !dlqQuery.isLoading && !dlqQuery.error ? (
          <p className={styles.settingsMuted}>No DLQ records found for the selected filters.</p>
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
        {dlqQuery.data?.nextCursor ? (
          <div className={styles.settingsActions}>
            <button
              type="button"
              className={styles.settingsButton}
              onClick={() => {
                setCursor(dlqQuery.data?.nextCursor);
              }}
              disabled={dlqQuery.isPending}
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
        {!selectedItem ? <p>Select a DLQ item to inspect payload and failure details.</p> : null}
        {selectedItem ? (
          <div className={styles.stack}>
            <p className={styles.settingsMuted}>
              ID: <span className={styles.mono}>{selectedItem.id}</span> | Status:{" "}
              <span className={styles.mono}>{selectedItem.status}</span>
            </p>
            <p className={styles.settingsMuted}>Reason: {selectedItem.reason ?? "No reason provided."}</p>
            {stackTrace ? (
              <div className={styles.dlqInspectBlock}>
                <p className={styles.key}>Error Stack</p>
                <pre className={styles.dlqPre}>{stackTrace}</pre>
              </div>
            ) : null}
            <div className={styles.dlqInspectBlock}>
              <p className={styles.key}>Raw Payload</p>
              <pre className={styles.dlqPre}>{JSON.stringify(selectedItem.payload, null, 2)}</pre>
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
                  void handleRequeue(selectedItem.id);
                }}
                disabled={readDenied || writeDenied || isMutating || activeMutationItemId === selectedItem.id}
              >
                {requeueMutation.isPending && activeMutationItemId === selectedItem.id ? "Re-queueing..." : "Re-queue"}
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
