---
kind: story
id: STORY-20260603-advanced-surface-containment
status: done
owner_role: frontend-engineer
source: planning
success_metric: Low-level primitives remain accessible but no longer dominate the primary operator path.
release_scope: deferred
ready: false
---

# Story: Advanced Surface Containment

## Metadata
- `id`: STORY-20260603-advanced-surface-containment
- `owner_role`: frontend-engineer
- `status`: done
- `source`: planning
- `decision_refs`: [ARCH-20260603-product-intuition-ia]
- `success_metric`: Low-level primitives remain accessible but no longer dominate the primary operator path.
- `release_scope`: deferred

## Problem Statement
- Agents, workflows, missions, run templates, policies, audit, and diagnostics all need to exist, but they should not all compete as primary next actions for a new operator.

## Scope
- In:
  - Update navigation grouping based on the IA decision.
  - Preserve routes and deep links where practical.
  - Keep author/admin/diagnostic surfaces findable under advanced or configure sections.
- Out:
  - Removing data models or API routes.
  - Changing backend authorization semantics.

## Assumptions
- Navigation changes can be made without breaking route compatibility.
- Existing primitive routes remain registered and directly reachable.
- This slice changes sidebar grouping/labels only; deeper page-level redesign stays in existing follow-up stories.

## Acceptance Criteria
1. Primary navigation emphasizes Start Work, Work History, Capabilities, Resources, and Review or the accepted equivalents.
2. Low-level implementation surfaces are grouped under advanced/configuration.
3. Existing direct URLs still resolve or redirect intentionally.

## Validation
- Required checks:
  - Console typecheck.
  - Route model tests.
- Additional checks:
  - Manual browser smoke for primary and advanced nav.

## Dependencies
- `ARCH-20260603-product-intuition-ia` complete; ADR: `docs/product/architecture/decisions/0025-product-intuition-and-start-work-ia.md`.

## Risks
- Existing users may need clear route labels to find advanced functionality.

## Open Questions
- Which surfaces should remain visible for agent authors by default? Keep them in an Advanced Work section for this slice.

## Next Step
- Move to engineering active.

## Engineering Handoff
- `change_summary`: Extracted sidebar navigation into a tested `navigationModel`; updated primary operator navigation to Dashboard, Start Work, Work History, Capabilities, Resources, and Review; moved primitive work surfaces into Advanced Work; moved admin/docs surfaces into Admin; preserved all existing route registrations and direct URLs.
- `validation_evidence`: `npm --workspace @athena/console run typecheck` passed; `npm --workspace @athena/console run test` passed with 19 files / 67 tests including navigation model coverage; `npm --workspace @athena/console run lint` passed; `git diff --check` passed; browser smoke verified primary labels, Advanced Work labels, and direct `/tasks` and `/workflows` URLs still resolve.
- `qa_focus`: Verify the new sidebar grouping matches ADR 0025; check whether "Review" as the Memory surface label is clear enough for this interim slice; verify direct deep links still feel intentional.
- `open_risks`: This slice changes navigation labels/grouping only. Deeper page copy and docs alignment remain in the docs follow-up story.

## QA Verdict
- `verdict`: pass
- `evidence_quality`: Good. Console typecheck, full console test suite, lint, diff whitespace check, Flywheel validation, navigation model tests, and browser smoke passed. Browser smoke verified primary operator labels, Advanced Work labels, and direct `/tasks` and `/workflows` URL preservation.
- `defects`: None filed. Residual risk: "Review" currently maps to the Memory page as an interim label; docs/page-copy alignment should clarify this in the next story.
- `state_transition`: move to done

## Transition History
- `2026-06-04T02:02:41Z`: `intake` -> `active`; ADR 0025 accepted and navigation containment scope refined
- `2026-06-04T02:04:29Z`: `active` -> `qa`; implementation complete and validation passed
- `2026-06-04T02:05:01Z`: `qa` -> `done`; QA pass for advanced surface containment
