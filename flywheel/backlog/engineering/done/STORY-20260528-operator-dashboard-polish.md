---
kind: story
id: STORY-20260528-operator-dashboard-polish
status: done
owner_role: Software Engineer
source: epic
success_metric: Dashboard reads as a practical Team Orchestrator operator home rather than a fleet/governance holdover.
release_scope: follow-up
ready: true
---

# Story: Operator Dashboard Polish

## Metadata
- `id`: STORY-20260528-operator-dashboard-polish
- `owner_role`: Software Engineer
- `status`: done
- `source`: epic
- `decision_refs`: [ADR-0006, ADR-0012]
- `epic`: docs/product/epics/refinement/2026.24.00-epic-console-product-surface-polish.md
- `success_metric`: Dashboard reads as a practical Team Orchestrator operator home rather than a fleet/governance holdover.
- `release_scope`: follow-up

## Problem Statement

The dashboard still uses fleet/governance framing and cost/provider widgets from earlier direction. That weakens the first impression after the new quickstart and onboarding work.

## Initial Scope

- In: dashboard lead copy, panel labels, metric labels, recent events framing, next-action layout, first-run guidance balance.
- Out: new backend dashboard endpoints unless PM refinement determines existing APIs cannot support the polish.

## PM Refinement

Use existing dashboard/readiness/fleet summary data first. Reframe visible labels and layout around operator readiness, active work, recent activity, and next actions. If a metric is not meaningful with current data, relabel or de-emphasize it rather than adding a backend endpoint. Do not remove the first-run panel; make it coexist with repeat-operator usage.

## Draft Acceptance Criteria

1. Dashboard copy centers local orchestration readiness, active work, recent activity, and next operator actions.
2. Fleet/governance wording is removed or reframed where it appears on the dashboard.
3. First-run guidance remains useful without dominating repeat usage.
4. Browser QA covers dashboard at desktop and mobile widths.
5. Existing dashboard data failures still show actionable error/empty states.

## Validation

- `npm --workspace apps/console run typecheck`
- `npm --workspace apps/console run lint`
- Focused console tests if dashboard model logic changes.
- Browser QA for `/` at desktop and mobile widths.
- Public copy scan for `fleet` and `governance` in dashboard-facing UI.
- `./flywheel/tools/validate_workflow_state.sh`

## Refinement Notes

Ready after navigation grouping.

## Engineering Handoff
- `change_summary`: Reframed the dashboard lead, metrics, usage panels, recent activity empty state, and loading/error copy around local orchestration readiness, active work, recent operator activity, and next actions. Moved the readiness/first-run panel below the live dashboard summary so repeat usage is not dominated by onboarding. Kept existing data APIs and internal implementation identifiers unchanged.
- `validation_evidence`: `npm --workspace apps/console run typecheck`; `npm --workspace apps/console run lint`; `./flywheel/tools/validate_workflow_state.sh`; `git diff --check`; visible dashboard copy scan found no old fleet/governance wording; browser smoke for `/` at desktop and 390x900 mobile confirmed updated headings/copy and no horizontal overflow.
- `qa_focus`: Verify the dashboard reads as an operator home, first-run guidance remains available below the summary, old fleet/governance wording is not visible, and data loading/error states remain actionable.
- `open_risks`: Internal component/API names still use the existing fleet summary contract by design because this story did not rename backend endpoints or packages.

## QA Verdict
- `verdict`: Pass
- `evidence_quality`: Typecheck, lint, workflow validation, whitespace check, focused copy scan, and desktop/mobile browser smoke cover acceptance.
- `defects`: None found.
- `state_transition`: Ready to move from `qa` to `done`.

## Transition History
- `2026-05-28T23:55:00Z`: planning intake created for operator dashboard polish
- `2026-05-29T00:25:53Z`: `intake` -> `ready`; PM refinement complete for operator dashboard polish
- `2026-05-29T00:58:44Z`: `ready` -> `active`; Engineering starts operator dashboard polish
- `2026-05-29T01:01:45Z`: `active` -> `qa`; Engineering handoff ready for operator dashboard polish
- `2026-05-29T01:02:16Z`: `qa` -> `done`; QA passed for operator dashboard polish
