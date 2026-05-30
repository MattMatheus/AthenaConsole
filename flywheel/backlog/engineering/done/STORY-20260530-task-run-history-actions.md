---
kind: story
id: STORY-20260530-task-run-history-actions
status: done
owner_role: Software Engineer
source: operator-testing
success_metric: Operators can find existing tasks and recent runs from the Tasks page without relying on a just-saved task panel.
release_scope: next
ready: false
---

# Story: Task Run History And Actions

## Metadata
- `id`: STORY-20260530-task-run-history-actions
- `owner_role`: Software Engineer
- `status`: done
- `source`: operator-testing
- `decision_refs`: [ADR-0009, ADR-0012]
- `epic`: docs/product/epics/refinement/2026.29.00-epic-real-work-run-loop.md
- `success_metric`: Operators can find existing tasks and recent runs from the Tasks page without relying on a just-saved task panel.
- `release_scope`: next

## Problem Statement

The task create flow can run a saved ready task, but task discovery and run history are still thin. After refresh, operators need a clearer way to find ready tasks, trigger runs, and reopen run results.

## Initial Scope

- In: Tasks page recent task list polish, ready/running/completed filters, run/open-run actions, recent run links, empty states.
- Out: full task editing workflow, bulk actions, mission graph redesign.

## Acceptance Criteria

1. Tasks page shows recent tasks in a scan-friendly list with status and assigned agent.
2. Ready tasks expose a run action.
3. Completed/running tasks expose recent run links when available.
4. Operators can filter or segment by task status.
5. Run actions navigate to the run detail page after launch.
6. Console tests or focused helper tests cover status/action mapping.

## Validation

- `npm --workspace @athena/console run typecheck`
- `npm --workspace @athena/console run lint`
- `npm --workspace @athena/console run test`
- Browser QA on task create/run/reopen paths.
- `git diff --check`

## Refinement Notes

This should make the task page feel like a workbench, not just a creation form.

## Transition History
- `2026-05-30T03:18:27Z`: `intake` -> `active`; continue final engineering story

## Engineering Handoff

- `change_summary`: Reworked the Tasks page so existing work is first-class: added an Existing Tasks/Mission Tasks panel above the create form, status segmentation for all/ready/running/completed/failed/cancelled, scan-friendly task rows with assigned agent, updated time, latest run metadata, Run actions for ready tasks, and Open Run actions for tasks with a latest run. Added `taskActionState` helper coverage for ready/completed/running task actions.
- `validation_evidence`: `npm --workspace @athena/console run typecheck`; `npm --workspace @athena/console run lint`; `npm --workspace @athena/console run test`; `npm --workspace @athena/console run test -- --run src/features/task-workbench/formModel.test.ts`; live API smoke with `curl 'http://127.0.0.1:8787/api/v1/tasks?status=completed'`; `git diff --check`.
- `qa_focus`: Verify the Tasks page opens with existing tasks above the create form, status filters update the list, ready tasks can be launched and navigate to run detail, and completed/running tasks expose Open Run for their latest run.
- `open_risks`: Browser automation was not callable in this turn, so final visual QA should be performed manually in the running console.
- `2026-05-30T03:23:40Z`: `active` -> `qa`; task run history actions implemented

## QA Verdict

- `verdict`: accepted
- `evidence_quality`: Console validation passed; operator reviewed the task page and confirmed the final task looked better and completed open work.
- `defects`: none blocking
- `state_transition`: move to `done`
- `2026-05-30T03:28:15Z`: `qa` -> `done`; operator accepted task run history actions
