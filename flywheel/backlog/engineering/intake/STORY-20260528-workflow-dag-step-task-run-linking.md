---
kind: story
id: STORY-20260528-workflow-dag-step-task-run-linking
status: intake
owner_role: Software Engineer
source: epic
success_metric: Workflow DAG steps reflect real task run lifecycle outcomes for workflow-template tasks.
release_scope: required
ready: false
---

# Story: Link Workflow DAG Steps To Task Run Outcomes

## Metadata
- `id`: STORY-20260528-workflow-dag-step-task-run-linking
- `owner_role`: Software Engineer
- `status`: intake
- `source`: epic
- `decision_refs`: [ADR-0015, ADR-0012]
- `epic`: docs/product/epics/refinement/2026.17.00-epic-workflow-dag-engine.md
- `success_metric`: Workflow DAG steps reflect real task run lifecycle outcomes for workflow-template tasks.
- `release_scope`: required

## Problem Statement

Workflow-template instantiation now creates a canonical workflow DAG run and projects tasks with provenance that includes workflow DAG run and step ids. Actual task execution does not yet update those DAG steps, so status APIs can show the envelope but not real task progress.

## Scope

- In: use task provenance to start, complete, and fail matching workflow DAG steps when task runs execute; include task run ids and useful outputs/failures on step records; focused service/API tests.
- Out: replacing the mission executor, parallel DAG execution, schedule execution changes, console redesign.

## Acceptance Criteria

1. A task run for a workflow-template-projected task starts the matching workflow DAG step.
2. Successful task run completion completes the matching DAG step and stores task run id/output detail.
3. Failed task run completion fails the matching DAG step and stores task run id/failure detail.
4. Workflow status for an instantiated workflow-template run reflects real task outcomes.
5. Non-workflow-template tasks keep existing behavior.
6. Existing task, mission, workflow-template, workflow-state, and workflow-status APIs remain backward compatible.

## Validation

- Required checks: `npm --workspace @athena/core run typecheck`; focused task workbench, workflow-template instantiation, workflow-state, and workflow-status tests.
- Additional checks: API workflow status regression tests and full `npm --workspace @athena/core run test:unit` if task workbench internals change broadly.

## Dependencies

- `STORY-20260528-workflow-template-dag-run-envelope` is done.

## Risks

- Task run lifecycle code is central and already large; keep the change narrowly focused on provenance-driven DAG step updates.
- Output/failure payloads should stay additive and avoid leaking provider-specific internals.

## Next Step

PM refinement should confirm whether this runs before the DAG executor service. Recommended: yes, because it proves status linkage while preserving existing execution.

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
