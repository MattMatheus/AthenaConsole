---
kind: story
id: STORY-20260528-first-run-health-readiness
status: done
owner_role: Software Engineer
source: epic
success_metric: A new local operator can tell whether Team Orchestrator is ready to run useful work and what to fix when it is not.
release_scope: follow-up
ready: true
---

# Story: First-Run Health And Readiness

## Metadata
- `id`: STORY-20260528-first-run-health-readiness
- `owner_role`: Software Engineer
- `status`: done
- `source`: epic
- `decision_refs`: [ADR-0006, ADR-0010, ADR-0012, ADR-0013]
- `epic`: docs/product/epics/refinement/2026.23.00-epic-operator-readiness-first-run.md
- `success_metric`: A new local operator can tell whether Team Orchestrator is ready to run useful work and what to fix when it is not.
- `release_scope`: follow-up
- `pm_refinement`: Build an API-first readiness contract with tests and documentation hooks. Console rendering belongs to the later onboarding story unless engineering finds an existing health surface that needs a small label/link update.

## Problem Statement

The product has health and diagnostics pieces, but a first-run operator still has to infer whether the API, app-state, plugins, runtime provider, and sample/demo path are ready.

## Scope

- In: readiness service/API contract, safe diagnostic categories, actionable missing/failing checks, expected local outputs, focused tests, docs hook for quickstart follow-up.
- Out: hosted onboarding, account setup, broad console redesign, new runtime backends, sample workflow implementation.

## Acceptance Criteria

1. A stable readiness response reports API status, SQLite app-state path/migration health, plugin index status, runtime/provider posture, and sample/demo availability.
2. Readiness output avoids secrets and payload contents.
3. Each degraded or failing category includes a concise operator-facing next step.
4. Readiness distinguishes required blockers from optional/demo-only gaps.
5. Existing health/admin diagnostics continue to work.

## Validation

- Required checks: core typecheck; focused readiness service/API tests; existing diagnostics regression coverage; docs consistency review for surfaced command/URL; `./flywheel/tools/validate_workflow_state.sh`.

## Dependencies

- Requires `docs/product/epics/refinement/2026.23.00-epic-operator-readiness-first-run.md`.

## Risks

- Readiness can become noisy if it exposes implementation details rather than operator decisions.

## Next Step

Engineering should keep this API-first and only touch console UI if an existing health/admin route already exposes the readiness result.

## Engineering Handoff
- `change_summary`: Added an API-first readiness contract at `GET /api/v1/readiness`, backed by a new control-plane readiness service. The report covers API response, SQLite app-state diagnostics, plugin index posture, runtime/provider posture, and sample/demo workflow availability while distinguishing required checks from optional demo gaps. Updated API contracts/schemas, server coverage, focused service tests, and quickstart command hooks.
- `validation_evidence`: `npm --workspace @athena/core run typecheck`; `npm --workspace @athena/core exec vitest run tests/control-plane.readiness.test.ts tests/api.schemas.test.ts tests/control-plane.api-contracts.test.ts tests/api.server.test.ts`; `npm --workspace @athena/core run test:unit`; `./flywheel/tools/validate_workflow_state.sh`; `git diff --check`.
- `qa_focus`: Verify readiness response shape, status rollup semantics, no secret/payload leakage, existing `/api/v1/health` and `/api/v1/admin/health` behavior, and Flywheel/docs alignment.
- `open_risks`: The sample/demo check is intentionally optional and degraded until the next sample plugin workflow story creates a canonical demo template.

## QA Verdict
- `verdict`: Pass.
- `evidence_quality`: Good. QA reran core typecheck, focused readiness/API/schema/server tests, full core unit suite, workflow-state validation, and whitespace checks.
- `defects`: None. QA found and fixed stale Flywheel/doc lane references caused by the QA transition before final validation.
- `state_transition`: Move to `done`.

## Transition History
- `2026-05-28T22:38:02Z`: `intake` -> `ready`; PM refinement complete for first-run readiness
- `2026-05-28T22:45:19Z`: `ready` -> `active`; Engineering starts first-run readiness
- `2026-05-28T22:52:10Z`: `active` -> `qa`; Engineering handoff complete for first-run readiness
- `2026-05-28T22:52:54Z`: `qa` -> `done`; QA passed for first-run readiness
