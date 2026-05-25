<!-- AUDIENCE: Internal/Technical -->

# ADR 0013: Safety, Approval, and Loop Limit Model

## Status

Accepted.

## Context

The product should be human-directed without requiring approval for every small action. Risky actions need explicit approval, and stuck agents need hard limits so they do not burn tokens or thrash through tools indefinitely.

## Decision

Team Orchestrator uses risk-based approvals plus mandatory run limits.

Low-risk actions are allowed by default when they are within the assigned agent's manifest permissions and runtime boundaries. Approvals are required for risky actions.

Follow-up task creation does not require approval by default, but follow-up tasks start as proposed/pending and do not automatically run.

Loop and tool-call limits are mandatory safety controls for all agent runs.

## Risk Classes

Initial risk classes:

- `read-only`
- `local-write`
- `destructive-filesystem`
- `network-read`
- `network-write`
- `credential-access`
- `shell-command`
- `container-control`
- `schedule-create`
- `schedule-update`
- `plugin-install`

Risk classification can come from agent manifest permissions, runtime backend, task inputs, and detected actions.

Local writes are scoped. Writing to approved artifact/output directories can be allowed without approval. Writing to source/project files is governed by agent permissions and task type and may require approval.

Implementation commands for local-command agents are not automatically approval-required, because they are the declared implementation. Ad hoc shell/tool calls inside an agent are governed by permissions and risk classification.

## Approval Records

Approval records should include:

- requested action
- risk class
- requesting run and agent
- reason
- requested scope
- operator decision
- timestamp
- expiry or one-time-use semantics where appropriate

V1 approvals are per run and expire when the run ends. Scoped reusable approvals can be added later.

## Limits

Required limits:

- max runtime duration
- max tool calls
- max repeated identical actions
- max retries
- max follow-up tasks proposed per run

Suggested v1 defaults:

- `maxRuntimeSeconds: 900`
- `maxToolCalls: 80`
- `maxRepeatedActions: 3`
- `maxRetries: 2`
- `maxFollowUpTasks: 5`

Agent manifests may override these values within global maximums.

Optional limits:

- max token budget
- max output bytes
- max artifacts
- max network requests where backend can enforce it

## Stop Behavior

When a limit is reached, the run should stop with status `stopped-by-limit`. The run should preserve events, logs, partial artifacts, and a clear stop reason.

The stop event and run failure details should include the limit type and reason.

Repeated-action detection is mandatory where Team Orchestrator can observe tool/action calls. Black-box agents must still enforce outer limits such as runtime duration, cancellation, retries, and artifact/output boundaries.

## Consequences

The operator can trust that agents will stop when stuck.

Risky actions are explicit without making the normal manual task loop feel heavy.

## Open Questions

- What global maximums should bound per-agent limit overrides?
- Which source/project write operations should require approval by default?
- Which actions should be classified as `network-write` in the first implementation?
