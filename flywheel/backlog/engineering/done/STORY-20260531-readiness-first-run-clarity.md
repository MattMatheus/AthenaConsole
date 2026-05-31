---
kind: story
id: STORY-20260531-readiness-first-run-clarity
status: done
owner_role: Software Engineer
source: operator-testing
success_metric: The dashboard clearly distinguishes demo readiness, real-work readiness, and server-hardening warnings.
release_scope: next
ready: true
---

# Story: Readiness First-Run Clarity

## Metadata
- `id`: STORY-20260531-readiness-first-run-clarity
- `owner_role`: Software Engineer
- `status`: done
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

Ready for one-cycle execution. Keep the scope to readiness classification and dashboard framing: expose user-facing readiness lanes for demo, real-work/provider setup, and server hardening; keep required failures prominent; avoid changing security defaults or suppressing warnings.

## Transition History
- `2026-05-31T14:16:02Z`: `intake` -> `active`; promoted for readiness first-run clarity cycle

## Engineering Handoff

- `change_summary`: Added readiness lanes to the API report for `first-run-demo`, `real-work`, `provider-setup`, and `server-hardening`. The dashboard now uses the first-run demo lane for its top-level badge and message, so a globally degraded local stack can still clearly say `demo ready` when the credential-free demo can proceed. Provider/secret and server-hardening warnings remain visible in separate lane cards and detailed checks, while required failures still drive a blocked top-level state.
- `validation_evidence`: `npm --workspace @athena/core exec -- vitest run tests/control-plane.readiness.test.ts tests/api.server.test.ts`; `npm --workspace @athena/core exec -- vitest run tests/api.schemas.test.ts tests/control-plane.readiness.test.ts tests/api.server.test.ts`; `npm --workspace @athena/console exec -- vitest run src/features/readiness/api.test.ts src/features/readiness/readinessModel.test.ts`; `npm --workspace @athena/core run typecheck`; `npm --workspace @athena/console run typecheck`; `npm --workspace @athena/core run check:schemas`; `npm --workspace @athena/core run test:unit`; `npm --workspace @athena/console run test`; `npm --workspace @athena/core run validate:manifests`; `git diff --check`; `./flywheel/tools/validate_workflow_state.sh --format json`; live `/api/v1/readiness` returned `status: degraded` with `first-run-demo: ready`, `real-work: ready`, and provider/server lanes degraded; Firefox dashboard QA showed `demo ready`, readiness lane cards, and separated provider/server warnings.
- `qa_focus`: Confirm dashboard top-level copy says whether the demo can run, even when provider/server warnings degrade global readiness. Confirm server-hardening and provider warnings remain visible. Confirm required failures would still present as blocked via the readiness model tests.
- `open_risks`: No open implementation risks. The lane model intentionally does not change security defaults, readiness check severity, or execution gating.
- `2026-05-31T14:23:40Z`: `active` -> `qa`; engineering handoff ready

## QA Verdict

- `verdict`: pass
- `qa_timestamp`: 2026-05-31T14:23:45Z
- `evidence_quality`: Strong. The story has service/API tests for ready, degraded-demo-usable, and blocked states; console parser/model tests for dashboard copy; full core unit and console suites; and browser QA against the local compose profile.
- `validation_evidence`: QA accepted the engineering evidence: focused readiness API/service tests, schema tests, core and console typechecks, `npm --workspace @athena/core run test:unit`, `npm --workspace @athena/console run test`, manifest validation, Flywheel validation, and `git diff --check`. Live dashboard QA confirmed global degraded readiness no longer obscures the demo-ready state and provider/server hardening warnings remain visible.
- `defects`: None blocking.
- `state_transition`: Move to done.
- `notes`: The dashboard now answers the first operator question directly: the credential-free first-run demo can proceed, while hardening/provider warnings explain when they matter.
- `2026-05-31T14:24:26Z`: `qa` -> `done`; QA passed readiness first-run clarity repair
