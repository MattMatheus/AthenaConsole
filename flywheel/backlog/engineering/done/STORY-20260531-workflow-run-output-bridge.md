---
kind: story
id: STORY-20260531-workflow-run-output-bridge
status: done
owner_role: Software Engineer
source: operator-testing
success_metric: Workflow run detail lets operators inspect linked task-run output and artifacts without losing workflow context.
release_scope: next
ready: true
---

# Story: Workflow Run Output Bridge

## Metadata
- `id`: STORY-20260531-workflow-run-output-bridge
- `owner_role`: Software Engineer
- `status`: done
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

Ready for one-cycle execution. Keep the implementation focused on a compact task-run evidence bridge in the workflow status payload and workflow run detail page: linked task run id/status, final output summary, artifact count/availability, and clearer empty-output copy.

## Transition History
- `2026-05-31T14:02:20Z`: `intake` -> `active`; promoted for workflow task evidence bridge cycle

## Engineering Handoff

- `change_summary`: Added compact task-run evidence to workflow status nodes when a workflow step output links to a task run. The evidence includes linked task run id, terminal task-run status, output summary, artifact count, and artifact summaries. The workflow run detail page now shows an expandable task evidence panel with output summary, artifact availability, and a direct link to the task run output/artifacts. The console parser also treats `failure: null` as absent so completed workflow runs no longer show a confusing `Run Failure` panel containing `null`.
- `validation_evidence`: `npm --workspace @athena/core exec -- vitest run tests/control-plane.workflow-status.test.ts`; `npm --workspace @athena/console exec -- vitest run src/features/workflow-runs/api.test.ts src/features/workflow-runs/runGraphModel.test.ts`; `npm --workspace @athena/core run typecheck`; `npm --workspace @athena/console run typecheck`; `npm --workspace @athena/core run check:schemas`; `npm --workspace @athena/core run validate:manifests`; `npm --workspace @athena/console run test`; `git diff --check`; `./flywheel/tools/validate_workflow_state.sh --format json`; live first-run workflow `workflow-run-mission-workflow-bridge-1780236476` executed successfully and `/api/v1/workflow-runs/workflow-run-mission-workflow-bridge-1780236476/status` returned task-run evidence for `prepare` and `verify`; Firefox QA confirmed the workflow detail task evidence panel and the link to task run `run-cf6f749d-f5f9-4b17-b0cf-adf7eeda6f1c` with artifact preview availability.
- `qa_focus`: Confirm completed workflow steps show linked task-run status, output summary, artifact count, and an `Open task output and artifacts` link. Confirm completed workflows without failures do not render `Run Failure: null`. Confirm pending/blocked/failed step rows still render without requiring task-run evidence.
- `open_risks`: Full `npm --workspace @athena/core run test:unit` still fails on an unrelated existing docs fixture issue in `tests/docs.stage-consistency.test.ts`, which looks for `packages/core/IMPLEMENT.MD`. Story-specific core tests and type/schema validations pass.
- `2026-05-31T14:10:28Z`: `active` -> `qa`; engineering handoff ready

## QA Verdict

- `verdict`: pass
- `qa_timestamp`: 2026-05-31T14:10:36Z
- `evidence_quality`: Strong for API/status enrichment, parser/model behavior, console test suite, type/schema checks, and live first-run browser QA.
- `validation_evidence`: Reconfirmed workflow status test, workflow-runs console parser/model tests, console test suite, core and console typechecks, schema check, manifest validation, Flywheel validation, and `git diff --check`. Live QA used workflow run `workflow-run-mission-workflow-bridge-1780236476`; the workflow detail page showed expanded task evidence for `prepare` with completed task run `run-cf6f749d-f5f9-4b17-b0cf-adf7eeda6f1c`, output summary, `1 artifact recorded`, artifact label/format, and a working link to task-run output/artifacts.
- `defects`: None blocking.
- `state_transition`: Move to done.
- `notes`: The unrelated full core unit-suite docs fixture issue remains documented as a residual risk, but it does not block this story because the targeted workflow-status test and core type/schema checks pass.
- `2026-05-31T14:10:51Z`: `qa` -> `done`; QA passed workflow run output bridge repair
