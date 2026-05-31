---
kind: story
id: STORY-20260531-readiness-first-run-clarity
status: intake
owner_role: Software Engineer
source: operator-testing
success_metric: The dashboard clearly distinguishes demo readiness, real-work readiness, and server-hardening warnings.
release_scope: next
ready: false
---

# Story: Readiness First-Run Clarity

## Metadata
- `id`: STORY-20260531-readiness-first-run-clarity
- `owner_role`: Software Engineer
- `status`: intake
- `source`: operator-testing
- `decision_refs`: [ADR-0013]
- `epic`: docs/product/epics/refinement/2026.33.00-epic-first-real-work-confidence.md
- `success_metric`: The dashboard clearly distinguishes demo readiness, real-work readiness, and server-hardening warnings.
- `release_scope`: next

## Problem Statement

The dashboard can show global readiness as degraded even when the credential-free demo and local operator loop are usable. In the audited local stack, warnings for local secret root and unauthenticated external binding were valuable, but they made the first-run state feel more blocked than it was.

## Initial Scope

- In: classify readiness into user-facing lanes such as demo readiness, real-work readiness, provider readiness, and server-hardening warnings.
- In: dashboard copy and status badges that tell the operator whether they can run the demo now.
- Out: changing security defaults, hiding genuine required failures, local-server deployment redesign.

## Acceptance Criteria

1. Dashboard top-level status tells a new user whether the first-run demo can proceed.
2. Server-hardening warnings are still visible but do not obscure demo readiness.
3. Optional provider/secret warnings explain when they matter for model-backed or server deployments.
4. Required failures remain prominent and actionable.
5. Readiness API and UI behavior are covered by tests for ready, degraded-demo-usable, and blocked states.

## Validation

- Focused readiness service tests for classification.
- Console tests for dashboard readiness rendering and next-action copy.
- Browser QA on the dashboard with the local compose profile.
- `npm --workspace @athena/core run typecheck`
- `npm --workspace @athena/console run typecheck`
- `npm --workspace @athena/console run test`
- `git diff --check`

## Refinement Notes

Do not soften security warnings. The improvement is priority and framing: "you can run the local demo" and "do this before LAN/server exposure" can both be true.

