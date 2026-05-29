---
kind: story
id: STORY-20260528-console-product-identity-polish
status: done
owner_role: Software Engineer
source: epic
success_metric: Console shell and public UI copy consistently present Team Orchestrator as the product.
release_scope: follow-up
ready: true
---

# Story: Console Product Identity Polish

## Metadata
- `id`: STORY-20260528-console-product-identity-polish
- `owner_role`: Software Engineer
- `status`: done
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

## PM Refinement

Use `Team Orchestrator` as the visible product name in the shell and auth gate. Keep implementation identifiers such as package names, local storage keys, API paths, and repository names unchanged. This story should be small and copy-focused; defer nav grouping, dashboard re-layout, and advanced-surface containment to later stories.

## Draft Acceptance Criteria

1. Sidebar and auth gate use Team Orchestrator branding.
2. User-facing copy avoids unexplained `ProjectAthena`, legacy direction labels, and internal planning terms.
3. Any retained `athena` names are implementation-only and not newly exposed in the operator UI.
4. Browser QA covers shell/auth-visible routes at desktop and mobile widths.
5. Console typecheck, lint, and focused public-copy scan pass.

## Validation

- `npm --workspace apps/console run typecheck`
- `npm --workspace apps/console run lint`
- Browser smoke for `/` and auth-gate rendering at desktop and mobile widths.
- Public copy scan for `ProjectAthena` in user-facing console files.
- `./flywheel/tools/validate_workflow_state.sh`

## Refinement Notes

Ready for engineering. Preferred first implementation story for this epic.

## Engineering Handoff
- `change_summary`: Replaced visible `ProjectAthena` branding in the console shell and password gate with `Team Orchestrator`, and adjusted sidebar brand sizing so the longer product name fits cleanly. Implementation identifiers and routes were left unchanged.
- `validation_evidence`: `npm --workspace apps/console run typecheck`; `npm --workspace apps/console run lint`; `rg "ProjectAthena" apps/console/src -n` returned no matches; Playwright browser smoke covered the console shell at `http://127.0.0.1:5174/` and password gate at `http://127.0.0.1:5175/` at 1440x900 and 390x900 with no horizontal overflow and no old product name.
- `qa_focus`: Verify the product name is visible in shell/auth UI, old branding is gone from user-facing console source, and deferred legacy/admin labels remain intentionally out of scope for later stories.
- `open_risks`: `Legacy A2A DLQ` and other advanced-surface terms remain visible by design until the dedicated containment story.

## QA Verdict
- `verdict`: Pass
- `evidence_quality`: Typecheck, lint, workflow validation, source copy scan, and desktop/mobile Playwright smoke all support acceptance.
- `defects`: None found. Deferred `Legacy A2A DLQ` and advanced-surface labels remain tracked in the dedicated containment story.
- `state_transition`: Ready to move from `qa` to `done`.

## Transition History
- `2026-05-28T23:55:00Z`: planning intake created for console product identity polish
- `2026-05-29T00:25:53Z`: `intake` -> `ready`; PM refinement complete for console product identity polish
- `2026-05-29T00:26:44Z`: `ready` -> `active`; Engineering starts console product identity polish
- `2026-05-29T00:28:13Z`: `active` -> `qa`; Engineering handoff ready for console product identity polish
- `2026-05-29T00:29:47Z`: `qa` -> `done`; QA passed for console product identity polish
