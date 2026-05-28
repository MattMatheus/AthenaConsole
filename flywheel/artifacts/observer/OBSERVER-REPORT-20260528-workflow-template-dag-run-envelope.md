# Observer Report: 20260528-workflow-template-dag-run-envelope

## Metadata
- `cycle_id`: 20260528-workflow-template-dag-run-envelope
- `generated_at_utc`: 2026-05-28T17:47:06Z
- `branch`: main
- `story_path`: flywheel/backlog/engineering/done/STORY-20260528-workflow-template-dag-run-envelope.md
- `actor`: Codex

## Structured Trace
- `trace_path`: OBSERVER-REPORT-20260528-workflow-template-dag-run-envelope.json

## Stage Trace
- `events`:
  - PM refinement promoted engineering intake -> active
  - Engineering implementation moved active -> qa
  - QA pass moved qa -> done

## Diff Inventory
- A	flywheel/backlog/engineering/done/STORY-20260528-workflow-template-dag-run-envelope.md
- D	flywheel/backlog/engineering/intake/STORY-20260528-workflow-template-dag-run-envelope.md
- M	docs/product/direction/current-direction.md
- M	flywheel/backlog/README.md
- M	flywheel/backlog/engineering/done/README.md
- M	flywheel/backlog/engineering/intake/README.md
- M	packages/core/src/control-plane/api-schemas.ts
- M	packages/core/src/control-plane/app-state/domain-repositories.ts
- M	packages/core/src/control-plane/app-state/migrations.ts
- M	packages/core/src/control-plane/generated-component-schemas.ts
- M	packages/core/src/control-plane/services/local-services.ts
- M	packages/core/src/control-plane/services/workflow-template-catalog.ts
- M	packages/core/src/schedule/index.ts
- M	packages/core/src/shared/contracts/schedule.ts
- M	packages/core/src/shared/contracts/workflow-template-catalog.ts
- M	packages/core/tests/api.task-schedules.test.ts
- M	packages/core/tests/api.workflow-template-catalog.test.ts
- M	packages/core/tests/control-plane.task-schedules.test.ts
- M	packages/core/tests/control-plane.workflow-template-instantiation.test.ts

## Objective
- `intended_outcome`: Workflow-template instantiation and workflow-template schedules create and expose a durable canonical workflow DAG run envelope.
- `scope_boundary`: Additive envelope/correlation only; no DAG executor replacement, no workflow step execution, and no console redesign.

## Inputs And Evidence
- `artifacts_reviewed`:
  - flywheel/backlog/engineering/done/STORY-20260528-workflow-template-dag-run-envelope.md
  - docs/product/architecture/decisions/0015-canonical-orchestration-state-model.md
  - packages/core/src/control-plane/services/workflow-template-catalog.ts
  - packages/core/src/control-plane/services/workflow-state.ts
  - packages/core/src/control-plane/services/workflow-status.ts
  - packages/core/src/control-plane/services/local-services.ts
- `tools_used`:
  - flywheel_state.sh
  - validate_workflow_state.sh
  - flywheel_doctor.sh
  - run_observer_cycle.sh
  - npm --workspace @athena/core run generate:schemas
  - npm --workspace @athena/core run typecheck
  - npm --workspace @athena/core run test:unit
- `external_sources`: []

## Changes Made
- `files_changed`:
  - packages/core/src/control-plane/services/workflow-template-catalog.ts
  - packages/core/src/control-plane/services/local-services.ts
  - packages/core/src/control-plane/app-state/domain-repositories.ts
  - packages/core/src/control-plane/app-state/migrations.ts
  - packages/core/src/control-plane/api-schemas.ts
  - packages/core/src/control-plane/generated-component-schemas.ts
  - packages/core/src/shared/contracts/workflow-template-catalog.ts
  - packages/core/src/shared/contracts/schedule.ts
  - packages/core/src/schedule/index.ts
  - packages/core/tests/control-plane.workflow-template-instantiation.test.ts
  - packages/core/tests/control-plane.task-schedules.test.ts
  - packages/core/tests/api.workflow-template-catalog.test.ts
  - packages/core/tests/api.task-schedules.test.ts
  - docs/product/direction/current-direction.md
  - flywheel/backlog/README.md
  - flywheel/backlog/engineering/done/STORY-20260528-workflow-template-dag-run-envelope.md
- `state_transitions`:
  - flywheel/backlog/engineering/intake/STORY-20260528-workflow-template-dag-run-envelope.md -> flywheel/backlog/engineering/active/STORY-20260528-workflow-template-dag-run-envelope.md
  - flywheel/backlog/engineering/active/STORY-20260528-workflow-template-dag-run-envelope.md -> flywheel/backlog/engineering/qa/STORY-20260528-workflow-template-dag-run-envelope.md
  - flywheel/backlog/engineering/qa/STORY-20260528-workflow-template-dag-run-envelope.md -> flywheel/backlog/engineering/done/STORY-20260528-workflow-template-dag-run-envelope.md
- `non_file_actions`:
  - regenerated API component schemas

## Validation
- `checks_run`:
  - npm --workspace @athena/core run typecheck
  - npm --workspace @athena/core run test:unit -- tests/control-plane.workflow-template-instantiation.test.ts tests/control-plane.workflow-state.test.ts tests/control-plane.workflow-status.test.ts tests/control-plane.task-schedules.test.ts tests/api.workflow-template-catalog.test.ts tests/api.task-schedules.test.ts tests/schema-generation.test.ts
  - npm --workspace @athena/core run test:unit
  - ./flywheel/tools/validate_workflow_state.sh
  - ./flywheel/tools/flywheel_doctor.sh
  - git diff --check
- `results`:
  - typecheck passed
  - focused suite passed: 7 files, 22 tests
  - full core unit suite passed: 84 files, 407 tests
  - workflow validation passed
  - Flywheel doctor passed
  - whitespace diff check passed
- `checks_not_run`: []

## Workflow Sync Checks
- [x] Entry docs updated if workflow behavior changed.
- [x] Prompts updated if stage behavior changed.
- [x] Process docs updated if contracts or gates changed.
- [x] Queue order and state remain synchronized.

## Warnings And Risks
- `unresolved_risks`:
  - Workflow DAG steps are created as pending envelope state; an executor slice still needs to start, complete, and recover real step execution.
- `assumptions_carried`:
  - The existing mission/task projection remains the execution behavior for this slice.
  - `GET /api/v1/workflow-runs/:runId/status` remains the canonical status inspection endpoint for the returned DAG run id.
- `warnings`: []

## Action Record
- `highest_action_class`: local write
- `approval_required`: no
- `approval_reference`: n/a

## Next Step
- `recommended_next_state`: no active story; route next work through PM refinement
- `follow_up_work`:
  - Refine the next workflow DAG executor slice if continuing DAG implementation.
  - Refine or implement flywheel/backlog/engineering/intake/STORY-20260528-split-app-state-domain-repositories.md if prioritizing the architecture follow-on refactor.
- `durable_promotions`:
  - Workflow-template instantiation now has a canonical workflow DAG run id for status/history correlation.

## Release Impact
- Release scope: required product behavior for the workflow DAG engine foundation
- Additional release actions: []
