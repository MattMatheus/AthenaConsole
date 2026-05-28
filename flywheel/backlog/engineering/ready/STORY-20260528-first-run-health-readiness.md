---
kind: story
id: STORY-20260528-first-run-health-readiness
status: ready
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
- `status`: ready
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
- `change_summary`:
- `validation_evidence`:
- `qa_focus`:
- `open_risks`:

## QA Verdict
- `verdict`:
- `evidence_quality`:
- `defects`:
- `state_transition`:

## Transition History
- `2026-05-28T22:38:02Z`: `intake` -> `ready`; PM refinement complete for first-run readiness
