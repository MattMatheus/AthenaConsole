# Observer Report: 20260528-legacy-workflow-dag-alignment

## Metadata
- `cycle_id`: 20260528-legacy-workflow-dag-alignment
- `generated_at_utc`: 2026-05-28T20:01:12Z
- `branch`: main
- `story_path`: flywheel/backlog/engineering/done/STORY-20260528-legacy-workflow-dag-alignment.md
- `actor`: Codex

## Structured Trace
- `trace_path`: OBSERVER-REPORT-20260528-legacy-workflow-dag-alignment.json

## Stage Trace
- `events`: []

## Diff Inventory
- A	flywheel/backlog/engineering/done/STORY-20260528-legacy-workflow-dag-alignment.md
- D	flywheel/backlog/engineering/intake/STORY-20260528-legacy-workflow-dag-alignment.md
- M	docs/product/direction/current-direction.md
- M	docs/product/epics/refinement/2026.17.00-epic-workflow-dag-engine.md
- M	flywheel/backlog/README.md
- M	flywheel/backlog/engineering/done/README.md
- M	flywheel/backlog/engineering/intake/README.md
- M	packages/core/src/control-plane/api-artifact.ts
- M	packages/core/src/control-plane/api-contracts.ts
- M	packages/core/src/control-plane/generated-component-schemas.ts
- M	packages/core/src/control-plane/services/workflow-observability.ts
- M	packages/core/src/shared/contracts/workflow.ts
- M	packages/core/tests/api.server.test.ts
- M	packages/core/tests/control-plane.api-artifact.test.ts
- M	packages/core/tests/control-plane.api-contracts.test.ts

## Objective
- `intended_outcome`: Legacy workflow APIs are explicitly labeled as deprecated compatibility surfaces, while canonical workflow DAG status remains the clear workflow-template execution model.
- `scope_boundary`: Additive labeling, contract metadata, docs, and tests only; no endpoint removal, no file-backed state migration, and no automatic bridge between legacy workflow ids and canonical DAG run ids.

## Inputs And Evidence
- `artifacts_reviewed`: [`flywheel/backlog/engineering/done/STORY-20260528-legacy-workflow-dag-alignment.md`, `docs/product/epics/refinement/2026.17.00-epic-workflow-dag-engine.md`, `docs/product/direction/current-direction.md`]
- `tools_used`: [`launch_stage.sh pm`, `launch_stage.sh engineering`, `launch_stage.sh qa`, `flywheel_state.sh move`, `npm --workspace @athena/core run typecheck`, `npm --workspace @athena/core run check:schemas`, `npm --workspace @athena/core run test:unit`, `validate_workflow_state.sh`, `flywheel_doctor.sh`]
- `external_sources`: []

## Changes Made
- `files_changed`: Core workflow contracts, workflow observability response builder, API route contract metadata, OpenAPI artifact generation, generated component schemas, workflow/API tests, product direction, epic, and Flywheel backlog records.
- `state_transitions`: `engineering/intake` -> `engineering/active` -> `engineering/qa` -> `engineering/done`.
- `non_file_actions`: Generated API component schemas after extending the workflow observability contract.

## Validation
- `checks_run`: [`npm --workspace @athena/core run typecheck`, `npm --workspace @athena/core run check:schemas`, `npm --workspace @athena/core run test:unit -- api.server.test.ts control-plane.api-contracts.test.ts control-plane.api-artifact.test.ts api.route-registration.test.ts control-plane.workflow-status.test.ts`, `npm --workspace @athena/core run test:unit`, `git diff --check`, `./flywheel/tools/validate_workflow_state.sh`, `./flywheel/tools/flywheel_doctor.sh`]
- `results`: All checks passed.
- `checks_not_run`: []

## Workflow Sync Checks
- [x] Entry docs updated if workflow behavior changed.
- [x] Prompts updated if stage behavior changed.
- [x] Process docs updated if contracts or gates changed.
- [x] Queue order and state remain synchronized.

## Warnings And Risks
- `unresolved_risks`: [`Retiring or migrating legacy file-backed workflow state remains future work and should be planned separately if desired.`]
- `assumptions_carried`: [`Existing compatibility consumers may still call /api/v1/workflows*; this story preserves behavior and labels the surface instead of removing it.`]
- `warnings`: []

## Action Record
- `highest_action_class`: Low-risk local contract metadata, additive response metadata, tests, and documentation edits.
- `approval_required`: No.
- `approval_reference`: None.

## Next Step
- `recommended_next_state`: Commit completed cycle.
- `follow_up_work`: []
- `durable_promotions`: [`Workflow DAG Engine epic is complete.`]

## Release Impact
- Release scope: follow-up
- Additional release actions: [`Call out deprecated legacy /api/v1/workflows* compatibility surfaces in release notes if external consumers depend on workflow APIs.`]
