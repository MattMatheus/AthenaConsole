---
kind: story
id: STORY-20260528-workflow-template-schedule-dag-execution
status: intake
owner_role: Software Engineer
source: epic
success_metric: Due workflow-template schedules execute through canonical workflow DAG runs and record terminal outcomes.
release_scope: required
ready: false
---

# Story: Run Scheduled Workflow Templates Through DAG Execution

## Metadata
- `id`: STORY-20260528-workflow-template-schedule-dag-execution
- `owner_role`: Software Engineer
- `status`: intake
- `source`: epic
- `decision_refs`: [ADR-0015, ADR-0014]
- `epic`: docs/product/epics/refinement/2026.17.00-epic-workflow-dag-engine.md
- `success_metric`: Due workflow-template schedules execute through canonical workflow DAG runs and record terminal outcomes.
- `release_scope`: required

## Problem Statement

Workflow-template schedules currently instantiate the mission/task projection and record a workflow DAG run id, but they do not yet drive canonical DAG execution or record DAG terminal outcomes.

## Scope

- In: schedule execution through DAG executor path, schedule history DAG run correlation, terminal status/error recording, backward-compatible responses, focused tests.
- Out: hosted scheduler changes, schedule UI redesign, parallel DAG execution policy.

## Acceptance Criteria

1. Due workflow-template schedules create a canonical workflow DAG run.
2. Scheduled workflow-template attempts execute through the DAG executor path.
3. Schedule history records workflow DAG run id, mission id, task ids, terminal status, and errors.
4. Failed DAG execution is reflected in schedule history and workflow status.
5. Existing schedule APIs and response fields remain backward compatible.
6. Non-workflow-template schedules are unchanged.

## Validation

- Required checks: `npm --workspace @athena/core run typecheck`; control-plane and API schedule tests; workflow-template and workflow-status tests.
- Additional checks: full `npm --workspace @athena/core run test:unit`.

## Dependencies

- Recommended after `STORY-20260528-workflow-dag-executor-service`.
- Benefits from `STORY-20260528-workflow-dag-restart-resume` if schedule retries/resume behavior is included.

## Risks

- Schedule attempts may become long-running once execution moves beyond instantiation; timeout and already-running behavior must stay clear.
- Terminal schedule status should not hide resumable workflow status.

## Next Step

PM refinement should decide whether this story requires restart/resume first or can run immediately after the executor service.

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
