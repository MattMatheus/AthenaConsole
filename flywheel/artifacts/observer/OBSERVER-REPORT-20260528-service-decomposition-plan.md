# Observer Report: 20260528-service-decomposition-plan

## Metadata
- `cycle_id`: 20260528-service-decomposition-plan
- `generated_at_utc`: 2026-05-28T17:38:26Z
- `branch`: main
- `story_path`: flywheel/backlog/architecture/done/ARCH-20260528-service-decomposition-plan.md
- `actor`: Codex

## Structured Trace
- `trace_path`: OBSERVER-REPORT-20260528-service-decomposition-plan.json

## Stage Trace
- `events`:
  - architecture active -> qa for ADR/review validation
  - architecture qa -> done after architecture review pass

## Diff Inventory
- A	docs/product/architecture/decisions/0016-core-service-decomposition-plan.md
- A	flywheel/artifacts/observer/OBSERVER-REPORT-20260528-service-decomposition-plan.json
- A	flywheel/artifacts/observer/OBSERVER-REPORT-20260528-service-decomposition-plan.md
- A	flywheel/backlog/architecture/done/ARCH-20260528-service-decomposition-plan.md
- A	flywheel/backlog/engineering/intake/STORY-20260528-split-app-state-domain-repositories.md
- D	flywheel/backlog/architecture/active/ARCH-20260528-service-decomposition-plan.md
- M	AGENTS.md
- M	docs/product/architecture/decisions/README.md
- M	docs/product/direction/current-direction.md
- M	flywheel/backlog/README.md
- M	flywheel/backlog/architecture/active/README.md
- M	flywheel/backlog/architecture/done/README.md
- M	flywheel/backlog/engineering/intake/README.md

## Objective
- `intended_outcome`: Accept a practical decomposition plan for oversized core service files and identify the first low-risk engineering extraction.
- `scope_boundary`: Architecture and backlog planning only; no runtime implementation, schema changes, or production behavior changes.

## Inputs And Evidence
- `artifacts_reviewed`:
  - docs/product/audits/2026-05-28-code-quality-audit.md
  - docs/product/architecture/decisions/0016-core-service-decomposition-plan.md
  - packages/core/src/control-plane/app-state/domain-repositories.ts
  - packages/core/src/control-plane/services/task-workbench.ts
  - packages/core/src/control-plane/services/local-services.ts
  - packages/core/src/control-plane/services/policy.ts
  - packages/core/src/control-plane/backends/k8s-sandbox-execution-backend.ts
- `tools_used`:
  - flywheel_state.sh
  - validate_workflow_state.sh
  - flywheel_doctor.sh
  - run_observer_cycle.sh
  - rg
  - wc
- `external_sources`: []

## Changes Made
- `files_changed`:
  - AGENTS.md
  - docs/product/architecture/decisions/README.md
  - docs/product/architecture/decisions/0016-core-service-decomposition-plan.md
  - docs/product/direction/current-direction.md
  - flywheel/backlog/README.md
  - flywheel/backlog/architecture/done/ARCH-20260528-service-decomposition-plan.md
  - flywheel/backlog/architecture/active/README.md
  - flywheel/backlog/architecture/done/README.md
  - flywheel/backlog/engineering/intake/README.md
  - flywheel/backlog/engineering/intake/STORY-20260528-split-app-state-domain-repositories.md
- `state_transitions`:
  - flywheel/backlog/architecture/active/ARCH-20260528-service-decomposition-plan.md -> flywheel/backlog/architecture/qa/ARCH-20260528-service-decomposition-plan.md
  - flywheel/backlog/architecture/qa/ARCH-20260528-service-decomposition-plan.md -> flywheel/backlog/architecture/done/ARCH-20260528-service-decomposition-plan.md
- `non_file_actions`: []

## Validation
- `checks_run`:
  - ./flywheel/tools/validate_workflow_state.sh
  - ./flywheel/tools/flywheel_doctor.sh
  - git diff --check
- `results`:
  - workflow validation passed
  - Flywheel doctor passed
  - whitespace diff check passed
- `checks_not_run`:
  - product unit/integration tests; cycle changed architecture and backlog artifacts only

## Workflow Sync Checks
- [x] Entry docs updated if workflow behavior changed.
- [x] Prompts updated if stage behavior changed.
- [x] Process docs updated if contracts or gates changed.
- [x] Queue order and state remain synchronized.

## Warnings And Risks
- `unresolved_risks`:
  - The decomposition is planned but not implemented; follow-on engineering still needs to prove the split with tests.
  - Import-boundary automation is deferred until module ownership stabilizes.
- `assumptions_carried`:
  - Generated schema files are excluded from the first decomposition pass.
  - The no-behavior-change app-state repository split is the lowest-risk first extraction.
- `warnings`: []

## Action Record
- `highest_action_class`: local documentation and backlog update
- `approval_required`: no
- `approval_reference`: n/a

## Next Step
- `recommended_next_state`: continue backlog refinement or select the next engineering intake item
- `follow_up_work`:
  - Refine or implement flywheel/backlog/engineering/intake/STORY-20260528-workflow-template-dag-run-envelope.md.
  - Refine or implement flywheel/backlog/engineering/intake/STORY-20260528-split-app-state-domain-repositories.md.
- `durable_promotions`:
  - ADR-0016 should guide future decomposition of oversized core service files.

## Release Impact
- Release scope: internal planning and architecture documentation only
- Additional release actions: []
