---
kind: story
id: STORY-20260528-split-app-state-domain-repositories
status: active
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
- `status`: active
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
- `2026-05-28T17:51:41Z`: `intake` -> `active`; PM refined as next mechanical architecture follow-on refactor
