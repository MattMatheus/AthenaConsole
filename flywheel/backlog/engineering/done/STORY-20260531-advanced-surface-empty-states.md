---
kind: story
id: STORY-20260531-advanced-surface-empty-states
status: done
owner_role: Software Engineer
source: operator-testing
success_metric: Advanced/admin pages show intentional empty, disabled, or not-configured states instead of raw Not found responses.
release_scope: next
ready: true
---

# Story: Advanced Surface Empty States

## Metadata
- `id`: STORY-20260531-advanced-surface-empty-states
- `owner_role`: Software Engineer
- `status`: done
- `source`: operator-testing
- `decision_refs`: [ADR-0013]
- `epic`: docs/product/epics/refinement/2026.33.00-epic-first-real-work-confidence.md
- `success_metric`: Advanced/admin pages show intentional empty, disabled, or not-configured states instead of raw Not found responses.
- `release_scope`: next

## Problem Statement

Advanced/admin pages such as Audit Trail, Access Control, and Failed Work can render normal page chrome and then display raw "Not found" messages after loading. To a small-team operator, this looks like broken product surface rather than an unavailable feature or empty local state.

## Initial Scope

- In: replace raw 404/Not found render states on advanced/admin pages with intentional UI states.
- In: add route fallback or redirect for obvious documentation URL mismatch, such as `/documentation` to `/docs`.
- In: decide whether unavailable admin surfaces should remain visible in nav, move behind diagnostics, or show local-profile requirements.
- Out: implementing full RBAC/audit/failed-work capabilities if the APIs are intentionally absent in the current profile.

## Acceptance Criteria

1. Audit Trail, Access Control, and Failed Work do not show raw "Not found" as their primary body state.
2. Empty-state copy explains whether the feature has no data, is not configured, or is unavailable in the current local profile.
3. The console has a friendly route fallback for `/documentation` or redirects it to `/docs`.
4. Navigation labels make advanced/admin surfaces feel secondary to the first operator loop.
5. Tests cover unavailable API responses and route fallback behavior.

## Validation

- Console tests for admin page empty/error states.
- API client tests or mocks for 404/unavailable responses where relevant.
- Browser QA on `/audit-trail`, `/rbac`, `/failed-work`, `/docs`, and `/documentation`.
- `npm --workspace @athena/console run typecheck`
- `npm --workspace @athena/console run test`
- `git diff --check`

## Refinement Notes

This is a product polish story, not a mandate to build all admin features. The operator should feel that advanced surfaces are intentionally scoped, not accidentally broken.

Ready for one-cycle execution. Keep the implementation focused on existing advanced/admin console routes that currently surface raw not-found responses or route mismatch confusion, plus tests that lock the operator-facing states.

## Engineering Handoff

- `change_summary`: Implemented shared advanced-surface state classification for unavailable or restricted admin APIs and wired it into Audit Trail, Access Control, and Failed Work. These pages now show explicit local-profile or privilege notices instead of exposing raw `Not found` API messages as the primary body state. Also added a `/documentation` route alias that redirects to `/docs`, renamed the nav group to `Advanced admin`, and added console unit tests for the route alias plus unavailable/restricted admin API states.
- `validation_evidence`: `npm --workspace @athena/console exec -- vitest run src/pages/advancedSurfaceState.test.ts src/app/routeModel.test.ts`; `npm --workspace @athena/console run typecheck`; `npm --workspace @athena/console run test`; `git diff --check`; Firefox browser QA after restarting the console container: `/documentation` redirects to `/docs`, `/audit-trail`, `/rbac`, and `/failed-work` show intentional local-profile notices, and the sidebar groups these surfaces under `Advanced admin`.
- `qa_focus`: Confirm unavailable-profile copy remains useful for local-first operators and does not imply the primary task/run loop is blocked; confirm route alias behavior on direct page load, not only client-side navigation.
- `open_risks`: Current local API profile returns unavailable notices for the three advanced surfaces, so browser QA exercised the not-configured path directly. Empty-data table states remain covered by existing page behavior rather than new DOM tests because this console test suite currently uses node-level model tests instead of a browser render harness.

## Transition History
- `2026-05-31T03:16:19Z`: `intake` -> `active`; promoted for next operator-polish cycle
- `2026-05-31T03:21:02Z`: `active` -> `qa`; engineering handoff ready

## QA Verdict

- `verdict`: pass
- `qa_timestamp`: 2026-05-31T03:24:00Z
- `evidence_quality`: strong for the observed local-profile route behavior and console model coverage; moderate for full page rendering because the repository does not currently include a DOM render test harness.
- `validation_evidence`: Reviewed engineering evidence; re-ran `git diff --check`; Firefox QA confirmed direct `/documentation` navigation redirects to `/docs`, the sidebar labels the section `Advanced admin`, and `/audit-trail`, `/rbac`, and `/failed-work` render specific local-profile notices instead of raw `Not found` or React Router error pages.
- `defects`: none blocking
- `state_transition`: move to `done`
- `notes`: Acceptance criteria are met for the local profile under test. The advanced API-not-configured case is now explicit and does not imply the primary task/run loop is blocked.
- `2026-05-31T03:22:02Z`: `qa` -> `done`; QA passed advanced surface empty-state repair
