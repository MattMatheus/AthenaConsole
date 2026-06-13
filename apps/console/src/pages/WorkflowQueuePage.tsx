import { AlertTriangle, Clock3, RefreshCw, RotateCcw, Timer, Workflow } from "lucide-react";
import { Link } from "react-router-dom";
import { useWorkflowQueueStatusQuery } from "../features/workflow-runs/queries";
import {
  formatHeartbeatAge,
  queueItemLabel,
  workerTone,
  workflowQueueTone,
  workflowQueueViewState,
} from "../features/workflow-runs/workflowQueueModel";
import type { WorkflowQueueStatusItem } from "../features/workflow-runs/types";
import styles from "./WorkflowQueuePage.module.css";

export function WorkflowQueuePage() {
  const queueQuery = useWorkflowQueueStatusQuery();
  const state = workflowQueueViewState({
    isLoading: queueQuery.isLoading,
    isError: queueQuery.isError,
    ...(queueQuery.data ? { data: queueQuery.data } : {}),
  });
  const data = queueQuery.data;
  const now = data?.generatedAt ? new Date(data.generatedAt) : new Date();

  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Workflow Queue</h1>
          <p className={styles.description}>Pending, running, retryable, and stuck workflow steps.</p>
        </div>
        <button
          className={styles.secondaryButton}
          type="button"
          onClick={() => void queueQuery.refetch()}
          aria-label="Refresh workflow queue"
          title="Refresh workflow queue"
        >
          <RefreshCw size={16} />
        </button>
      </header>

      {data ? (
        <section className={styles.summaryGrid} aria-label="Workflow queue summary">
          <Metric label="Pending" value={data.summary.pending} />
          <Metric label="Running" value={data.summary.running} />
          <Metric label="Retryable" value={data.summary.retryable} />
          <Metric label="Stuck" value={data.summary.stuck} tone={data.summary.stuck > 0 ? "danger" : "neutral"} />
        </section>
      ) : null}

      {state === "loading" ? (
        <section className={styles.state}>
          <p className={styles.stateTitle}>Loading Queue</p>
        </section>
      ) : null}

      {state === "error" ? (
        <section className={styles.state}>
          <AlertTriangle size={20} />
          <p className={styles.stateTitle}>Queue Status Unavailable</p>
          <p className={styles.description}>Refresh after the control-plane API is reachable.</p>
        </section>
      ) : null}

      {state === "empty" ? (
        <section className={styles.state}>
          <Workflow size={20} />
          <p className={styles.stateTitle}>No Queue Records</p>
        </section>
      ) : null}

      {data && state !== "loading" && state !== "error" && state !== "empty" ? (
        <div className={styles.layout}>
          <section className={styles.panel}>
            <div className={styles.panelHeader}>
              <h2 className={styles.panelTitle}>Work</h2>
              <span className={styles.panelMeta}>{data.items.length} records</span>
            </div>
            <div className={styles.queueList}>
              {data.items.map((item) => (
                <QueueItem key={item.id} item={item} />
              ))}
            </div>
          </section>

          <aside className={styles.panel}>
            <div className={styles.panelHeader}>
              <h2 className={styles.panelTitle}>Workers</h2>
              <span className={styles.panelMeta}>{data.workers.length} heartbeats</span>
            </div>
            <div className={styles.workerList}>
              {data.workers.length === 0 ? <p className={styles.description}>No worker heartbeats.</p> : null}
              {data.workers.map((worker) => (
                <div className={styles.workerRow} key={worker.workerId}>
                  <div className={styles.rowTop}>
                    <span className={styles.workerId}>{worker.workerId}</span>
                    <span className={toneClass(workerTone(worker))}>{worker.status}</span>
                  </div>
                  <dl className={styles.metaGrid}>
                    <div>
                      <dt>Age</dt>
                      <dd>{formatHeartbeatAge(worker, now)}</dd>
                    </div>
                    <div>
                      <dt>Capacity</dt>
                      <dd>{worker.capacity}</dd>
                    </div>
                    <div>
                      <dt>Version</dt>
                      <dd>{worker.version}</dd>
                    </div>
                    {worker.activeRunId ? (
                      <div>
                        <dt>Run</dt>
                        <dd>{worker.activeRunId}</dd>
                      </div>
                    ) : null}
                  </dl>
                </div>
              ))}
            </div>
          </aside>
        </div>
      ) : null}

      {state === "stuck" ? (
        <section className={styles.recoveryBand}>
          <AlertTriangle size={18} />
          <div>
            <h2 className={styles.panelTitle}>Recovery</h2>
            <p className={styles.description}>Cancel stale task runs, restart the worker, then retry eligible workflow steps.</p>
          </div>
          <Link className={styles.inlineLink} to="/docs">
            Open docs
          </Link>
        </section>
      ) : null}
    </div>
  );
}

function Metric({ label, value, tone = "neutral" }: { label: string; value: number; tone?: "neutral" | "danger" }) {
  return (
    <div className={`${styles.metric} ${tone === "danger" ? styles.metricDanger : ""}`}>
      <span className={styles.metricLabel}>{label}</span>
      <span className={styles.metricValue}>{value}</span>
    </div>
  );
}

function QueueItem({ item }: { item: WorkflowQueueStatusItem }) {
  return (
    <article className={styles.queueItem}>
      <div className={styles.rowTop}>
        <div>
          <h3 className={styles.itemTitle}>{queueItemLabel(item)}</h3>
          <p className={styles.description}>{item.workflowRunId}</p>
        </div>
        <span className={toneClass(workflowQueueTone(item.state))}>{item.state}</span>
      </div>
      <dl className={styles.metaGrid}>
        <div>
          <dt>Attempt</dt>
          <dd>
            {item.attempt}
            {item.maxAttempts ? ` / ${item.maxAttempts}` : ""}
          </dd>
        </div>
        {item.taskId ? (
          <div>
            <dt>Task</dt>
            <dd>{item.taskId}</dd>
          </div>
        ) : null}
        {item.taskRunId ? (
          <div>
            <dt>Run</dt>
            <dd>
              <Link className={styles.inlineLink} to={`/tasks/runs/${encodeURIComponent(item.taskRunId)}`}>
                {item.taskRunId}
              </Link>
            </dd>
          </div>
        ) : null}
        {item.workerId ? (
          <div>
            <dt>Worker</dt>
            <dd>{item.workerId}</dd>
          </div>
        ) : null}
      </dl>
      {item.reason ? (
        <p className={styles.reason}>
          {reasonIcon(item.state)}
          {item.reason}
        </p>
      ) : null}
    </article>
  );
}

function toneClass(tone: "neutral" | "running" | "warning" | "danger" | "success"): string {
  if (tone === "running") {
    return styles.badgeRunning ?? "";
  }
  if (tone === "warning") {
    return styles.badgeWarning ?? "";
  }
  if (tone === "danger") {
    return styles.badgeDanger ?? "";
  }
  if (tone === "success") {
    return styles.badgeSuccess ?? "";
  }
  return styles.badgeMuted ?? "";
}

function reasonIcon(state: WorkflowQueueStatusItem["state"]) {
  if (state === "retryable") {
    return <RotateCcw size={14} />;
  }
  if (state === "stuck") {
    return <Timer size={14} />;
  }
  return <Clock3 size={14} />;
}
