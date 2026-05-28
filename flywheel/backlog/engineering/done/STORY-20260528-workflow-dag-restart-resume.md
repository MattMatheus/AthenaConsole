---
kind: story
id: STORY-20260528-workflow-dag-restart-resume
status: done
owner_role: Software Engineer
source: epic
success_metric: Interrupted workflow DAG runs can be recovered and resumed without re-running completed dependencies.
release_scope: required
ready: true
---

# Story: Resume Workflow DAG Runs After Restart

## Metadata
- `id`: STORY-20260528-workflow-dag-restart-resume
- `owner_role`: Software Engineer
- `status`: done
- `source`: epic
- `decision_refs`: [ADR-0015, ADR-0012]
- `epic`: docs/product/epics/refinement/2026.17.00-epic-workflow-dag-engine.md
- `success_metric`: Interrupted workflow DAG runs can be recovered and resumed without re-running completed dependencies.
- `release_scope`: required

## Problem Statement

Workflow-state helpers can mark stale running steps resumable, but the product needs an end-to-end restart and resume path for real workflow-template DAG runs executed through the canonical DAG path.

## Scope

- In: startup recovery integration for canonical `workflowDagRuns`; service-level resume entry point on the canonical workflow DAG executor; skip completed dependencies by using existing `resumeFromFirstFailedStep` semantics; recovery events/status coverage; focused tests using workflow-template-instantiated runs.
- Out: API route exposure, console affordance, manual retry policy design, broad cancellation UI, hosted scheduler behavior, changing existing task/mission stale-run recovery semantics.

## Acceptance Criteria

1. Startup recovery detects workflow DAG runs with stale running steps.
2. Stale running steps are marked failed/resumable with recovery events.
3. Resume restarts from failed or stale steps without re-running completed dependencies.
4. Status API shows recovered and resumed state accurately.
5. Restart/resume works for workflow-template-instantiated runs.
6. Existing task/mission stale-run recovery remains unchanged.
7. The first operator-facing trigger is service-only; API and console affordances remain later stories.
8. Completed workflow DAG steps are not re-run during resume.

## Validation

- Required checks: `npm --workspace @athena/core run typecheck`; workflow-state, workflow-status, stale-run-recovery, and workflow-template integration tests.
- Additional checks: full `npm --workspace @athena/core run test:unit` if startup service wiring changes.

## Dependencies

- `STORY-20260528-workflow-dag-executor-service` is done.

## Risks

- Recovery semantics must not accidentally re-run completed work.
- Resume behavior should be explicit about failed vs stale-running steps.
- Startup recovery should be idempotent and must not mutate already terminal workflow DAG runs.

## Open Questions

- Resolved: first operator-facing trigger is service-only through the canonical workflow DAG executor; no API route or console affordance in this slice.
- Resolved: use existing workflow-state recovery/resume events and extend startup wiring rather than introducing a separate recovery model.
- Resolved: keep task/mission stale-run recovery behavior unchanged.

## Next Step

Engineering should implement service-level workflow DAG restart recovery and resume as the next active Workflow DAG Engine story.

## Engineering Handoff
- `change_summary`: Added canonical workflow DAG startup recovery through `recoverStaleWorkflowDagRuns`, wired it into local control-plane service startup, added bounded workflow DAG run listing, and added `LocalWorkflowDagExecutorService.resume`. Resume recovers stale running steps, prepares failed/stale descendants for retry, resets affected projected tasks to `ready`, then executes through the canonical DAG executor without re-running completed dependencies.
- `validation_evidence`: `npm --workspace @athena/core run typecheck`; `npm --workspace @athena/core run test:unit -- tests/control-plane.workflow-dag-executor.test.ts tests/control-plane.workflow-state.test.ts tests/control-plane.workflow-status.test.ts tests/control-plane.stale-run-recovery.test.ts tests/control-plane.workflow-template-instantiation.test.ts`; `npm --workspace @athena/core run test:unit`.
- `qa_focus`: Verify startup recovery is idempotent, recovered workflow DAG runs become resumable with recovery events, resume does not re-run completed dependencies, projected failed/stale tasks are reset only when needed, and existing task/mission stale-run recovery remains unchanged.
- `open_risks`: Resume is still service-only; API, console affordance, and richer retry policy remain later stories.

## QA Verdict
- `verdict`: pass
- `evidence_quality`: Strong. QA reran typecheck, the focused workflow DAG executor/state/status/stale-recovery/template suites, and the full core unit suite after startup wiring changes.
- `defects`: none
- `state_transition`: move to engineering/done

## Transition History
- `2026-05-28T19:25:54Z`: `intake` -> `active`; PM refined as service-only workflow DAG restart and resume story
- `2026-05-28T19:29:03Z`: `active` -> `qa`; Engineering implemented service-only workflow DAG restart and resume
- `2026-05-28T19:29:35Z`: `qa` -> `done`; QA passed service-only workflow DAG restart and resume
