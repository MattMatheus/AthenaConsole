---
kind: story
id: STORY-20260530-remove-fleet-compatibility
status: done
owner_role: Senior Engineer
source: direct
success_metric: Operations telemetry is canonical and fleet compatibility aliases/contracts are removed.
release_scope: required
ready: false
---

# Story: Remove Fleet Compatibility

## Metadata
- `id`: STORY-20260530-remove-fleet-compatibility
- `owner_role`: Senior Engineer
- `status`: done
- `source`: direct
- `decision_refs`: [0006, 0012, 0015]
- `epic`: docs/product/epics/refinement/2026.32.00-epic-useful-feature-migration-and-legacy-removal.md
- `success_metric`: Operations telemetry is canonical and fleet compatibility aliases/contracts are removed.
- `release_scope`: required

## Problem Statement

Operations telemetry has been brought forward, but old fleet aliases and internal compatibility naming remain. Compatibility is not required, so the product should remove fleet routes, contracts, docs, and tests after operations behavior is canonical.

## Scope
- In: remove `/api/fleet/*` and `/api/v1/fleet/*`; remove `personaBreakdown` compatibility from operations cost contracts when safe; rename remaining fleet-named API schemas, service contracts, tests, docs, and RBAC permissions to operations naming.
- Out: changing operations telemetry semantics or removing the operations dashboard/cost export.

## Acceptance Criteria
1. Operations routes are the only telemetry/cost API routes.
2. Fleet route aliases are removed from route registration, API contracts, schemas, and tests.
3. Fleet-named RBAC permissions are replaced with operations permissions.
4. Current docs and console source have no fleet terminology outside archived history.
5. Operations telemetry tests cover summary, cost settings, and CSV export.

## Validation
- Required checks: core typecheck, schema check, focused API tests, console typecheck/tests, `rg "\\bfleet\\b|\\bFleet\\b" apps/console/src packages/core/src packages/core/docs docs/developer --glob '!**/dist/**'`, `git diff --check`.

## Dependencies
- Operations telemetry rename.

## Risks
- Some internal filenames may be widely referenced; keep the edit focused but complete enough that public/current source no longer teaches fleet as a concept.

## Engineering Handoff
- `change_summary`: Removed legacy telemetry compatibility aliases and completed the operations naming migration. `/api/v1/operations/*` and `/api/operations/*` are now the only telemetry/cost routes; `/api/v1/fleet/*` no longer registers. Renamed service/contracts/parsers/helpers/tests from fleet to operations, replaced fleet RBAC permissions with operations permissions, removed `personaBreakdown` from the operations cost contract/CSV, and updated current docs/config to use `ATHENA_OPERATIONS_METRICS_PROVIDER`.
- `validation_evidence`: `npm --workspace @athena/core exec vitest run tests/api.server.test.ts tests/api.route-registration.test.ts tests/api.schemas.test.ts tests/control-plane.operations-cost-summary.test.ts tests/control-plane.policy-operations.test.ts tests/config.test.ts tests/control-plane.authorization.test.ts`; `npm --workspace @athena/core run typecheck`; `npm --workspace @athena/core run check:schemas`; `npm --workspace @athena/console run typecheck`; `npm --workspace @athena/console run build`; `rg "fleet|Fleet|personaBreakdown|getProviderCostSettings|putProviderCostSettings|getFleet|FLEET|mock-metrics-provider" apps/console/src packages/core/src packages/core/docs docs/developer`; `git diff --check`.
- `qa_focus`: Confirm operations summary, provider cost settings update/read, and CSV export still work; confirm removed telemetry aliases return 404; verify current source/docs no longer present fleet as an active concept.
- `open_risks`: Existing dirty worktree contains prior story changes and generated artifacts not committed in this cycle; this story avoided reverting or reshaping unrelated changes.

## QA Verdict
- `verdict`: Pass
- `evidence_quality`: Focused API/schema/service/config tests, core and console typechecks, console production build, source terminology grep, and whitespace checks passed.
- `defects`: None found.
- `state_transition`: Ready for `active` -> `done`.

## Transition History
- `2026-05-31T01:10:58Z`: `intake` -> `active`
- `2026-05-31T01:17:52Z`: `active` -> `done`
