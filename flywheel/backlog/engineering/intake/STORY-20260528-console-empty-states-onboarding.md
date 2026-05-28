---
kind: story
id: STORY-20260528-console-empty-states-onboarding
status: intake
owner_role: Software Engineer
source: epic
success_metric: Empty console surfaces guide a first-run operator to supported next actions.
release_scope: follow-up
ready: false
---

# Story: Console Empty States And Onboarding

## Metadata
- `id`: STORY-20260528-console-empty-states-onboarding
- `owner_role`: Software Engineer
- `status`: intake
- `source`: epic
- `decision_refs`: [ADR-0006, ADR-0012, ADR-0015]
- `epic`: docs/product/epics/refinement/2026.23.00-epic-operator-readiness-first-run.md
- `success_metric`: Empty console surfaces guide a first-run operator to supported next actions.
- `release_scope`: follow-up

## Problem Statement

The console has operational surfaces, but first-run empty states do not consistently explain what the operator can do next with the product as it exists today.

## Scope

- In: empty states for key first-run console surfaces, links to real routes/actions, concise operator copy, focused UI tests.
- Out: broad visual redesign, marketing landing page work, unsupported workflow shortcuts.

## Acceptance Criteria

1. Empty states guide the operator to readiness, agent/plugin inspection, sample run, or create/run workflows where supported.
2. Empty states avoid internal planning jargon.
3. Links and actions point to implemented routes only.
4. Text fits and remains usable across common desktop/mobile widths.

## Validation

- Required checks: console typecheck; focused console tests; browser QA if routes/layout change; `./flywheel/tools/validate_workflow_state.sh`.

## Dependencies

- Recommended after readiness and sample demo stories define the supported first-run actions.

## Risks

- Empty states can overpromise if they link to flows that are not actually complete.

## Next Step

PM refinement should identify the first console surfaces to improve and whether the readiness/sample actions already exist.

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
