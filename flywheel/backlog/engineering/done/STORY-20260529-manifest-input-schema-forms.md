---
kind: story
id: STORY-20260529-manifest-input-schema-forms
status: done
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
- `status`: done
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

## Engineering Handoff

- `completed_at`: 2026-05-29T20:54:00Z
- `change_summary`: Extended the console manifest input form model for task and workflow creation with enum, URL, JSON, and repo-context-aware fields, editable raw JSON fallback, validation for raw JSON and enum values, and repo-context validation behavior that lets a connected repo satisfy declared repo inputs.
- `files_changed`:
  - `apps/console/src/features/task-workbench/formModel.ts`
  - `apps/console/src/features/task-workbench/formModel.test.ts`
  - `apps/console/src/features/workflow-templates/formModel.ts`
  - `apps/console/src/features/workflow-templates/formModel.test.ts`
  - `apps/console/src/features/workflow-templates/types.ts`
  - `apps/console/src/pages/TaskCreatePage.tsx`
  - `apps/console/src/pages/TaskCreatePage.module.css`
  - `apps/console/src/pages/WorkflowsPage.tsx`
  - `apps/console/src/pages/WorkflowsPage.module.css`
- `validation_evidence`: Focused console form tests, console typecheck, console lint, browser QA, and whitespace validation passed.
  - `npm --workspace apps/console run test -- --run src/features/task-workbench/formModel.test.ts src/features/workflow-templates/formModel.test.ts`
  - `npm --workspace apps/console run typecheck`
  - `npm --workspace apps/console run lint`
  - Browser QA in Chrome against local API/Vite: task create showed structured repo summary inputs, repo-context selector, repo input hint, and raw JSON fallback; workflow instantiate showed structured demo input and raw JSON fallback.
  - `git diff --check`
- `qa_focus`: Confirm task and workflow forms render common manifest inputs, repo inputs can be supplied by connected repo selection, raw JSON fallback remains available, and validation catches required, invalid numeric, invalid enum, invalid JSON, and invalid raw JSON states.
- `open_risks`: This is intentionally a modest renderer, not a full arbitrary JSON Schema UI. Nested object/array inputs continue to use JSON/raw JSON.

## QA Verdict

- `verdict`: pass
- `qa_timestamp`: 2026-05-29T20:55:00Z
- `evidence_quality`: Fresh QA covered focused form-model tests, console typecheck, console lint, browser validation of task and workflow create forms, and whitespace validation.
- `acceptance_coverage`:
  - AC1: Task create renders manifest fields for strings/markdown, numbers, booleans, JSON/object fallback, enum model support, URL model support, and repo-context fields.
  - AC2: Workflow instantiate reuses the same manifest input model and renders the first-run template input as a structured field.
  - AC3: Repo summary task input shows the connected repo selector and uses the selected connected repository to satisfy declared repo inputs.
  - AC4: Task and workflow input sections expose an editable Raw JSON fallback.
  - AC5: Form tests cover missing required fields, invalid integer/number values, invalid enum values, invalid JSON, and invalid raw JSON before request construction.
- `validation_evidence`: `npm --workspace apps/console run test -- --run src/features/task-workbench/formModel.test.ts src/features/workflow-templates/formModel.test.ts`; `npm --workspace apps/console run typecheck`; `npm --workspace apps/console run lint`; Chrome QA against `http://127.0.0.1:5173/tasks` and `/workflows`; `git diff --check`.
- `defects`: None found.
- `state_transition`: Move to `done`.

## Transition History
- `2026-05-29T03:08:43Z`: PM refinement created ready engineering story
- `2026-05-29T20:44:37Z`: `ready` -> `active`; Engineering starts manifest input schema forms
- `2026-05-29T20:55:20Z`: `active` -> `qa`; Engineering handoff for manifest input schema forms
- `2026-05-29T20:55:59Z`: `qa` -> `done`; QA passed for manifest input schema forms
