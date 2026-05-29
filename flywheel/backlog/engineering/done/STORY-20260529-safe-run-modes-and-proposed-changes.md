---
kind: story
id: STORY-20260529-safe-run-modes-and-proposed-changes
status: done
owner_role: Software Engineer
source: epic
success_metric: Repo-affecting work defaults to read-only or proposed-change artifacts before any file mutation is applied.
release_scope: next
ready: true
---

# Story: Safe Run Modes And Proposed Changes

## Metadata
- `id`: STORY-20260529-safe-run-modes-and-proposed-changes
- `owner_role`: Software Engineer
- `status`: done
- `source`: epic
- `decision_refs`: [ADR-0013, ADR-0018]
- `epic`: docs/product/epics/refinement/2026.29.00-epic-real-work-run-loop.md
- `success_metric`: Repo-affecting work defaults to read-only or proposed-change artifacts before any file mutation is applied.
- `release_scope`: next

## Problem Statement

The product should be able to do useful repo work without surprising operators with file edits or remote mutations.

## Initial Scope

- In: run mode input conventions, `read-only` default, `propose-changes` artifact convention, diff artifact rendering, blocked `approved-write` placeholder if approval support is not complete.
- Out: remote push, automatic commit, complex multi-user approvals.

## Acceptance Criteria

1. Task/workflow inputs can carry `runMode` with `read-only` as the default.
2. Proposed file changes are represented as artifacts, not applied automatically.
3. Console can render proposed diff/change artifacts clearly.
4. Write/apply actions are blocked or explicitly marked unavailable until approval implementation exists.
5. No remote push behavior is introduced.

## Validation

- Core tests for run mode defaults/conventions where implemented.
- Console tests/browser QA for proposed change artifact display.
- `npm --workspace apps/console run typecheck`
- `npm --workspace apps/console run lint`
- `./flywheel/tools/validate_workflow_state.sh`

## Refinement Notes

This creates the safe UX contract before write-capable agents are promoted.

## Engineering Handoff

- `change_summary`: Added task workbench run mode contracts and metadata (`read-only`, `propose-changes`, `approved-write`) with `read-only` defaulting in task create/update paths; added run-readiness checks that warn for proposed-change mode and block `approved-write`; propagated workflow instantiation `runMode` into generated task inputs; added console task/workflow run mode selectors and proposed-change artifact rendering with diff display and unavailable apply messaging.
- `validation_evidence`: `npm --workspace @athena/core run typecheck`; `npm --workspace apps/console run typecheck`; `npm --workspace @athena/core run test:unit -- --run tests/control-plane.task-workbench.test.ts tests/api.task-workbench.test.ts tests/control-plane.workflow-template-instantiation.test.ts`; `npm --workspace apps/console run test -- --run src/features/task-workbench/formModel.test.ts src/features/workflow-templates/formModel.test.ts src/features/task-workbench/runInspectionModel.test.ts`; `npm --workspace apps/console run lint`; `npm --workspace apps/console run build`; `npm --workspace @athena/core run build`; `npm --workspace @athena/core run check:schemas`; `git diff --check`; `./flywheel/tools/validate_workflow_state.sh`; browser QA via headless Chrome confirmed proposed-change badge, summary, apply-unavailable text, target path, and diff content rendered.
- `qa_focus`: Confirm `approved-write` remains blocked by run readiness and visibly unavailable in console copy; confirm proposed-change artifacts render as review-only diffs and do not expose any apply/push action; confirm workflow-created tasks inherit the selected run mode.
- `open_risks`: No automatic apply/approval flow exists yet by design; future approval work must preserve the current default-safe behavior. Browser QA used a temporary local plugin and state directory, not committed sample plugin data.

## QA Verdict

- `verdict`: Passed. Acceptance criteria are met: task/workflow inputs carry defaulted `runMode`, proposed file changes persist as artifacts, console run detail renders proposed diffs clearly, `approved-write` is blocked/unavailable, and no remote push/apply path was introduced.
- `evidence_quality`: Strong. Covered core contracts/services/API, workflow propagation, console form models, artifact inspection model, lint/build/schema gates, workflow validation, and a live API-backed headless browser QA pass.
- `state_transition`: Move to done.

## Transition History
- `2026-05-29T03:08:43Z`: PM refinement created ready engineering story
- `2026-05-29T21:16:03Z`: `ready` -> `active`; Engineering starts safe run modes and proposed changes
- `2026-05-29T21:31:02Z`: `active` -> `qa`; Engineering handoff complete for safe run modes
- `2026-05-29T21:32:01Z`: `qa` -> `done`; QA passed safe run modes and proposed changes
