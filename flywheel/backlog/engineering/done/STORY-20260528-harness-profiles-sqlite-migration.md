---
kind: story
id: STORY-20260528-harness-profiles-sqlite-migration
status: done
owner_role: Software Engineer
source: epic
success_metric: Harness profiles are served from SQLite app-state with no file-store fallback in normal runtime paths.
release_scope: follow-up
ready: false
---

# Story: Migrate Harness Profiles To SQLite App-State

## Metadata
- `id`: STORY-20260528-harness-profiles-sqlite-migration
- `owner_role`: Software Engineer
- `status`: done
- `source`: epic
- `decision_refs`: [ADR-0010, ADR-0011]
- `epic`: docs/product/epics/refinement/2026.22.00-epic-state-ownership-and-sqlite-migration.md
- `success_metric`: Harness profiles are served from SQLite app-state with no file-store fallback in normal runtime paths.
- `release_scope`: follow-up

## Problem Statement

Harness profiles are operator-facing control-plane resources but still use file-backed state. They should move to SQLite before dependent domains migrate.

## Scope

- In: SQLite repository/schema for harness profiles, service rewiring, removal of file-store runtime reads, API/console behavior tests.
- Out: changing harness profile contract shape, policy-pack authoring, hosted profile catalogs.

## Acceptance Criteria

1. Harness profile list/create APIs use SQLite app-state as the source of truth.
2. Normal runtime paths do not read harness profiles from the old file-backed store.
3. Task runs, run templates, and console selectors continue to resolve profiles from SQLite.
4. Migration is covered by focused service/API tests and full core unit tests.

## Validation

- Required checks: core typecheck; focused harness profile API/service tests; full core unit tests; schema checks if contracts change.

## Dependencies

- Requires `ARCH-20260528-state-ownership-map`.
- Recommended after `STORY-20260528-state-store-startup-diagnostics`.

## Risks

- Harness profiles are used by tasks and run templates, so test coverage needs to include multiple call paths.

## Next Step

PM refinement should confirm whether any one-time local seed data is needed before removing file-store reads.

## Engineering Handoff
- `change_summary`: Added the `harness_profiles` SQLite table and repository, routed local control-plane harness profile list/create through SQLite, and wrapped the shared state store so run creation, run-template validation, workflow validation, and API/console selectors resolve harness profiles from SQLite rather than `.athena/harness-profiles`. Updated diagnostics and the ownership map to classify harness profiles as SQLite app-state.
- `validation_evidence`: `npm --workspace @athena/core run typecheck` passed; `npm --workspace @athena/core run test:unit -- api.server.test.ts control-plane.baseline.test.ts` passed; `npm --workspace @athena/core run test:unit` passed; `./flywheel/tools/validate_workflow_state.sh` passed; `git diff --check` passed.
- `qa_focus`: Confirm old file-backed harness profile JSON is ignored by normal API/runtime paths, run templates and task runs resolve newly created SQLite profiles, and diagnostics no longer list harness profiles as a migration-candidate file root.
- `open_risks`: Existing local file-backed harness profiles are intentionally not imported; operators must recreate needed profiles through the current API if they had pre-existing local files.

## QA Verdict
- `verdict`: Pass.
- `evidence_quality`: Strong. QA reran core typecheck, focused API/control-plane tests, Flywheel workflow validation, and diff whitespace validation. Engineering also ran the full core unit suite.
- `defects`: None found.
- `state_transition`: Move to engineering done.

## Transition History
- `2026-05-28T20:58:54Z`: `intake` -> `active`; activate next SQLite migration story
- `2026-05-28T21:02:53Z`: `active` -> `qa`; engineering handoff ready for harness profiles SQLite migration
- `2026-05-28T21:03:26Z`: `qa` -> `done`; QA passed for harness profiles SQLite migration
