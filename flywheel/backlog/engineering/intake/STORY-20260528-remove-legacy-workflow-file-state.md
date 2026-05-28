---
kind: story
id: STORY-20260528-remove-legacy-workflow-file-state
status: intake
owner_role: Software Engineer
source: epic
success_metric: Deprecated legacy workflow file-backed state is removed from normal runtime paths.
release_scope: follow-up
ready: false
---

# Story: Remove Legacy Workflow File State

## Metadata
- `id`: STORY-20260528-remove-legacy-workflow-file-state
- `owner_role`: Software Engineer
- `status`: intake
- `source`: epic
- `decision_refs`: [ADR-0010, ADR-0015]
- `epic`: docs/product/epics/refinement/2026.22.00-epic-state-ownership-and-sqlite-migration.md
- `success_metric`: Deprecated legacy workflow file-backed state is removed from normal runtime paths.
- `release_scope`: follow-up

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

PM refinement should confirm the canonical route coverage that must exist before deleting the deprecated path.

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
