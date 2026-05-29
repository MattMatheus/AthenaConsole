---
kind: story
id: STORY-20260529-repo-context-create-work
status: done
owner_role: Software Engineer
source: epic
success_metric: Tasks and workflows can receive selected connected repo context through structured inputs.
release_scope: next
ready: true
---

# Story: Repo Context In Create Work

## Metadata
- `id`: STORY-20260529-repo-context-create-work
- `owner_role`: Software Engineer
- `status`: done
- `source`: epic
- `decision_refs`: [ADR-0007, ADR-0009, ADR-0018]
- `epic`: docs/product/epics/refinement/2026.26.00-epic-real-work-repo-connection.md
- `success_metric`: Tasks and workflows can receive selected connected repo context through structured inputs.
- `release_scope`: next

## Problem Statement

Connecting a repo is only useful if work creation can pass that repo into agents and workflow templates consistently.

## Initial Scope

- In: task/workflow create forms can select connected repo, structured `repo` input context, API validation helpers, compatibility with existing raw inputs.
- Out: generalized schema rendering, write approvals, provider setup.

## Acceptance Criteria

1. Task creation can include a selected connected repo as structured `inputs.repo`.
2. Workflow-template instantiation can include a selected connected repo in input bindings.
3. Existing raw JSON input behavior remains available for advanced use.
4. UI shows missing/invalid repo status before run creation.
5. New examples/docs converge on structured `repo` context while tolerating `repoPath` for existing plugins.

## Validation

- `npm --workspace @athena/core run typecheck`
- `npm --workspace apps/console run typecheck`
- `npm --workspace apps/console run lint`
- Focused core/console tests for repo input shaping.
- Browser QA for task and workflow create paths.
- `./flywheel/tools/validate_workflow_state.sh`

## Refinement Notes

This is a bridge story before full manifest-driven input forms.

## Engineering Handoff

- `change_summary`: Added a shared connected-repository context helper that turns selected repository records into structured `inputs.repo` payloads and adds `repoPath` for compatibility when the operator has not supplied it manually. Task creation and workflow instantiation now load connected repositories, expose optional repo selectors, show workspace/branch/dirty context, and block ready/instantiate actions when the selected repo is not ready.
- `validation_evidence`: `npm --workspace @athena/core run typecheck`; `npm --workspace apps/console exec -- vitest run src/features/connected-repositories/repoContext.test.ts src/features/task-workbench/formModel.test.ts src/features/workflow-templates/formModel.test.ts`; `npm --workspace apps/console run typecheck`; `npm --workspace apps/console run lint`; `git diff --check`; `./flywheel/tools/validate_workflow_state.sh`; local API/console smoke with `curl http://127.0.0.1:5173/api/v1/repositories`; headless Firefox screenshots at 1440px and 390px for `/tasks` and `/workflows`.
- `qa_focus`: Verify task create and workflow instantiate can select a connected repo, shape `inputs.repo` plus compatibility `repoPath`, preserve existing manifest input behavior, and surface non-ready repo status before ready/instantiate submission.
- `open_risks`: Browser screenshot tooling captures React Query loading states for these pages, so settled-state behavior is backed by form-model tests and API smoke rather than interactive browser automation.

## QA Verdict

- `verdict`: pass
- `qa_timestamp`: 2026-05-29T03:50:42Z
- `evidence_quality`: moderate
- `validation_evidence`: `npm --workspace @athena/core run typecheck`; `npm --workspace apps/console exec -- vitest run src/features/connected-repositories/repoContext.test.ts src/features/task-workbench/formModel.test.ts src/features/workflow-templates/formModel.test.ts`; `npm --workspace apps/console run typecheck`; `npm --workspace apps/console run lint`; `git diff --check`; `./flywheel/tools/validate_workflow_state.sh`; local API/console smoke with a ready connected repository; headless Firefox desktop/mobile screenshots for `/tasks` and `/workflows`.
- `defects`: none
- `state_transition`: move to done
- `notes`: The input-shaping and readiness behavior is covered by focused tests. Visual QA confirmed the task/workflow pages render at desktop and mobile sizes without visible overflow, but one-shot screenshots caught loading states before query settlement.

## Transition History
- `2026-05-29T03:08:43Z`: PM refinement created ready engineering story
- `2026-05-29T03:46:11Z`: `ready` -> `active`; Engineering starts repo context create work
- `2026-05-29T03:49:45Z`: Engineering implementation completed; ready for QA.
- `2026-05-29T03:50:09Z`: `active` -> `qa`; Engineering handoff ready for QA
- `2026-05-29T03:50:42Z`: QA passed; ready for done.
- `2026-05-29T03:51:20Z`: `qa` -> `done`; QA passed for repo context create work
