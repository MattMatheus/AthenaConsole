---
kind: story
id: STORY-20260528-legacy-workflow-dag-alignment
status: intake
owner_role: Software Engineer
source: epic
success_metric: Legacy workflow APIs are labeled, bridged, or deprecated so operators see one canonical workflow execution model.
release_scope: follow-up
ready: false
---

# Story: Reconcile Legacy Workflow APIs With Canonical DAG Runs

## Metadata
- `id`: STORY-20260528-legacy-workflow-dag-alignment
- `owner_role`: Software Engineer
- `status`: intake
- `source`: epic
- `decision_refs`: [ADR-0015]
- `epic`: docs/product/epics/refinement/2026.17.00-epic-workflow-dag-engine.md
- `success_metric`: Legacy workflow APIs are labeled, bridged, or deprecated so operators see one canonical workflow execution model.
- `release_scope`: follow-up

## Problem Statement

The product still has legacy file-backed workflow APIs alongside canonical SQLite workflow DAG runs. Without alignment, operators and future maintainers will see multiple meanings for “workflow run.”

## Scope

- In: inventory legacy workflow routes/services, label or bridge them to canonical DAG runs, update docs/API descriptions, focused route/service tests.
- Out: broad file-backed state migration, visual editor work, unrelated state ownership migrations.

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

## Next Step

PM refinement should decide whether this is a documentation/labeling story or a route behavior story after canonical DAG execution is live.

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
