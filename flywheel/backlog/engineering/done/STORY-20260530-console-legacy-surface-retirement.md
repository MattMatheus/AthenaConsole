---
kind: story
id: STORY-20260530-console-legacy-surface-retirement
status: done
owner_role: Senior Engineer
source: direct
success_metric: Console no longer exposes unused A2A observability code or a primary specialist/directive workflow as current operator work.
release_scope: required
ready: false
---

# Story: Console Legacy Surface Retirement

## Metadata
- `id`: STORY-20260530-console-legacy-surface-retirement
- `owner_role`: Senior Engineer
- `status`: done
- `source`: direct
- `decision_refs`: [0006, 0009, 0012, 0015]
- `success_metric`: Console no longer exposes unused A2A observability code or a primary specialist/directive workflow as current operator work.
- `release_scope`: required

## Problem Statement

The console still carries legacy surfaces from the pre-pivot model. `features/a2a-observability/` is not statically reachable from the app entrypoints, and `MissionControlPage` presents direct specialist/directive execution instead of the current task, mission, workflow, and agent-catalog model.

## Scope
- In: remove unused `features/a2a-observability/`; remove or hide `/mission-control` navigation and route; preserve any still-needed DLQ diagnostics under advanced tooling; update tests/types affected by removal.
- Out: backend API deletion, DLQ deletion, workflow run graph changes, or task/mission redesign.

## Assumptions
- `features/dlq/` remains the current console client for the legacy A2A DLQ diagnostic page.
- New operator work should start from tasks, missions, workflows, or agents.

## Acceptance Criteria
1. Unused A2A observability frontend files are removed.
2. Mission Control is no longer presented as a primary console workflow.
3. Remaining routes build and typecheck.
4. Console navigation still provides clear paths to tasks, missions, workflows, agents, schedules, docs, and settings.

## Validation
- Required checks: `npm --workspace @athena/console run typecheck`, `npm --workspace @athena/console run test`, `git diff --check`.
- Additional checks: static search confirms no imports of removed frontend feature.

## Dependencies
- Code retirement audit.

## Risks
- A hidden user may still use `/mission-control`; keep an explicit redirect or deprecation copy if PM wants a transition.

## Open Questions
- Should `/mission-control` redirect to `/tasks`, `/missions`, or `/agents`?

## Next Step
- PM/engineering refinement should choose removal versus redirect behavior.

## Engineering Handoff
- `change_summary`: Removed the unused `apps/console/src/features/a2a-observability/` frontend client, removed the legacy `MissionControlPage` and its CSS module, removed the `/mission-control` route, and removed the Mission Control sidebar entry. Kept the existing DLQ compatibility diagnostic feature intact.
- `validation_evidence`: Ran `npm --workspace @athena/console run typecheck` successfully; ran `npm --workspace @athena/console run test` successfully with 13 files and 43 tests passing; ran `rg "MissionControlPage|mission-control|a2a-observability|A2aObservability|useA2aObservability|fetchA2aObservability|exportA2aStallAlertHistoryCsv" apps/console/src` and confirmed no matches; ran `git diff --check`; ran `git diff --cached --check`; ran `./flywheel/tools/validate_workflow_state.sh --format json` successfully.
- `qa_focus`: Confirm Mission Control is gone from both route registration and sidebar navigation, confirm the unused A2A observability client is absent, and confirm the DLQ compatibility queue remains available in admin diagnostics.
- `open_risks`: Direct visits to `/mission-control` no longer resolve to the removed legacy page. This is intentional for the retirement story; no redirect was added because the story asked to remove or hide the primary specialist/directive workflow and the current operator entry points are already Tasks, Missions, Workflows, and Agents.

## QA Verdict
- `verdict`: accepted
- `evidence_quality`: Strong. Engineering ran console typecheck and test suite successfully. QA verified no remaining `MissionControlPage`, `mission-control`, or removed A2A observability client references in `apps/console/src`; verified the `/dlq` Compatibility Queue route and `features/dlq` client remain present; workflow validation passed.
- `defects`: none
- `state_transition`: move to `done`

## Transition History
- `2026-05-30T23:49:43Z`: `intake` -> `active`; activate next backlog story
- `2026-05-30T23:51:18Z`: `active` -> `qa`; engineering handoff ready
- `2026-05-30T23:51:46Z`: `qa` -> `done`; QA accepted console legacy surface retirement
