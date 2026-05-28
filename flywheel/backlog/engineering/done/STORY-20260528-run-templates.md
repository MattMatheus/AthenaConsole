---
kind: story
id: STORY-20260528-run-templates
status: done
owner_role: Product Manager
source: planning
success_metric: Repeatable operator-triggered jobs are defined as a bounded post-DAG workflow track.
release_scope: deferred
ready: false
---

# Story: Refine Run Templates Track

## Metadata
- `id`: STORY-20260528-run-templates
- `owner_role`: Product Manager
- `status`: done
- `source`: planning
- `decision_refs`: [ADR-0008, ADR-0009, ADR-0011]
- `success_metric`: Repeatable operator-triggered jobs are defined as a bounded post-DAG workflow track.
- `release_scope`: deferred

## Problem Statement

Operators will need reusable manual run definitions that can be triggered repeatedly without rebuilding a task or workflow each time.

## Scope
- In: refine the product shape for run templates, source decisions, acceptance criteria, and first implementation slice.
- Out: implementing the console surface or changing the existing backend/API/CLI baseline.

## Assumptions

- Workflow-template DAG execution remains the nearer-term track.
- Existing run-template backend/API/CLI support is real product baseline and should be used rather than re-specified from scratch.

## Acceptance Criteria

1. Defines the difference between workflow templates, schedules, and run templates.
2. Identifies the first implementation story and validation expectations.
3. Links accepted ADRs or creates an architecture intake item if decisions are missing.

## Refinement Outcome

Run templates are reusable, operator-owned single-run presets. They bind a directive template to a harness profile and default parameters, then allow immediate manual execution with overrides.

Workflow templates are plugin-provided multi-step definitions that create tasks, missions, or workflow runs. They remain the home for DAG execution, dependency readiness, and restart-safe workflow state.

Schedules are time-based triggers. They decide when existing work should run and should not define the work payload themselves.

The existing codebase already includes run-template backend/API/CLI support:

- `GET /api/v1/run-templates`
- `POST /api/v1/run-templates`
- `POST /api/v1/templates/:id/run`
- CLI `run --template <id> --param KEY=VALUE`
- placeholder validation and run metadata for effective params

The first implementation gap is the console surface, not the core schema.

## Validation
- Required checks: Flywheel workflow validation after lane movement.
- Additional checks: evidence that existing run-template API/CLI baseline was found in source and tests.

## Dependencies

- Current workflow DAG engine track.

## Risks

- Could duplicate workflow-template concepts if the distinction is not explicit.
- Console implementation should avoid presenting run templates as workflow-template aliases.

## Open Questions

- Should schedules eventually target run templates directly, or should scheduled execution continue to use tasks, missions, and workflow templates only?

## Next Step

Implement `flywheel/backlog/engineering/ready/STORY-20260528-run-template-console.md` when this deferred track is promoted.

## Engineering Handoff
- `change_summary`: Added refined run-template epic, clarified product boundary against workflow templates and schedules, updated current direction, and created the first ready implementation story for a console surface.
- `validation_evidence`: Inspected existing run-template API/CLI/source/tests; ran `./flywheel/tools/validate_workflow_state.sh --format json`, `python3 -m py_compile flywheel/tools/lib/flywheel_state.py`, `git diff --check`, and `npm --workspace @athena/core run test:unit -- tests/api.request-parsers.test.ts tests/control-plane.api-contracts.test.ts tests/api.route-registration.test.ts`.
- `qa_focus`: Confirm ready story is bounded to console work and does not duplicate existing backend/API/CLI support.
- `open_risks`: Scheduling run templates directly remains deferred.

## QA Verdict
- `verdict`: pass
- `evidence_quality`: sufficient for PM refinement; acceptance criteria are documented in the story, refined epic, current direction, and ready follow-on story.
- `defects`: none
- `state_transition`: move to `done`

## Transition History
- `2026-05-28T03:03:52Z`: `intake` -> `active` by `Codex`; PM refinement started
- `2026-05-28T03:05:03Z`: `active` -> `qa` by `Codex`; PM refinement handoff ready
- `2026-05-28T03:05:27Z`: `qa` -> `done` by `Codex`; QA accepted PM refinement
