<!-- AUDIENCE: Internal/Technical -->

# Cycle Checklist

Use this checklist at the end of every development cycle.

## Story Closure

- [ ] Story scope is completed and acceptance criteria are met.
- [ ] The active story's engineering handoff and QA/verdict sections are updated.
- [ ] Any new source decision, ADR, or refinement dependency is linked from the story.
- [ ] Follow-up work is written as a candidate story or explicitly deferred.

## Validation

- [ ] Run the narrowest meaningful package validation for the changed surface.
- [ ] For core backend work, prefer `npm --workspace @athena/core run typecheck`, `npm --workspace @athena/core run test:unit`, and `npm --workspace @athena/core run validate:manifests`.
- [ ] For console work, inspect package scripts and run the focused UI validation available for the touched area.
- [ ] Run `git diff --check`.

## Handoff Operations (Mandatory)

- [ ] Move completed story files through Flywheel lanes with `./flywheel/tools/flywheel_state.sh move ...` when practical.
- [ ] Update the relevant Flywheel active queue README when queue order changes.
- [ ] Run `./flywheel/tools/validate_workflow_state.sh`.
- [ ] Run `./flywheel/tools/run_observer_cycle.sh --cycle-id <cycle-id>`.
- [ ] If needed, promote the next active story only from a reset-aligned refinement epic or accepted ADR.

## Reporting

- [ ] Summarize changed files.
- [ ] Record key risks and follow-up items.
