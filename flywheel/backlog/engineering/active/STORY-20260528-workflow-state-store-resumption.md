---
kind: story
id: STORY-20260528-workflow-state-store-resumption
status: active
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
- `status`: active
- `source`: pm
- `decision_refs`: [ADR-0009, ADR-0011, ADR-0012, EPIC-2026.17]
- `success_metric`: Durable workflow run state can be created, loaded, updated, and resumed without changing current mission/template behavior.
- `release_scope`: required

## Status

Active.

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

- `change_summary`:
- `validation_evidence`:
- `qa_focus`:
- `open_risks`:

## QA Verdict

- `verdict`:
- `evidence_quality`:
- `defects`:
- `state_transition`:
