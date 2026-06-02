---
kind: story
id: STORY-20260602-memory-manifest-permissions
status: done
owner_role: Software Engineer
source: epic
success_metric: Agent/plugin manifests can declare durable-memory read, propose, and write permissions by namespace scope and sensitivity.
release_scope: post-release
ready: false
---

# Story: Memory Manifest Permissions

## Metadata
- `id`: STORY-20260602-memory-manifest-permissions
- `owner_role`: Software Engineer
- `status`: done
- `source`: epic
- `decision_refs`: [ADR-0019, ADR-0020, ADR-0021, ADR-0022]
- `epic`: docs/product/epics/refinement/2026.36.00-epic-memory-governance-agent-integration.md
- `success_metric`: Agent/plugin manifests can declare durable-memory read, propose, and write permissions by namespace scope and sensitivity.
- `release_scope`: post-release

## Problem Statement

Durable memory becomes hidden mutable prompt state if agents can read or write it without an explicit manifest contract. Operators need memory access to be declared before a plugin can influence run context.

## Initial Scope

- In: additive agent/plugin manifest memory permission schema for durable-memory read, propose, and reviewed write needs.
- In: namespace scope constraints, sensitivity limits, local-dev/default deny behavior, and validation errors that are visible in catalog metadata.
- In: docs/examples for memory permission declarations in agent manifests.
- Out: runtime memory injection, proposal review UI, and automatic writes.

## Acceptance Criteria

1. Agent manifests can declare durable-memory permissions for read, propose, and write-reviewed operations.
2. Permission declarations include namespace scope constraints and maximum sensitivity.
3. Missing declarations default to no durable-memory access.
4. Invalid memory permission declarations are rejected by manifest validation and surfaced through existing catalog validation metadata.
5. Docs and at least one sample manifest show the declaration format without enabling broad write access by default.

## Validation

- Manifest schema and parser tests.
- Agent catalog/indexing tests for valid and invalid memory permissions.
- `npm --workspace @athena/core run typecheck`
- `npm --workspace @athena/core run check:schemas` if schemas are touched.
- `git diff --check`
- `./flywheel/tools/validate_workflow_state.sh --format json`

## Dependencies

- `STORY-20260602-durable-memory-contracts`
- `STORY-20260602-durable-memory-readiness-config`

## Transition History
- `2026-06-02T18:20:00Z`: PM refinement created engineering intake story from 2026.36 epic.
- `2026-06-02T20:37:05Z`: `intake` -> `active`; PM activation: first dependency in memory governance sequence

## Engineering Handoff

- `change_summary`: Added additive `permissions.durableMemory.read`, `permissions.durableMemory.propose`, and `permissions.durableMemory.writeReviewed` schema support for plugin and agent manifests with required namespace scopes and maximum sensitivity. Kept durable-memory access default-deny by omission, added schema tests, documented the format, and added a narrow repo-summary sample declaration using read/propose only.
- `validation_evidence`: `npm --workspace @athena/core run test:unit -- control-plane.manifests.test.ts`; `npm --workspace @athena/core run validate:manifests`; `npm --workspace @athena/core run check:schemas`; `npm --workspace @athena/core run typecheck`.
- `qa_focus`: Confirm invalid durable-memory declarations surface through existing manifest validation/catalog issue paths and sample manifests remain valid without granting reviewed write access by default.
- `open_risks`: Runtime enforcement is intentionally out of scope for this story and belongs to `STORY-20260602-memory-runtime-context`.
- `2026-06-02T20:39:49Z`: `active` -> `qa`; Engineering handoff ready for durable-memory manifest permissions

## QA Verdict

- `verdict`: pass
- `validation_evidence`: `npm --workspace @athena/core run test:unit -- control-plane.manifests.test.ts control-plane.agent-catalog.test.ts control-plane.plugin-loader.test.ts`; `npm --workspace @athena/core run typecheck`; `npm --workspace @athena/core run check:schemas`; `npm --workspace @athena/core run validate:manifests`; `git diff --check`; `./flywheel/tools/validate_workflow_state.sh --format json`.
- `evidence_quality`: Focused automated tests cover manifest schema validation, plugin-loader/catalog surfacing, sample validation, and type/schema integrity.
- `state_transition`: Move to `done`; acceptance criteria passed with runtime enforcement deferred to the dependent story.
- `notes`: Acceptance criteria are covered by schema validation, manifest example validation, catalog/plugin-loader regression tests, docs, and the repo-summary sample declaration. Runtime enforcement remains correctly deferred to the dependent runtime-context story.
- `2026-06-02T20:41:09Z`: `qa` -> `done`; QA passed durable-memory manifest permissions
