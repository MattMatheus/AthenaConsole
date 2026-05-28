---
kind: story
id: STORY-20260528-directives-sqlite-migration
status: done
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
- `status`: done
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
- `change_summary`: Added the `directives` SQLite table and repository, routed directive list/create through SQLite, and updated the shared state-store wrapper so runs, run templates, workflow validation, and API paths resolve directives from SQLite rather than `.athena/directives`. Updated diagnostics and the ownership map to classify directives as SQLite app-state.
- `validation_evidence`: `npm --workspace @athena/core run typecheck` passed; `npm --workspace @athena/core run test:unit -- api.server.test.ts control-plane.baseline.test.ts` passed; `npm --workspace @athena/core run test:unit` passed; `./flywheel/tools/validate_workflow_state.sh` passed; `git diff --check` passed.
- `qa_focus`: Confirm old file-backed directive JSON is ignored by normal API/runtime paths, run and workflow paths resolve newly created SQLite directives, and diagnostics no longer list directives as a migration-candidate file root.
- `open_risks`: Existing local file-backed directives are intentionally not imported; operators must recreate needed directives through the current API if they had pre-existing local files.

## QA Verdict
- `verdict`: Pass.
- `evidence_quality`: Strong. QA reran core typecheck, focused API/control-plane tests, Flywheel workflow validation, and diff whitespace validation. Engineering also ran the full core unit suite.
- `defects`: None found.
- `state_transition`: Move to engineering done.

## Transition History
- `2026-05-28T21:06:39Z`: `intake` -> `active`; activate next SQLite migration story
- `2026-05-28T21:08:41Z`: `active` -> `qa`; engineering handoff ready for directives SQLite migration
- `2026-05-28T21:09:15Z`: `qa` -> `done`; QA passed for directives SQLite migration
