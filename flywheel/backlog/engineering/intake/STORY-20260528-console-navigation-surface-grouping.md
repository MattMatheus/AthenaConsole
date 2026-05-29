---
kind: story
id: STORY-20260528-console-navigation-surface-grouping
status: intake
owner_role: Product Manager
source: epic
success_metric: Console navigation clearly separates primary operator workflows from advanced/admin surfaces.
release_scope: follow-up
ready: false
---

# Story: Console Navigation And Surface Grouping

## Metadata
- `id`: STORY-20260528-console-navigation-surface-grouping
- `owner_role`: Product Manager
- `status`: intake
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

## Draft Acceptance Criteria

1. Primary navigation emphasizes dashboard, agents, workflows, missions, tasks, schedules, and sessions.
2. Advanced/admin/legacy surfaces are grouped, visually separated, or moved out of the primary workflow path.
3. Placeholder pages are not promoted as first-class workflow destinations.
4. Mobile navigation remains usable and does not introduce horizontal overflow.

## Refinement Notes

PM should decide whether advanced surfaces remain in the sidebar under a section label or move into Settings/More.

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
- `2026-05-28T23:55:00Z`: planning intake created for console navigation and surface grouping
