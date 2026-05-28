---
kind: story
id: STORY-20260528-workflow-dag-step-task-run-linking
status: active
owner_role: Software Engineer
source: epic
success_metric: Workflow DAG steps reflect real task run lifecycle outcomes for workflow-template tasks.
release_scope: required
ready: true
---

# Story: Link Workflow DAG Steps To Task Run Outcomes

## Metadata
- `id`: STORY-20260528-workflow-dag-step-task-run-linking
- `owner_role`: Software Engineer
- `status`: active
- `source`: epic
- `decision_refs`: [ADR-0015, ADR-0012]
- `epic`: docs/product/epics/refinement/2026.17.00-epic-workflow-dag-engine.md
- `success_metric`: Workflow DAG steps reflect real task run lifecycle outcomes for workflow-template tasks.
- `release_scope`: required

## Problem Statement

Workflow-template instantiation now creates a canonical workflow DAG run and projects tasks with provenance that includes workflow DAG run and step ids. Actual task execution does not yet update those DAG steps, so status APIs can show the envelope but not real task progress.

## Scope

- In: provenance-driven workflow DAG step lifecycle updates inside task run execution; helper-level parsing of `workflowDagRunId` and `workflowDagStepId`; step output/failure payloads that include task run id and execution detail; focused service/API tests.
- Out: replacing the mission executor, adding a DAG executor service, parallel DAG execution, schedule execution changes, console redesign, schema changes.

## Acceptance Criteria

1. A task run for a workflow-template-projected task starts the matching workflow DAG step.
2. Successful task run completion completes the matching DAG step and stores task run id/output detail.
3. Failed task run completion fails the matching DAG step and stores task run id/failure detail.
4. Workflow status for an instantiated workflow-template run reflects real task outcomes.
5. Non-workflow-template tasks keep existing behavior.
6. Existing task, mission, workflow-template, workflow-state, and workflow-status APIs remain backward compatible.
7. The implementation is a narrow hook/helper around existing task workbench run transitions, not a broad task workbench refactor.

## Validation

- Required checks: `npm --workspace @athena/core run typecheck`; `npm --workspace @athena/core run test:unit -- tests/control-plane.task-workbench.test.ts tests/control-plane.workflow-template-instantiation.test.ts tests/control-plane.workflow-state.test.ts tests/control-plane.workflow-status.test.ts`.
- Additional checks: API workflow status regression tests if route behavior changes; full `npm --workspace @athena/core run test:unit` because task workbench is a shared execution path.

## Dependencies

- `STORY-20260528-workflow-template-dag-run-envelope` is done.

## Risks

- Task run lifecycle code is central and already large; keep the change narrowly focused on provenance-driven DAG step updates.
- Output/failure payloads should stay additive and avoid leaking provider-specific internals.

## Open Questions

- Resolved: this should run before the DAG executor service because it proves real task-run-to-DAG-status linkage while preserving existing execution.
- Resolved: use existing task provenance fields (`workflowDagRunId`, `workflowDagStepId`) as the linkage contract; do not introduce schema changes in this slice.
- Resolved: keep the implementation narrow by adding helper calls around existing task workbench run start/success/failure transitions.

## Next Step

Engineering should implement this as the next active workflow DAG story before introducing the DAG executor service.

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

## Transition History
- `2026-05-28T18:43:38Z`: `intake` -> `active`; PM refined as next workflow DAG execution-linking story
