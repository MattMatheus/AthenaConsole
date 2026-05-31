---
kind: story
id: STORY-20260531-workflow-run-output-bridge
status: intake
owner_role: Software Engineer
source: operator-testing
success_metric: Workflow run detail lets operators inspect linked task-run output and artifacts without losing workflow context.
release_scope: next
ready: false
---

# Story: Workflow Run Output Bridge

## Metadata
- `id`: STORY-20260531-workflow-run-output-bridge
- `owner_role`: Software Engineer
- `status`: intake
- `source`: operator-testing
- `decision_refs`: [ADR-0009, ADR-0012, ADR-0015]
- `epic`: docs/product/epics/refinement/2026.33.00-epic-first-real-work-confidence.md
- `success_metric`: Workflow run detail lets operators inspect linked task-run output and artifacts without losing workflow context.
- `release_scope`: next

## Problem Statement

The workflow run detail page proves dependency execution, but a completed first-run workflow shows sparse step output such as `none` or a dependency id. The useful final result and artifact metadata live in linked task runs. New operators need a stronger bridge from workflow-level progress to task-level evidence.

## Initial Scope

- In: expose linked task run ids, terminal status, final result summary, and artifact availability on workflow run steps.
- In: add clear links or inline expandable previews from workflow step cards to task-run output/artifacts.
- Out: replacing the task run detail page, building a full workflow graph editor, changing workflow execution semantics.

## Acceptance Criteria

1. Each completed workflow step with a linked task run shows the linked task run and terminal task-run status.
2. Workflow step cards expose final result summary or a clear "open task output" action.
3. Artifact availability is visible from the workflow run page when task-run artifacts exist.
4. Empty or dependency-only workflow output is explained rather than shown as ambiguous `none`.
5. Workflow run detail remains readable for failed, blocked, pending, and completed steps.

## Validation

- Core/API tests for workflow status payloads that include linked task-run output summary where appropriate.
- Console tests for workflow run step rendering across completed, failed, blocked, and artifact/no-artifact cases.
- Browser QA: run first-run demo, open workflow run, inspect prepare/verify evidence from workflow context.
- `npm --workspace @athena/core run typecheck`
- `npm --workspace @athena/console run typecheck`
- `npm --workspace @athena/console run test`
- `git diff --check`

## Refinement Notes

The goal is not to duplicate the full task run page; it is to make the workflow run page answer the first operator question: "What did this step produce, and where do I inspect it?"

