<!-- AUDIENCE: Internal/Technical -->

# ADR 0015: Canonical Orchestration State Model

## Status

Accepted.

## Context

Team Orchestrator now has several durable and semi-durable state paths that describe overlapping orchestration concepts:

- SQLite app state for tasks, missions, runs, schedule history, workflow DAG runs, run events, and artifact metadata.
- File-backed control-plane state for sessions, directives, harness profiles, run templates, legacy workflow runs, work queues, and evidence payloads.
- Workflow-template instantiation that creates missions and tasks but does not yet create the workflow DAG run that the workflow status API expects.
- Schedule execution that can target workflow templates but does not yet have a single canonical execution envelope for scheduled workflow runs.

ADR 0009 defines tasks, missions, and runs. ADR 0010 makes SQLite the durable app-state target. ADR 0012 defines event and artifact observability. ADR 0014 defines schedules. This decision connects those records into one ownership model for orchestration state.

## Decision

SQLite app state is the canonical orchestration state store for Team Orchestrator.

Workflow DAG run state is the canonical execution envelope for workflow-template execution. Task and mission records remain first-class execution records, but when a workflow template is instantiated the workflow DAG run owns the workflow execution identity and attaches mission/task runs as execution details.

Mission and task runs remain canonical for direct mission and direct task execution. A workflow-template run may create a mission and tasks as the migration-compatible execution projection, but those records do not replace the workflow DAG run for workflow identity, status, recovery, or schedule history.

File-backed orchestration surfaces are legacy or non-orchestration support state unless this decision explicitly lists them as filesystem-owned payloads.

## State Ownership Map

| Domain | Canonical owner | Notes |
| --- | --- | --- |
| Workflow templates | SQLite app state | Template metadata, DAG definition, input schema, and activation status live in the workflow template catalog. Source/import files may remain filesystem inputs. |
| Workflow template runs | SQLite app state, `workflowDagRuns` | A template instantiation creates a workflow DAG run before or with the mission/task projection. The workflow DAG run id is the canonical workflow execution id. |
| Workflow DAG status | SQLite app state, `workflowDagRuns` | Status API reads DAG run state and step state. Mission/task run ids are linked execution details. |
| Missions | SQLite app state, `missions` | Canonical for direct mission planning and mission-level execution projection created from workflow templates. |
| Mission runs | SQLite app state, `runs` plus mission state | Canonical for direct mission execution attempts and the mission projection under workflow-template execution. |
| Tasks | SQLite app state, `tasks` | Canonical unit of work for humans, agents, and runtime backends. |
| Task runs | SQLite app state, `runs` | Canonical for direct task execution attempts and workflow step execution details. |
| Schedules | SQLite app state, `schedules` | Schedule definitions, target bindings, overlap policy, and enabled state live in SQLite. |
| Schedule history | SQLite app state, `scheduleRunHistory` | History records include schedule provenance plus the canonical run id for the target type. Workflow-template schedules record `workflowDagRunId`; task/mission schedules record task or mission run ids. |
| Run events | SQLite app state, `runEvents` | Canonical operator-visible event timeline for task, mission, and workflow execution. Workflow step events should attach to the workflow DAG run and related task/mission run where applicable. |
| Artifact metadata | SQLite app state, `artifacts` | Canonical index for artifact identity, provenance, type, and path. |
| Artifact payloads | Filesystem | Large/binary payload bytes remain filesystem-owned, addressed by artifact metadata. |
| Directives | File-backed legacy control-plane state | Migration-targeted unless later ADR scopes directives as durable app-state inputs. They are not canonical orchestration execution state. |
| Harness profiles | File-backed support state | Local runtime configuration, not app-state orchestration history. |
| Run templates | File-backed legacy control-plane state | Migration-targeted. New repeatable workflows should use SQLite workflow templates. |
| Legacy workflows | File-backed legacy control-plane state | Compatibility-only. New workflow execution should create workflow DAG runs in SQLite. |
| Sessions and transcripts | File-backed support state | Chat/runtime support state, not canonical Team Orchestrator task/mission/workflow state. |
| Plugin and agent source files | Filesystem | Source package files remain on disk. SQLite owns app-facing indexes and catalog metadata. |

## Workflow Instantiation Target

When a workflow template is instantiated, the system should:

1. Resolve the template from SQLite.
2. Create a `workflowDagRun` record with schedule/manual provenance, template version information, input values, and initial step states.
3. Create or link the migration-compatible mission and task projection.
4. Attach mission/task ids and task run ids back to workflow steps as execution details.
5. Expose the workflow DAG run id to APIs, schedule history, and the status graph.

Until the DAG executor owns all workflow execution directly, mission/task records are allowed as the execution projection. They must be correlated to the workflow DAG run rather than becoming a parallel source of truth.

## Stale Run Recovery Semantics

Startup reconciliation should recover task and mission runs left in `running` when no live in-process execution exists.

For the first implementation, because active task and mission execution state is process-local, every persisted `running` task or mission run found at API/service startup is treated as stale unless a future lease/heartbeat proves otherwise.

Recovery rules:

- Mark stale task and mission runs `failed`.
- Add recovery metadata with code `STALE_RUNNING_RUN`, recovery timestamp, and a message that the run was recovered after process startup.
- Update the owning task or mission out of `running` when the recovered run is its current active execution.
- Write an operator-visible warning event such as `run.recovered_stale`.
- Make the recovery idempotent; rerunning startup reconciliation must not duplicate terminal state changes or create conflicting events.
- Ensure `skip-if-running` schedule behavior is unblocked after recovery.
- If a recovered task/mission run is attached to a workflow DAG step, mark that step failed and leave the workflow DAG run `resumable`, matching the existing stale workflow-step recovery posture.

Future heartbeat leases may allow a long-running external process to prove liveness. That is out of scope for the first recovery implementation.

## First Implementation Sequence

1. Implement stale task and mission run recovery using the semantics above.
2. Create a workflow DAG run envelope during workflow-template instantiation and expose the workflow run id.
3. Update workflow-template schedule execution and schedule history to record `workflowDagRunId`.
4. Attach task/mission execution ids, events, and artifacts to workflow DAG steps for status inspection.
5. Add diagnostics or labels for legacy file-backed orchestration state so operators can distinguish compatibility paths from canonical state.

## Alternatives Considered

### Keep Workflow DAG Runs Separate From Mission/Task Execution

This preserves current behavior but keeps workflow status detached from ordinary workflow-template execution. It was rejected because it leaves two valid answers for workflow run identity.

### Treat Mission/Task Runs As Canonical And DAG As Visualization Only

This fits current mission-based execution but weakens restart-safe workflow resumption and visualizer-friendly status. It was rejected because the workflow DAG engine needs durable step ownership.

### Make Workflow DAG Runs Canonical And Attach Mission/Task Runs

This is the accepted path. It gives workflow templates one execution identity while preserving existing task and mission APIs during migration.

### Preserve File-Backed Workflow Execution As Another First-Class Path

This lowers migration pressure but makes future recovery, schedule history, and status APIs ambiguous. It was rejected for new execution; file-backed workflow state is legacy compatibility only.

## Consequences

Console APIs should prefer workflow DAG run ids for workflow-template execution and task/mission run ids for direct task or mission execution.

Schedule history must record target-specific canonical ids. Scheduled workflow-template runs should be inspectable through the workflow status API, not only through the mission/task projection.

The migration can be incremental. Existing mission/task execution remains useful, but new workflow-template behavior must not deepen file-backed workflow state or create another independent status model.

## Risks

- Compatibility: callers that expect workflow-template instantiation to return only missions/tasks will need additive response fields before any breaking change.
- Migration: legacy file-backed workflow state may remain visible for a while and must be labeled clearly.
- Recovery: startup-only stale recovery may fail a process that survived independently of the API process; heartbeat leases can address that later.
- Schedule behavior: schedules must consistently treat recovered stale runs as non-running.
- API shape: workflow and mission/task inspection routes need clear ids and cross-links so operators can move between graph status and execution details.
