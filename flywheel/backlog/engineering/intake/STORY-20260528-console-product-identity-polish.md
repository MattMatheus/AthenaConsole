---
kind: story
id: STORY-20260528-console-product-identity-polish
status: intake
owner_role: Product Manager
source: epic
success_metric: Console shell and public UI copy consistently present Team Orchestrator as the product.
release_scope: follow-up
ready: false
---

# Story: Console Product Identity Polish

## Metadata
- `id`: STORY-20260528-console-product-identity-polish
- `owner_role`: Product Manager
- `status`: intake
- `source`: epic
- `decision_refs`: [ADR-0006]
- `epic`: docs/product/epics/refinement/2026.24.00-epic-console-product-surface-polish.md
- `success_metric`: Console shell and public UI copy consistently present Team Orchestrator as the product.
- `release_scope`: follow-up

## Problem Statement

The console still exposes earlier product identity in visible UI, including `ProjectAthena` branding and old-direction terminology that makes the app feel internally transitional.

## Initial Scope

- In: app shell branding, auth gate branding, visible copy scans, route/page titles where old product identity leaks.
- Out: package renames, API path changes, storage key migrations, repository rename.

## Draft Acceptance Criteria

1. Sidebar and auth gate use Team Orchestrator branding.
2. User-facing copy avoids unexplained `ProjectAthena`, legacy direction labels, and internal planning terms.
3. Any retained `athena` names are implementation-only and not newly exposed in the operator UI.
4. Browser QA covers shell/auth-visible routes at desktop and mobile widths.

## Refinement Notes

PM should confirm whether the visible product name is `Team Orchestrator` everywhere or whether a shorter console brand is preferred in tight UI.

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
- `2026-05-28T23:55:00Z`: planning intake created for console product identity polish
