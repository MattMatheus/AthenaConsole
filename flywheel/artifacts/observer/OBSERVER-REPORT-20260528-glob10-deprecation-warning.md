# Observer Report: 20260528-glob10-deprecation-warning

## Metadata
- `cycle_id`: 20260528-glob10-deprecation-warning
- `generated_at_utc`: 2026-05-28T15:47:09Z
- `branch`: main
- `story_path`: flywheel/backlog/engineering/done/BUG-20260528-glob10-deprecation-warning.md
- `actor`: Codex

## Structured Trace
- `trace_path`: OBSERVER-REPORT-20260528-glob10-deprecation-warning.json

## Stage Trace
- `events`: []

## Diff Inventory
- A	flywheel/backlog/engineering/done/BUG-20260528-glob10-deprecation-warning.md
- D	flywheel/backlog/engineering/intake/BUG-20260528-glob10-deprecation-warning.md
- M	flywheel/backlog/engineering/done/README.md
- M	flywheel/backlog/engineering/intake/README.md
- M	package-lock.json
- M	packages/core/package-lock.json
- M	packages/core/package.json
- M	packages/core/src/runtime/session-store.ts
- M	packages/core/tests/api.router.test.ts
- M	packages/core/tests/runtime.context-overflow.test.ts

## Objective
- `intended_outcome`: Remove the deprecated `glob@10.5.0` dependency path from CI installs and document validation evidence.
- `scope_boundary`: Dependency hygiene for the `@athena/core` coverage tooling path plus QA fixes required to keep the upgraded coverage stack green.

## Inputs And Evidence
- `artifacts_reviewed`: [`flywheel/backlog/engineering/done/BUG-20260528-glob10-deprecation-warning.md`, `package-lock.json`, `packages/core/package-lock.json`, `packages/core/package.json`]
- `tools_used`: [`npm ls glob`, `npm audit --omit=dev`, `npm audit`, `npm --workspace @athena/core run typecheck`, `npm --workspace @athena/core run test:unit`, `npm --workspace @athena/core run test:coverage`, `rg`, `flywheel_state.sh`, `validate_workflow_state.sh`, `flywheel_doctor.sh`]
- `external_sources`: []

## Changes Made
- `files_changed`: [`packages/core/package.json`, `package-lock.json`, `packages/core/package-lock.json`, `packages/core/src/runtime/session-store.ts`, `packages/core/tests/api.router.test.ts`, `packages/core/tests/runtime.context-overflow.test.ts`, backlog lane README/story files]
- `state_transitions`: [`intake -> active`, `active -> qa`, `qa -> done`]
- `non_file_actions`: [`npm install`, dependency graph validation, audit reporting, full coverage QA]

## Validation
- `checks_run`: [`npm ls glob`, `rg 'glob-10\\.5\\.0|test-exclude-7\\.0\\.1' package-lock.json packages/core/package-lock.json`, `npm audit --omit=dev`, `npm audit`, `npm --workspace @athena/core run typecheck`, `npm --workspace @athena/core run test:unit -- tests/api.router.test.ts tests/runtime.lock.test.ts`, `npm --workspace @athena/core run test:unit -- tests/runtime.context-overflow.test.ts`, `npm --workspace @athena/core run test:coverage`, `./flywheel/tools/validate_workflow_state.sh --format json`, `./flywheel/tools/flywheel_doctor.sh --format json`, `git diff --check`]
- `results`: [`npm ls glob` reported `(empty)`, lockfile grep returned no deprecated glob/test-exclude matches, typecheck passed, focused tests passed, full coverage passed with 83 test files and 391 tests, workflow validation passed, doctor passed, diff check passed, audits still report unrelated pre-existing advisories]
- `checks_not_run`: []

## Workflow Sync Checks
- [x] Entry docs updated if workflow behavior changed.
- [x] Prompts updated if stage behavior changed.
- [x] Process docs updated if contracts or gates changed.
- [x] Queue order and state remain synchronized.

## Warnings And Risks
- `unresolved_risks`: [`npm audit --omit=dev` and `npm audit` still fail because of unrelated advisories outside the removed glob path.]
- `assumptions_carried`: []
- `warnings`: []

## Action Record
- `highest_action_class`: dependency refresh
- `approval_required`: no
- `approval_reference`: n/a

## Next Step
- `recommended_next_state`: committed
- `follow_up_work`: []
- `durable_promotions`: []

## Release Impact
- Release scope: Dependency hygiene and test stability for `@athena/core`.
- Additional release actions: []
