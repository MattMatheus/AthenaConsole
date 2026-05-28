---
kind: story
id: STORY-20260528-stale-run-recovery
status: active
owner_role: Software Engineer
source: planning
success_metric: Stale `running` task and mission runs are reconciled on startup with operator-visible recovery events.
release_scope: required
ready: true
---

# Story: Recover Stale Running Task And Mission Runs

## Metadata
- `id`: STORY-20260528-stale-run-recovery
- `owner_role`: Software Engineer
- `status`: active
- `source`: planning
- `decision_refs`: [ADR-0009, ADR-0010, ADR-0012]
- `success_metric`: Stale `running` task and mission runs are reconciled on startup with operator-visible recovery events.
- `release_scope`: required

## Problem Statement
Task and mission runs can persist as `running` if the API process dies mid-run. Active cancellation state is in memory, and there is no startup reconciliation equivalent to workflow DAG stale-step recovery.

## Scope
- In: task run stale detection, mission run stale detection, startup reconciliation, recovery events, schedule behavior for recovered targets.
- Out: broad workflow DAG state migration unless required by the canonical state decision.

## Assumptions
- First pass should mark stale task/mission runs as `failed` with explicit recovery metadata/event text unless the canonical state architecture item specifies a better existing status before implementation starts.
- Operator-visible events are required so state changes are explainable.

## Acceptance Criteria
1. API/service startup reconciles task runs left `running` from a previous process into a non-running terminal or recovery state with timestamped recovery metadata.
2. API/service startup reconciles mission runs left `running` from a previous process into a non-running terminal or recovery state with timestamped recovery metadata.
3. Recovery writes events or history entries visible through existing inspection surfaces.
4. Schedules and future manual runs are not permanently blocked by recovered stale task or mission runs.
5. The recovery path is idempotent when startup reconciliation runs more than once.

## Validation
- Required checks: focused app-state/service unit tests, schedule regression test, `npm --workspace @athena/core run typecheck`.
- Additional checks: full `npm --workspace @athena/core run test:unit` if service wiring changes broadly.

## Dependencies
- Queue after `ARCH-20260528-canonical-orchestration-state-model` if that architecture item is still open; otherwise use its decision record as implementation guidance.

## Risks
- Incorrect recovery could mark a still-running external process as failed.
- Retry/pause semantics may affect schedule reliability.

## Open Questions
- Should long-running external processes eventually gain heartbeat leases instead of startup-only stale reconciliation?

## Next Step
Promote to engineering active after the production auth bug and canonical orchestration state architecture decision.

## Engineering Handoff
- `change_summary`:
- `validation_evidence`:
- `qa_focus`:
- `open_risks`:

## QA Verdict
- `verdict`:
- `evidence_quality`:
- `defects`:
- `state_transition`:

## Transition History
- `2026-05-28T16:23:39Z`: `intake` -> `active` by `Codex`; PM refined and queued after canonical state decision
