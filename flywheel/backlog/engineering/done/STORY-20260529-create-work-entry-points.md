---
kind: story
id: STORY-20260529-create-work-entry-points
status: done
owner_role: Software Engineer
source: epic
success_metric: Operators understand which work primitive to create for tasks, missions, workflows, schedules, and run presets.
release_scope: follow-up
ready: true
---

# Story: Create Work Entry Points

## Metadata
- `id`: STORY-20260529-create-work-entry-points
- `owner_role`: Software Engineer
- `status`: done
- `source`: epic
- `decision_refs`: [ADR-0006, ADR-0009, ADR-0014, ADR-0017]
- `epic`: docs/product/epics/refinement/2026.25.00-epic-operator-workflow-clarity-repo-wiring.md
- `success_metric`: Operators understand which work primitive to create for tasks, missions, workflows, schedules, and run presets.
- `release_scope`: follow-up

## Problem Statement

The console exposes several work primitives, but it is not always clear whether an operator should create a task, mission, workflow run, schedule, or run preset.

## Initial Scope

- In: dashboard next actions, page-level create affordances, empty-state copy, agent-detail task entry point, workflow/schedule/run-template links.
- Out: new backend creation endpoints, console-native agent authoring, broad redesign.

## Acceptance Criteria

1. Dashboard gives operators clear entry points for creating a one-off task, instantiating a workflow, scheduling repeated work, and using advanced run presets.
2. Agent detail pages deep-link into task creation with the selected agent already chosen when possible.
3. The Task creation page explains when to use tasks and how agent inputs carry run context such as repo path or objective.
4. Workflow, Schedule, and Run Template pages explain when to use each primitive without introducing new backend behavior.
5. Empty/loading/error states touched by the story remain actionable and consistent with plugin-backed agents and repo run context.
6. Browser QA covers dashboard, agent-detail to task deep link, tasks, workflows, schedules, and run templates at desktop and mobile widths.

## Validation

- `npm --workspace apps/console run typecheck`
- `npm --workspace apps/console run lint`
- Browser QA for dashboard, agents, tasks, workflows, schedules, and run templates.
- `./flywheel/tools/validate_workflow_state.sh`

## Refinement Notes

PM refinement completed. Implement as UI guidance and routing only; do not add backend creation endpoints or new persisted work primitives.

Suggested implementation notes:

- Add a compact "Create work" guidance band on Dashboard with links to Tasks, Workflows, Schedules, and Run Templates.
- Pass `agentId` and `version` from Agent Detail to `/tasks`; TaskCreatePage should preselect that agent if it is available.
- Add small page-level guidance on Tasks, Workflows, Schedules, and Run Templates that explains the intended primitive and mentions repo/run context where relevant.
- Keep Run Templates labeled as advanced presets so operators do not confuse them with plugin workflow templates.

## Engineering Handoff
- `change_summary`: Added a Dashboard create-work chooser for tasks, workflows, schedules, and advanced run presets. Added primitive-specific guidance to Tasks, Workflows, Schedules, and Run Templates. Agent detail now deep-links to task creation with `agentId` and `version`, and TaskCreatePage preselects that agent when available.
- `validation_evidence`: `npm --workspace apps/console run typecheck`; `npm --workspace apps/console run lint`; `git diff --check`; `./flywheel/tools/validate_workflow_state.sh`; browser QA for Dashboard, Agent Detail to Task deep link, Tasks, Workflows, Schedules, and Run Templates; 390px Chrome CDP QA confirmed touched pages render expected guidance with no horizontal overflow.
- `qa_focus`: Verify operators can distinguish task, workflow, schedule, and run preset usage; verify agent-detail task deep link preselects the agent; verify mobile guidance does not clip or obscure primary create controls.
- `open_risks`: This story improves entry points but does not add repo-specific input defaults or workflow-template bridging; the remaining first-run-to-real-repo story should close that handoff.

## QA Verdict
- `verdict`: Pass. Work creation entry points now explain the primitive choices and agent-detail task creation preselects the originating agent.
- `evidence_quality`: Strong. Typecheck, lint, diff whitespace, Flywheel validation, desktop browser QA, deep-link QA, and 390px responsive QA all passed.
- `defects`: None found.
- `state_transition`: Move to done.

## Transition History
- `2026-05-29T01:30:00Z`: planning intake created for create work entry points
- `2026-05-29T02:10:51Z`: PM refinement completed; ready for engineering
- `2026-05-29T02:17:41Z`: engineering completed; ready for QA
- `2026-05-29T02:18:00Z`: `active` -> `qa`; Engineering handoff ready for QA
- `2026-05-29T02:18:00Z`: QA passed with no defects
- `2026-05-29T02:11:16Z`: `intake` -> `active`; PM refined; engineering starts create work entry points
- `2026-05-29T02:17:55Z`: `active` -> `qa`; Engineering handoff ready for QA
- `2026-05-29T02:18:29Z`: `qa` -> `done`; QA passed for create work entry points
