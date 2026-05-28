---
kind: story
id: STORY-20260528-state-store-startup-diagnostics
status: done
owner_role: Software Engineer
source: epic
success_metric: Operators and maintainers can see which persistence stores are active for the local control plane.
release_scope: follow-up
ready: false
---

# Story: Add State Store Startup Diagnostics

## Metadata
- `id`: STORY-20260528-state-store-startup-diagnostics
- `owner_role`: Software Engineer
- `status`: done
- `source`: epic
- `decision_refs`: [ADR-0010, ADR-0015]
- `epic`: docs/product/epics/refinement/2026.22.00-epic-state-ownership-and-sqlite-migration.md
- `success_metric`: Operators and maintainers can see which persistence stores are active for the local control plane.
- `release_scope`: follow-up

## Problem Statement

The control plane uses SQLite app-state plus intentional file artifact stores, and some deprecated file-backed stores may remain until removal stories land. Startup does not make those active stores visible.

## Scope

- In: startup/admin diagnostics for SQLite path, intentional file artifact roots, deprecated file-backed roots that still need removal, ownership categories from the architecture map, tests for diagnostics payload/log formatting.
- Out: migrating any state domain, changing health status semantics for healthy stores, adding a console diagnostics page unless needed for acceptance.

## Acceptance Criteria

1. Diagnostics report SQLite app-state location, intentional file artifact roots, and any deprecated file-backed roots still present.
2. Diagnostics use the ownership categories from `ARCH-20260528-state-ownership-map`.
3. Output is stable enough for tests and does not expose secrets.
4. Existing health/admin health behavior remains stable unless explicitly extended.

## Validation

- Required checks: core typecheck; focused config/server diagnostics tests; `git diff --check`; `./flywheel/tools/validate_workflow_state.sh`.

## Dependencies

- Requires `ARCH-20260528-state-ownership-map`.

## Risks

- Diagnostics could leak local absolute paths in contexts where that is undesirable; QA should review output scope.

## Next Step

PM refinement should decide whether diagnostics are log-only, admin-health payload, or both.

## Engineering Handoff
- `change_summary`: Added a state diagnostics service, exposed its payload on `/api/v1/admin/health`, and emitted a `STATE_STORES_ACTIVE` startup event. Diagnostics report the SQLite app-state path, intentional file artifact/support roots, migration candidates, and deprecated legacy workflow file roots using the architecture map categories.
- `validation_evidence`: `npm --workspace @athena/core run typecheck` passed; `npm --workspace @athena/core run test:unit -- api.server.test.ts api.schemas.test.ts` passed; `npm --workspace @athena/core run test:unit` passed; `./flywheel/tools/validate_workflow_state.sh` passed; `git diff --check` passed.
- `qa_focus`: Confirm public `/api/v1/health` remains unchanged, admin health includes state store diagnostics, startup emits diagnostics once, and diagnostics do not include secret values or payload contents.
- `open_risks`: Diagnostics intentionally expose local filesystem paths for operator troubleshooting; this should remain limited to admin health and startup telemetry.

## QA Verdict
- `verdict`: Pass.
- `evidence_quality`: Strong. QA reran core typecheck, focused API/schema unit tests, Flywheel state validation, and diff whitespace validation. Engineering also ran the full core unit suite.
- `defects`: None found.
- `state_transition`: Move to engineering done.

## Transition History
- `2026-05-28T20:31:23Z`: `intake` -> `active`; activate first engineering story after state ownership map
- `2026-05-28T20:35:51Z`: `active` -> `qa`; engineering handoff ready for state diagnostics
- `2026-05-28T20:36:32Z`: `qa` -> `done`; QA passed for state store diagnostics
