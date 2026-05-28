---
kind: story
id: STORY-20260528-run-templates-sqlite-migration
status: done
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
- `status`: done
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
- `change_summary`: Added the `run_templates` SQLite table and repository, routed run-template list/create/run lookup through SQLite, and updated diagnostics plus the ownership map to classify run templates as SQLite app-state. API coverage now proves old `.athena/run-templates` files are ignored by normal runtime paths while effective params and run metadata remain correct.
- `validation_evidence`: `npm --workspace @athena/core run typecheck` passed; `npm --workspace @athena/core run test:unit -- api.server.test.ts control-plane.baseline.test.ts` passed; `npm --workspace @athena/console run typecheck` passed; `npm --workspace @athena/console run test -- run-templates` passed; `npm --workspace @athena/core run test:unit` passed; `./flywheel/tools/validate_workflow_state.sh` passed; `git diff --check` passed.
- `qa_focus`: Confirm run-template list/create/run APIs use SQLite, old file-backed run-template JSON is ignored, effective parameter resolution still merges defaults and overrides, and console run-template parsing remains compatible.
- `open_risks`: Existing local file-backed run templates are intentionally not imported; operators must recreate needed templates through the current API if they had pre-existing local files.

## QA Verdict
- `verdict`: pass
- `evidence_quality`: Strong. QA reran core typecheck, targeted run-template API/baseline unit tests, console typecheck, console run-template tests, workflow-state validation, and whitespace checks after engineering's full core unit run.
- `defects`: None found.
- `state_transition`: Move to engineering done.

## Transition History
- `2026-05-28T21:12:39Z`: `intake` -> `active`; activate next SQLite migration story
- `2026-05-28T21:14:41Z`: `active` -> `qa`; engineering handoff ready for run templates SQLite migration
- `2026-05-28T21:16:38Z`: `qa` -> `done`; QA passed for run templates SQLite migration
