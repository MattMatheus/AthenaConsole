---
kind: story
id: STORY-20260531-advanced-surface-empty-states
status: intake
owner_role: Software Engineer
source: operator-testing
success_metric: Advanced/admin pages show intentional empty, disabled, or not-configured states instead of raw Not found responses.
release_scope: next
ready: false
---

# Story: Advanced Surface Empty States

## Metadata
- `id`: STORY-20260531-advanced-surface-empty-states
- `owner_role`: Software Engineer
- `status`: intake
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
