---
kind: story
id: STORY-20260530-operations-telemetry-rename
status: done
owner_role: Software Architect
source: direct
success_metric: Fleet-branded operator telemetry has a current Team Orchestrator name with compatibility preserved.
release_scope: required
ready: false
---

# Story: Operations Telemetry Rename

## Metadata
- `id`: STORY-20260530-operations-telemetry-rename
- `owner_role`: Software Architect
- `status`: done
- `source`: direct
- `decision_refs`: [0006, 0012, 0015]
- `success_metric`: Fleet-branded operator telemetry has a current Team Orchestrator name with compatibility preserved.
- `release_scope`: required

## Problem Statement

The `fleet` name survives in the dashboard, service layer, API routes, RBAC permissions, and cost summary contracts. The capability is still useful, but the name reflects an older fleet-governance product direction rather than current operations telemetry for local agent work.

## Scope
- In: decide target name; add current-name API routes while preserving `/api/v1/fleet/*` aliases; rename frontend feature folders/components; update visible copy; introduce compatibility-aware contract fields such as `agentBreakdown` where practical.
- Out: removing fleet aliases immediately, changing cost calculation semantics, or package-wide Athena renames.

## Assumptions
- Runtime health, cost usage, and capability telemetry remain product-relevant.
- Existing tests should keep alias compatibility explicit.

## Acceptance Criteria
1. A target name is selected and applied consistently in operator-visible UI.
2. Current-name API routes exist for summary, cost settings, and cost export.
3. Existing `/api/v1/fleet/*` routes continue to work as deprecated aliases.
4. Tests cover both current routes and alias compatibility.
5. Documentation uses the new terminology for current workflows.

## Validation
- Required checks: `npm --workspace @athena/core run typecheck`, focused API tests, `npm --workspace @athena/console run typecheck`, focused console tests if affected, `git diff --check`.
- Additional checks: `rg "fleet"` review for intentional compatibility leftovers.

## Dependencies
- Code retirement audit.

## Risks
- This touches API contracts, RBAC names, frontend services, and docs; it should be broken down further if it grows too large.

## Open Questions
- Preferred name: Operations, Runtime Health, Operator Telemetry, or another product term?

## Next Step
- Architecture/PM should choose the target naming before engineering starts.

## Engineering Handoff
- `change_summary`: Selected `Operations` as the current product name; moved the console feature from `features/fleet` to `features/operations`; renamed dashboard/service/component symbols to operations naming; added `/api/operations/*` and `/api/v1/operations/*` routes for summary, cost settings, and cost CSV while preserving `/api/fleet/*` and `/api/v1/fleet/*` aliases; added `agentBreakdown` to the cost summary contract while retaining `personaBreakdown`; added current operations RBAC permission names while retaining legacy fleet permission names.
- `validation_evidence`: `npm --workspace @athena/core run typecheck` passed; `npm --workspace @athena/core run check:schemas` passed; `npm --workspace @athena/core run test:unit -- tests/api.server.test.ts tests/api.schemas.test.ts tests/control-plane.fleet-cost-summary.test.ts tests/control-plane.authorization.test.ts` passed (4 files, 25 tests); `npm --workspace @athena/console run typecheck` passed; `npm --workspace @athena/console run test` passed (13 files, 43 tests); `rg "features/fleet|FleetDashboard|FleetApiService|/fleet|\\bfleet\\b|\\bFleet\\b" apps/console/src --glob '!**/dist/**'` returned no matches; `git diff --check` passed; `./flywheel/tools/validate_workflow_state.sh --format json` passed.
- `qa_focus`: Confirm operations routes are the current route family for frontend calls, old fleet aliases still work for API callers, the CSV export exposes both current `agentName` and legacy `personaName` sections, and current docs use Operations terminology.
- `open_risks`: Backend class/file names such as `LocalFleetService`, `FleetSummary`, and `fleet-events-policy` remain as compatibility internals to avoid widening the change into a package-wide migration.

## QA Verdict
- `verdict`: Pass
- `evidence_quality`: Core and console typechecks passed; schema check passed; focused API/schema/authorization tests passed; full console test suite passed; app-source fleet scan confirmed no operator-facing console leftovers.
- `defects`: None found.
- `state_transition`: Move to done.

## Transition History
- `2026-05-30T23:56:48Z`: `intake` -> `active`
- `2026-05-31T00:04:51Z`: `active` -> `qa`
- `2026-05-31T00:05:02Z`: `qa` -> `done`
