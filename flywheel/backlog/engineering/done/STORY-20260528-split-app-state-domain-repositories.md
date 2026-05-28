---
kind: story
id: STORY-20260528-split-app-state-domain-repositories
status: done
owner_role: Software Engineer
source: architecture
success_metric: App-state domain repositories are split by aggregate without behavior or import-surface changes.
release_scope: deferred
ready: true
---

# Story: Split App-State Domain Repositories By Aggregate

## Metadata
- `id`: STORY-20260528-split-app-state-domain-repositories
- `owner_role`: Software Engineer
- `status`: done
- `source`: architecture
- `decision_refs`: [ADR-0016]
- `success_metric`: App-state domain repositories are split by aggregate without behavior or import-surface changes.
- `release_scope`: deferred

## Problem Statement

`packages/core/src/control-plane/app-state/domain-repositories.ts` contains task, mission, schedule, run, event, artifact, mapping, and shared helper code in one large file. This is the safest first decomposition target because the file already has clear repository-class boundaries and broad test coverage.

## Scope

- In: mechanical file split by repository aggregate, stable public exports through `packages/core/src/control-plane/app-state/index.ts`, a compatibility barrel when useful, import cleanup, focused tests.
- Out: schema changes, query behavior changes, new pagination contracts, service behavior changes, generated schema changes, lint/import-boundary rules.

## Acceptance Criteria

1. Public imports through `packages/core/src/control-plane/app-state/index.ts` remain compatible.
2. Task, mission, schedule, run, run-event, and artifact repository behavior remains unchanged.
3. Shared JSON/limit helpers are placed in a small shared module without creating import cycles.
4. The diff is mechanical and does not include opportunistic behavior changes.
5. Existing app-state, task workbench, mission workbench, schedule, workflow-template, stale-recovery, and API tests pass.
6. `domain-repositories.ts` either remains as a compatibility barrel or is replaced by an equivalent directory barrel without breaking existing imports.

## Validation

- Required checks: `npm --workspace @athena/core run typecheck`; `npm --workspace @athena/core run test:unit -- tests/control-plane.domain-repositories.test.ts tests/control-plane.app-state.test.ts tests/control-plane.stale-run-recovery.test.ts`.
- Additional checks: full `npm --workspace @athena/core run test:unit` because the app-state barrel is widely imported.

## Dependencies

- ADR 0016 is accepted.

## Risks

- Import cycles if shared helpers depend on aggregate modules.
- Noisy diffs can hide accidental behavior changes; keep the story mechanical.
- Generated schema and API route imports may reveal implicit import assumptions.

## Open Questions

- Resolved: preserve the existing public import surface. Keep `domain-repositories.ts` as a compatibility barrel for this slice unless engineering proves an equivalent directory barrel is purely mechanical and import-compatible.

## Next Step

Engineering should execute this as the next active no-behavior-change refactor story. The workflow-template DAG run envelope story is already complete.

## Engineering Handoff
- `change_summary`: Split `domain-repositories.ts` into aggregate modules under `packages/core/src/control-plane/app-state/domain-repositories/` for tasks, missions, schedules, runs/events/artifacts, and shared helpers. Kept `domain-repositories.ts` as a compatibility barrel so existing `app-state/index.ts` exports and direct imports remain stable.
- `validation_evidence`: `npm --workspace @athena/core run typecheck`; `npm --workspace @athena/core run test:unit -- tests/control-plane.domain-repositories.test.ts tests/control-plane.app-state.test.ts tests/control-plane.stale-run-recovery.test.ts`; `npm --workspace @athena/core run test:unit` initially exposed a stale-run-recovery ordering flake, the test passed in isolation, and the full suite passed on rerun with 84 files / 407 tests; `git diff --check`.
- `qa_focus`: Confirm the split is mechanical, public imports still flow through `packages/core/src/control-plane/app-state/index.ts` and `domain-repositories.ts`, no schema/query/service behavior changed, and broad app-state consumers continue to pass.
- `open_risks`: The full suite exposed one pre-existing nondeterministic stale-recovery ordering expectation on the first run; it passed in isolation and on full-suite rerun without code changes.

## QA Verdict
- `verdict`: Pass
- `evidence_quality`: Strong. Typecheck passed, required focused repository/app-state/stale-recovery tests passed, full core unit suite passed on rerun after one documented stale-recovery ordering flake, and `git diff --check` passed.
- `defects`: None found in the repository split. The observed stale-recovery ordering flake is pre-existing/nondeterministic and was not changed in this mechanical refactor.
- `state_transition`: Move to done.

## Transition History
- `2026-05-28T17:51:41Z`: `intake` -> `active`; PM refined as next mechanical architecture follow-on refactor
- `2026-05-28T17:58:27Z`: `active` -> `qa`; Engineering handoff ready with mechanical split and validation evidence
- `2026-05-28T17:58:58Z`: `qa` -> `done`; QA pass; mechanical split and validation accepted
