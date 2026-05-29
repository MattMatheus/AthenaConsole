---
kind: story
id: STORY-20260528-legacy-advanced-surface-containment
status: intake
owner_role: Product Manager
source: epic
success_metric: Advanced and legacy console surfaces remain available without distracting from the primary operator workflow.
release_scope: follow-up
ready: false
---

# Story: Legacy And Advanced Surface Containment

## Metadata
- `id`: STORY-20260528-legacy-advanced-surface-containment
- `owner_role`: Product Manager
- `status`: intake
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

## Draft Acceptance Criteria

1. Legacy surfaces are clearly marked as compatibility or diagnostic tools, not recommended first-run paths.
2. Advanced/admin copy explains current Team Orchestrator value in operator terms.
3. Placeholder pages are either made useful or removed from primary visibility.
4. Public-facing copy avoids unexplained `A2A`, `harness profile`, and `persona` terminology unless the page itself defines the concept.

## Refinement Notes

PM should decide which terms are acceptable technical vocabulary for advanced users and which need product-language replacements.

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
- `2026-05-28T23:55:00Z`: planning intake created for legacy and advanced surface containment
