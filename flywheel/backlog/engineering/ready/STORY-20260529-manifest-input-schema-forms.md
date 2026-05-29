---
kind: story
id: STORY-20260529-manifest-input-schema-forms
status: ready
owner_role: Software Engineer
source: epic
success_metric: Task and workflow creation render manifest-declared inputs as usable forms instead of raw JSON whenever possible.
release_scope: next
ready: true
---

# Story: Manifest Input Schema Forms

## Metadata
- `id`: STORY-20260529-manifest-input-schema-forms
- `owner_role`: Software Engineer
- `status`: ready
- `source`: epic
- `decision_refs`: [ADR-0007, ADR-0009, ADR-0018]
- `epic`: docs/product/epics/refinement/2026.29.00-epic-real-work-run-loop.md
- `success_metric`: Task and workflow creation render manifest-declared inputs as usable forms instead of raw JSON whenever possible.
- `release_scope`: next

## Problem Statement

Raw JSON inputs are too sharp-edged for normal real-work runs.

## Initial Scope

- In: form model for string/number/boolean/enum/path/repo/object basics, fallback to raw JSON, validation messages, task and workflow create integration.
- Out: arbitrary JSON Schema renderer, nested complex UI, approvals.

## Acceptance Criteria

1. Task create renders common manifest input types as fields.
2. Workflow instantiate renders common workflow input definitions as fields.
3. Repo inputs use the connected repo selector where applicable.
4. Raw JSON remains available for advanced/unsupported schemas.
5. Validation errors identify missing/invalid fields before submission.

## Validation

- Console form model tests.
- `npm --workspace apps/console run typecheck`
- `npm --workspace apps/console run lint`
- Browser QA for task/workflow create forms.
- `./flywheel/tools/validate_workflow_state.sh`

## Refinement Notes

Keep scope intentionally modest. A small reliable renderer beats a fragile complete schema engine.

## Transition History
- `2026-05-29T03:08:43Z`: PM refinement created ready engineering story
