---
kind: story
id: STORY-20260531-repo-task-input-contract
status: done
owner_role: Software Engineer
source: operator-testing
success_metric: A UI-created repo-summary task with a selected ready repository runs successfully without manual JSON edits.
release_scope: next
ready: true
---

# Story: Repo Task Input Contract

## Metadata
- `id`: STORY-20260531-repo-task-input-contract
- `owner_role`: Software Engineer
- `status`: done
- `source`: operator-testing
- `decision_refs`: [ADR-0007, ADR-0009]
- `epic`: docs/product/epics/refinement/2026.33.00-epic-first-real-work-confidence.md
- `success_metric`: A UI-created repo-summary task with a selected ready repository runs successfully without manual JSON edits.
- `release_scope`: next
- `refinement_status`: PM selected from 2026.33 intake as the highest-priority first-real-work repair.

## Problem Statement

The console lets an operator select a ready connected repository when creating a repo-backed task, and the saved task reports repository context as ready. The actual run can still fail because the sample repo-summary runner expects `inputs.repo.path`, while the UI-created task stores repository context as a richer object plus `repoPath`.

This creates a trust-breaking first-real-work failure: the UI says the task is ready, then the runtime says a required path is missing.

## Initial Scope

- In: normalize selected repository context into the input shape required by current repo-backed sample agents; align manifest validation, run readiness, and runner contracts; preserve compatibility for existing `repoPath` inputs.
- In: add regression coverage for creating and running a repo-summary task from selected connected repo context.
- Out: private repo authentication, remote write/push flows, generalized repo provider integrations.

## Acceptance Criteria

1. Selecting a ready connected repository in the task form creates inputs that satisfy both manifest validation and the repo-summary runner.
2. Run readiness fails before execution if the selected repo cannot produce the required runtime path shape.
3. Existing raw JSON and `repoPath` compatibility behavior remains available for advanced users and older tasks.
4. The repo-summary sample agent documents the accepted repo input shape in its manifest/docs.
5. A UI-created repo-summary task can be run successfully and produces an inspectable output artifact or final result.

## Validation

- Focused core tests for repo input normalization and run readiness.
- Focused console tests for task form repo selection and saved input payloads.
- Browser QA: select "Athena Console QA" or another ready repo, save a Repo Summary task, run it, and inspect the task-run output.
- `npm --workspace @athena/core run typecheck`
- `npm --workspace @athena/console run typecheck`
- `npm --workspace @athena/console run test`
- `git diff --check`

## Refinement Notes

Audit reproduction created task `task-a708a711-020f-46a6-9d39-eecca2c893d8` and run `run-1b7c2930-9125-41e5-997f-9db949ca4282`; the run failed with `inputs.repo.path must be a non-empty string.`

## Engineering Handoff

- `change_summary`: Promoted the top 2026.33 intake item and repaired the repo task input contract. Console-selected repository context now includes `repo.path` as the runtime contract while preserving `workspacePath` metadata and `repoPath` compatibility. Core task creation/update normalizes compatible repo inputs into `repo.path`, execution/readiness normalize older saved task inputs before runner handoff, and repo readiness now blocks stale "ready" records whose workspace path is not accessible to the current API/runtime. Repo summary/code review sample docs now call out the normalized runtime contract.
- `validation_evidence`: `npm --workspace @athena/console exec -- vitest run src/features/connected-repositories/repoContext.test.ts src/features/task-workbench/formModel.test.ts`; `npm --workspace @athena/core exec -- vitest run tests/control-plane.task-workbench.test.ts tests/control-plane.repo-summary-sample.test.ts`; `npm --workspace @athena/core run typecheck`; `npm --workspace @athena/console run typecheck`; `npm --workspace @athena/console run test`; `npm --workspace @athena/core run validate:manifests`; `npm --workspace @athena/core run build`; `git diff --check`; `./flywheel/tools/validate_workflow_state.sh --format json`; live API smoke against `http://127.0.0.1:8787` created a connected repo at `/workspace`, created a UI-shaped repo-summary task, verified normalized `task.inputs.repo.path`, ran it to `completed`, and confirmed stale host-path repo readiness blocks before execution.
- `qa_focus`: Verify the console task form creates repo-summary/code-review tasks with `inputs.repo.path`; verify a container-visible connected repo runs successfully; verify a stale or host-only repo path is blocked in run readiness with a clear repo-context next step.
- `open_risks`: In-app Browser automation was unavailable during engineering verification, but Firefox desktop QA later confirmed the completed repo-summary task run renders with final output and artifact metadata. The specific task creation form controls were covered by console unit tests rather than full click-through creation.

## QA Verdict

- `verdict`: pass
- `qa_timestamp`: 2026-05-31T03:10:00Z
- `evidence_quality`: strong for service/runtime contract; moderate for rendered UI create form because task creation was validated by unit tests and API smoke, while Firefox QA inspected the completed run detail.
- `validation_evidence`: Reused engineering evidence plus Firefox desktop QA at `http://localhost:5173/tasks/runs/run-96823cee-0228-4b8c-a5dc-b547f82908e4`, confirming completed status, local-process backend, final output containing `repo.path` `/workspace`, and recorded repo-summary artifact metadata.
- `defects`: none blocking
- `state_transition`: move to `done`
- `notes`: The original contract failure is covered by focused tests and live API smoke. Stale host-path repository records now block at repo-context readiness before execution.

## Transition History
- `2026-05-31T02:56:56Z`: `intake` -> `active`; PM refinement selected highest-priority user-testing repair
- `2026-05-31T03:08:43Z`: `active` -> `qa`; Engineering handoff ready for QA
- `2026-05-31T03:10:39Z`: `qa` -> `done`; QA passed for repo task input contract repair
