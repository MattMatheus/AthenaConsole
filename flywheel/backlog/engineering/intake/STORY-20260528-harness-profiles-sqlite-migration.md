---
kind: story
id: STORY-20260528-harness-profiles-sqlite-migration
status: intake
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
- `status`: intake
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
- `change_summary`:
- `validation_evidence`:
- `qa_focus`:
- `open_risks`:

## QA Verdict
- `verdict`:
- `evidence_quality`:
- `defects`:
- `state_transition`:
