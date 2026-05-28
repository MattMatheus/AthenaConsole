---
kind: story
id: STORY-20260528-first-run-health-readiness
status: intake
owner_role: Software Engineer
source: epic
success_metric: A new local operator can tell whether Team Orchestrator is ready to run useful work and what to fix when it is not.
release_scope: follow-up
ready: false
---

# Story: First-Run Health And Readiness

## Metadata
- `id`: STORY-20260528-first-run-health-readiness
- `owner_role`: Software Engineer
- `status`: intake
- `source`: epic
- `decision_refs`: [ADR-0006, ADR-0010, ADR-0012, ADR-0013]
- `epic`: docs/product/epics/refinement/2026.23.00-epic-operator-readiness-first-run.md
- `success_metric`: A new local operator can tell whether Team Orchestrator is ready to run useful work and what to fix when it is not.
- `release_scope`: follow-up

## Problem Statement

The product has health and diagnostics pieces, but a first-run operator still has to infer whether the API, app-state, plugins, runtime provider, and sample/demo path are ready.

## Scope

- In: readiness status contract, safe diagnostic categories, actionable missing/failing checks, tests.
- Out: hosted onboarding, account setup, broad console redesign.

## Acceptance Criteria

1. Readiness reports API status, SQLite app-state path/migration health, plugin index status, runtime/provider posture, and sample/demo availability.
2. Readiness output avoids secrets and payload contents.
3. Failure states include concise operator next steps.
4. Existing health/admin diagnostics continue to work.

## Validation

- Required checks: core typecheck; focused readiness/API tests; docs consistency review; `./flywheel/tools/validate_workflow_state.sh`.

## Dependencies

- Requires `docs/product/epics/refinement/2026.23.00-epic-operator-readiness-first-run.md`.

## Risks

- Readiness can become noisy if it exposes implementation details rather than operator decisions.

## Next Step

PM refinement should decide whether readiness is API-only first or API plus console surface in the same story.

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
