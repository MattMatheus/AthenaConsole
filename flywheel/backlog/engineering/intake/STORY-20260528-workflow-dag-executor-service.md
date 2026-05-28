---
kind: story
id: STORY-20260528-workflow-dag-executor-service
status: intake
owner_role: Software Engineer
source: epic
success_metric: Workflow DAG runs can execute projected tasks by dependency readiness through a deterministic executor service.
release_scope: required
ready: false
---

# Story: Add Deterministic Workflow DAG Executor Service

## Metadata
- `id`: STORY-20260528-workflow-dag-executor-service
- `owner_role`: Software Engineer
- `status`: intake
- `source`: epic
- `decision_refs`: [ADR-0015, ADR-0011]
- `epic`: docs/product/epics/refinement/2026.17.00-epic-workflow-dag-engine.md
- `success_metric`: Workflow DAG runs can execute projected tasks by dependency readiness through a deterministic executor service.
- `release_scope`: required

## Problem Statement

Workflow DAG state tracks dependency readiness, but there is no executor that uses that state as the primary execution plan. Workflow-template execution still depends on the mission/task projection path.

## Scope

- In: new workflow DAG executor service, ready-step selection, one-step-at-a-time deterministic execution, readiness recomputation, task run linkage reuse, focused tests.
- Out: parallelism, hosted scheduling, visual editor behavior, broad mission API replacement.

## Acceptance Criteria

1. The executor loads a workflow DAG run and selects ready pending steps deterministically.
2. Each selected step runs its projected task through existing task execution services.
3. Completed steps unblock dependents through existing readiness recomputation.
4. Failed steps fail or pause the DAG run according to existing workflow-state semantics.
5. First implementation is serial unless a dependency-safe concurrency contract is explicitly added.
6. Existing mission/task execution behavior remains compatible.

## Validation

- Required checks: `npm --workspace @athena/core run typecheck`; workflow-state, workflow-status, task workbench, and workflow-template integration tests.
- Additional checks: full `npm --workspace @athena/core run test:unit` because execution services are shared.

## Dependencies

- Recommended after `STORY-20260528-workflow-dag-step-task-run-linking`.

## Risks

- Executor behavior can easily become a product semantic change; keep first slice serial and explicit.
- Task cancellation and timeout behavior may need follow-on work rather than expanding this story.

## Next Step

PM refinement should decide whether the first executor entry point is service-only or exposed through an API route in the same story.

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
