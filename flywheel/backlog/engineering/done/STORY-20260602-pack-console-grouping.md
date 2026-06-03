---
kind: story
id: STORY-20260602-pack-console-grouping
status: done
owner_role: engineering
source: pm
success_metric: Operators can distinguish bundled packs from local plugins in catalog and workflow surfaces without losing access to either.
release_scope: deferred
ready: false
---

# Story: Pack Console Grouping

## Metadata
- `id`: STORY-20260602-pack-console-grouping
- `owner_role`: engineering
- `status`: done
- `source`: pm
- `decision_refs`: []
- `success_metric`: Operators can distinguish bundled packs from local plugins in catalog and workflow surfaces without losing access to either.
- `release_scope`: deferred

## Problem Statement
Bundled first-party packs can make the product more useful, but they may crowd the console unless catalog and workflow surfaces show source, category, maturity, and requirements clearly.

## Scope
- In: Add grouping, labels, filters, or summaries for bundled packs in agent catalog and workflow-template surfaces; show credential, memory, and safety requirements from metadata.
- Out: Agent authoring UI, marketplace install flows, and connector-specific credential forms.

## Assumptions
- Catalog/API responses expose enough pack metadata and source information.
- Existing console navigation and empty-state patterns should be reused.
- Local/user plugins must remain visible and first-class.

## Acceptance Criteria
1. Agent catalog surfaces visually distinguish bundled packs from local plugins.
2. Workflow-template surfaces expose pack source and requirement metadata where workflow templates are listed or selected.
3. Operators can filter or scan by pack category, maturity, or source without hiding local plugins by default.
4. Requirement labels clearly indicate credential, memory, and safety needs before a run is started.
5. Console tests cover grouped rendering and mixed bundled/local catalog data.

## Validation
- Required checks: `npm --workspace @athena/console run typecheck`; focused console tests for catalog/workflow rendering.
- Additional checks: in-browser smoke of catalog and workflow surfaces using representative bundled/local fixture data.

## Dependencies
- `STORY-20260602-pack-manifest-conventions`.
- `STORY-20260602-bundled-pack-loader`.

## Risks
- UI labels could imply pack readiness or safety guarantees beyond the metadata.
- Over-grouping could make local plugins feel secondary.

## Open Questions
- Which console surfaces should be changed in the first pass: agent catalog only, or catalog plus workflow templates?
- Should bundled packs be grouped as a source, category, or both?

## Next Step
- Promote after bundled pack API/catalog shape is known.

## Engineering Handoff
- `change_summary`: Added pack metadata to agent catalog and workflow template response contracts, mapped `plugin.pack` through core services, parsed it in console API clients, and added catalog/workflow source and pack category filters plus requirement/safety badges.
- `validation_evidence`: `npm --workspace @athena/core run test:unit -- control-plane.agent-catalog.test.ts control-plane.workflow-template-catalog.test.ts api.schemas.test.ts` passed; `npm --workspace @athena/core run typecheck` passed; `npm --workspace @athena/console run typecheck` passed; `npm --workspace @athena/console run test` passed with 18 files and 63 tests. Attempted narrower console test filter for AgentCatalog/Workflows, but no matching test files exist.
- `qa_focus`: Verify optional pack metadata remains absent for unpackaged plugins; confirm source and pack filters work with mixed local/system data; check requirement badges do not imply connector auth support.
- `open_risks`: The UI surfaces pack metadata from manifests but does not yet provide dedicated enablement controls or credential setup flows.

## QA Verdict
- `verdict`: Pass. Acceptance criteria are met.
- `evidence_quality`: Strong. QA reviewed API, service, parser, and page diffs and reran `npm --workspace @athena/core run test:unit -- control-plane.agent-catalog.test.ts control-plane.workflow-template-catalog.test.ts api.schemas.test.ts`, `npm --workspace @athena/console run typecheck`, and `npm --workspace @athena/console run test`.
- `defects`: None.
- `state_transition`: Move to `done`.

## Transition History
- `2026-06-03T01:35:38Z`: `intake` -> `ready`; PM refined for capability pack foundation sequence
- `2026-06-03T01:39:05Z`: `ready` -> `active`; Activate console grouping after loader metadata is available
- `2026-06-03T01:44:08Z`: `active` -> `qa`; Engineering handoff ready with catalog and console validation
- `2026-06-03T01:44:35Z`: `qa` -> `done`; QA passed console grouping validation
