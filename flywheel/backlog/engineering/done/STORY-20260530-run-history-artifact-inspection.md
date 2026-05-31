---
kind: story
id: STORY-20260530-run-history-artifact-inspection
status: done
owner_role: Product Engineer
source: direct
success_metric: Operators can inspect run history, transcripts, and artifacts through current task/mission/workflow run surfaces.
release_scope: required
ready: false
---

# Story: Run History Artifact Inspection

## Metadata
- `id`: STORY-20260530-run-history-artifact-inspection
- `owner_role`: Product Engineer
- `status`: done
- `source`: direct
- `decision_refs`: [0006, 0008, 0012, 0015]
- `epic`: docs/product/epics/refinement/2026.32.00-epic-useful-feature-migration-and-legacy-removal.md
- `success_metric`: Operators can inspect run history, transcripts, and artifacts through current task/mission/workflow run surfaces.
- `release_scope`: required

## Problem Statement

Session, transcript, and artifact inspection is useful, but session-first product language is no longer the primary model. Operators should find this capability from run history and run detail screens tied to tasks, missions, and workflows.

## Scope
- In: rename/reframe user-facing session surfaces to run history or run inspection; ensure task/mission/workflow run detail pages expose transcript and artifact inspection; keep internal runtime session naming only where it is implementation detail.
- Out: preserving old session navigation labels for compatibility.

## Acceptance Criteria
1. Navigation and page copy use current run-history/run-inspection language.
2. Operators can reach transcript and artifact views from task, mission, or workflow run detail contexts.
3. Existing `/api/v1/sessions/*` behavior is either hidden behind current service calls or scheduled for removal if no longer needed.
4. Documentation describes run history and artifacts as the current inspection model.
5. Tests cover routing/model behavior for the updated inspection path.

## Validation
- Required checks: console typecheck, focused console tests, route/link review, `git diff --check`.
- Additional checks: browser QA for desktop and mobile run-inspection flows if UI changes are substantial.

## Dependencies
- Useful feature migration epic.

## Risks
- Internal session IDs may still appear in artifacts; keep them as technical metadata while avoiding session-first UX.

## Engineering Handoff
- `change_summary`: Reframed the console session explorer as the current Run History surface at `/runs`, redirected `/sessions` to `/runs`, updated navigation/header/search copy, and updated run-history docs. Task-run detail already exposed events, output, verification, and artifact previews; mission run history already links child task runs; workflow run detail now extracts `taskRunId` from step output and links operators into task-run artifact inspection.
- `validation_evidence`: `npm --workspace @athena/console run typecheck`; `npm --workspace @athena/console test -- --run src/features/workflow-runs/runGraphModel.test.ts src/features/task-workbench/runInspectionModel.test.ts`; route/link review with `rg "Session Explorer|/sessions|session history|run/session|Global Session Search|persona runs|Artifact Gallery"`; browser QA on `http://127.0.0.1:5174/runs`, `/sessions` redirect, and workflow run detail render; `git diff --check`; `./flywheel/tools/validate_workflow_state.sh --format json`.
- `qa_focus`: Confirm `/runs` is the visible run-history entry point, `/sessions` redirects, workflow step outputs with `taskRunId` link to `/tasks/runs/<id>`, and task-run artifact previews remain accessible.
- `open_risks`: The underlying transcript/artifact APIs still use `/api/v1/sessions/*` as backing compatibility endpoints; they are now framed as Run History internals and remain candidates for removal or replacement in the later persona/specialist/runtime cleanup work.

## QA Verdict
- `verdict`: Pass.
- `evidence_quality`: Strong for the scoped UI/routing change. Console typecheck and focused model tests passed, route/link review confirmed current user-facing copy no longer leads with Session Explorer, browser QA verified `/runs`, the `/sessions` redirect, and workflow run detail rendering, and workflow validation passed after lane movement.
- `defects`: None found.
- `state_transition`: Move to `done`.

## Transition History
- `2026-05-31T00:40:01Z`: `intake` -> `active`
- `2026-05-31T00:44:30Z`: `active` -> `qa`
- `2026-05-31T00:44:45Z`: `qa` -> `done`
