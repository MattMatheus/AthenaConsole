---
kind: story
id: STORY-20260528-directives-sqlite-migration
status: intake
owner_role: Software Engineer
source: epic
success_metric: Directives are served from SQLite app-state with no file-store fallback in normal runtime paths.
release_scope: follow-up
ready: false
---

# Story: Migrate Directives To SQLite App-State

## Metadata
- `id`: STORY-20260528-directives-sqlite-migration
- `owner_role`: Software Engineer
- `status`: intake
- `source`: epic
- `decision_refs`: [ADR-0010, ADR-0012]
- `epic`: docs/product/epics/refinement/2026.22.00-epic-state-ownership-and-sqlite-migration.md
- `success_metric`: Directives are served from SQLite app-state with no file-store fallback in normal runtime paths.
- `release_scope`: follow-up

## Problem Statement

Directive records are reusable control-plane inputs for runs and templates but still live in file-backed state.

## Scope

- In: SQLite directive repository/schema, service rewiring, removal of file-store runtime reads, API and run-path tests.
- Out: redesigning directive templates, plugin-packaged directives, workflow-template schema changes.

## Acceptance Criteria

1. Directive list/create APIs use SQLite app-state as source of truth.
2. Normal runtime paths do not read directives from the old file-backed store.
3. Task and run-template paths that reference directives keep working from SQLite.
4. Existing API response shapes remain stable unless refinement explicitly changes them.

## Validation

- Required checks: core typecheck; focused directive API/service tests; full core unit tests; schema checks if contracts change.

## Dependencies

- Requires `ARCH-20260528-state-ownership-map`.
- Recommended after harness profile migration because directives often resolve with harness profiles at run time.

## Risks

- Existing task and run-template paths may reference directive ids; migration must preserve lookup behavior through SQLite.

## Next Step

PM refinement should confirm whether any one-time local seed data is needed before removing file-store reads.

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
