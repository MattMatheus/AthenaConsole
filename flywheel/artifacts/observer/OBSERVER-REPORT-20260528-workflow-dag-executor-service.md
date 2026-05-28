# Observer Report: 20260528-workflow-dag-executor-service

## Metadata
- `cycle_id`: 20260528-workflow-dag-executor-service
- `generated_at_utc`: 2026-05-28T19:22:41Z
- `branch`: main
- `story_path`: flywheel/backlog/engineering/done/STORY-20260528-workflow-dag-executor-service.md
- `actor`: Codex

## Structured Trace
- `trace_path`: OBSERVER-REPORT-20260528-workflow-dag-executor-service.json

## Stage Trace
- `events`:
  - PM refined the executor story as a service-only canonical workflow DAG executor slice and moved it from intake to active.
  - Engineering implemented the executor, provenance-based task lookup, and focused success/failure tests.
  - QA reran focused and full validation, fixed an unrelated order-sensitive test assertion, and moved the story to done.

## Diff Inventory
- A	flywheel/backlog/engineering/done/STORY-20260528-workflow-dag-executor-service.md
- A	packages/core/src/control-plane/services/workflow-dag-executor.ts
- A	packages/core/tests/control-plane.workflow-dag-executor.test.ts
- D	flywheel/backlog/engineering/intake/STORY-20260528-workflow-dag-executor-service.md
- M	docs/product/direction/current-direction.md
- M	docs/product/epics/refinement/2026.17.00-epic-workflow-dag-engine.md
- M	flywheel/backlog/README.md
- M	flywheel/backlog/engineering/done/README.md
- M	flywheel/backlog/engineering/intake/README.md
- M	packages/core/src/control-plane/app-state/domain-repositories/tasks.ts
- M	packages/core/tests/control-plane.stale-run-recovery.test.ts

## Objective
- `intended_outcome`: Add a deterministic service-only executor that runs canonical workflow DAG steps through projected task runs.
- `scope_boundary`: No API route, schedule execution change, parallelism, schema migration, or legacy file-backed `WorkflowExecutor` replacement.

## Inputs And Evidence
- `artifacts_reviewed`:
  - `flywheel/backlog/engineering/done/STORY-20260528-workflow-dag-executor-service.md`
  - `docs/product/epics/refinement/2026.17.00-epic-workflow-dag-engine.md`
  - `docs/product/direction/current-direction.md`
  - `packages/core/src/control-plane/services/workflow-dag-executor.ts`
  - `packages/core/src/control-plane/services/task-workbench.ts`
  - `packages/core/src/control-plane/services/workflow-state.ts`
  - `packages/core/src/control-plane/app-state/domain-repositories/tasks.ts`
  - `packages/core/tests/control-plane.workflow-dag-executor.test.ts`
- `tools_used`:
  - `launch_stage.sh`
  - `flywheel_state.sh`
  - `validate_workflow_state.sh`
  - `flywheel_doctor.sh`
  - `run_observer_cycle.sh`
  - `npm --workspace @athena/core run typecheck`
  - `npm --workspace @athena/core run test:unit`
- `external_sources`: []

## Changes Made
- `files_changed`:
  - `packages/core/src/control-plane/services/workflow-dag-executor.ts`
  - `packages/core/src/control-plane/app-state/domain-repositories/tasks.ts`
  - `packages/core/tests/control-plane.workflow-dag-executor.test.ts`
  - `packages/core/tests/control-plane.stale-run-recovery.test.ts`
  - `flywheel/backlog/engineering/done/STORY-20260528-workflow-dag-executor-service.md`
  - `flywheel/backlog/engineering/intake/README.md`
  - `flywheel/backlog/engineering/done/README.md`
  - `flywheel/backlog/README.md`
  - `docs/product/direction/current-direction.md`
  - `docs/product/epics/refinement/2026.17.00-epic-workflow-dag-engine.md`
- `state_transitions`:
  - `STORY-20260528-workflow-dag-executor-service.md`: engineering/intake -> engineering/active
  - `STORY-20260528-workflow-dag-executor-service.md`: engineering/active -> engineering/qa
  - `STORY-20260528-workflow-dag-executor-service.md`: engineering/qa -> engineering/done
- `non_file_actions`:
  - Confirmed the new executor is service-only and leaves API, schedule, and legacy workflow executor behavior unchanged.
  - Fixed an unrelated order-sensitive stale-run recovery test assertion found during full-suite QA.

## Validation
- `checks_run`:
  - `npm --workspace @athena/core run typecheck`
  - `npm --workspace @athena/core run test:unit -- tests/control-plane.workflow-dag-executor.test.ts tests/control-plane.task-workbench.test.ts tests/control-plane.workflow-template-instantiation.test.ts tests/control-plane.workflow-state.test.ts tests/control-plane.workflow-status.test.ts`
  - `npm --workspace @athena/core run test:unit -- tests/control-plane.stale-run-recovery.test.ts`
  - `npm --workspace @athena/core run test:unit`
  - `./flywheel/tools/validate_workflow_state.sh`
  - `./flywheel/tools/flywheel_doctor.sh`
  - `git diff --check`
- `results`:
  - Typecheck passed.
  - Focused workflow/task suite passed: 5 files, 36 tests.
  - Stale-run recovery regression passed: 1 file, 4 tests.
  - Full unit suite passed: 85 files, 411 tests.
  - Workflow state validation passed.
  - Flywheel doctor passed.
  - `git diff --check` produced no errors.
- `checks_not_run`: []

## Workflow Sync Checks
- [x] Entry docs updated if workflow behavior changed.
- [x] Prompts updated if stage behavior changed.
- [x] Process docs updated if contracts or gates changed.
- [x] Queue order and state remain synchronized.

## Warnings And Risks
- `unresolved_risks`:
  - Cancellation and timeout orchestration remain follow-on work.
  - Missing projected tasks are treated as configuration errors.
- `assumptions_carried`:
  - Workflow-template task provenance remains the canonical DAG step-to-task linkage contract.
  - Serial execution is the desired first executor behavior.
- `warnings`: []

## Action Record
- `highest_action_class`: local write
- `approval_required`: no
- `approval_reference`: none

## Next Step
- `recommended_next_state`: engineering/done
- `follow_up_work`:
  - Refine the restart/resume workflow DAG story next.
- `durable_promotions`: []

## Release Impact
- Release scope: Required Workflow DAG Engine backend slice completed.
- Additional release actions: []
