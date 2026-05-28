---
kind: story
id: STORY-20260528-workflow-state-store-resumption
status: done
owner_role: Software Architect
source: pm
success_metric: Durable workflow run state can be created, loaded, updated, and resumed without changing current mission/template behavior.
release_scope: required
ready: true
---

# Story: Implement Workflow State Store and Resumption Logic

## Metadata
- `id`: STORY-20260528-workflow-state-store-resumption
- `owner_role`: Software Architect
- `status`: done
- `source`: pm
- `decision_refs`: [ADR-0009, ADR-0011, ADR-0012, EPIC-2026.17]
- `success_metric`: Durable workflow run state can be created, loaded, updated, and resumed without changing current mission/template behavior.
- `release_scope`: required

## Status

Done.

## Source Decisions

- `docs/product/architecture/decisions/0009-task-mission-run-domain-model.md`
- `docs/product/architecture/decisions/0011-runtime-backend-interface.md`
- `docs/product/architecture/decisions/0012-event-artifact-observability-model.md`
- `docs/product/direction/current-direction.md`
- `docs/product/epics/refinement/2026.17.00-epic-workflow-dag-engine.md`
- `docs/product/history/completed-stories/2026.14.03-run-sequential-mission-plans.md`
- `docs/product/history/completed-stories/2026.17.01-implement-workflow-dag-definition-parser.md`

## User Story

As an operator, I need durable workflow run state so a multi-step workflow can survive process restarts and resume from the correct ready or failed step.

## Scope

Add the first durable workflow-run state model for DAG-capable workflow execution. Use the parsed workflow-template DAG output as the foundation for step status, dependency readiness, and resumable execution state.

## Acceptance Criteria

- Adds durable app-state workflow run/state records for workflow DAG executions.
- Records workflow run status, current step states, attempts, timestamps, dependency readiness, and failure details.
- Provides service-level helpers to create, load, update, and resume workflow run state without requiring UI changes.
- Recovers stale running steps after restart into an actionable resumable or failed state.
- Emits or records enough event/state detail for future visualizer-friendly status APIs.
- Preserves existing mission run behavior and current workflow-template instantiation behavior.

## Non-Goals

- No parallel executor yet unless it falls out naturally from readiness calculation.
- No workflow status visualization UI.
- No hosted scheduler changes.
- No automatic retry policy beyond recording attempts and resumable state.

## Validation Expectations

- `npm --workspace @athena/core run typecheck`
- Focused app-state repository and workflow state service tests.
- Existing mission/workflow-template instantiation tests still pass.
- `git diff --check`

## Engineering Handoff

- `change_summary`: Added SQLite app-state tables and repository access for durable workflow DAG runs, steps, and events. Added `LocalWorkflowStateService` helpers to create runs from parsed workflow-template DAG tasks, load snapshots, start/complete/fail steps, recompute dependency readiness, recover stale running steps into resumable state, and prepare resume from the first failed step. Updated app-state database wiring and migration tests.
- `validation_evidence`: Pass: `npm --workspace @athena/core exec vitest run tests/control-plane.workflow-state.test.ts`. Pass: `npm --workspace @athena/core exec vitest run tests/control-plane.workflow-template-instantiation.test.ts tests/control-plane.workflow-template-dag.test.ts tests/control-plane.domain-repositories.test.ts`. Pass: `npm --workspace @athena/core run typecheck`. Pass: `npm --workspace @athena/core run validate:manifests`. Pass: `npm --workspace @athena/core run test:unit` (82 files, 386 tests). Pass: `git diff --check`.
- `qa_focus`: Verify migration 6 creates durable workflow DAG run/step/event tables and remains idempotent. Verify readiness calculations for dependency chains, failure/resume behavior, attempt preservation, and stale running step recovery after reopening the SQLite database. Confirm existing workflow-template instantiation and mission/run repository behavior remain unchanged.
- `open_risks`: This introduces service-level workflow state only; it is intentionally not wired into a public HTTP route, scheduler execution path, or UI yet. Future executor/status API stories should decide how this service becomes the canonical runtime entry point.

## QA Verdict

- `verdict`: Pass. Acceptance criteria are satisfied for a service-level durable workflow DAG state slice.
- `evidence_quality`: Strong. QA reran focused workflow-state tests, affected app-state/workflow-template regression tests, typecheck, manifest validation, `git diff --check`, and the full unit suite. One full-suite attempt hit an unrelated `tests/runtime.lock.test.ts` temp-file race; the failed test passed in isolation and the full suite passed on retry.
- `defects`: None filed.
- `state_transition`: Move `qa` -> `done`.

## Transition History
- `2026-05-28T02:41:28Z`: `active` -> `qa`; engineering handoff ready
- `2026-05-28T02:42:47Z`: `qa` -> `done`; QA passed
