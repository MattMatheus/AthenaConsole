---
kind: story
id: STORY-20260602-durable-memory-contracts
status: ready
owner_role: Software Engineer
source: epic
success_metric: Durable memory implementation can use typed namespace, provenance, provider operation, cache mode, and server-mode contracts without changing existing memory behavior.
release_scope: post-release
ready: true
---

# Story: Durable Memory Contracts And Validation Helpers

## Metadata
- `id`: STORY-20260602-durable-memory-contracts
- `owner_role`: Software Engineer
- `status`: ready
- `source`: epic
- `decision_refs`: [ADR-0019, ADR-0020, ADR-0021, ADR-0022, ADR-0023]
- `epic`: docs/product/epics/refinement/2026.35.00-epic-remote-memory-mvp.md
- `success_metric`: Durable memory implementation can use typed namespace, provenance, provider operation, cache mode, and server-mode contracts without changing existing memory behavior.
- `release_scope`: post-release

## Problem Statement

The durable memory ADRs define product semantics, but the codebase still only has legacy diagnostic memory contracts for markdown/transcript search. Before routes, storage, or provider clients are implemented, engineering needs additive TypeScript contracts and validation helpers that encode the accepted durable memory namespace, provenance, provider-operation, cache-mode, and server-mode rules.

## Initial Scope

- In: shared TypeScript contracts for durable memory namespace refs, provenance refs, source kinds, record/proposal/snapshot shapes, provider requests/responses, cache sync statuses, operator-visible statuses, and server-mode provider config.
- In: validation helpers for namespace shape, parent rules, required provenance by source kind, mutation reason requirements, and event payload redaction constraints.
- In: focused unit tests and exports from the existing shared/core contract surface.
- Out: storage schema, API routes, provider HTTP client, console UI, cache implementation, route migration, semantic retrieval, and writes from agents.

## Acceptance Criteria

1. Durable memory namespace types support the scopes accepted in ADR 0021 and validation rejects missing scope/id or invalid parent chains.
2. Durable memory provenance types support operator, agent, task-run, workflow-run, artifact, connector, import, and system source kinds, with validation enforcing the required fields from ADR 0021.
3. Provider operation request/response types cover create/write, get, list, search, proposal create/approve/reject, archive/delete, snapshot create/list/restore, and provider health/status.
4. Cache/server-mode types cover sync status, stale/cache/offline/queued/conflict statuses, provider id, revision/etag, fetched timestamps, and local-dev-only labeling from ADR 0022.
5. No existing `/api/v1/memory/*` contracts, routes, CLI behavior, artifact preview behavior, or diagnostic memory tests change in this story.
6. Focused tests cover valid and invalid namespace/provenance examples, reason-required mutations, and event redaction guardrails.

## Validation

- `npm --workspace @athena/core run typecheck`
- Focused core tests for durable memory contract validation helpers.
- Existing memory CLI/API parity tests still pass or are intentionally unaffected.
- `git diff --check`
- `./flywheel/tools/validate_workflow_state.sh --format json`

## Refinement Notes

Keep this additive. Prefer a new durable-memory contract module over modifying the existing legacy `MemoryRecord`/`MemorySearchResult` contract, because ADR 0022 keeps current diagnostic memory routes as compatibility behavior.

## Dependencies

- Accepted ADR 0019 through ADR 0023.

## QA Focus

- Confirm the story adds durable memory contracts without silently redefining legacy diagnostic memory.
- Confirm validation messages are explicit enough for future API and provider layers.
- Confirm tests prove source-kind-specific provenance requirements.

## Transition History
- `2026-06-02T15:42:00Z`: PM refinement created engineering intake story
- `2026-06-02T15:43:05Z`: `intake` -> `ready`; PM refinement complete for durable memory contracts first implementation slice
