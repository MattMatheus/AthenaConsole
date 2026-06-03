---
kind: story
id: STORY-20260602-bundled-pack-loader
status: done
owner_role: engineering
source: pm
success_metric: Bundled first-party packs appear through the normal plugin index with no per-pack hardcoded catalog entries.
release_scope: deferred
ready: false
---

# Story: Bundled Pack Loader

## Metadata
- `id`: STORY-20260602-bundled-pack-loader
- `owner_role`: engineering
- `status`: done
- `source`: pm
- `decision_refs`: [0008-plugin-package-format]
- `success_metric`: Bundled first-party packs appear through the normal plugin index with no per-pack hardcoded catalog entries.
- `release_scope`: deferred

## Problem Statement
Team Orchestrator needs bundled capability packs to be discoverable through the same plugin indexing path as local plugins so first-party capabilities do not become product special cases.

## Scope
- In: Add a configured bundled-pack discovery path; index bundled packs with existing plugin validation; expose their source/type in plugin catalog data.
- Out: Remote registry installation, automatic third-party downloads, connector credential setup, and pack marketplace UI.

## Assumptions
- Bundled packs can live in a checked-in directory separate from ad hoc sample plugins.
- The loader should preserve local plugin behavior and ordering.
- Disabled or invalid bundled packs should report clear diagnostics.

## Acceptance Criteria
1. The plugin index can discover bundled packs from a stable repository path or config setting.
2. Bundled packs are validated through the existing manifest validation path.
3. Catalog/API data identifies a plugin as bundled or local without hardcoding individual pack IDs.
4. Invalid bundled pack manifests produce actionable diagnostics without preventing valid local plugins from loading.
5. Tests cover bundled-only, local-only, and mixed bundled/local plugin indexing.

## Validation
- Required checks: focused plugin loader tests; `npm --workspace @athena/core run validate:manifests`; `npm --workspace @athena/core run test:unit`.
- Additional checks: `npm --workspace @athena/core run typecheck`; API smoke if catalog response shape changes.

## Dependencies
- `STORY-20260602-pack-manifest-conventions` for metadata shape if catalog data includes pack metadata.

## Risks
- Loader ordering could surprise users if bundled packs crowd local plugins.
- Path handling may differ between local dev, Docker, and local-server modes.

## Open Questions
- Should bundled packs be always enabled, enabled by default, or discoverable but opt-in?
- Should sample plugins remain separate from first-party bundled packs?

## Next Step
- Promote after pack metadata conventions are accepted or explicitly scoped as optional.

## Engineering Handoff
- `change_summary`: Added `bundled-plugins` as the stable default system plugin search path, documented the path, and added loader coverage for bundled-only, mixed bundled/local, and invalid bundled pack indexing through the existing plugin loader.
- `validation_evidence`: `npm --workspace @athena/core run test:unit -- control-plane.plugin-loader.test.ts config.test.ts` passed with 27 tests; `npm --workspace @athena/core run validate:manifests` passed; `npm --workspace @athena/core run typecheck` passed.
- `qa_focus`: Verify the default system path does not disrupt local plugin indexing; confirm invalid bundled manifests are recorded as system plugin diagnostics while valid local plugins still load.
- `open_risks`: `ATHENA_SYSTEM_PLUGIN_PATHS` remains an override of the default bundled path, so deployments that set it must include bundled paths explicitly if they want built-in packs.

## QA Verdict
- `verdict`: Pass. Acceptance criteria are met.
- `evidence_quality`: Strong. QA reviewed the loader/config/test diff and reran `npm --workspace @athena/core run test:unit -- control-plane.plugin-loader.test.ts config.test.ts` plus `npm --workspace @athena/core run validate:manifests`.
- `defects`: None.
- `state_transition`: Move to `done`.

## Transition History
- `2026-06-03T01:35:38Z`: `intake` -> `ready`; PM refined for capability pack foundation sequence
- `2026-06-03T01:37:17Z`: `ready` -> `active`; Activate next capability pack foundation dependency
- `2026-06-03T01:38:44Z`: `active` -> `qa`; Engineering handoff ready with loader validation evidence
- `2026-06-03T01:39:05Z`: `qa` -> `done`; QA passed bundled loader validation
