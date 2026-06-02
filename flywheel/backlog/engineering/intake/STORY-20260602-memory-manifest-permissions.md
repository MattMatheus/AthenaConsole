---
kind: story
id: STORY-20260602-memory-manifest-permissions
status: intake
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
- `status`: intake
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
