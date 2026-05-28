---
kind: story
id: STORY-20260528-workflow-template-schedule-dag-execution
status: done
owner_role: Software Engineer
source: epic
success_metric: Due workflow-template schedules execute through canonical workflow DAG runs and record terminal outcomes.
release_scope: required
ready: true
---

# Story: Run Scheduled Workflow Templates Through DAG Execution

## Metadata
- `id`: STORY-20260528-workflow-template-schedule-dag-execution
- `owner_role`: Software Engineer
- `status`: done
- `source`: epic
- `decision_refs`: [ADR-0015, ADR-0014]
- `epic`: docs/product/epics/refinement/2026.17.00-epic-workflow-dag-engine.md
- `success_metric`: Due workflow-template schedules execute through canonical workflow DAG runs and record terminal outcomes.
- `release_scope`: required

## Problem Statement

Workflow-template schedules currently instantiate the mission/task projection and record a workflow DAG run id, but they do not yet drive canonical DAG execution or record DAG terminal outcomes.

## Scope

- In: run due workflow-template schedules through `LocalWorkflowDagExecutorService` after instantiation; preserve workflow DAG run, mission, and task history correlation; record schedule terminal status/reason/error from DAG execution outcome; backward-compatible schedule responses; focused control-plane/API schedule tests.
- Out: hosted scheduler changes, schedule UI redesign, parallel DAG execution policy, schedule resume/retry policy changes, non-workflow-template schedule behavior changes.

## Acceptance Criteria

1. Due workflow-template schedules create a canonical workflow DAG run.
2. Scheduled workflow-template attempts execute through the DAG executor path.
3. Schedule history records workflow DAG run id, mission id, task ids, terminal status, and errors.
4. Failed DAG execution is reflected in schedule history and workflow status.
5. Existing schedule APIs and response fields remain backward compatible.
6. Non-workflow-template schedules are unchanged.
7. The first implementation executes the freshly instantiated canonical DAG run synchronously through the service-only executor.
8. Resumable/retry policy design remains follow-on; this story records failed DAG outcomes without hiding workflow status.

## Validation

- Required checks: `npm --workspace @athena/core run typecheck`; control-plane and API schedule tests; workflow-template and workflow-status tests.
- Additional checks: full `npm --workspace @athena/core run test:unit`.

## Dependencies

- `STORY-20260528-workflow-dag-executor-service` is done.
- `STORY-20260528-workflow-dag-restart-resume` is done.

## Risks

- Schedule attempts may become long-running once execution moves beyond instantiation; timeout and already-running behavior must stay clear.
- Terminal schedule status should not hide resumable workflow status.
- Synchronous DAG execution can lengthen schedule tick latency; keep this story focused on service behavior and test coverage.

## Open Questions

- Resolved: this story can run now because executor and restart/resume foundations are done.
- Resolved: due workflow-template schedules should execute the freshly instantiated DAG run synchronously through the service-only executor.
- Resolved: richer retry/resume policy remains later; record failed DAG status and preserve workflow DAG run correlation.

## Next Step

Engineering should wire workflow-template schedule attempts through the canonical DAG executor while preserving schedule response compatibility.

## Engineering Handoff
- `change_summary`: Workflow-template schedules now instantiate the canonical DAG run and execute it synchronously through `LocalWorkflowDagExecutorService`. Schedule run results and history still include workflow DAG run id, mission id, and task ids, and now record terminal DAG success/failure via schedule status, reason, and failure policy metadata. Added coverage for successful scheduled DAG completion, failed scheduled DAG execution, API tick behavior, and workflow status correlation.
- `validation_evidence`: `npm --workspace @athena/core run typecheck`; `npm --workspace @athena/core run test:unit -- tests/control-plane.task-schedules.test.ts tests/api.task-schedules.test.ts tests/control-plane.workflow-template-instantiation.test.ts tests/control-plane.workflow-status.test.ts tests/control-plane.workflow-dag-executor.test.ts`; `npm --workspace @athena/core run test:unit`.
- `qa_focus`: Verify workflow-template schedules execute through the canonical DAG executor, failed DAG execution is recorded as a failed schedule attempt without losing workflow DAG correlation, existing API response fields remain present, and non-workflow-template schedules remain unchanged.
- `open_risks`: Synchronous DAG execution can lengthen schedule tick duration; richer schedule retry/resume policy remains follow-on work.

## QA Verdict
- `verdict`: pass
- `evidence_quality`: Strong. QA reran typecheck, focused control-plane/API schedule and workflow suites, and the full core unit suite.
- `defects`: none
- `state_transition`: move to engineering/done

## Transition History
- `2026-05-28T19:34:36Z`: `intake` -> `active`; PM refined as synchronous workflow-template schedule DAG execution story
- `2026-05-28T19:37:16Z`: `active` -> `qa`; Engineering wired workflow-template schedules through canonical DAG execution
- `2026-05-28T19:37:50Z`: `qa` -> `done`; QA passed workflow-template schedule DAG execution
