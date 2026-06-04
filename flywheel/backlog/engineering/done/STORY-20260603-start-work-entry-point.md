---
kind: story
id: STORY-20260603-start-work-entry-point
status: done
owner_role: frontend-engineer
source: planning
success_metric: A new operator sees Start Work as the obvious primary action from the dashboard and navigation.
release_scope: deferred
ready: false
---

# Story: Start Work Entry Point

## Metadata
- `id`: STORY-20260603-start-work-entry-point
- `owner_role`: frontend-engineer
- `status`: done
- `source`: planning
- `decision_refs`: [ARCH-20260603-product-intuition-ia]
- `success_metric`: A new operator sees Start Work as the obvious primary action from the dashboard and navigation.
- `release_scope`: deferred

## Problem Statement
- The dashboard currently asks users to choose between task, workflow, schedule, and run preset before they have selected an outcome.
- Add an intent-led Start Work surface that presents useful capabilities first.

## Scope
- In:
  - Add a Start Work route and make it the dashboard primary action.
  - Present bundled first-run, software-team, and GitHub outcomes as cards/actions.
  - Link selected outcomes into existing task/workflow creation paths with useful query parameters where current screens support them.
  - Keep existing task/workflow routes available.
- Out:
  - New connectors.
  - Backend domain model changes.
  - Natural-language autonomous planning.

## Assumptions
- Capability metadata from existing plugins/workflow templates is sufficient for an initial curated surface.
- ADR 0025 defines the initial IA: Start Work is primary; primitives remain reachable.
- The first slice may use curated capability cards and existing routes rather than adding a new backend capability registry.

## Acceptance Criteria
1. Dashboard primary CTA points to Start Work or an equivalent intent-led section.
2. Start Work shows outcome-oriented options instead of task/workflow primitive choices.
3. Selecting an option carries enough context to continue into existing task/workflow setup.
4. Existing task/workflow routes remain directly reachable.

## Validation
- Required checks:
  - Console typecheck.
  - Focused route/component tests where applicable.
- Additional checks:
  - Manual browser smoke from dashboard to first-run demo and at least one bundled software-team capability.

## Dependencies
- `ARCH-20260603-product-intuition-ia` complete; ADR: `docs/product/architecture/decisions/0025-product-intuition-and-start-work-ia.md`.

## Risks
- The page may become another launcher unless capability cards are curated and action-oriented.

## Open Questions
- Should "Capabilities" replace "Agents" in primary navigation? Deferred to advanced surface containment.

## Next Step
- Move to engineering active.

## Engineering Handoff
- `change_summary`: Added `/start` Start Work route and page with curated outcome cards; added Start Work to primary nav; changed dashboard primary CTA and create-work panel from primitive-led language to outcome-led links; added workflow `templateId` query preselection support; added route model coverage for the Start Work path.
- `validation_evidence`: `npm --workspace @athena/console run typecheck` passed; `npm --workspace @athena/console run test` passed with 18 files / 64 tests; `npm --workspace @athena/console run lint` passed; browser smoke verified dashboard Start Work link, `/start` rendering, first-run card navigation to `/workflows?templateId=first-run.demo.workflow`, and repo-summary card navigation to `/tasks?agentId=bundled.software-team.repo-summary.local&version=0.1.0`.
- `qa_focus`: Confirm Start Work cards feel outcome-led rather than primitive-led; verify direct task/workflow routes remain reachable; verify card links carry useful context once API data is available; review whether the GitHub card wording is sufficiently cautious about credentials.
- `open_risks`: Browser smoke ran with only the console dev server, so workflow/task API calls returned 500; full stack smoke should recheck selected workflow/agent preselection with API running.

## QA Verdict
- `verdict`: pass
- `evidence_quality`: Good for the scoped UI/navigation story. Console typecheck, full console test suite, lint, diff whitespace check, Flywheel validation, and browser smoke all passed. Browser smoke verified navigation and query/context handoff with the console dev server only.
- `defects`: None filed. Residual risk: full API-backed preselection should be rechecked once API and console are running together, because console-only smoke returned expected API 500s on task/workflow data fetches.
- `state_transition`: move to done

## Transition History
- `2026-06-04T01:43:20Z`: `intake` -> `active`; ADR 0025 complete and story refined
- `2026-06-04T01:46:18Z`: `active` -> `qa`; implementation complete and validation passed
- `2026-06-04T01:47:10Z`: `qa` -> `done`; QA pass for Start Work entry point
