---
kind: story
id: STORY-20260602-pack-authoring-guide
status: done
owner_role: engineering
source: pm
success_metric: A user can copy the first-party pack pattern to create a local capability pack with metadata, docs, fixtures, and workflow examples.
release_scope: deferred
ready: false
---

# Story: Pack Authoring Guide

## Metadata
- `id`: STORY-20260602-pack-authoring-guide
- `owner_role`: engineering
- `status`: done
- `source`: pm
- `decision_refs`: []
- `success_metric`: A user can copy the first-party pack pattern to create a local capability pack with metadata, docs, fixtures, and workflow examples.
- `release_scope`: deferred

## Problem Statement
First-party capability packs should teach users how to build their own packs, but that pattern needs explicit documentation that connects manifests, agents, workflows, fixtures, testing, safety labels, and console behavior.

## Scope
- In: Add user/developer documentation for capability pack structure, metadata, fixtures, workflow composition, validation, and console expectations.
- Out: New scaffold command behavior unless a small docs-only command reference is enough; marketplace or remote publishing guidance.

## Assumptions
- Pack metadata and fixture conventions are implemented or finalized before this guide is completed.
- Existing agent authoring docs can be extended instead of creating a disconnected doc island.
- The guide should use a first-party pack as the canonical example.

## Acceptance Criteria
1. Documentation explains the required and optional files in a capability pack.
2. Documentation maps pack metadata fields to console labels and operator expectations.
3. Documentation shows how to add agent manifests, workflow templates, fixtures, and validation checks.
4. Documentation includes a concise local validation checklist.
5. Existing docs index or user-guide navigation links to the pack authoring guide.

## Validation
- Required checks: docs link review; relevant docs smoke/manual review.
- Additional checks: run manifest/fixture validation commands named in the guide to ensure they are accurate.

## Dependencies
- `STORY-20260602-pack-manifest-conventions`.
- `STORY-20260602-pack-fixtures-and-tests`.
- `STORY-20260602-pack-console-grouping` if console labels are documented.

## Risks
- Guide can become aspirational if written before implementation details settle.
- Too much authoring guidance may imply unsupported marketplace or connector behavior.

## Open Questions
- Should this live under user guide, developer product guides, or both with one canonical source?
- Should the guide include a small copyable starter pack skeleton?

## Next Step
- Promote after the implementation stories settle the pack shape.

## Engineering Handoff
- `change_summary`: Added `docs/developer/product-dev-guides/capability-pack-authoring.md` covering pack structure, metadata-to-console mapping, agents/workflows, fixtures, validation, and local installation. Linked it from the developer guide index and main docs map.
- `validation_evidence`: `npm --workspace @athena/core run validate:manifests` passed; `npm --workspace @athena/core run validate:pack-fixtures` passed; `npm --workspace @athena/core run test:unit -- control-plane.plugin-loader.test.ts control-plane.manifests.test.ts` passed with 22 tests; `npm --workspace @athena/console run typecheck` passed; `npm --workspace @athena/console run test` passed with 18 files and 63 tests; link/path smoke with `test -f`, `test -d`, and `rg` passed.
- `qa_focus`: Confirm the guide does not imply marketplace or connector behavior; verify commands named in the guide are accurate and pack paths resolve.
- `open_risks`: The guide documents a copyable structure but does not add a scaffold command.

## QA Verdict
- `verdict`: Pass. Acceptance criteria are met.
- `evidence_quality`: Strong. QA reviewed docs/navigation diffs and reran `npm --workspace @athena/core run validate:manifests`, `npm --workspace @athena/core run validate:pack-fixtures`, `npm --workspace @athena/console run typecheck`, and a path/link smoke with `test` plus `rg`.
- `defects`: None.
- `state_transition`: Move to `done`.

## Transition History
- `2026-06-03T01:35:39Z`: `intake` -> `ready`; PM refined for capability pack foundation sequence
- `2026-06-03T01:47:28Z`: `ready` -> `active`; Activate final capability pack foundation documentation story
- `2026-06-03T01:48:30Z`: `active` -> `qa`; Engineering handoff ready with docs validation evidence
- `2026-06-03T01:48:55Z`: `qa` -> `done`; QA passed capability pack authoring guide validation
