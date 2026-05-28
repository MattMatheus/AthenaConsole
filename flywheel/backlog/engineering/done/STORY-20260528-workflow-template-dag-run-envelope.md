---
kind: story
id: STORY-20260528-workflow-template-dag-run-envelope
status: done
owner_role: Software Engineer
source: architecture
success_metric: Workflow-template instantiation and scheduled workflow-template execution create and expose a canonical workflow DAG run id.
release_scope: required
ready: true
---

# Story: Create Workflow DAG Run Envelope For Workflow Templates

## Metadata
- `id`: STORY-20260528-workflow-template-dag-run-envelope
- `owner_role`: Software Engineer
- `status`: done
- `source`: architecture
- `decision_refs`: [ADR-0015]
- `success_metric`: Workflow-template instantiation and scheduled workflow-template execution create and expose a canonical workflow DAG run id.
- `release_scope`: required

## Problem Statement

Workflow-template instantiation currently creates the mission/task projection but does not create the workflow DAG run that ADR 0015 names as the canonical workflow execution envelope. Scheduled workflow-template execution therefore lacks one durable workflow run id for status, history, recovery, and inspection.

## Scope

- In: workflow-template instantiation DAG run creation, additive API/service response fields, schedule history correlation for workflow-template targets, focused tests.
- Out: replacing mission/task execution with a full DAG executor, starting/completing workflow DAG steps, migrating legacy file-backed workflow state, broad console redesign.

## Acceptance Criteria

1. Instantiating a workflow template creates a `workflowDagRun` record before or with the mission/task projection.
2. The instantiation result exposes the workflow DAG run id without removing existing mission/task response data.
3. Workflow-template schedule execution records `workflowDagRunId` in schedule history.
4. Workflow status APIs can inspect a real instantiated workflow-template run using the canonical workflow DAG run id.
5. Mission/task ids created during instantiation are linked to the workflow DAG run or steps as execution details.
6. Existing manual workflow-template instantiation behavior remains backward compatible.
7. The DAG run is created after template availability, input, and DAG validation pass, and before mission/task projection is returned.

## Validation

- Required checks: focused workflow-template catalog, workflow-state, workflow-status, and schedule service tests; `npm --workspace @athena/core run typecheck`.
- Additional checks: console/API route regression tests if response DTOs change.

## Dependencies

- ADR 0015 is accepted.
- Should run after stale task/mission recovery unless engineering decides the envelope is needed first for a narrower implementation path.

## Risks

- Response DTOs may accidentally become breaking if existing mission/task fields are renamed or removed.
- Schedule history may need additive schema or serialization changes.
- DAG run creation must remain idempotent around retries and failed instantiation.

## Open Questions

- Resolved: create the workflow DAG run after template availability, input, and DAG validation pass, then create the existing mission/task projection.
- Resolved: the existing `GET /api/v1/workflow-runs/:runId/status` endpoint is the primary console entry point for the returned workflow DAG run id.

## Next Step

Engineering should implement the additive envelope slice without replacing the executor or changing existing mission/task response fields.

## Engineering Handoff
- `change_summary`: Added a durable workflow DAG run envelope to workflow-template instantiation, exposed the additive `workflowDagRun.id` field in service/API responses, linked mission context and task provenance to the DAG run/step ids, and persisted `workflowDagRunId` through workflow-template schedule execution/history.
- `validation_evidence`: `npm --workspace @athena/core run typecheck`; `npm --workspace @athena/core run test:unit -- tests/control-plane.workflow-template-instantiation.test.ts tests/control-plane.workflow-state.test.ts tests/control-plane.workflow-status.test.ts tests/control-plane.task-schedules.test.ts tests/api.workflow-template-catalog.test.ts tests/api.task-schedules.test.ts tests/schema-generation.test.ts`; `npm --workspace @athena/core run test:unit`.
- `qa_focus`: Verify backward compatibility of existing mission/task instantiation fields, API response validation for the additive workflow DAG run field, schedule run history persistence of `workflowDagRunId`, and workflow status inspection through `GET /api/v1/workflow-runs/:runId/status`.
- `open_risks`: The executor still does not start/complete workflow DAG steps; this story intentionally creates the canonical envelope only.

## QA Verdict
- `verdict`: Pass
- `evidence_quality`: Strong. Focused tests cover workflow-template instantiation, workflow DAG state/status inspection, workflow-template schedules, API route responses, and schema freshness; full core unit suite also passed.
- `defects`: None found.
- `state_transition`: Move to done.

## Transition History
- `2026-05-28T17:41:55Z`: `intake` -> `active`; PM refined as next required DAG envelope implementation
- `2026-05-28T17:46:09Z`: `active` -> `qa`; Engineering handoff ready with implementation and validation evidence
- `2026-05-28T17:46:33Z`: `qa` -> `done`; QA pass; acceptance criteria and regression checks satisfied
