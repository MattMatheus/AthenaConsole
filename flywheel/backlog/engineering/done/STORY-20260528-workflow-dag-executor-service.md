---
kind: story
id: STORY-20260528-workflow-dag-executor-service
status: done
owner_role: Software Engineer
source: epic
success_metric: Workflow DAG runs can execute projected tasks by dependency readiness through a deterministic executor service.
release_scope: required
ready: true
---

# Story: Add Deterministic Workflow DAG Executor Service

## Metadata
- `id`: STORY-20260528-workflow-dag-executor-service
- `owner_role`: Software Engineer
- `status`: done
- `source`: epic
- `decision_refs`: [ADR-0015, ADR-0011]
- `epic`: docs/product/epics/refinement/2026.17.00-epic-workflow-dag-engine.md
- `success_metric`: Workflow DAG runs can execute projected tasks by dependency readiness through a deterministic executor service.
- `release_scope`: required

## Problem Statement

Workflow DAG state tracks dependency readiness, but there is no executor that uses that state as the primary execution plan. Workflow-template execution still depends on the mission/task projection path.

## Scope

- In: new canonical workflow DAG executor service over `workflowDagRuns`; lookup of projected tasks through existing workflow-template provenance; deterministic one-step-at-a-time ready-step execution through `LocalTaskWorkbenchService`; readiness/status return values after execution; focused service tests.
- Out: API route exposure, scheduled workflow-template execution changes, replacing legacy file-backed `WorkflowExecutor`, parallel execution, hosted scheduling, visual editor behavior, broad mission API replacement.

## Acceptance Criteria

1. The executor loads a workflow DAG run and selects ready pending steps deterministically.
2. Each selected step runs its projected task through existing task execution services.
3. Completed steps unblock dependents through existing readiness recomputation.
4. Failed steps fail or pause the DAG run according to existing workflow-state semantics.
5. First implementation is serial unless a dependency-safe concurrency contract is explicitly added.
6. Existing mission/task execution behavior remains compatible.
7. The first entry point is service-only and does not add API routes or schedule behavior.
8. The implementation does not alter the legacy file-backed `WorkflowExecutor`; it introduces the canonical DAG executor beside it.

## Validation

- Required checks: `npm --workspace @athena/core run typecheck`; workflow-state, workflow-status, task workbench, and workflow-template integration tests.
- Additional checks: full `npm --workspace @athena/core run test:unit` because execution services are shared.

## Dependencies

- `STORY-20260528-workflow-dag-step-task-run-linking` is done.

## Risks

- Executor behavior can easily become a product semantic change; keep first slice serial and explicit.
- Task cancellation and timeout behavior may need follow-on work rather than expanding this story.
- A projected DAG step may be missing its task if a mission/task was manually edited after instantiation; fail loudly with a clear configuration error.

## Open Questions

- Resolved: first executor entry point is service-only; API and schedule wiring remain later stories.
- Resolved: do not replace or refactor the legacy file-backed `WorkflowExecutor` in this slice.
- Resolved: use workflow-template task provenance to map DAG steps to projected tasks; do not add schema fields.

## Next Step

Engineering should implement the canonical DAG executor service as the next active Workflow DAG Engine story.

## Engineering Handoff
- `change_summary`: Added `LocalWorkflowDagExecutorService` as a service-only canonical DAG executor. It loads a workflow DAG run, recomputes readiness, selects ready pending steps by `stepOrder`, resolves projected tasks through existing workflow-template provenance, executes them serially through `LocalTaskWorkbenchService`, and stops after terminal failure while preserving existing task/mission behavior. Added a targeted task repository lookup by workflow DAG run/step provenance and focused executor tests for success and failure paths.
- `validation_evidence`: `npm --workspace @athena/core run typecheck`; `npm --workspace @athena/core run test:unit -- tests/control-plane.workflow-dag-executor.test.ts tests/control-plane.task-workbench.test.ts tests/control-plane.workflow-template-instantiation.test.ts tests/control-plane.workflow-state.test.ts tests/control-plane.workflow-status.test.ts`; `npm --workspace @athena/core run test:unit`.
- `qa_focus`: Verify deterministic serial step selection, projected task lookup by provenance, successful dependent unblocking, failed-step blocking behavior, and absence of API/schedule/legacy `WorkflowExecutor` changes.
- `open_risks`: Executor currently fails loudly when a DAG step has no projected task; cancellation and timeout orchestration remain follow-on concerns.

## QA Verdict
- `verdict`: pass
- `evidence_quality`: Strong. QA reran typecheck, the focused workflow DAG executor/task/workflow suites, the stale-run recovery regression after fixing an order-sensitive assertion, and the full core unit suite.
- `defects`: none in the story implementation; QA fixed an unrelated order-sensitive stale-run recovery test assertion encountered during full-suite validation.
- `state_transition`: move to engineering/done

## Transition History
- `2026-05-28T19:18:22Z`: `intake` -> `active`; PM refined as service-only canonical workflow DAG executor story
- `2026-05-28T19:20:57Z`: `active` -> `qa`; Engineering implemented service-only canonical workflow DAG executor
- `2026-05-28T19:22:00Z`: `qa` -> `done`; QA passed service-only canonical workflow DAG executor
