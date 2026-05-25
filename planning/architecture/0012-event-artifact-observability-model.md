<!-- AUDIENCE: Internal/Technical -->

# ADR 0012: Event and Artifact Observability Model

## Status

Accepted.

## Context

Team Orchestrator's value depends on inspectability. The operator should understand what ran, which agent ran it, what happened internally when available, what outputs were produced, and why a run failed, stopped, or requested approval.

The model must support both black-box agents and inspectable framework-backed agents.

## Decision

Every run has a structured event timeline and artifact index.

Events describe what happened. Artifacts hold outputs and evidence.

Events are the canonical run timeline. Run inspection pages should render primarily from events plus artifact metadata.

## Event Model

Events should include:

- `id`
- `runId`
- optional `taskId`
- optional `missionId`
- optional `agentId`
- `type`
- `level`
- `timestamp`
- `message`
- structured `payload`
- optional parent/trace fields

Core event types:

- `run.started`
- `run.validated`
- `run.log`
- `run.completed`
- `run.failed`
- `run.cancel.requested`
- `run.cancelled`
- `run.stopped_by_limit`
- `agent.step.started`
- `agent.step.completed`
- `agent.tool_call.started`
- `agent.tool_call.completed`
- `artifact.created`
- `approval.requested`
- `approval.resolved`
- `followup.proposed`

Severity levels:

- `debug`
- `info`
- `warning`
- `error`

`runId` is required on every event. `taskId`, `missionId`, `agentId`, `parentEventId`, and `traceId` are optional correlation fields when available.

The common event envelope should be stable. Event `payload` remains flexible in v1. Strict payload schemas can be added first for high-value event types such as approvals, tool calls, artifacts, and follow-up tasks.

The event model must be compatible with live streaming to the console. The first implementation may poll SQLite, but the shape should not block SSE or WebSocket transport later.

## Artifact Model

Artifact metadata should include:

- `id`
- `runId`
- optional `taskId`
- optional `agentId`
- `label`
- `kind`
- `format`
- storage location
- size/hash when available
- creation timestamp
- optional schema validation result

Artifacts may be text, markdown, JSON, image, binary, patch, log, or domain-specific outputs.

V1 artifact formats:

- `text`
- `markdown`
- `json`
- `image`
- `binary`
- `patch`
- `log`
- `directory`

Artifact metadata is stored in SQLite. Artifact payloads live on the filesystem by default.

Important log lines and status updates should be emitted as `run.log` events. Full raw logs may be stored as log artifacts/files.

## Black-Box vs Inspectable Agents

Black-box agents must emit outer lifecycle events and artifacts.

Inspectable agents should additionally emit internal steps, graph transitions, tool calls, intermediate artifacts, and framework-level state when available.

Tool calls are first-class events for inspectable agents.

## Storage

SQLite stores event and artifact metadata. Large artifact payloads may live on disk.

The UI should render a timeline, logs, artifacts, final output, safety stops, and approval records from this model.

## Consequences

The product can debug local commands, containers, API agents, LangGraph wrappers, and native DAGs through one run inspection surface.

Evidence and verification work can be reframed as artifact and output validation.

## Retention

Run events and artifacts are retained until the associated task, mission, or run is archived or deleted. Automated retention policies are deferred.

## Open Questions

- Which high-value event payload schemas should become strict first?
- Should event streaming use SSE or WebSocket first?
- How should artifact payload directories be organized on disk?
