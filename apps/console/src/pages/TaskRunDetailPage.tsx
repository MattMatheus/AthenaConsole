import { useState } from "react";
import { ArrowLeft, Box, BrainCircuit, Clock3, FileText, RefreshCw, ShieldCheck, TerminalSquare } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { Link, useParams } from "react-router-dom";
import {
  namespaceFromParts,
  useDurableMemoryPromotionMutation,
  type DurableMemoryNamespaceScope,
  type DurableMemorySensitivity,
} from "../features/durable-memory";
import {
  artifactPreviewState,
  classifyRunEvent,
  formatBytes,
  formatUnknown,
  formatVerificationFailureDetails,
  isProposedChangeArtifact,
  memoryRunSummary,
  modelProviderRunMetadata,
  modelRunOutput,
  proposedChangeArtifact,
  runStatusTone,
  verificationStatusLabel,
  verificationStatusTone,
  useTaskRunArtifactQuery,
  useTaskRunDetailQuery,
  type TaskWorkbenchArtifactRecord,
  type TaskWorkbenchRunEvent,
  type TaskWorkbenchRunStatus,
  type TaskWorkbenchArtifactMetadata,
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

function renderArtifactBody(artifact: TaskWorkbenchArtifactMetadata): JSX.Element {
  if (!isProposedChangeArtifact(artifact)) {
    return (
      <>
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
      </>
    );
  }

  const proposed = proposedChangeArtifact(artifact);
  return (
    <>
      <p className={styles.description}>{proposed.summary}</p>
      <p className={styles.errorText}>
        {proposed.applyAvailable ? "Apply action is unavailable in this console build." : "Apply action unavailable until approvals exist."}
      </p>
      <p className={styles.mono}>{artifact.storageUri}</p>
      {proposed.changes.length === 0 ? (
        <p className={styles.description}>No file-level diff metadata was recorded.</p>
      ) : (
        <div className={styles.diffList}>
          {proposed.changes.map((change) => (
            <article key={`${artifact.id}-${change.path}`} className={styles.diffItem}>
              <div className={styles.artifactHeader}>
                <p className={styles.artifactTitle}>{change.path}</p>
                <span className={styles.badgeWarning}>{change.changeType}</span>
              </div>
              {change.diff ? <pre className={styles.diffBlock}>{change.diff}</pre> : <p className={styles.description}>No diff text recorded.</p>}
            </article>
          ))}
        </div>
      )}
    </>
  );
}

function renderArtifactContent(artifact: TaskWorkbenchArtifactRecord): JSX.Element {
  if (artifact.content.kind === "json") {
    return <pre className={styles.codeBlock}>{formatUnknown(artifact.content.value)}</pre>;
  }
  if (artifact.format === "markdown" || artifact.content.mediaType === "text/markdown") {
    return (
      <div className={styles.markdownPreview}>
        <ReactMarkdown>{artifact.content.text}</ReactMarkdown>
      </div>
    );
  }
  return <pre className={artifact.format === "diff" ? styles.diffBlock : styles.codeBlock}>{artifact.content.text}</pre>;
}

function artifactPromotionBody(artifact: TaskWorkbenchArtifactRecord): string | undefined {
  if (artifact.content.kind === "text") {
    return artifact.content.text;
  }
  if (artifact.content.kind === "json") {
    return JSON.stringify(artifact.content.value, null, 2);
  }
  return undefined;
}

function artifactPromotionUnsupportedReason(artifact: TaskWorkbenchArtifactRecord): string | undefined {
  if (artifact.content.kind !== "text" && artifact.content.kind !== "json") {
    return "Only text-like artifact payloads can be promoted.";
  }
  if (artifact.format === "binary") {
    return "Binary artifacts cannot be promoted into durable memory.";
  }
  return undefined;
}

function ArtifactPreview({ artifactId, runId }: { artifactId: string; runId: string | undefined }): JSX.Element {
  const artifactQuery = useTaskRunArtifactQuery(runId, artifactId);

  if (artifactQuery.isLoading) {
    return <p className={styles.description}>Loading artifact content.</p>;
  }

  if (artifactQuery.error instanceof Error) {
    return <p className={styles.errorText}>{artifactQuery.error.message}</p>;
  }

  if (!artifactQuery.data) {
    return <p className={styles.description}>Artifact content is not available.</p>;
  }

  return (
    <div className={styles.artifactPreview}>
      <div className={styles.artifactPreviewHeader}>
        <p className={styles.panelMeta}>{artifactQuery.data.content.mediaType}</p>
        <span className={styles.badge}>{artifactQuery.data.content.kind}</span>
      </div>
      {renderArtifactContent(artifactQuery.data)}
      <ArtifactPromotionForm artifact={artifactQuery.data} runId={runId} />
    </div>
  );
}

function ArtifactPromotionForm({ artifact, runId }: { artifact: TaskWorkbenchArtifactRecord; runId: string | undefined }): JSX.Element {
  const [scope, setScope] = useState<DurableMemoryNamespaceScope>("run");
  const [namespaceId, setNamespaceId] = useState(runId ?? "run");
  const [memoryType, setMemoryType] = useState(artifact.format === "json" ? "artifact-json" : "artifact-note");
  const [sensitivity, setSensitivity] = useState<DurableMemorySensitivity>("internal");
  const [reason, setReason] = useState("");
  const body = artifactPromotionBody(artifact);
  const unsupportedReason = artifactPromotionUnsupportedReason(artifact);
  const namespace = namespaceFromParts(scope, namespaceId || "default");
  const promotionMutation = useDurableMemoryPromotionMutation(namespace);
  const requiresProposal = sensitivity === "sensitive" || sensitivity === "secret-adjacent";
  const canSubmit = Boolean(body && reason.trim() && memoryType.trim() && namespaceId.trim() && !unsupportedReason);

  return (
    <form
      className={styles.promotionForm}
      onSubmit={(event) => {
        event.preventDefault();
        if (!body || !canSubmit || !runId) {
          return;
        }
        const provenance = {
          sourceKind: "artifact" as const,
          actorType: "operator" as const,
          actorId: "console-operator",
          runId,
          artifactId: artifact.id,
          createdByAction: "artifact-promoted-to-memory",
          ...(artifact.taskId ? { taskId: artifact.taskId } : {}),
          ...(artifact.agentId ? { agentId: artifact.agentId } : {}),
        };
        if (requiresProposal) {
          promotionMutation.mutate({
            mode: "proposal",
            request: {
              targetNamespace: namespace,
              provenance,
              memoryType,
              proposedBody: body,
              reason,
            },
          });
          return;
        }
        promotionMutation.mutate({
          mode: "record",
          request: {
            namespace,
            provenance,
            memoryType,
            body,
            summary: artifact.label,
            sensitivity,
            reason,
          },
        });
      }}
    >
      <p className={styles.panelTitle}>Promote To Memory</p>
      {unsupportedReason ? <p className={styles.errorText}>{unsupportedReason}</p> : null}
      <div className={styles.promotionGrid}>
        <label>
          Namespace scope
          <select value={scope} onChange={(event) => setScope(event.target.value as DurableMemoryNamespaceScope)}>
            <option value="run">run</option>
            <option value="task">task</option>
            <option value="repository">repository</option>
            <option value="workspace">workspace</option>
          </select>
        </label>
        <label>
          Namespace id
          <input value={namespaceId} onChange={(event) => setNamespaceId(event.target.value)} />
        </label>
        <label>
          Memory type
          <input value={memoryType} onChange={(event) => setMemoryType(event.target.value)} />
        </label>
        <label>
          Sensitivity
          <select value={sensitivity} onChange={(event) => setSensitivity(event.target.value as DurableMemorySensitivity)}>
            <option value="public">public</option>
            <option value="internal">internal</option>
            <option value="sensitive">sensitive</option>
            <option value="secret-adjacent">secret-adjacent</option>
          </select>
        </label>
      </div>
      <label>
        Reason
        <input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Required before promotion" />
      </label>
      <p className={styles.description}>
        {requiresProposal ? "Sensitive promotions create a reviewed memory proposal." : "Public/internal promotions create a durable record."}
      </p>
      {promotionMutation.error ? <p className={styles.errorText}>{promotionMutation.error.message}</p> : null}
      {promotionMutation.isSuccess ? <p className={styles.description}>Promotion submitted.</p> : null}
      <button type="submit" className={styles.secondaryButton} disabled={!canSubmit || !runId || promotionMutation.isPending}>
        Promote
      </button>
    </form>
  );
}

export function TaskRunDetailPage() {
  const params = useParams<{ runId: string }>();
  const runId = params.runId;
  const [openArtifactId, setOpenArtifactId] = useState<string | undefined>();
  const runQuery = useTaskRunDetailQuery(runId);
  const detail = runQuery.data;
  const modelProvider = detail ? modelProviderRunMetadata(detail.events) : undefined;
  const modelOutput = detail ? modelRunOutput(detail.run.output) : undefined;
  const memorySummary = detail ? memoryRunSummary(detail.events) : undefined;

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

          {modelProvider || modelOutput ? (
            <section className={styles.panel}>
              <div className={styles.panelHeader}>
                <div>
                  <p className={styles.panelTitle}>Model Result</p>
                  <p className={styles.panelMeta}>Provider-backed output</p>
                </div>
                <BrainCircuit size={18} />
              </div>
              <div className={styles.modelResultGrid}>
                <div className={styles.modelResponse}>
                  <p className={styles.modelResponseTitle}>Response</p>
                  {modelOutput?.response ? (
                    <p className={styles.modelResponseText}>{modelOutput.response}</p>
                  ) : modelOutput?.responseMarkdown ? (
                    <pre className={styles.markdownBlock}>{modelOutput.responseMarkdown}</pre>
                  ) : (
                    <p className={styles.description}>No model response field was recorded.</p>
                  )}
                </div>
                <dl className={styles.compactKv}>
                  <div>
                    <dt>Provider</dt>
                    <dd>{modelOutput?.providerId ?? modelProvider?.providerId ?? "not recorded"}</dd>
                  </div>
                  <div>
                    <dt>Kind</dt>
                    <dd>{modelOutput?.providerKind ?? modelProvider?.providerKind ?? "not recorded"}</dd>
                  </div>
                  <div>
                    <dt>Model</dt>
                    <dd>{modelOutput?.model ?? modelProvider?.model ?? "not recorded"}</dd>
                  </div>
                  <div>
                    <dt>Base URL</dt>
                    <dd>{modelProvider?.baseUrl ?? "not recorded"}</dd>
                  </div>
                  <div>
                    <dt>Usage</dt>
                    <dd>{modelOutput?.usage !== undefined ? formatUnknown(modelOutput.usage) : "not recorded"}</dd>
                  </div>
                </dl>
              </div>
            </section>
          ) : null}

          <section className={styles.panel}>
            <div className={styles.panelHeader}>
              <div>
                <p className={styles.panelTitle}>Memory Evidence</p>
                <p className={styles.panelMeta}>Durable memory only</p>
              </div>
            </div>
            {!memorySummary ||
            (memorySummary.usedRecords.length === 0 &&
              memorySummary.proposals.length === 0 &&
              memorySummary.writes.length === 0 &&
              memorySummary.statuses.length === 0) ? (
              <p className={styles.description}>No durable-memory usage was recorded for this run.</p>
            ) : (
              <div className={styles.memoryEvidenceGrid}>
                <MemoryEvidenceList
                  title="Used records"
                  empty="No memory records influenced this run."
                  items={memorySummary.usedRecords.map((record) => `${record.id}${record.sensitivity ? ` / ${record.sensitivity}` : ""}`)}
                />
                <MemoryEvidenceList
                  title="Proposals"
                  empty="No memory proposals were created."
                  items={memorySummary.proposals.map((proposal) => `${proposal.id}${proposal.status ? ` / ${proposal.status}` : ""}`)}
                />
                <MemoryEvidenceList
                  title="Writes"
                  empty="No memory records were written."
                  items={memorySummary.writes.map((write) => `${write.id}${write.status ? ` / ${write.status}` : ""}`)}
                />
                <MemoryEvidenceList title="Namespaces" empty="No namespaces recorded." items={memorySummary.namespaces} />
                <MemoryEvidenceList title="Statuses" empty="No provider statuses recorded." items={memorySummary.statuses} />
                <MemoryEvidenceList title="Warnings" empty="No memory warnings recorded." items={memorySummary.warnings} warning />
              </div>
            )}
            <Link className={styles.secondaryButton} to="/memory">
              Open Memory Inspector
            </Link>
          </section>

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
                        {formatUnknown(event.payload) ? (
                          <details className={styles.payloadDetails}>
                            <summary>Payload</summary>
                            <pre className={styles.eventPayload}>{formatUnknown(event.payload)}</pre>
                          </details>
                        ) : null}
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
                {modelOutput ? (
                  <details className={styles.payloadDetails}>
                    <summary>Raw output</summary>
                    <pre className={styles.codeBlock}>{formatUnknown(detail.run.output)}</pre>
                  </details>
                ) : detail.run.output !== undefined ? (
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
                      <ArtifactCard
                        key={artifact.id}
                        artifact={artifact}
                        isOpen={openArtifactId === artifact.id}
                        runId={runId}
                        onToggle={() => setOpenArtifactId((current) => (current === artifact.id ? undefined : artifact.id))}
                      />
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

function MemoryEvidenceList(props: { title: string; empty: string; items: string[]; warning?: boolean }): JSX.Element {
  return (
    <div className={styles.memoryEvidenceList}>
      <p className={styles.panelMeta}>{props.title}</p>
      {props.items.length === 0 ? (
        <p className={styles.description}>{props.empty}</p>
      ) : (
        <ul>
          {props.items.map((item) => (
            <li key={item} className={props.warning ? styles.warningText : undefined}>
              {item}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ArtifactCard({
  artifact,
  isOpen,
  onToggle,
  runId,
}: {
  artifact: TaskWorkbenchArtifactMetadata;
  isOpen: boolean;
  onToggle: () => void;
  runId: string | undefined;
}): JSX.Element {
  const preview = artifactPreviewState(artifact);

  return (
    <article className={styles.artifact}>
      <div className={styles.artifactHeader}>
        <p className={styles.artifactTitle}>{artifact.label}</p>
        <div className={styles.artifactActions}>
          <span className={isProposedChangeArtifact(artifact) ? styles.badgeWarning : styles.badge}>
            {isProposedChangeArtifact(artifact) ? "proposed change" : artifact.format}
          </span>
          <span className={preview.status === "available" ? styles.badgeSuccess : preview.status === "blocked" ? styles.badgeDanger : styles.badge}>
            {preview.label}
          </span>
          <button
            type="button"
            className={styles.secondaryButton}
            onClick={onToggle}
            disabled={!preview.canOpen}
            title={preview.description}
          >
            {isOpen ? "Close" : "Open"}
          </button>
        </div>
      </div>
      <p className={styles.description}>{preview.description}</p>
      {renderArtifactBody(artifact)}
      {isOpen ? <ArtifactPreview artifactId={artifact.id} runId={runId} /> : null}
    </article>
  );
}
