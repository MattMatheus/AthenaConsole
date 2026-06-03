---
kind: story
id: STORY-20260602-pack-manifest-conventions
status: done
owner_role: engineering
source: pm
success_metric: First-party pack metadata can be validated and exposed without special-casing individual packs.
release_scope: deferred
ready: false
---

# Story: Pack Manifest Conventions

## Metadata
- `id`: STORY-20260602-pack-manifest-conventions
- `owner_role`: engineering
- `status`: done
- `source`: pm
- `decision_refs`: [0008-plugin-package-format]
- `success_metric`: First-party pack metadata can be validated and exposed without special-casing individual packs.
- `release_scope`: deferred

## Problem Statement
First-party capability packs need a consistent way to describe category, maturity, credential needs, memory needs, safety posture, and example workflows while remaining normal plugin packages.

## Scope
- In: Extend or document manifest metadata conventions for bundled capability packs; define validation behavior; add representative fixture coverage.
- Out: Marketplace metadata, remote plugin registry behavior, connector-specific auth flows, and new console authoring tools.

## Assumptions
- First-party packs continue to use the existing plugin manifest path.
- Metadata should be minimal and product-facing, not a marketplace taxonomy.
- Existing sample plugins can be used as fixture patterns.

## Acceptance Criteria
1. Pack metadata conventions are documented in the plugin or pack manifest docs.
2. Manifest validation accepts valid pack metadata and rejects malformed category, maturity, credential, memory, or safety fields.
3. At least one checked-in first-party or sample fixture demonstrates the complete metadata shape.
4. Existing user-authored plugin manifests remain valid without requiring pack metadata.

## Validation
- Required checks: `npm --workspace @athena/core run validate:manifests`; focused manifest/schema tests.
- Additional checks: `npm --workspace @athena/core run typecheck`; docs review for terminology consistency.

## Dependencies
- Epic 2026.38 Capability Pack Foundation.
- Existing plugin package format and manifest validation path.

## Risks
- Metadata sprawl can create premature marketplace semantics.
- Required fields could accidentally break existing local plugins.

## Open Questions
- Should pack metadata live in the existing plugin manifest root or under a dedicated optional `pack` object?
- Which maturity labels are enough for first-party packs without implying marketplace review states?

## Next Step
- Architecture or PM should confirm the metadata shape before implementation promotion.

## Engineering Handoff
- `change_summary`: Added optional `plugin.pack` metadata to the v1 plugin manifest schema, documented the convention, added a full metadata fixture to the multi-agent plugin example, and added schema tests for valid and invalid pack metadata.
- `validation_evidence`: `npm --workspace @athena/core run validate:manifests` passed; `npm --workspace @athena/core run test:unit -- control-plane.manifests.test.ts` passed with 10 tests; `npm --workspace @athena/core run typecheck` passed.
- `qa_focus`: Confirm existing plugins can still omit `plugin.pack`; verify malformed pack metadata is rejected; review the enum set for premature marketplace or connector scope.
- `open_risks`: The metadata taxonomy is intentionally small and may need a later ADR or refinement before large connector packs depend on it.

## QA Verdict
- `verdict`: Pass. Acceptance criteria are met.
- `evidence_quality`: Strong. QA reviewed the schema/docs/test diff and reran `npm --workspace @athena/core run validate:manifests` plus `npm --workspace @athena/core run test:unit -- control-plane.manifests.test.ts`.
- `defects`: None.
- `state_transition`: Move to `done`.

## Transition History
- `2026-06-03T01:35:38Z`: `intake` -> `ready`; PM refined for capability pack foundation sequence
- `2026-06-03T01:35:39Z`: `ready` -> `active`; Activate first dependency story for implementation
- `2026-06-03T01:36:58Z`: `active` -> `qa`; Engineering handoff ready with manifest validation evidence
- `2026-06-03T01:37:17Z`: `qa` -> `done`; QA passed manifest conventions validation
