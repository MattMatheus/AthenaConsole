---
kind: story
id: STORY-20260528-console-navigation-surface-grouping
status: done
owner_role: Software Engineer
source: epic
success_metric: Console navigation clearly separates primary operator workflows from advanced/admin surfaces.
release_scope: follow-up
ready: true
---

# Story: Console Navigation And Surface Grouping

## Metadata
- `id`: STORY-20260528-console-navigation-surface-grouping
- `owner_role`: Software Engineer
- `status`: done
- `source`: epic
- `decision_refs`: [ADR-0006]
- `epic`: docs/product/epics/refinement/2026.24.00-epic-console-product-surface-polish.md
- `success_metric`: Console navigation clearly separates primary operator workflows from advanced/admin surfaces.
- `release_scope`: follow-up

## Problem Statement

The sidebar presents primary workflow pages, admin tools, legacy diagnostics, and placeholders as one flat list, which makes the first-run and daily operator path harder to read.

## Initial Scope

- In: sidebar order, grouping/separators, route labels, breadcrumb/title labels, top-level visibility for placeholder or advanced routes.
- Out: removing implemented functionality, backend route changes, new role-based navigation permissions.

## PM Refinement

Keep all implemented routes available. Prefer sectioned navigation over hidden routes for this pass: primary workflow surfaces first, then advanced/admin/diagnostic surfaces under a distinct visual grouping. `Resources` should not remain a top-level placeholder unless it gets useful copy in the same story. Coordinate labels with the later legacy/advanced containment story but do not do deep page copy rewrites here.

## Draft Acceptance Criteria

1. Primary navigation emphasizes dashboard, agents, workflows, missions, tasks, schedules, and sessions.
2. Advanced/admin/legacy surfaces are grouped, visually separated, or moved out of the primary workflow path.
3. Placeholder pages are not promoted as first-class workflow destinations.
4. Mobile navigation remains usable and does not introduce horizontal overflow.
5. Breadcrumb/title labels remain accurate after grouping and relabeling.

## Validation

- `npm --workspace apps/console run typecheck`
- `npm --workspace apps/console run lint`
- Browser QA for sidebar and route navigation at desktop and mobile widths.
- Public copy scan for newly introduced labels.
- `./flywheel/tools/validate_workflow_state.sh`

## Refinement Notes

Ready after identity polish.

## Engineering Handoff
- `change_summary`: Reworked the console sidebar into sectioned navigation: `Operate` for daily workflow surfaces, `Configure` for setup surfaces, and `Admin & diagnostics` for restricted or legacy tools. Renamed `Resources` to `Resource Controls`, added useful placeholder copy, and made top-level breadcrumbs reuse route labels for relabeled routes.
- `validation_evidence`: `npm --workspace apps/console run typecheck`; `npm --workspace apps/console run lint`; `./flywheel/tools/validate_workflow_state.sh`; `git diff --check`; Browser desktop smoke at `http://127.0.0.1:5174/` confirmed nav sections/order and no horizontal overflow; Playwright mobile smoke at 390x900 confirmed the sidebar opens with grouped sections, no horizontal overflow, and `Resource Controls` title/breadcrumb/page heading align.
- `qa_focus`: Verify primary workflow links are visually first, advanced/admin/legacy links are separated, `Resource Controls` is not a bare top-level placeholder, and mobile sidebar behavior remains usable.
- `open_risks`: This story intentionally leaves deeper legacy/advanced copy containment for the dedicated follow-up story.

## QA Verdict
- `verdict`: Pass
- `evidence_quality`: Typecheck, lint, workflow validation, whitespace check, desktop browser smoke, and 390px mobile Playwright smoke cover the acceptance criteria.
- `defects`: None found.
- `state_transition`: Ready to move from `qa` to `done`.

## Transition History
- `2026-05-28T23:55:00Z`: planning intake created for console navigation and surface grouping
- `2026-05-29T00:25:53Z`: `intake` -> `ready`; PM refinement complete for console navigation surface grouping
- `2026-05-29T00:32:28Z`: `ready` -> `active`; Engineering starts console navigation surface grouping
- `2026-05-29T00:36:03Z`: `active` -> `qa`; Engineering handoff ready for console navigation surface grouping
- `2026-05-29T00:36:31Z`: `qa` -> `done`; QA passed for console navigation surface grouping
