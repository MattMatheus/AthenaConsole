---
kind: story
id: STORY-20260529-create-work-entry-points
status: intake
owner_role: Software Engineer
source: epic
success_metric: Operators understand which work primitive to create for tasks, missions, workflows, schedules, and run presets.
release_scope: follow-up
ready: false
---

# Story: Create Work Entry Points

## Metadata
- `id`: STORY-20260529-create-work-entry-points
- `owner_role`: Software Engineer
- `status`: intake
- `source`: epic
- `decision_refs`: [ADR-0006, ADR-0009, ADR-0014]
- `epic`: docs/product/epics/refinement/2026.25.00-epic-operator-workflow-clarity-repo-wiring.md
- `success_metric`: Operators understand which work primitive to create for tasks, missions, workflows, schedules, and run presets.
- `release_scope`: follow-up

## Problem Statement

The console exposes several work primitives, but it is not always clear whether an operator should create a task, mission, workflow run, schedule, or run preset.

## Initial Scope

- In: dashboard next actions, page-level create affordances, empty-state copy, agent-detail task entry point, workflow/schedule/run-template links.
- Out: new backend creation endpoints, console-native agent authoring, broad redesign.

## Draft Acceptance Criteria

1. Dashboard points to the appropriate work creation paths.
2. Agent detail pages make it easy to create a task using that agent.
3. Workflow, schedule, and run-template pages explain when to use each primitive.
4. Empty states remain actionable and consistent.
5. Browser QA covers representative desktop and mobile paths.

## Validation

- `npm --workspace apps/console run typecheck`
- `npm --workspace apps/console run lint`
- Browser QA for dashboard, agents, tasks, workflows, schedules, and run templates.
- `./flywheel/tools/validate_workflow_state.sh`

## Refinement Notes

Can follow agent catalog guidance and repo wiring guidance.

## Engineering Handoff
- `change_summary`:
- `validation_evidence`:
- `qa_focus`:
- `open_risks`:

## QA Verdict
- `verdict`:
- `evidence_quality`:
- `defects`:
- `state_transition`:

## Transition History
- `2026-05-29T01:30:00Z`: planning intake created for create work entry points
