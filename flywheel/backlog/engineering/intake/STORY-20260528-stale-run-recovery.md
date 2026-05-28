---
kind: story
id: STORY-20260528-stale-run-recovery
status: intake
owner_role: Software Engineer
source: planning
success_metric: Stale `running` task and mission runs are reconciled on startup with operator-visible recovery events.
release_scope: required
ready: false
---

# Story: Recover Stale Running Task And Mission Runs

## Metadata
- `id`: STORY-20260528-stale-run-recovery
- `owner_role`: Software Engineer
- `status`: intake
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
- Recovery can initially mark stale runs failed or recoverable, but the exact status semantics need PM/architecture confirmation.
- Operator-visible events are required so state changes are explainable.

## Acceptance Criteria
1. Task runs left `running` across process restart are reconciled on startup.
2. Mission runs left `running` across process restart are reconciled on startup.
3. Recovery writes events or history entries visible through existing inspection surfaces.
4. Schedules do not remain permanently blocked by stale targets.

## Validation
- Required checks: focused app-state/service unit tests, schedule regression test, `npm --workspace @athena/core run typecheck`.
- Additional checks: full `npm --workspace @athena/core run test:unit` if service wiring changes broadly.

## Dependencies
- May depend on `ARCH-20260528-canonical-orchestration-state-model` for final status semantics.

## Risks
- Incorrect recovery could mark a still-running external process as failed.
- Retry/pause semantics may affect schedule reliability.

## Open Questions
- Should stale runs become `failed`, `cancelled`, `recovered`, or `resumable`?
- What timeout or heartbeat qualifies a run as stale?

## Next Step
PM refinement should clarify recovery status semantics and whether this waits for the canonical state architecture item.

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
