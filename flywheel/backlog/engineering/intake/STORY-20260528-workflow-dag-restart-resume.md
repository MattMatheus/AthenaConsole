---
kind: story
id: STORY-20260528-workflow-dag-restart-resume
status: intake
owner_role: Software Engineer
source: epic
success_metric: Interrupted workflow DAG runs can be recovered and resumed without re-running completed dependencies.
release_scope: required
ready: false
---

# Story: Resume Workflow DAG Runs After Restart

## Metadata
- `id`: STORY-20260528-workflow-dag-restart-resume
- `owner_role`: Software Engineer
- `status`: intake
- `source`: epic
- `decision_refs`: [ADR-0015, ADR-0012]
- `epic`: docs/product/epics/refinement/2026.17.00-epic-workflow-dag-engine.md
- `success_metric`: Interrupted workflow DAG runs can be recovered and resumed without re-running completed dependencies.
- `release_scope`: required

## Problem Statement

Workflow-state helpers can mark stale running steps resumable, but the product needs an end-to-end restart and resume path for real workflow-template DAG runs executed through the canonical DAG path.

## Scope

- In: startup recovery integration for real workflow DAG runs, resume entry point, skip completed dependencies, recovery events, focused tests.
- Out: manual retry policy design, broad cancellation UI, hosted scheduler behavior.

## Acceptance Criteria

1. Startup recovery detects workflow DAG runs with stale running steps.
2. Stale running steps are marked failed/resumable with recovery events.
3. Resume restarts from failed or stale steps without re-running completed dependencies.
4. Status API shows recovered and resumed state accurately.
5. Restart/resume works for workflow-template-instantiated runs.
6. Existing task/mission stale-run recovery remains unchanged.

## Validation

- Required checks: `npm --workspace @athena/core run typecheck`; workflow-state, workflow-status, stale-run-recovery, and workflow-template integration tests.
- Additional checks: full `npm --workspace @athena/core run test:unit` if startup service wiring changes.

## Dependencies

- Recommended after `STORY-20260528-workflow-dag-executor-service`.

## Risks

- Recovery semantics must not accidentally re-run completed work.
- Resume behavior should be explicit about failed vs stale-running steps.

## Next Step

PM refinement should confirm the operator-facing resume trigger: service/API only first, console affordance later.

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
