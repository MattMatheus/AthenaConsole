---
kind: story
id: STORY-20260528-workflow-status-api
status: done
owner_role: Software Architect
source: pm
success_metric: Workflow run state is exposed through a graph-friendly status API without leaking storage internals.
release_scope: required
ready: true
---

# Story: Add Visualizer-Friendly Workflow Status API

## Metadata
- `id`: STORY-20260528-workflow-status-api
- `owner_role`: Software Architect
- `status`: done
- `source`: pm
- `decision_refs`: [ADR-0009, ADR-0011, ADR-0012, EPIC-2026.17]
- `success_metric`: Workflow run state is exposed through a graph-friendly status API without leaking storage internals.
- `release_scope`: required

## Problem Statement

After durable workflow state exists, operators and future UI surfaces need a stable way to inspect workflow runs as dependency graphs instead of storage rows.

## Scope
- In: read-only workflow status API/service shape for workflow run state, steps, dependencies, events, recovery context, and failure context.
- Out: visual editor, frontend graph visualization, parallel executor, hosted scheduler changes.

## Assumptions

- `STORY-20260528-workflow-state-store-resumption.md` has created durable workflow run and step state.
- Existing run/event/artifact repositories remain the source for operational history.

## Acceptance Criteria

1. Exposes workflow run status, step status, dependencies, and readiness in a graph-friendly shape.
2. Includes failure and recovery context for each step.
3. Supports console polling without exposing internal storage table details.
4. Preserves existing mission run and workflow-template instantiation behavior.
5. Includes focused service/API tests.

## Validation
- Required checks: `npm --workspace @athena/core run typecheck`, focused workflow status tests, `git diff --check`.
- Additional checks: existing workflow-template instantiation tests where touched.

## Dependencies

- `flywheel/backlog/engineering/active/STORY-20260528-workflow-state-store-resumption.md`
- `docs/product/epics/refinement/2026.17.00-epic-workflow-dag-engine.md`

## Risks

- API shape may accidentally leak repository internals if not explicitly mapped.
- Status polling could become expensive without bounded query patterns.

## Open Questions

- Should this be service-only first, or include HTTP routes in the same slice?

## Next Step

Promote after workflow state storage and resumption logic completes.

## Engineering Handoff
- `change_summary`: Added a graph-friendly workflow run status contract, `LocalWorkflowStatusService`, authorized control-plane service wiring, and `GET /api/v1/workflow-runs/:runId/status`. The response maps durable workflow DAG state into run summary, progress, nodes, edges, events, recovery context, and polling metadata without exposing SQLite table shape. Added focused service/API tests and updated route/schema contracts.
- `validation_evidence`: Pass: `npm --workspace @athena/core exec vitest run tests/control-plane.workflow-status.test.ts`. Pass: `npm --workspace @athena/core exec vitest run tests/control-plane.workflow-state.test.ts tests/control-plane.workflow-template-instantiation.test.ts tests/api.server.test.ts tests/control-plane.authorization.test.ts`. Pass: `npm --workspace @athena/core exec vitest run tests/api.schemas.test.ts tests/control-plane.api-contracts.test.ts tests/control-plane.workflow-status.test.ts`. Pass: `npm --workspace @athena/core run check:schemas`. Pass: `npm --workspace @athena/core run typecheck`. Pass: `npm --workspace @athena/core run validate:manifests`. Pass: `npm --workspace @athena/core run test:unit` (83 files, 388 tests). Pass: `git diff --check`.
- `qa_focus`: Confirm the status shape is graph-oriented and stable for polling, includes dependencies/dependents/readiness, includes failure and stale-step recovery context, and does not leak repository table/row names. Verify the HTTP route resolves under the workflows route family and existing workflow-template instantiation tests still pass.
- `open_risks`: The response schema is intentionally permissive in `api-schemas.ts` because the local schema generator does not currently emit this newly added graph contract; tightening that generated schema can be a follow-up if API artifact strictness becomes important.

## QA Verdict
- `verdict`: Pass. The workflow run status API satisfies the acceptance criteria for graph-friendly polling over durable workflow DAG state.
- `evidence_quality`: Strong. QA reran focused workflow status/state/template tests, API route/schema/contract tests, typecheck, schema check, manifest validation, `git diff --check`, and the full unit suite. One full-suite run hit the unrelated `tests/runtime.lock.test.ts` temp-file race; that test passed in isolation and the full suite passed on retry.
- `defects`: None filed.
- `state_transition`: Move `qa` -> `done`.

## Transition History
- `2026-05-28T02:44:42Z`: `ready` -> `active`; next ready story promoted for implementation
- `2026-05-28T02:50:27Z`: `active` -> `qa`; engineering handoff ready
- `2026-05-28T02:51:33Z`: `qa` -> `done`; QA passed
