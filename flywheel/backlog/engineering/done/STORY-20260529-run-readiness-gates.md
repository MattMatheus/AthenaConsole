---
kind: story
id: STORY-20260529-run-readiness-gates
status: done
owner_role: Software Engineer
source: epic
success_metric: Operators see missing repo, provider, agent, runtime, or permission requirements before starting real work.
release_scope: next
ready: true
---

# Story: Run Readiness Gates

## Metadata
- `id`: STORY-20260529-run-readiness-gates
- `owner_role`: Software Engineer
- `status`: done
- `source`: epic
- `decision_refs`: [ADR-0013, ADR-0018]
- `epic`: docs/product/epics/refinement/2026.29.00-epic-real-work-run-loop.md
- `success_metric`: Operators see missing repo, provider, agent, runtime, or permission requirements before starting real work.
- `release_scope`: next

## Problem Statement

Operators need clear pre-run feedback instead of discovering missing setup through failed runs.

## Initial Scope

- In: readiness service for task/workflow start, checks for repo/provider/agent/runtime/permissions, console display, blocked submission when required setup is missing.
- Out: mutation approval flow, server deployment diagnostics.

## Acceptance Criteria

1. Readiness checks identify missing or invalid repo context.
2. Readiness checks identify missing provider/secret configuration.
3. Readiness checks identify missing agent/workflow/runtime requirements.
4. Console shows actionable next steps before run.
5. Readiness payloads do not expose raw secret values.

## Validation

- Core readiness tests.
- Console tests for readiness state mapping if helpers are added.
- `npm --workspace @athena/core run typecheck`
- `npm --workspace apps/console run typecheck`
- Browser QA for blocked/ready states.
- `./flywheel/tools/validate_workflow_state.sh`

## Refinement Notes

This should compose repo and provider readiness rather than duplicating their logic.

## Engineering Handoff

- `change_summary`: Added task run readiness contracts, API/schema coverage, task response payloads, and run-time enforcement. Readiness now checks task status, assigned agent availability/capabilities, manifest inputs, connected repo context, model provider readiness, runtime resolution, and approval-gated permissions. Mission and workflow launch surfaces now show readiness states and block launch when task readiness is blocked.
- `validation_evidence`: `npm --workspace @athena/core run typecheck`; `npm --workspace @athena/core run build`; `npm --workspace @athena/core run test:unit -- --run tests/control-plane.task-workbench.test.ts tests/api.task-workbench.test.ts tests/control-plane.api-contracts.test.ts tests/api.schemas.test.ts`; `npm --workspace apps/console run typecheck`; `npm --workspace apps/console run lint`; `npm --workspace apps/console run build`; Chrome browser QA on `http://127.0.0.1:5173/missions?missionId=mission-readiness-qa&v=readiness6` confirmed the mission Run button disables for a missing repo and displays the actionable Repository Context next step; Chrome browser QA on `/workflows` confirmed the first-run demo workflow remains runnable in a ready state.
- `qa_focus`: Confirm blocked repo/provider/runtime conditions are surfaced before launch, readiness payloads avoid secret values, and workflow/mission launch buttons remain enabled for ready work.
- `open_risks`: Browser QA created temporary local API state for a missing QA repository/mission/task while the dev server was running; no tracked files were added for that state.

## QA Verdict

- `verdict`: Pass. Acceptance criteria are met: missing repo, provider, agent/runtime, and permission requirements are represented in task run readiness; blocked readiness prevents task/mission/workflow launch; console surfaces actionable next steps; provider readiness payloads reuse the redacted provider-readiness contract and tests assert no raw secret names leak.
- `evidence_quality`: Strong. QA reviewed the engineering evidence, reran core typecheck/build, focused readiness/API/schema tests, console typecheck/lint/build, and browser QA for both blocked mission and ready workflow states.
- `state_transition`: Move to engineering done.

## Transition History
- `2026-05-29T03:08:43Z`: PM refinement created ready engineering story
- `2026-05-29T20:58:29Z`: `ready` -> `active`; Engineering starts run readiness gates
- `2026-05-29T21:13:05Z`: `active` -> `qa`; Engineering handoff ready for QA
- `2026-05-29T21:13:50Z`: `qa` -> `done`; QA passed run readiness gates
