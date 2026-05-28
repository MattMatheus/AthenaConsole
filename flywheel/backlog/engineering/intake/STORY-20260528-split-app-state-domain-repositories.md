---
kind: story
id: STORY-20260528-split-app-state-domain-repositories
status: intake
owner_role: Software Engineer
source: architecture
success_metric: App-state domain repositories are split by aggregate without behavior or import-surface changes.
release_scope: deferred
ready: false
---

# Story: Split App-State Domain Repositories By Aggregate

## Metadata
- `id`: STORY-20260528-split-app-state-domain-repositories
- `owner_role`: Software Engineer
- `status`: intake
- `source`: architecture
- `decision_refs`: [ADR-0016]
- `success_metric`: App-state domain repositories are split by aggregate without behavior or import-surface changes.
- `release_scope`: deferred

## Problem Statement

`packages/core/src/control-plane/app-state/domain-repositories.ts` contains task, mission, schedule, run, event, artifact, mapping, and shared helper code in one large file. This is the safest first decomposition target because the file already has clear repository-class boundaries and broad test coverage.

## Scope

- In: mechanical file split by repository aggregate, stable public exports, import cleanup, focused tests.
- Out: schema changes, query behavior changes, new pagination contracts, service behavior changes, lint/import-boundary rules.

## Acceptance Criteria

1. Public imports through `packages/core/src/control-plane/app-state/index.ts` remain compatible.
2. Task, mission, schedule, run, run-event, and artifact repository behavior remains unchanged.
3. Shared JSON/limit helpers are placed in a small shared module without creating import cycles.
4. The diff is mechanical and does not include opportunistic behavior changes.
5. Existing app-state, task workbench, mission workbench, schedule, workflow-template, stale-recovery, and API tests pass.

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

- Should `domain-repositories.ts` remain as a compatibility barrel for one release, or should imports move directly to a directory barrel in the same slice?

## Next Step

PM refinement should confirm whether this runs before or after the workflow-template DAG run envelope story.

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
