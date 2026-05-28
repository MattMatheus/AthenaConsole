---
kind: story
id: STORY-20260528-run-template-console
status: ready
owner_role: Engineer
source: pm
success_metric: Operators can manage and trigger existing run templates from the console without using CLI/API calls directly.
release_scope: deferred
ready: true
---

# Story: Add Run Template Console Surface

## Metadata
- `id`: STORY-20260528-run-template-console
- `owner_role`: Engineer
- `status`: ready
- `source`: pm
- `decision_refs`: [ADR-0009, ADR-0011, docs/product/epics/refinement/2026.18.00-epic-run-templates.md]
- `success_metric`: Operators can manage and trigger existing run templates from the console without using CLI/API calls directly.
- `release_scope`: deferred

## Problem Statement

Run templates already have backend, API, and CLI support, but operators cannot discover, create, or trigger them from the web console.

## Scope
- In: console API client/model helpers, a run-template page or workbench section, create form, trigger form with parameter overrides, loading/error/empty states, and focused frontend tests.
- Out: changing the core run-template schema, scheduling run templates, plugin-packaged run templates, or DAG workflow behavior.

## Assumptions

- Existing endpoints remain the source of truth: `GET /api/v1/run-templates`, `POST /api/v1/run-templates`, and `POST /api/v1/templates/:id/run`.
- Harness profiles are already available through existing console/API surfaces.
- Run-template execution should link or surface the resulting run/session using existing run inspection patterns where practical.

## Acceptance Criteria

1. The console lists saved run templates with harness profile, directive template, and default parameter summary.
2. Operators can create a run template by choosing or entering a harness profile, directive template, and default parameters.
3. Operators can trigger a selected template with parameter overrides and see the resulting run metadata or navigation target.
4. Empty, loading, API error, and validation error states are handled without breaking the page layout.
5. Tests cover request parsing/model helpers and the primary create/run UI behavior at the narrowest practical layer.

## Validation
- Required checks: console package test/typecheck scripts relevant to changed files, plus Flywheel workflow validation.
- Additional checks: browser QA of the run-template console surface if a local console dev server is available.

## Dependencies

- Existing run-template API and CLI baseline.
- Existing harness profile catalog.

## Risks

- Parameter editing can become awkward if represented as raw JSON only.
- The page could duplicate task/workflow template language unless copy stays focused on single-run presets.

## Open Questions

- Should the initial trigger result deep-link to a run detail page or show an inline success summary only?

## Next Step

Engineering implementation.

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
