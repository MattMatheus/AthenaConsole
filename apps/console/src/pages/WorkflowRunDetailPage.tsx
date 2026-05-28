import { ArrowLeft, Clock3, GitBranch, RefreshCw, RotateCw, TerminalSquare } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import {
  dependencyLabel,
  edgeSummary,
  formatWorkflowRunUnknown,
  formatWorkflowRunDate,
  readinessLabel,
  useWorkflowRunStatusQuery,
  workflowRunStatusTone,
  type WorkflowRunGraphEventLevel,
  type WorkflowRunGraphRunStatus,
  type WorkflowRunGraphStepStatus,
  type WorkflowRunStatusEvent,
  type WorkflowRunStatusNode,
} from "../features/workflow-runs";
import styles from "./WorkflowRunDetailPage.module.css";

function statusClass(status: WorkflowRunGraphRunStatus | WorkflowRunGraphStepStatus): string {
  const tone = workflowRunStatusTone(status);
  if (tone === "success") {
    return styles.badgeSuccess ?? "";
  }
  if (tone === "danger") {
    return styles.badgeDanger ?? "";
  }
  if (tone === "warning") {
    return styles.badgeWarning ?? "";
  }
  if (tone === "running") {
    return styles.badgeRunning ?? "";
  }
  return styles.badge ?? "";
}

function eventClass(level: WorkflowRunGraphEventLevel): string {
  if (level === "error") {
    return styles.eventError ?? "";
  }
  if (level === "warning") {
    return styles.eventWarning ?? "";
  }
  return styles.eventInfo ?? "";
}

function nodeSort(left: WorkflowRunStatusNode, right: WorkflowRunStatusNode): number {
  if (left.status === right.status) {
    return left.id.localeCompare(right.id);
  }
  const order: Record<WorkflowRunGraphStepStatus, number> = {
    running: 0,
    failed: 1,
    pending: 2,
    completed: 3,
    skipped: 4,
  };
  return order[left.status] - order[right.status];
}

export function WorkflowRunDetailPage() {
  const params = useParams<{ runId: string }>();
  const runId = params.runId;
  const statusQuery = useWorkflowRunStatusQuery(runId);
  const detail = statusQuery.data;
  const sortedNodes = detail ? [...detail.nodes].sort(nodeSort) : [];
  const recentEvents = detail ? detail.events.slice(0, 12) : [];
  const progressValue = detail ? Math.max(0, Math.min(100, detail.progress.percentComplete)) : 0;

  return (
    <section className={styles.page}>
      <div className={styles.header}>
        <Link className={styles.backLink} to="/workflows">
          <ArrowLeft size={16} /> Workflows
        </Link>
        <button
          type="button"
          className={styles.iconButton}
          onClick={() => void statusQuery.refetch()}
          disabled={statusQuery.isFetching || !runId}
          aria-label="Refresh workflow run"
          title="Refresh workflow run"
        >
          <RefreshCw size={16} />
        </button>
      </div>

      {!runId ? (
        <div className={styles.state}>
          <p className={styles.stateTitle}>Workflow Run Not Selected</p>
          <p className={styles.description}>Open a workflow DAG run by id to inspect graph status.</p>
        </div>
      ) : null}

      {statusQuery.isLoading ? (
        <div className={styles.state}>
          <p className={styles.stateTitle}>Loading Workflow Run</p>
          <p className={styles.description}>Reading DAG steps, dependency readiness, recovery state, and recent events.</p>
        </div>
      ) : null}

      {statusQuery.error instanceof Error ? (
        <div className={styles.state}>
          <p className={styles.stateTitle}>Unable To Load Workflow Run</p>
          <p className={styles.errorText}>{statusQuery.error.message}</p>
        </div>
      ) : null}

      {detail ? (
        <>
          <div className={styles.titleRow}>
            <div>
              <p className={styles.panelMeta}>Workflow DAG Run</p>
              <h2 className={styles.title}>{detail.run.id}</h2>
              <p className={styles.description}>
                {detail.run.workflowTemplate.id}
                {detail.run.workflowTemplate.version ? `@${detail.run.workflowTemplate.version}` : ""}
              </p>
            </div>
            <span className={statusClass(detail.run.status)}>{detail.run.status}</span>
          </div>

          <div className={styles.summaryGrid}>
            <section className={styles.panel}>
              <div className={styles.panelHeader}>
                <div>
                  <p className={styles.panelTitle}>Progress</p>
                  <p className={styles.panelMeta}>{detail.progress.totalSteps} steps</p>
                </div>
                <span className={styles.progressValue}>{progressValue}%</span>
              </div>
              <div className={styles.progressTrack} aria-label={`Workflow progress ${progressValue}%`}>
                <span style={{ width: `${progressValue}%` }} />
              </div>
              <div className={styles.metricGrid}>
                <Metric label="Completed" value={detail.progress.completedSteps} />
                <Metric label="Running" value={detail.progress.runningSteps} />
                <Metric label="Ready" value={detail.progress.readySteps} />
                <Metric label="Blocked" value={detail.progress.blockedSteps} />
                <Metric label="Failed" value={detail.progress.failedSteps} />
                <Metric label="Pending" value={detail.progress.pendingSteps} />
              </div>
            </section>

            <section className={styles.panel}>
              <div className={styles.panelHeader}>
                <div>
                  <p className={styles.panelTitle}>Run Metadata</p>
                  <p className={styles.panelMeta}>{detail.polling.etag || "no etag"}</p>
                </div>
                <Clock3 size={18} aria-hidden="true" />
              </div>
              <dl className={styles.kvList}>
                <div>
                  <dt>Started</dt>
                  <dd>{formatWorkflowRunDate(detail.run.startedAt)}</dd>
                </div>
                <div>
                  <dt>Finished</dt>
                  <dd>{formatWorkflowRunDate(detail.run.finishedAt)}</dd>
                </div>
                <div>
                  <dt>Updated</dt>
                  <dd>{formatWorkflowRunDate(detail.run.updatedAt)}</dd>
                </div>
                <div>
                  <dt>Polling</dt>
                  <dd>{detail.polling.recommendedIntervalMs} ms</dd>
                </div>
              </dl>
            </section>

            <section className={styles.panel}>
              <div className={styles.panelHeader}>
                <div>
                  <p className={styles.panelTitle}>Recovery</p>
                  <p className={styles.panelMeta}>{detail.recovery.resumable ? "resumable" : "not resumable"}</p>
                </div>
                <RotateCw size={18} aria-hidden="true" />
              </div>
              <dl className={styles.kvList}>
                <div>
                  <dt>Failed steps</dt>
                  <dd>{detail.recovery.failedStepIds.length > 0 ? detail.recovery.failedStepIds.join(", ") : "none"}</dd>
                </div>
                <div>
                  <dt>Recovered stale steps</dt>
                  <dd>{detail.recovery.staleRecoveredStepIds.length > 0 ? detail.recovery.staleRecoveredStepIds.join(", ") : "none"}</dd>
                </div>
              </dl>
            </section>
          </div>

          <section className={styles.panel}>
            <div className={styles.panelHeader}>
              <div>
                <p className={styles.panelTitle}>Dependency Summary</p>
                <p className={styles.panelMeta}>{detail.edges.length} edges</p>
              </div>
              <GitBranch size={18} aria-hidden="true" />
            </div>
            <p className={styles.edgeSummary}>{edgeSummary(detail.edges)}</p>
          </section>

          {detail.run.failure !== undefined ? (
            <section className={styles.panel}>
              <div className={styles.panelHeader}>
                <div>
                  <p className={styles.panelTitle}>Run Failure</p>
                  <p className={styles.panelMeta}>Terminal detail</p>
                </div>
              </div>
              <pre className={styles.codeBlock}>{formatWorkflowRunUnknown(detail.run.failure)}</pre>
            </section>
          ) : null}

          <div className={styles.detailGrid}>
            <section className={styles.panel}>
              <div className={styles.panelHeader}>
                <div>
                  <p className={styles.panelTitle}>Steps</p>
                  <p className={styles.panelMeta}>{sortedNodes.length} total</p>
                </div>
              </div>
              {sortedNodes.length === 0 ? (
                <p className={styles.description}>No steps are recorded for this workflow run.</p>
              ) : (
                <div className={styles.stepTable}>
                  <div className={styles.stepHeader}>
                    <span>Step</span>
                    <span>Readiness</span>
                    <span>Dependencies</span>
                    <span>Timing</span>
                  </div>
                  {sortedNodes.map((node) => (
                    <StepRow key={node.id} node={node} />
                  ))}
                </div>
              )}
            </section>

            <section className={styles.panel}>
              <div className={styles.panelHeader}>
                <div>
                  <p className={styles.panelTitle}>Recent Events</p>
                  <p className={styles.panelMeta}>{detail.events.length} recorded</p>
                </div>
              </div>
              {recentEvents.length === 0 ? (
                <p className={styles.description}>No workflow run events recorded.</p>
              ) : (
                <ul className={styles.timeline}>
                  {recentEvents.map((event) => (
                    <EventItem key={event.id} event={event} />
                  ))}
                </ul>
              )}
            </section>
          </div>
        </>
      ) : null}
    </section>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className={styles.metric}>
      <span className={styles.metricLabel}>{label}</span>
      <span className={styles.metricValue}>{value}</span>
    </div>
  );
}

function StepRow({ node }: { node: WorkflowRunStatusNode }) {
  return (
    <article className={styles.stepRow}>
      <div className={styles.stepIdentity}>
        <span className={statusClass(node.status)}>{node.status}</span>
        <div>
          <p className={styles.rowTitle}>{node.id}</p>
          <p className={styles.panelMeta}>attempt {node.attempt}</p>
        </div>
      </div>
      <div>
        <p className={styles.rowTitle}>{readinessLabel(node)}</p>
        {node.recovery?.resumable ? <p className={styles.warningText}>Recovery: {node.recovery.reason ?? "resumable"}</p> : null}
      </div>
      <div className={styles.badgeRow}>
        {node.dependencies.length === 0 ? <span className={styles.badge}>no dependencies</span> : null}
        {node.dependencies.map((dependency) => (
          <span key={dependency} className={styles.badge}>
            {dependency}
          </span>
        ))}
        {node.dependents.length > 0 ? <span className={styles.badgeMuted}>feeds {node.dependents.join(", ")}</span> : null}
      </div>
      <dl className={styles.compactKv}>
        <div>
          <dt>Started</dt>
          <dd>{formatWorkflowRunDate(node.timestamps.startedAt)}</dd>
        </div>
        <div>
          <dt>Finished</dt>
          <dd>{formatWorkflowRunDate(node.timestamps.finishedAt)}</dd>
        </div>
      </dl>
      {node.failure !== undefined || node.output !== undefined ? (
        <details className={styles.details}>
          <summary>{node.failure !== undefined ? "Failure" : "Output"}</summary>
          <pre className={styles.codeBlock}>{formatWorkflowRunUnknown(node.failure ?? node.output)}</pre>
        </details>
      ) : null}
      <span className={styles.srOnly}>{dependencyLabel(node)}</span>
    </article>
  );
}

function EventItem({ event }: { event: WorkflowRunStatusEvent }) {
  return (
    <li className={`${styles.eventItem} ${eventClass(event.level)}`}>
      <span className={styles.eventIcon}>
        <TerminalSquare size={16} />
      </span>
      <div className={styles.eventBody}>
        <div className={styles.eventHeader}>
          <span className={styles.eventType}>{event.type}</span>
          <span className={styles.eventTime}>{formatWorkflowRunDate(event.timestamp)}</span>
        </div>
        <p className={styles.eventMessage}>{event.message}</p>
        {event.stepId ? <p className={styles.panelMeta}>Step {event.stepId}</p> : null}
        {event.payload !== undefined ? <pre className={styles.eventPayload}>{formatWorkflowRunUnknown(event.payload)}</pre> : null}
      </div>
    </li>
  );
}
