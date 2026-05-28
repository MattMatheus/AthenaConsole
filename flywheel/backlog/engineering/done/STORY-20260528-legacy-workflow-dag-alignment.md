---
kind: story
id: STORY-20260528-legacy-workflow-dag-alignment
status: done
owner_role: Software Engineer
source: epic
success_metric: Legacy workflow APIs are labeled, bridged, or deprecated so operators see one canonical workflow execution model.
release_scope: follow-up
ready: true
---

# Story: Reconcile Legacy Workflow APIs With Canonical DAG Runs

## Metadata
- `id`: STORY-20260528-legacy-workflow-dag-alignment
- `owner_role`: Software Engineer
- `status`: done
- `source`: epic
- `decision_refs`: [ADR-0015]
- `epic`: docs/product/epics/refinement/2026.17.00-epic-workflow-dag-engine.md
- `success_metric`: Legacy workflow APIs are labeled, bridged, or deprecated so operators see one canonical workflow execution model.
- `release_scope`: follow-up

## Problem Statement

The product still has legacy file-backed workflow APIs alongside canonical SQLite workflow DAG runs. Without alignment, operators and future maintainers will see multiple meanings for “workflow run.”

## Scope

- In: inventory and explicitly label legacy file-backed workflow routes/services, add compatibility metadata that points consumers to canonical workflow DAG run status, update API artifact metadata/docs, and add focused contract/route tests.
- Out: broad file-backed state migration, endpoint removal, automatic state bridging between file-backed workflows and SQLite workflow DAG runs, visual editor work, unrelated state ownership migrations.

## Acceptance Criteria

1. Legacy workflow routes and services are explicitly labeled, bridged, or deprecated.
2. Canonical workflow DAG run terminology is used in docs and API descriptions.
3. Operators have a clear path from workflow-template execution to canonical DAG status.
4. Existing legacy behavior is preserved unless a deprecation/bridge is explicitly tested.
5. Product direction and epic docs reflect the final workflow execution model.

## Validation

- Required checks: `npm --workspace @athena/core run typecheck`; workflow route/API contract tests; docs consistency checks.
- Additional checks: full `npm --workspace @athena/core run test:unit` if route behavior changes.

## Dependencies

- Recommended after the DAG executor and schedule execution stories prove the canonical path.

## Risks

- Deprecating too early could remove useful existing behavior.
- Bridging too broadly could hide state ownership problems that need separate migration work.

## Refinement

- Decision: this is a labeling/deprecation story, not a behavior rewrite.
- Rationale: canonical workflow-template DAG execution is now live and inspectable, but the older `/api/v1/workflows*` file-backed endpoints may still be useful for compatibility and should not be removed without a separate migration plan.
- Implementation shape: mark `/api/v1/workflows`, `/api/v1/workflows/run/:id`, and `/api/v1/workflows/run/:id/resume` as legacy file-backed compatibility in contract/OpenAPI metadata; add response-level compatibility metadata to legacy workflow run observability; keep `/api/v1/workflow-runs/:runId/status` as the canonical workflow DAG run status path.
- Open questions resolved: no endpoint removal; no automatic bridge from legacy file-backed workflow ids to canonical SQLite DAG run ids in this story.

## Engineering Handoff
- `change_summary`: Marked legacy file-backed `/api/v1/workflows*` routes as deprecated compatibility surfaces in API contract metadata and generated OpenAPI artifacts; marked `/api/v1/workflow-runs/:runId/status` as the stable canonical workflow DAG status surface; added compatibility metadata to legacy workflow run observability responses; updated product direction and epic docs to name the final workflow execution model.
- `validation_evidence`: `npm --workspace @athena/core run typecheck` passed; focused `npm --workspace @athena/core run test:unit -- api.server.test.ts control-plane.api-contracts.test.ts control-plane.api-artifact.test.ts api.route-registration.test.ts control-plane.workflow-status.test.ts` passed; full `npm --workspace @athena/core run test:unit` passed; `npm --workspace @athena/core run check:schemas` passed; `git diff --check` passed; `./flywheel/tools/validate_workflow_state.sh` passed.
- `qa_focus`: Confirm no legacy endpoint was removed; verify OpenAPI artifact includes deprecation/canonical path metadata; verify legacy workflow observability responses include compatibility metadata while canonical workflow DAG status remains stable.
- `open_risks`: Actual migration/removal of file-backed workflow state remains separate future work if the product wants to retire compatibility endpoints.

## QA Verdict
- `verdict`: Pass.
- `evidence_quality`: Good. QA reran `npm --workspace @athena/core run typecheck`, `npm --workspace @athena/core run check:schemas`, focused workflow/API artifact tests, `git diff --check`, and `./flywheel/tools/validate_workflow_state.sh`; all passed. Engineering also ran the full `npm --workspace @athena/core run test:unit` suite successfully.
- `defects`: None found. QA caught and fixed one tracking-doc lane reference before final validation.
- `state_transition`: Move `engineering/qa` -> `engineering/done`.

## Transition History
- `2026-05-28T19:57:52Z`: `intake` -> `active`; PM refined as legacy file-backed workflow labeling and deprecation story
- `2026-05-28T20:00:09Z`: `active` -> `qa`; Engineering complete with legacy workflow compatibility labeling and validation evidence
- `2026-05-28T20:00:49Z`: `qa` -> `done`; QA passed legacy workflow compatibility labeling validation
