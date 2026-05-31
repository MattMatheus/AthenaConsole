---
kind: story
id: STORY-20260530-code-review-plugin-agent-migration
status: done
owner_role: Senior Engineer
source: direct
success_metric: Code review exists as a current plugin-backed sample agent and no longer depends on specialist/persona assets.
release_scope: required
ready: false
---

# Story: Code Review Plugin Agent Migration

## Metadata
- `id`: STORY-20260530-code-review-plugin-agent-migration
- `owner_role`: Senior Engineer
- `status`: done
- `source`: direct
- `decision_refs`: [0006, 0007, 0008, 0009]
- `epic`: docs/product/epics/refinement/2026.32.00-epic-useful-feature-migration-and-legacy-removal.md
- `success_metric`: Code review exists as a current plugin-backed sample agent and no longer depends on specialist/persona assets.
- `release_scope`: required

## Problem Statement

`specialists/code-review` contains useful behavior, but it teaches the old specialist/persona model. Code review should remain a first-class example only if it is expressed as a manifest-backed plugin agent.

## Scope
- In: create or adapt a plugin-backed code-review sample; migrate useful prompt/skill/doc context; add manifest validation and sample tests; update docs to point new users to the plugin-backed agent.
- Out: preserving `athena specialist` or `athena persona` behavior for compatibility.

## Acceptance Criteria
1. A code-review sample agent exists under the current plugin/sample-agent structure.
2. The sample can be discovered by the agent catalog and used from task/workflow creation paths.
3. Useful review behavior from `specialists/code-review` is migrated or intentionally discarded with notes.
4. Current docs point to the plugin-backed code-review agent, not `specialists/code-review`.
5. `specialists/code-review` is removed, archived, or converted into a fixture that is clearly not current product guidance.

## Validation
- Required checks: manifest validation, focused sample/plugin tests, `npm --workspace @athena/core run typecheck`, `git diff --check`.
- Additional checks: `rg "specialists/code-review|athena specialist|athena persona"` review for active docs.

## Dependencies
- Useful feature migration epic.

## Risks
- Code-review behavior may rely on specialist-only artifact conventions; migrate outputs into current run artifact contracts.

## Engineering Handoff
- `change_summary`: Added `sample-plugins/code-review` with a plugin manifest, agent manifest, bounded repo input schema, deterministic read-only git diff runner, and plugin README. Added `packages/core/tests/control-plane.code-review-sample.test.ts` to prove catalog discovery, task execution, structured findings, and artifact metadata. Updated current docs to point code-review users at the plugin-backed sample and removed the active `specialists/code-review` asset.
- `validation_evidence`: `npm --workspace @athena/core run validate:manifests`; `npm --workspace @athena/core exec vitest run tests/control-plane.code-review-sample.test.ts`; `npm --workspace @athena/core exec vitest run tests/control-plane.code-review-sample.test.ts tests/control-plane.plugin-loader.test.ts`; `npm --workspace @athena/core run typecheck`; `git diff --check`; `./flywheel/tools/validate_workflow_state.sh --format json`.
- `qa_focus`: Confirm `code.review.local` loads from `sample-plugins/code-review`, task runs return deterministic `P1`/`P2`/`P3` findings and a markdown artifact, and public/current docs no longer send users to the code-review specialist asset.
- `open_risks`: Broader persona/specialist runtime references still exist in compatibility source, tests, and package docs; those are intentionally left for `STORY-20260530-remove-persona-specialist-runtime`.

## QA Verdict
- `verdict`: Pass.
- `evidence_quality`: Strong. Manifest validation covers the new plugin package, focused control-plane tests cover plugin discovery and task-run output, typecheck passed, diff whitespace passed, and workflow validation passed after QA lane movement.
- `defects`: None found.
- `state_transition`: Move to `done`.

## Transition History
- `2026-05-31T00:28:49Z`: `intake` -> `active`
- `2026-05-31T00:36:31Z`: `active` -> `qa`
- `2026-05-31T00:36:50Z`: `qa` -> `done`
