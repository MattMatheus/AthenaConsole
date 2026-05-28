---
kind: story
id: STORY-20260528-remove-legacy-workflow-file-state
status: done
owner_role: Software Engineer
source: epic
success_metric: Deprecated legacy workflow file-backed state is removed from normal runtime paths.
release_scope: follow-up
ready: true
---

# Story: Remove Legacy Workflow File State

## Metadata
- `id`: STORY-20260528-remove-legacy-workflow-file-state
- `owner_role`: Software Engineer
- `status`: done
- `source`: epic
- `decision_refs`: [ADR-0010, ADR-0015]
- `epic`: docs/product/epics/refinement/2026.22.00-epic-state-ownership-and-sqlite-migration.md
- `success_metric`: Deprecated legacy workflow file-backed state is removed from normal runtime paths.
- `release_scope`: follow-up
- `pm_refinement`: Canonical route coverage is `/api/v1/workflow-runs/:runId/status`, already covered by workflow status and workflow-template catalog API tests. Remove the legacy `/api/v1/workflows*` runtime surface rather than preserving a deprecated bridge.

## Problem Statement

Legacy `/api/v1/workflows*` file-backed APIs are deprecated now that canonical workflow DAG run state exists. The product does not need backward compatibility shims, so this state should be removed once replacement coverage is confirmed.

## Scope

- In: remove or disable deprecated file-backed workflow runtime/storage paths, update product direction, verify canonical workflow DAG routes cover status/graph inspection.
- Out: adding compatibility bridges, long-term support shims, migrating legacy workflow file payloads.

## Acceptance Criteria

1. Deprecated file-backed workflow runtime/storage paths are removed or made unreachable.
2. Product direction points operators to canonical workflow DAG state only.
3. Tests prove canonical workflow DAG status/graph inspection still works.
4. No compatibility bridge or fallback read path is introduced.

## Validation

- Required checks: core typecheck; focused workflow DAG API/service tests; docs consistency review; `./flywheel/tools/validate_workflow_state.sh`.

## Dependencies

- Requires `ARCH-20260528-state-ownership-map`.
- Recommended after session/artifact classification.

## Risks

- Removal could uncover stale internal callers that still use the deprecated file-backed workflow path.

## Next Step

Engineering should remove the deprecated `/api/v1/workflows*` API/service surface, prove those routes are unreachable, and rerun canonical workflow DAG status tests.

## Engineering Handoff
- `change_summary`: Removed the legacy `/api/v1/workflows*` API contract/routes, legacy workflow service wiring, CLI `work status --workflow` path, legacy workflow observability/executor helpers, and deprecated workflow diagnostics entries. Product direction and the ownership map now point operators to canonical workflow DAG status at `/api/v1/workflow-runs/:runId/status` only. API/contract tests now prove the old routes are unreachable while canonical DAG status coverage remains.
- `validation_evidence`: `npm --workspace @athena/core run typecheck` passed; `npm --workspace @athena/core run test:unit -- api.route-registration.test.ts control-plane.api-contracts.test.ts control-plane.api-artifact.test.ts control-plane.state-ownership.test.ts api.server.test.ts control-plane.workflow-status.test.ts api.workflow-template-catalog.test.ts` passed; `npm --workspace @athena/core run check:schemas` passed; `./flywheel/tools/validate_workflow_state.sh` passed; `git diff --check` passed.
- `qa_focus`: Confirm `/api/v1/workflows`, `/api/v1/workflows/run/:id`, and `/api/v1/workflows/run/:id/resume` are absent/unreachable; confirm `/api/v1/workflow-runs/:runId/status` still returns canonical graph/status payloads; confirm no deprecated workflow file roots appear in state diagnostics.
- `open_risks`: Low-level `FileStateStore` workflow record helpers remain for historical file parsing tests but are no longer wired into API/service/CLI runtime paths.

## QA Verdict
- `verdict`: pass
- `evidence_quality`: Strong. QA reran core typecheck, full core unit tests, generated API schema check, workflow-state validation, and whitespace checks.
- `defects`: None found. QA adjusted the authorization denial-count expectation to reflect the four removed workflow operations, then reran the full core unit suite successfully.
- `state_transition`: Move to engineering done.

## Transition History
- `2026-05-28T22:14:54Z`: `intake` -> `active`; activate final state ownership cleanup story
- `2026-05-28T22:24:44Z`: `active` -> `qa`; engineering handoff ready for legacy workflow file-state removal
- `2026-05-28T22:25:48Z`: `qa` -> `done`; QA passed for legacy workflow file-state removal
