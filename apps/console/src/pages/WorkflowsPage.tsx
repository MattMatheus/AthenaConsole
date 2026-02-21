import { useMemo, useState } from "react";
import { exportA2aStallAlertHistoryCsv, useA2aObservabilityQuery, useA2aStallAlertHistoryQuery } from "../features/a2a-observability";
import { ApiClientError } from "../services";
import styles from "./PageScaffold.module.css";

function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) {
    return "0s";
  }
  if (ms < 1_000) {
    return `${Math.round(ms)}ms`;
  }
  const seconds = ms / 1_000;
  if (seconds < 60) {
    return `${seconds.toFixed(1)}s`;
  }
  const minutes = seconds / 60;
  return `${minutes.toFixed(1)}m`;
}

function formatBucket(iso: string): string {
  const value = Date.parse(iso);
  if (!Number.isFinite(value)) {
    return iso;
  }
  return new Date(value).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit"
  });
}

export function WorkflowsPage() {
  const [windowMinutes, setWindowMinutes] = useState(60);
  const [bucketMinutes, setBucketMinutes] = useState(5);
  const [traceId, setTraceId] = useState("");
  const [alertCursor, setAlertCursor] = useState<string | undefined>(undefined);
  const [alertStepId, setAlertStepId] = useState("");
  const [alertSeverity, setAlertSeverity] = useState<"" | "warning" | "critical">("");
  const [alertCreatedAfter, setAlertCreatedAfter] = useState("");
  const [alertCreatedBefore, setAlertCreatedBefore] = useState("");
  const [exportStatus, setExportStatus] = useState<string | undefined>(undefined);

  const observabilityQuery = useA2aObservabilityQuery({
    limit: 800,
    windowMinutes,
    bucketMinutes,
    ...(traceId.trim().length > 0 ? { traceId: traceId.trim() } : {})
  });

  const readDenied = observabilityQuery.error instanceof ApiClientError && observabilityQuery.error.status === 403;
  const alertHistoryQuery = useA2aStallAlertHistoryQuery({
    ...(alertCursor ? { cursor: alertCursor } : {}),
    limit: 25,
    ...(traceId.trim().length > 0 ? { traceId: traceId.trim() } : {}),
    ...(alertStepId.trim().length > 0 ? { stepId: alertStepId.trim() } : {}),
    ...(alertSeverity ? { severity: alertSeverity } : {}),
    ...(alertCreatedAfter ? { createdAfter: new Date(alertCreatedAfter).toISOString() } : {}),
    ...(alertCreatedBefore ? { createdBefore: new Date(alertCreatedBefore).toISOString() } : {})
  });

  const maxLatencyMs = useMemo(
    () =>
      Math.max(
        1,
        ...(observabilityQuery.data?.latencyHeatmap.map((row) => Math.max(row.averageLatencyMs, row.p95LatencyMs)) ?? [1])
      ),
    [observabilityQuery.data?.latencyHeatmap]
  );

  async function handleExportCsv(): Promise<void> {
    const createdAfter = alertCreatedAfter ? new Date(alertCreatedAfter).toISOString() : undefined;
    const createdBefore = alertCreatedBefore ? new Date(alertCreatedBefore).toISOString() : undefined;
    if (!createdAfter || !createdBefore) {
      setExportStatus("Set both Created After and Created Before before export.");
      return;
    }
    try {
      setExportStatus("Exporting CSV...");
      const csv = await exportA2aStallAlertHistoryCsv({
        ...(traceId.trim().length > 0 ? { traceId: traceId.trim() } : {}),
        ...(alertStepId.trim().length > 0 ? { stepId: alertStepId.trim() } : {}),
        ...(alertSeverity ? { severity: alertSeverity } : {}),
        createdAfter,
        createdBefore
      });
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = "a2a-stall-alerts.csv";
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(objectUrl);
      setExportStatus("CSV exported.");
    } catch (error) {
      setExportStatus(error instanceof Error ? error.message : "CSV export failed.");
    }
  }

  return (
    <section className={styles.page}>
      <h2>Workflows</h2>
      <p className={styles.lead}>
        A2A throughput, queue depth, latency heatmap, and stall-alert monitoring for workflow bottleneck detection.
      </p>
      {readDenied ? <p>A2A observability requires Operator or Admin privileges.</p> : null}

      <div className={styles.settingsPanel}>
        <div className={styles.settingsHeader}>
          <h3>Observability Controls</h3>
          <p className={styles.settingsMuted}>Auto-refresh every 10 seconds</p>
        </div>
        <div className={styles.observabilityFilterGrid}>
          <label className={styles.policyField}>
            <span>Window (minutes)</span>
            <input
              className={styles.settingsInput}
              type="number"
              min={5}
              max={1440}
              value={windowMinutes}
              onChange={(event) => setWindowMinutes(Math.max(5, Math.min(1440, Number(event.target.value) || 60)))}
            />
          </label>
          <label className={styles.policyField}>
            <span>Bucket (minutes)</span>
            <input
              className={styles.settingsInput}
              type="number"
              min={1}
              max={60}
              value={bucketMinutes}
              onChange={(event) => setBucketMinutes(Math.max(1, Math.min(60, Number(event.target.value) || 5)))}
            />
          </label>
          <label className={styles.policyField}>
            <span>Trace Filter (optional)</span>
            <input
              className={styles.settingsInput}
              value={traceId}
              onChange={(event) => {
                setAlertCursor(undefined);
                setTraceId(event.target.value);
              }}
              placeholder="trace-123..."
            />
          </label>
        </div>
        <p className={styles.settingsMuted}>
          {observabilityQuery.data
            ? `Sampled ${observabilityQuery.data.sampleCount} telemetry events between ${new Date(
                observabilityQuery.data.windowStart
              ).toLocaleTimeString()} and ${new Date(observabilityQuery.data.windowEnd).toLocaleTimeString()}`
            : "Waiting for telemetry sample..."}
          {observabilityQuery.data?.truncated ? " (sample capped)" : ""}
        </p>
      </div>

      <div className={styles.settingsPanel}>
        <div className={styles.settingsHeader}>
          <h3>Throughput and Queue Depth</h3>
        </div>
        {observabilityQuery.isLoading ? <p>Loading throughput snapshot...</p> : null}
        {observabilityQuery.error instanceof Error && !readDenied ? <p>{observabilityQuery.error.message}</p> : null}
        {observabilityQuery.data?.throughput.length === 0 ? (
          <p className={styles.settingsMuted}>No throughput buckets found in the selected window.</p>
        ) : null}
        <div className={styles.tableWrapper}>
          <table className={styles.settingsTable}>
            <thead>
              <tr>
                <th>Queue</th>
                <th>Bucket</th>
                <th>Items/Minute</th>
                <th>Processed</th>
                <th>Queue Depth</th>
              </tr>
            </thead>
            <tbody>
              {(observabilityQuery.data?.throughput ?? []).map((point) => (
                <tr key={`${point.queueId}-${point.bucketStart}`}>
                  <td className={styles.mono}>{point.queueId}</td>
                  <td className={styles.mono}>{formatBucket(point.bucketStart)}</td>
                  <td>{point.itemsPerMinute.toFixed(2)}</td>
                  <td>{point.processedItems}</td>
                  <td>{point.queueDepth}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className={styles.settingsPanel}>
        <div className={styles.settingsHeader}>
          <h3>Latency Heatmap</h3>
        </div>
        {observabilityQuery.data?.latencyHeatmap.length === 0 ? (
          <p className={styles.settingsMuted}>No completed A2A step latencies available for this window.</p>
        ) : null}
        <div className={styles.heatmapList}>
          {(observabilityQuery.data?.latencyHeatmap ?? []).slice(0, 40).map((row) => {
            const intensity = Math.max(8, Math.min(100, Math.round((Math.max(row.averageLatencyMs, row.p95LatencyMs) / maxLatencyMs) * 100)));
            return (
              <div
                key={`${row.traceId}-${row.stepId}`}
                className={styles.heatmapRow}
                style={{ ["--heat-intensity" as string]: `${intensity}%` }}
              >
                <div>
                  <p className={styles.heatmapTitle}>
                    {row.stepId} <span className={styles.mono}>{row.traceId}</span>
                  </p>
                  <p className={styles.settingsMuted}>
                    avg {formatDuration(row.averageLatencyMs)} | p95 {formatDuration(row.p95LatencyMs)} | queue wait{" "}
                    {formatDuration(row.averageQueueWaitMs)}
                  </p>
                </div>
                <span className={styles.mono}>{row.sampleSize} samples</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className={styles.settingsPanel}>
        <div className={styles.settingsHeader}>
          <h3>Live Stall Alerts</h3>
        </div>
        {observabilityQuery.data?.stallAlerts.length === 0 ? (
          <p className={styles.settingsMuted}>No workflow stalls beyond historical P95 thresholds.</p>
        ) : null}
        <div className={styles.auditList}>
          {(observabilityQuery.data?.stallAlerts ?? []).map((alert) => (
            <article key={`${alert.traceId}-${alert.stepId}-${alert.correlationId}`} className={styles.auditEntry}>
              <div className={styles.auditEntryHead}>
                <p className={styles.auditTitle}>
                  {alert.severity.toUpperCase()} | {alert.stepId}
                </p>
                <p className={styles.auditMeta}>
                  <span className={styles.mono}>trace={alert.traceId}</span>
                  <span className={styles.mono}>queue={alert.queueId}</span>
                  <span className={styles.mono}>item={alert.correlationId}</span>
                </p>
              </div>
              <p className={styles.settingsMuted}>
                Pending {formatDuration(alert.pendingForMs)} since {new Date(alert.startedAt).toLocaleTimeString()} (historical
                p95 {formatDuration(alert.historicalP95Ms)}).
              </p>
            </article>
          ))}
        </div>
      </div>

      <div className={styles.settingsPanel}>
        <div className={styles.settingsHeader}>
          <h3>Alert History</h3>
          <button className={styles.settingsButton} type="button" onClick={() => void handleExportCsv()} disabled={readDenied}>
            Export CSV
          </button>
        </div>
        <div className={styles.observabilityFilterGrid}>
          <label className={styles.policyField}>
            <span>Step ID (optional)</span>
            <input
              className={styles.settingsInput}
              value={alertStepId}
              onChange={(event) => {
                setAlertCursor(undefined);
                setAlertStepId(event.target.value);
              }}
              placeholder="planner"
            />
          </label>
          <label className={styles.policyField}>
            <span>Severity (optional)</span>
            <select
              className={styles.settingsInput}
              value={alertSeverity}
              onChange={(event) => {
                setAlertCursor(undefined);
                const value = event.target.value;
                setAlertSeverity(value === "warning" || value === "critical" ? value : "");
              }}
            >
              <option value="">all</option>
              <option value="warning">warning</option>
              <option value="critical">critical</option>
            </select>
          </label>
          <label className={styles.policyField}>
            <span>Created After</span>
            <input
              className={styles.settingsInput}
              type="datetime-local"
              value={alertCreatedAfter}
              onChange={(event) => {
                setAlertCursor(undefined);
                setAlertCreatedAfter(event.target.value);
              }}
            />
          </label>
          <label className={styles.policyField}>
            <span>Created Before</span>
            <input
              className={styles.settingsInput}
              type="datetime-local"
              value={alertCreatedBefore}
              onChange={(event) => {
                setAlertCursor(undefined);
                setAlertCreatedBefore(event.target.value);
              }}
            />
          </label>
        </div>
        {exportStatus ? <p className={styles.settingsMuted}>{exportStatus}</p> : null}
        {alertHistoryQuery.isLoading ? <p>Loading alert history...</p> : null}
        {alertHistoryQuery.error instanceof Error && !readDenied ? <p>{alertHistoryQuery.error.message}</p> : null}
        {alertHistoryQuery.data?.items.length === 0 ? (
          <p className={styles.settingsMuted}>No historical alerts matched these filters.</p>
        ) : null}
        <div className={styles.auditList}>
          {(alertHistoryQuery.data?.items ?? []).map((alert) => (
            <article key={alert.id} className={styles.auditEntry}>
              <div className={styles.auditEntryHead}>
                <p className={styles.auditTitle}>
                  {alert.severity.toUpperCase()} | {alert.stepId} | {alert.status.toUpperCase()}
                </p>
                <p className={styles.auditMeta}>
                  <span className={styles.mono}>trace={alert.traceId}</span>
                  <span className={styles.mono}>queue={alert.queueId}</span>
                  <span className={styles.mono}>item={alert.correlationId}</span>
                </p>
              </div>
              <p className={styles.settingsMuted}>
                Created {new Date(alert.createdAt).toLocaleString()} | Started {new Date(alert.startedAt).toLocaleTimeString()} | Pending{" "}
                {formatDuration(alert.pendingForMs)} | historical p95 {formatDuration(alert.historicalP95Ms)}
                {alert.resolvedAt ? ` | Resolved ${new Date(alert.resolvedAt).toLocaleString()}` : ""}
              </p>
            </article>
          ))}
        </div>
        <div className={styles.settingsActions}>
          <button
            className={styles.settingsButton}
            type="button"
            onClick={() => setAlertCursor(alertHistoryQuery.data?.nextCursor)}
            disabled={!alertHistoryQuery.data?.nextCursor}
          >
            Next Page
          </button>
          <button className={styles.settingsButton} type="button" onClick={() => setAlertCursor(undefined)}>
            First Page
          </button>
        </div>
      </div>
    </section>
  );
}
