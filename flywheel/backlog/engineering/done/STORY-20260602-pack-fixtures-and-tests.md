---
kind: story
id: STORY-20260602-pack-fixtures-and-tests
status: done
owner_role: engineering
source: pm
success_metric: Each first-party pack has reviewable fixtures and at least one automated validation path.
release_scope: deferred
ready: false
---

# Story: Pack Fixtures And Tests

## Metadata
- `id`: STORY-20260602-pack-fixtures-and-tests
- `owner_role`: engineering
- `status`: done
- `source`: pm
- `decision_refs`: []
- `success_metric`: Each first-party pack has reviewable fixtures and at least one automated validation path.
- `release_scope`: deferred

## Problem Statement
First-party packs should be useful examples and reliable product assets, which requires repeatable fixtures, manifest tests, and smokeable workflows that do not depend on live third-party services.

## Scope
- In: Define pack fixture requirements; add test harness coverage for manifest validation and smokeable workflows; document how packs declare or provide fixtures.
- Out: Live service integration tests, connector credential testing, and broad CI redesign.

## Assumptions
- The first capability packs can use mock providers or deterministic local fixtures.
- Some packs may include reviewable examples instead of executable workflows when live services would be required.
- Tests should scale to future first-party packs without bespoke commands per pack.

## Acceptance Criteria
1. A pack fixture convention is documented for agent inputs, workflow inputs, expected artifacts, and mock provider behavior.
2. Automated validation can discover first-party pack fixtures and run manifest checks.
3. At least one pack workflow can be smoke-tested without external credentials.
4. Test failures identify the affected pack and fixture clearly.
5. CI or documented local validation includes the pack fixture validation command.

## Validation
- Required checks: pack fixture validation command; `npm --workspace @athena/core run validate:manifests`; focused tests for fixture discovery.
- Additional checks: `npm run test` if shared validation command wiring changes.

## Dependencies
- `STORY-20260602-pack-manifest-conventions`.
- `STORY-20260602-bundled-pack-loader`.

## Risks
- Fixtures may become brittle if they assert too much generated text.
- First-party packs could drift if validation is documented but not wired into routine checks.

## Open Questions
- Should pack fixture validation live in `@athena/core`, `@athena/pdk`, or a repo-level script?
- What is the minimum acceptable smoke for a provider-backed pack?

## Next Step
- Promote alongside or immediately after bundled loader work.

## Engineering Handoff
- `change_summary`: Added a minimal first-party bundled software-team demo pack with pack metadata, one deterministic local agent, one workflow template, JSON fixture inputs, docs, and a runner script. Added `npm --workspace @athena/core run validate:pack-fixtures` to validate bundled pack metadata, manifests, JSON fixtures, and smokeable workflow references.
- `validation_evidence`: `npm --workspace @athena/core run validate:pack-fixtures` passed; `npm --workspace @athena/core run validate:manifests` passed; `npm --workspace @athena/core run test:unit -- control-plane.plugin-loader.test.ts control-plane.manifests.test.ts` passed with 22 tests; `npm --workspace @athena/core run typecheck` passed.
- `qa_focus`: Confirm invalid fixture shapes fail with pack-specific diagnostics; verify the bundled demo pack remains no-auth/no-provider and indexes through the normal bundled loader.
- `open_risks`: The validator checks manifest and fixture shape but does not execute the workflow runner end to end.

## QA Verdict
- `verdict`: Pass. Acceptance criteria are met.
- `evidence_quality`: Strong. QA reviewed the fixture validation command, bundled pack fixture structure, and manifest docs, then reran `npm --workspace @athena/core run validate:pack-fixtures`, `npm --workspace @athena/core run validate:manifests`, and `npm --workspace @athena/core run test:unit -- control-plane.plugin-loader.test.ts control-plane.manifests.test.ts`.
- `defects`: None.
- `state_transition`: Move to `done`.

## Transition History
- `2026-06-03T01:35:38Z`: `intake` -> `ready`; PM refined for capability pack foundation sequence
- `2026-06-03T01:44:35Z`: `ready` -> `active`; Activate pack fixture validation story
- `2026-06-03T01:47:08Z`: `active` -> `qa`; Engineering handoff ready with pack fixture validation evidence
- `2026-06-03T01:47:28Z`: `qa` -> `done`; QA passed pack fixture validation
