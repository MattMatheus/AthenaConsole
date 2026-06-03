---
kind: story
id: STORY-20260602-software-team-pack-skeleton
status: done
owner_role: engineering
source: pm
success_metric: The software-team bundled pack exists as a normal validated first-party pack with canonical metadata, docs, fixtures, and placeholder workflow structure.
release_scope: deferred
ready: false
---

# Story: Software Team Pack Skeleton

## Metadata
- `id`: STORY-20260602-software-team-pack-skeleton
- `owner_role`: engineering
- `status`: done
- `source`: pm
- `decision_refs`: [0008-plugin-package-format]
- `success_metric`: The software-team bundled pack exists as a normal validated first-party pack with canonical metadata, docs, fixtures, and placeholder workflow structure.
- `release_scope`: deferred

## Problem Statement
The built-in software-team capability pack needs a stable first-party package home before individual agents and workflows are promoted into it.

## Scope
- In: Create or convert the bundled software-team pack root; define pack metadata; establish docs, fixtures, runner layout, validation wiring, and naming conventions for the pack.
- Out: Full implementation of all agents, connector integrations, external writes, and memory-aware behavior.

## Assumptions
- The 2026.38 bundled pack foundation is complete.
- The existing `bundled-plugins/software-team` foundation can be evolved into the real pack rather than keeping a separate demo fixture.
- The pack remains a normal plugin indexed through the bundled/system loader.

## Acceptance Criteria
1. A bundled software-team pack exists under the stable bundled plugin path with valid `plugin.pack` metadata.
2. The pack validates through manifest and pack-fixture validation.
3. Pack docs explain current capabilities, deterministic mode, provider-backed expectations, and safety posture.
4. The pack includes at least one fixture and at least one smokeable workflow placeholder or initial workflow.
5. Naming conventions for agents, workflow IDs, fixtures, and scripts are documented for follow-on stories.

## Validation
- Required checks: `npm --workspace @athena/core run validate:manifests`; `npm --workspace @athena/core run validate:pack-fixtures`; focused plugin loader tests.
- Additional checks: `npm --workspace @athena/core run typecheck`; docs/path smoke.

## Dependencies
- Completed 2026.38 Capability Pack Foundation.

## Risks
- Renaming the demo pack could break tests or docs if references are missed.
- Leaving too many placeholder resources could make the pack look more complete than it is.

## Open Questions
- Should the existing demo pack become the real software-team pack or remain as a separate fixture?

## Next Step
- PM promote first; it unlocks all other 2026.39 stories.

## Engineering Handoff
- `change_summary`: Evolved the bundled software-team foundation into `bundled-plugins/software-team` with canonical plugin metadata, docs, fixtures, shared runner layout, stable agent/workflow naming, and validation through the bundled pack fixture command.
- `validation_evidence`: `npm --workspace @athena/core run validate:pack-fixtures` passed; `npm --workspace @athena/core run validate:manifests` passed; `npm --workspace @athena/core run test:unit -- control-plane.plugin-loader.test.ts control-plane.manifests.test.ts control-plane.agent-catalog.test.ts control-plane.workflow-template-catalog.test.ts` passed with 28 tests; `npm --workspace @athena/core run typecheck` passed.
- `qa_focus`: Confirm `bundled-plugins/software-team` indexes as a normal bundled/system plugin; verify docs explain deterministic, provider-backed, memory-aware, and safety expectations without overclaiming completeness.
- `open_risks`: The pack is useful in deterministic mode, but provider-backed quality improvements remain future work.

## QA Verdict
- `verdict`: Pass. Acceptance criteria are met.
- `evidence_quality`: Strong. QA reran pack fixture validation, manifest validation, focused plugin/catalog tests, and core typecheck.
- `defects`: None.
- `state_transition`: Move to `done`.

## Transition History
- `2026-06-03T02:26:36Z`: `intake` -> `ready`; PM refined 2026.39 software-team pack sequence
- `2026-06-03T02:26:36Z`: `ready` -> `active`; Activate first software-team pack dependency
- `2026-06-03T02:32:04Z`: `active` -> `qa`; Engineering handoff ready with pack skeleton validation evidence
- `2026-06-03T02:32:20Z`: `qa` -> `done`; QA passed software-team pack skeleton
