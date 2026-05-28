---
kind: story
id: STORY-20260528-console-empty-states-onboarding
status: ready
owner_role: Software Engineer
source: epic
success_metric: Empty console surfaces guide a first-run operator to supported next actions.
release_scope: follow-up
ready: true
---

# Story: Console Empty States And Onboarding

## Metadata
- `id`: STORY-20260528-console-empty-states-onboarding
- `owner_role`: Software Engineer
- `status`: ready
- `source`: epic
- `decision_refs`: [ADR-0006, ADR-0012, ADR-0015]
- `epic`: docs/product/epics/refinement/2026.23.00-epic-operator-readiness-first-run.md
- `success_metric`: Empty console surfaces guide a first-run operator to supported next actions.
- `release_scope`: follow-up
- `pm_refinement`: Limit UI work to first-run empty states on implemented console surfaces. Copy should point to readiness, catalog/sample inspection, and supported run creation only after those routes exist.

## Problem Statement

The console has operational surfaces, but first-run empty states do not consistently explain what the operator can do next with the product as it exists today.

## Scope

- In: empty states for key first-run console surfaces, links to real routes/actions, concise operator copy, focused UI tests, browser QA for affected routes.
- Out: broad visual redesign, marketing landing page work, unsupported workflow shortcuts.

## Acceptance Criteria

1. Empty states cover the initial console surfaces most likely to be blank after a fresh local start: dashboard/home, agents/plugins, workflow templates/runs, tasks/missions, and schedules where present.
2. Empty states guide the operator to readiness, agent/plugin inspection, sample run, or create/run workflows where supported.
3. Empty states avoid internal planning jargon and do not mention Flywheel, ADRs, or backlog mechanics.
4. Links and actions point to implemented routes only.
5. Text fits and remains usable across common desktop/mobile widths.

## Validation

- Required checks: console typecheck; focused console tests for affected empty states/routes; browser QA across desktop and mobile widths; `./flywheel/tools/validate_workflow_state.sh`.

## Dependencies

- Recommended after readiness and sample demo stories define the supported first-run actions.

## Risks

- Empty states can overpromise if they link to flows that are not actually complete.

## Next Step

Engineering should update only routes backed by implemented readiness/sample/catalog behavior and leave placeholders out of the UI.

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
- `2026-05-28T22:38:02Z`: `intake` -> `ready`; PM refinement complete for first-run console onboarding
