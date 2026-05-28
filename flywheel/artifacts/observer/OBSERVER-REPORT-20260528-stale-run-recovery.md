# Observer Report: 20260528-stale-run-recovery

## Metadata
- `cycle_id`: 20260528-stale-run-recovery
- `generated_at_utc`: 2026-05-28T16:59:14Z
- `branch`: main
- `story_path`: flywheel/backlog/engineering/done/STORY-20260528-stale-run-recovery.md
- `actor`: Codex

## Structured Trace
- `trace_path`: OBSERVER-REPORT-20260528-stale-run-recovery.json

## Stage Trace
- `events`:
  - Engineering story moved from active to QA with implementation handoff complete.
  - Engineering story moved from QA to done after QA passed.

## Diff Inventory
- A	flywheel/backlog/engineering/done/STORY-20260528-stale-run-recovery.md
- A	packages/core/src/control-plane/services/stale-run-recovery.ts
- A	packages/core/tests/control-plane.stale-run-recovery.test.ts
- D	flywheel/backlog/engineering/active/STORY-20260528-stale-run-recovery.md
- M	flywheel/backlog/README.md
- M	flywheel/backlog/engineering/active/README.md
- M	flywheel/backlog/engineering/done/README.md
- M	packages/core/src/control-plane/services.ts

## Objective
- `intended_outcome`: Recover stale SQLite task and mission runs left in `running` after API/service restart.
- `scope_boundary`: Task and mission run recovery, startup wiring, operator-visible events, idempotence, and schedule behavior; workflow DAG step linkage remains future work because current DAG state has no task/mission run attachment field.

## Inputs And Evidence
- `artifacts_reviewed`:
  - docs/product/architecture/decisions/0015-canonical-orchestration-state-model.md
  - packages/core/src/control-plane/services/task-workbench.ts
  - packages/core/src/control-plane/services/mission-workbench.ts
  - packages/core/src/control-plane/services.ts
  - packages/core/src/control-plane/app-state/domain-repositories.ts
  - packages/core/src/control-plane/services/local-services.ts
- `tools_used`:
  - flywheel_state.sh
  - validate_workflow_state.sh
  - flywheel_doctor.sh
  - run_observer_cycle.sh
  - npm --workspace @athena/core run test:unit
  - npm --workspace @athena/core run typecheck
- `external_sources`: []

## Changes Made
- `files_changed`:
  - packages/core/src/control-plane/services/stale-run-recovery.ts
  - packages/core/src/control-plane/services.ts
  - packages/core/tests/control-plane.stale-run-recovery.test.ts
  - flywheel/backlog/engineering/done/STORY-20260528-stale-run-recovery.md
  - flywheel/backlog/README.md
- `state_transitions`:
  - STORY-20260528-stale-run-recovery: active -> QA
  - STORY-20260528-stale-run-recovery: QA -> done
- `non_file_actions`:
  - QA review completed with no defects found.

## Validation
- `checks_run`:
  - npm --workspace @athena/core run test:unit -- tests/control-plane.stale-run-recovery.test.ts
  - npm --workspace @athena/core run typecheck
  - npm --workspace @athena/core run test:unit
  - ./flywheel/tools/validate_workflow_state.sh
  - ./flywheel/tools/flywheel_doctor.sh
  - git diff --check
- `results`:
  - PASS: focused stale-run recovery tests, 3 tests.
  - PASS: core typecheck.
  - PASS: full core unit suite, 84 files and 401 tests.
  - PASS: workflow state validation.
  - PASS: flywheel doctor.
  - PASS: git diff --check.
- `checks_not_run`: []

## Workflow Sync Checks
- [x] Entry docs updated if workflow behavior changed.
- [x] Prompts updated if stage behavior changed.
- [x] Process docs updated if contracts or gates changed.
- [x] Queue order and state remain synchronized.

## Warnings And Risks
- `unresolved_risks`:
  - Startup-only recovery can fail an external process that survives API restart; heartbeat leases remain future work.
  - Workflow DAG step propagation is deferred until task/mission run ids are attached to DAG steps.
- `assumptions_carried`:
  - Active task and mission execution state remains process-local.
  - Failed recovered task/mission records are no longer considered running for schedule overlap purposes.
- `warnings`: []

## Action Record
- `highest_action_class`: local code and workflow state changes
- `approval_required`: no
- `approval_reference`: not applicable

## Next Step
- `recommended_next_state`: Continue with the next active backlog item.
- `follow_up_work`:
  - Refine and implement workflow-template DAG run envelope linkage so recovered task/mission runs can propagate to workflow DAG step status when attached.
- `durable_promotions`: []

## Release Impact
- Release scope: required bug/story work completed
- Additional release actions: []
