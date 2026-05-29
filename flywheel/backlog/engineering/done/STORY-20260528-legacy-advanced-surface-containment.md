---
kind: story
id: STORY-20260528-legacy-advanced-surface-containment
status: done
owner_role: Software Engineer
source: epic
success_metric: Advanced and legacy console surfaces remain available without distracting from the primary operator workflow.
release_scope: follow-up
ready: true
---

# Story: Legacy And Advanced Surface Containment

## Metadata
- `id`: STORY-20260528-legacy-advanced-surface-containment
- `owner_role`: Software Engineer
- `status`: done
- `source`: epic
- `decision_refs`: [ADR-0006, ADR-0012]
- `epic`: docs/product/epics/refinement/2026.24.00-epic-console-product-surface-polish.md
- `success_metric`: Advanced and legacy console surfaces remain available without distracting from the primary operator workflow.
- `release_scope`: follow-up

## Problem Statement

Implemented but specialized surfaces such as legacy DLQ, RBAC, audit trail, run templates, and Resources still expose old implementation language or placeholder copy.

## Initial Scope

- In: visible copy and labels for legacy/admin/advanced pages, placeholder page treatment, top-level route affordances if coordinated with navigation story.
- Out: removal of implemented diagnostics, RBAC model changes, audit/event backend changes.

## PM Refinement

Treat this as a copy and containment story for implemented specialized tools. Keep the legacy DLQ, RBAC, audit trail, run templates, and settings/admin capabilities reachable. Explain specialized terms when they remain visible. Do not remove backend capabilities or change authorization behavior.

## Draft Acceptance Criteria

1. Legacy surfaces are clearly marked as compatibility or diagnostic tools, not recommended first-run paths.
2. Advanced/admin copy explains current Team Orchestrator value in operator terms.
3. Placeholder pages are either made useful or removed from primary visibility.
4. Public-facing copy avoids unexplained `A2A`, `harness profile`, and `persona` terminology unless the page itself defines the concept.
5. No implemented diagnostic/admin route is removed without an explicit replacement path.

## Validation

- `npm --workspace apps/console run typecheck`
- `npm --workspace apps/console run lint`
- Browser QA for affected advanced/admin routes.
- Public copy scan for unexplained advanced terms.
- `./flywheel/tools/validate_workflow_state.sh`

## Refinement Notes

Ready after dashboard polish.

## Engineering Handoff
- `change_summary`: Contained specialized console surfaces through copy and labels while keeping all implemented routes reachable. Renamed the old DLQ navigation to `Compatibility Queue`, changed the DLQ page to explain legacy agent-to-agent messages and dead-letter queues, reframed RBAC as `Access Control`, removed governance/fleet framing from audit/settings copy, replaced visible `harness profile` and `persona` phrasing with operator-facing runtime/profile language, and made Resource Controls copy more useful.
- `validation_evidence`: `npm --workspace apps/console run typecheck`; `npm --workspace apps/console run lint`; `./flywheel/tools/validate_workflow_state.sh`; `git diff --check`; focused visible-copy scans for unexplained `A2A`, `harness profile`, `persona`, and old fleet/governance phrasing; browser QA for `/dlq`, `/rbac`, `/audit-trail`, `/run-templates`, `/resources`, and `/settings` at desktop and 390x900 mobile with no horizontal overflow.
- `qa_focus`: Verify advanced/admin routes remain reachable, the admin/diagnostic nav labels are contained, specialized terms are explained where they appear, and no authorization or backend behavior changed.
- `open_risks`: Internal implementation names and API contracts still include historical terms such as `fleet`, `governance`, and `persona`; this story intentionally changed visible operator copy only.

## QA Verdict
- `verdict`: Pass
- `evidence_quality`: Typecheck, lint, workflow validation, whitespace check, focused visible-copy scans, and desktop/mobile browser QA cover acceptance.
- `defects`: None found.
- `state_transition`: Ready to move from `qa` to `done`.

## Transition History
- `2026-05-28T23:55:00Z`: planning intake created for legacy and advanced surface containment
- `2026-05-29T00:25:53Z`: `intake` -> `ready`; PM refinement complete for legacy and advanced surface containment
- `2026-05-29T01:08:25Z`: `ready` -> `active`; Engineering starts legacy and advanced surface containment
- `2026-05-29T01:11:30Z`: `active` -> `qa`; Engineering handoff ready for legacy and advanced surface containment
- `2026-05-29T01:12:10Z`: `qa` -> `done`; QA passed for legacy and advanced surface containment
