---
kind: story
id: STORY-20260528-stale-run-recovery
status: done
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
- `status`: done
- `source`: planning
- `decision_refs`: [ADR-0009, ADR-0010, ADR-0012, ADR-0015]
- `success_metric`: Stale `running` task and mission runs are reconciled on startup with operator-visible recovery events.
- `release_scope`: required

## Problem Statement
Task and mission runs can persist as `running` if the API process dies mid-run. Active cancellation state is in memory, and there is no startup reconciliation equivalent to workflow DAG stale-step recovery.

## Scope
- In: task run stale detection, mission run stale detection, startup reconciliation, recovery events, schedule behavior for recovered targets.
- Out: broad workflow DAG state migration unless required by the canonical state decision.

## Recovery Semantics
- Consume ADR 0015 as the canonical state decision for this story.
- On API/service startup, persisted task and mission runs still marked `running` should be treated as stale because active task/mission execution state is process-local.
- First-pass recovery marks stale task and mission runs `failed` with recovery metadata code `STALE_RUNNING_RUN`, a recovery timestamp, and an explicit after-startup recovery message.
- Recovery updates the owning task or mission out of `running` when the recovered run is its current active execution.
- Recovery writes an operator-visible warning event such as `run.recovered_stale`.
- Recovery must be idempotent and must not duplicate terminal state changes or create conflicting events if reconciliation runs more than once.
- `skip-if-running` schedules must treat recovered stale runs as non-running so future due executions are not permanently blocked.
- If a recovered task/mission run is attached to a workflow DAG step, mark that step failed and leave the workflow DAG run `resumable`.

## Acceptance Criteria
1. API/service startup reconciles task runs left `running` from a previous process to `failed` with timestamped recovery metadata and code `STALE_RUNNING_RUN`.
2. API/service startup reconciles mission runs left `running` from a previous process to `failed` with timestamped recovery metadata and code `STALE_RUNNING_RUN`.
3. Recovery writes events or history entries visible through existing inspection surfaces.
4. Schedules and future manual runs are not permanently blocked by recovered stale task or mission runs.
5. The recovery path is idempotent when startup reconciliation runs more than once.

## Validation
- Required checks: focused app-state/service unit tests, schedule regression test, `npm --workspace @athena/core run typecheck`.
- Additional checks: full `npm --workspace @athena/core run test:unit` if service wiring changes broadly.

## Dependencies
- Queue after `ARCH-20260528-canonical-orchestration-state-model`; use ADR 0015 as implementation guidance.

## Risks
- Incorrect recovery could mark a still-running external process as failed.
- Retry/pause semantics may affect schedule reliability.

## Open Questions
- Should long-running external processes eventually gain heartbeat leases instead of startup-only stale reconciliation?
- What event type string should be standardized if existing run event conventions suggest a better name than `run.recovered_stale`?

## Next Step
Continue with the next active backlog item.

## Engineering Handoff
- `change_summary`: Added startup recovery for stale SQLite task and mission runs through `recoverStaleTaskAndMissionRuns`, wired it into `createLocalControlPlaneServices`, and covered task, mission, idempotence, startup, and schedule-regression behavior in focused tests.
- `validation_evidence`: `npm --workspace @athena/core run test:unit -- tests/control-plane.stale-run-recovery.test.ts`; `npm --workspace @athena/core run typecheck`; `npm --workspace @athena/core run test:unit`.
- `qa_focus`: Confirm stale `running` task and mission runs become failed with `STALE_RUNNING_RUN` metadata, warning events are visible through run event history, repeated recovery does not duplicate events, and schedules are not treated as already running after startup recovery.
- `open_risks`: Startup-only recovery can still fail a genuinely live external process if it survives the API process; ADR 0015 leaves heartbeat leases as future work. Current workflow DAG state does not yet link task/mission run ids to DAG steps, so DAG-step resumability remains part of the workflow-template DAG run envelope follow-up.

## QA Verdict
- `verdict`: Pass.
- `evidence_quality`: Focused recovery tests cover task and mission stale-run failure, `STALE_RUNNING_RUN` metadata, warning events, startup wiring, schedule behavior after recovery, and idempotence. Full core unit suite and typecheck passed.
- `defects`: None found.
- `state_transition`: Ready for engineering done.

## Transition History
- `2026-05-28T16:23:39Z`: `intake` -> `active` by `Codex`; PM refined and queued after canonical state decision
- `2026-05-28T16:58:21Z`: `active` -> `qa` by `Codex`; Engineering handoff complete
- `2026-05-28T16:58:57Z`: `qa` -> `done` by `Codex`; QA passed
