---
kind: story
id: STORY-20260528-workflow-template-dag-run-envelope
status: intake
owner_role: Software Engineer
source: architecture
success_metric: Workflow-template instantiation and scheduled workflow-template execution create and expose a canonical workflow DAG run id.
release_scope: required
ready: false
---

# Story: Create Workflow DAG Run Envelope For Workflow Templates

## Metadata
- `id`: STORY-20260528-workflow-template-dag-run-envelope
- `owner_role`: Software Engineer
- `status`: intake
- `source`: architecture
- `decision_refs`: [ADR-0015]
- `success_metric`: Workflow-template instantiation and scheduled workflow-template execution create and expose a canonical workflow DAG run id.
- `release_scope`: required

## Problem Statement

Workflow-template instantiation currently creates the mission/task projection but does not create the workflow DAG run that ADR 0015 names as the canonical workflow execution envelope. Scheduled workflow-template execution therefore lacks one durable workflow run id for status, history, recovery, and inspection.

## Scope

- In: workflow-template instantiation DAG run creation, additive API/service response fields, schedule history correlation for workflow-template targets, focused tests.
- Out: replacing mission/task execution with a full DAG executor, migrating legacy file-backed workflow state, broad console redesign.

## Acceptance Criteria

1. Instantiating a workflow template creates a `workflowDagRun` record before or with the mission/task projection.
2. The instantiation result exposes the workflow DAG run id without removing existing mission/task response data.
3. Workflow-template schedule execution records `workflowDagRunId` in schedule history.
4. Workflow status APIs can inspect a real instantiated workflow-template run using the canonical workflow DAG run id.
5. Mission/task ids created during instantiation are linked to the workflow DAG run or steps as execution details.
6. Existing manual workflow-template instantiation behavior remains backward compatible.

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

- Should the workflow DAG run be created before mission/task projection or immediately after template input validation?
- Which status endpoint should be the primary console entry point for the returned workflow DAG run id?

## Next Step

PM refinement should split this into the smallest implementation slice that creates the canonical envelope without replacing the executor.

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
