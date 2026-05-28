---
kind: story
id: STORY-20260528-run-templates-sqlite-migration
status: intake
owner_role: Software Engineer
source: epic
success_metric: Run templates are operator-owned SQLite app-state resources with no file-store fallback in normal runtime paths.
release_scope: follow-up
ready: false
---

# Story: Migrate Run Templates To SQLite App-State

## Metadata
- `id`: STORY-20260528-run-templates-sqlite-migration
- `owner_role`: Software Engineer
- `status`: intake
- `source`: epic
- `decision_refs`: [ADR-0010, ADR-0012]
- `epic`: docs/product/epics/refinement/2026.22.00-epic-state-ownership-and-sqlite-migration.md
- `success_metric`: Run templates are operator-owned SQLite app-state resources with no file-store fallback in normal runtime paths.
- `release_scope`: follow-up

## Problem Statement

Run templates are stable operator-owned presets but still use file-backed state. They should move to SQLite after their dependencies are SQLite-owned.

## Scope

- In: SQLite run-template repository/schema, service rewiring, removal of file-store runtime reads, API/console behavior tests.
- Out: schedule targeting run templates, plugin-packaged run template catalogs, shared/team template metadata.

## Acceptance Criteria

1. Run template list/create/run APIs use SQLite app-state.
2. Normal runtime paths do not read run templates from the old file-backed store.
3. Effective parameter resolution and run metadata remain correct for SQLite-owned templates.
4. Console run-template page works against the migrated service.

## Validation

- Required checks: core typecheck; run-template API/service tests; console tests if parser behavior changes; full core unit tests.

## Dependencies

- Requires `ARCH-20260528-state-ownership-map`.
- Recommended after harness profile and directive migrations.

## Risks

- Run-template execution spans profile resolution, directive rendering, and run metadata; regressions may surface outside the run-template service.

## Next Step

PM refinement should confirm dependency completion and whether any one-time local seed data is needed before removing file-store reads.

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
