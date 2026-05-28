import { ArrowLeft, Box, Clock3, FileText, RefreshCw, ShieldCheck, TerminalSquare } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import {
  classifyRunEvent,
  formatBytes,
  formatUnknown,
  formatVerificationFailureDetails,
  runStatusTone,
  verificationStatusLabel,
  verificationStatusTone,
  useTaskRunDetailQuery,
  type TaskWorkbenchRunEvent,
  type TaskWorkbenchRunStatus,
  type TaskWorkbenchVerificationStatus,
} from "../features/task-workbench";
import styles from "./TaskRunDetailPage.module.css";

function formatDate(value: string | undefined): string {
  if (!value) {
    return "not recorded";
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function statusClass(status: TaskWorkbenchRunStatus): string {
  const tone = runStatusTone(status);
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

function eventIcon(event: TaskWorkbenchRunEvent): JSX.Element {
  const kind = classifyRunEvent(event);
  if (kind === "log") {
    return <TerminalSquare size={16} />;
  }
  if (kind === "artifact") {
    return <Box size={16} />;
  }
  return <Clock3 size={16} />;
}

function eventClass(event: TaskWorkbenchRunEvent): string {
  const kind = classifyRunEvent(event);
  if (kind === "log") {
    return styles.eventLog ?? "";
  }
  if (kind === "artifact") {
    return styles.eventArtifact ?? "";
  }
  if (event.level === "error") {
    return styles.eventError ?? "";
  }
  return styles.eventLifecycle ?? "";
}

function verificationClass(status: TaskWorkbenchVerificationStatus | undefined): string {
  const tone = verificationStatusTone(status);
  if (tone === "success") {
    return styles.badgeSuccess ?? "";
  }
  if (tone === "danger") {
    return styles.badgeDanger ?? "";
  }
  return styles.badge ?? "";
}

export function TaskRunDetailPage() {
  const params = useParams<{ runId: string }>();
  const runId = params.runId;
  const runQuery = useTaskRunDetailQuery(runId);
  const detail = runQuery.data;

  return (
    <section className={styles.page}>
      <div className={styles.header}>
        <Link className={styles.backLink} to="/tasks">
          <ArrowLeft size={16} /> Tasks
        </Link>
        <button
          type="button"
          className={styles.iconButton}
          onClick={() => void runQuery.refetch()}
          disabled={runQuery.isFetching || !runId}
          aria-label="Refresh task run"
          title="Refresh task run"
        >
          <RefreshCw size={16} />
        </button>
      </div>

      {!runId ? (
        <div className={styles.state}>
          <p className={styles.stateTitle}>Run Not Selected</p>
          <p className={styles.description}>Open a task run by id to inspect its timeline and outputs.</p>
        </div>
      ) : null}

      {runQuery.isLoading ? (
        <div className={styles.state}>
          <p className={styles.stateTitle}>Loading Run</p>
          <p className={styles.description}>Reading run state, events, output, and artifact metadata.</p>
        </div>
      ) : null}

      {runQuery.error instanceof Error ? (
        <div className={styles.state}>
          <p className={styles.stateTitle}>Unable To Load Run</p>
          <p className={styles.errorText}>{runQuery.error.message}</p>
        </div>
      ) : null}

      {detail ? (
        <>
          <div className={styles.titleRow}>
            <div>
              <p className={styles.panelMeta}>Task Run</p>
              <h2 className={styles.title}>{detail.run.id}</h2>
              <p className={styles.description}>
                {detail.task?.title ?? detail.run.targetId}
              </p>
            </div>
            <span className={statusClass(detail.run.status)}>{detail.run.status}</span>
          </div>

          <div className={styles.summaryGrid}>
            <section className={styles.panel}>
              <p className={styles.panelTitle}>Run</p>
              <dl className={styles.kvList}>
                <div>
                  <dt>Task</dt>
                  <dd className={styles.mono}>{detail.run.targetId}</dd>
                </div>
                <div>
                  <dt>Agent</dt>
                  <dd>{detail.run.agentId ? `${detail.run.agentId}@${detail.run.agentVersion ?? "latest"}` : "not recorded"}</dd>
                </div>
                <div>
                  <dt>Backend</dt>
                  <dd>{detail.run.backend ?? "not recorded"}</dd>
                </div>
                <div>
                  <dt>Started</dt>
                  <dd>{formatDate(detail.run.startedAt)}</dd>
                </div>
                <div>
                  <dt>Ended</dt>
                  <dd>{formatDate(detail.run.endedAt)}</dd>
                </div>
              </dl>
            </section>

            <section className={styles.panel}>
              <p className={styles.panelTitle}>Task</p>
              {detail.task ? (
                <dl className={styles.kvList}>
                  <div>
                    <dt>Status</dt>
                    <dd>{detail.task.status}</dd>
                  </div>
                  <div>
                    <dt>Requirements</dt>
                    <dd>{detail.task.capabilityRequirements.length > 0 ? detail.task.capabilityRequirements.join(", ") : "none"}</dd>
                  </div>
                  <div>
                    <dt>Updated</dt>
                    <dd>{formatDate(detail.task.updatedAt)}</dd>
                  </div>
                </dl>
              ) : (
                <p className={styles.description}>Task metadata was not found for this run.</p>
              )}
            </section>
          </div>

          <section className={styles.panel}>
            <div className={styles.panelHeader}>
              <div>
                <p className={styles.panelTitle}>Verification</p>
                <p className={styles.panelMeta}>Policy evaluation</p>
              </div>
              <span className={verificationClass(detail.run.verificationStatus)}>
                <ShieldCheck size={14} />
                {verificationStatusLabel(detail.run.verificationStatus)}
              </span>
            </div>
            {detail.run.verificationStatus === "verification-failed" && detail.run.verificationFailures?.length ? (
              <div className={styles.verificationFailureList}>
                {detail.run.verificationFailures.map((failure) => (
                  <article key={`${failure.policyId}-${failure.message}`} className={styles.verificationFailure}>
                    <div className={styles.artifactHeader}>
                      <p className={styles.artifactTitle}>{failure.policyId}</p>
                      <span className={styles.badgeDanger}>{failure.kind}</span>
                    </div>
                    <p className={styles.eventMessage}>{failure.message}</p>
                    <pre className={styles.failureDetails}>{formatVerificationFailureDetails(failure)}</pre>
                  </article>
                ))}
              </div>
            ) : (
              <p className={styles.description}>
                {detail.run.verificationStatus === "passed"
                  ? "Required evidence policies passed for this run."
                  : "No verification result is recorded for this run."}
              </p>
            )}
          </section>

          {detail.run.failure !== undefined || detail.run.safetyStop !== undefined ? (
            <section className={styles.panel}>
              <div className={styles.panelHeader}>
                <div>
                  <p className={styles.panelTitle}>Terminal State</p>
                  <p className={styles.panelMeta}>Failure and safety detail</p>
                </div>
              </div>
              {detail.run.failure !== undefined ? <pre className={styles.codeBlock}>{formatUnknown(detail.run.failure)}</pre> : null}
              {detail.run.safetyStop !== undefined ? <pre className={styles.codeBlock}>{formatUnknown(detail.run.safetyStop)}</pre> : null}
            </section>
          ) : null}

          <div className={styles.detailGrid}>
            <section className={styles.panel}>
              <div className={styles.panelHeader}>
                <div>
                  <p className={styles.panelTitle}>Timeline</p>
                  <p className={styles.panelMeta}>{detail.events.length} events</p>
                </div>
              </div>
              {detail.events.length === 0 ? (
                <p className={styles.description}>No events recorded for this run.</p>
              ) : (
                <ol className={styles.timeline}>
                  {detail.events.map((event) => (
                    <li key={event.id} className={`${styles.eventItem} ${eventClass(event)}`}>
                      <span className={styles.eventIcon}>{eventIcon(event)}</span>
                      <div className={styles.eventBody}>
                        <div className={styles.eventHeader}>
                          <span className={styles.eventType}>{event.type}</span>
                          <span className={styles.eventTime}>{formatDate(event.timestamp)}</span>
                        </div>
                        {event.message ? <p className={styles.eventMessage}>{event.message}</p> : null}
                        {formatUnknown(event.payload) ? <pre className={styles.eventPayload}>{formatUnknown(event.payload)}</pre> : null}
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </section>

            <aside className={styles.sideStack}>
              <section className={styles.panel}>
                <div className={styles.panelHeader}>
                  <div>
                    <p className={styles.panelTitle}>Output</p>
                    <p className={styles.panelMeta}>Final result</p>
                  </div>
                  <FileText size={18} />
                </div>
                {detail.run.output !== undefined ? (
                  <pre className={styles.codeBlock}>{formatUnknown(detail.run.output)}</pre>
                ) : (
                  <p className={styles.description}>No final output recorded.</p>
                )}
              </section>

              <section className={styles.panel}>
                <div className={styles.panelHeader}>
                  <div>
                    <p className={styles.panelTitle}>Artifacts</p>
                    <p className={styles.panelMeta}>{detail.artifacts.length} recorded</p>
                  </div>
                </div>
                {detail.artifacts.length === 0 ? (
                  <p className={styles.description}>No artifact metadata recorded.</p>
                ) : (
                  <div className={styles.artifactList}>
                    {detail.artifacts.map((artifact) => (
                      <article key={artifact.id} className={styles.artifact}>
                        <div className={styles.artifactHeader}>
                          <p className={styles.artifactTitle}>{artifact.label}</p>
                          <span className={styles.badge}>{artifact.format}</span>
                        </div>
                        <p className={styles.mono}>{artifact.storageUri}</p>
                        <dl className={styles.compactKv}>
                          <div>
                            <dt>Kind</dt>
                            <dd>{artifact.kind}</dd>
                          </div>
                          <div>
                            <dt>Size</dt>
                            <dd>{formatBytes(artifact.sizeBytes)}</dd>
                          </div>
                          <div>
                            <dt>Hash</dt>
                            <dd>{artifact.hash ?? "not recorded"}</dd>
                          </div>
                        </dl>
                      </article>
                    ))}
                  </div>
                )}
              </section>
            </aside>
          </div>
        </>
      ) : null}
    </section>
  );
}
