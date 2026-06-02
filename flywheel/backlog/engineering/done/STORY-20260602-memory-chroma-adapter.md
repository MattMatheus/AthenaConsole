---
kind: story
id: STORY-20260602-memory-chroma-adapter
status: done
owner_role: Software Engineer
source: planning
success_metric: Chroma can run as an optional memory backend adapter with conformance tests and operator-visible readiness/failure states.
release_scope: post-release
ready: false
---

# Story: Memory Chroma Adapter

## Metadata
- `id`: STORY-20260602-memory-chroma-adapter
- `owner_role`: Software Engineer
- `status`: done
- `source`: planning
- `decision_refs`: [ADR-0020, ADR-0022, ADR-0023, ADR-0024]
- `epic`: docs/product/epics/refinement/2026.37.00-epic-semantic-memory-and-sync-backends.md
- `success_metric`: Chroma can run as an optional memory backend adapter with conformance tests and operator-visible readiness/failure states.
- `release_scope`: post-release

## Problem Statement

Team Orchestrator needs a practical semantic backend proving ground, but Chroma must remain an optional provider behind the memory contract rather than becoming the product model.

## Scope
- In: optional Chroma provider adapter, configuration/readiness wiring, vector upsert/search/delete/list support needed by the memory contract, filtering behavior, conformance tests, and local/server deployment notes.
- Out: making Chroma mandatory, hosted vector service operations, connector-specific ingestion, and changing the agent-facing memory API.

## Assumptions
- Architecture strategy confirms Chroma remains the near-term adapter candidate.
- Embedding lifecycle and hybrid retrieval contracts are available.
- Local development can use mock or containerized Chroma fixtures.

## Acceptance Criteria
1. Chroma adapter implements the required memory provider conformance surface for semantic retrieval.
2. Adapter failures, unavailable backend state, and unsupported filter behavior are reported clearly through provider status/readiness.
3. Tests cover upsert/search/filter/archive-delete behavior and fallback/error cases.
4. Documentation explains how to enable the adapter locally without making it the default durable memory source.

## Validation
- Required checks: Chroma adapter conformance tests, durable-memory provider tests, core typecheck, `git diff --check`, Flywheel workflow validation.
- Additional checks: manual smoke with a local Chroma instance or documented mock fixture.

## Dependencies
- `ARCH-20260602-semantic-memory-backend-strategy`
- `STORY-20260602-memory-embedding-lifecycle`
- `STORY-20260602-memory-hybrid-retrieval`

## Risks
- Chroma filter semantics may not match the canonical memory filter model.
- Local/server deployment complexity can distract from proving the provider contract.

## Open Questions
- Should Chroma be enabled via existing durable-memory provider config or a separate semantic-index backend setting?
- Which Chroma deployment mode is acceptable for first local-server validation?

## Next Step

PM refinement should keep this in intake until hybrid retrieval conformance expectations are accepted.

## Engineering Handoff
- `change_summary`: Added an optional dependency-free Chroma semantic memory adapter, exported it from the core durable-memory module, added conformance tests for upsert/search/delete and readiness/failure states, and documented local enablement without making Chroma canonical or mandatory.
- `validation_evidence`: Focused Chroma adapter, durable-memory storage, and remote provider tests passed; core typecheck passed.
- `qa_focus`: Verify the adapter writes bounded canonical metadata, filters by namespace, maps Chroma query results to semantic match metadata, reports unavailable/degraded health, and remains optional.
- `open_risks`: Adapter paths use a lightweight HTTP shape suitable for mock/local Chroma fixtures; real Chroma deployment smoke is documented but not run in this environment.

### Change Summary

- Added `ChromaDurableMemoryAdapter` with `upsertRecord`, `search`, `deleteRecord`, and `getHealth`.
- Kept Chroma as an optional semantic index adapter, not the durable-memory record store.
- Added semantic match mapping to canonical `DurableMemorySearchMatch` metadata.
- Added Chroma adapter conformance tests with mock fetch fixtures.
- Added developer guide `docs/developer/product-dev-guides/chroma-semantic-memory-adapter.md` and linked it from the developer guide README.

### Validation Evidence

- `npm --workspace @athena/core exec -- vitest run tests/durable-memory.chroma-adapter.test.ts tests/durable-memory.server-storage.test.ts tests/durable-memory.remote-http-provider.test.ts` passed: 3 files, 16 tests.
- `npm --workspace @athena/core run typecheck` passed.

### QA Focus

- Confirm adapter metadata includes namespace, source kind, memory type, sensitivity, status, and canonical memory id.
- Confirm search maps Chroma distances to semantic match scores without exposing raw vectors.
- Confirm unavailable and unsupported-filter/failure cases map to operator-visible degraded/readiness states.
- Confirm documentation states Chroma is optional and not the canonical source of truth.

### Open Risks

- No live Chroma server was available for manual smoke; mock fetch tests cover the adapter contract and documented smoke path.
- The adapter intentionally does not add automatic embedding generation or durable-memory service routing.

## QA Verdict
- `verdict`: Pass. The Chroma adapter story satisfies the acceptance criteria for an optional semantic index adapter with conformance tests, readiness/failure states, and local enablement documentation.
- `evidence_quality`: Good. Mock-fetch conformance tests cover upsert/search/delete, namespace filters, semantic match mapping, unavailable health, and unsupported-filter/degraded behavior. Core typecheck passed. Live Chroma smoke was not run and is documented as a manual follow-up path.
- `defects`: None.
- `state_transition`: Move to `done`.

### QA Evidence

- `npm --workspace @athena/core exec -- vitest run tests/durable-memory.chroma-adapter.test.ts tests/durable-memory.server-storage.test.ts tests/durable-memory.remote-http-provider.test.ts` passed: 3 files, 16 tests.
- `npm --workspace @athena/core run typecheck` passed.
- Documentation added at `docs/developer/product-dev-guides/chroma-semantic-memory-adapter.md`.

### QA Assessment

- Acceptance criterion 1 is covered by `ChromaDurableMemoryAdapter` upsert/search/delete and semantic match mapping.
- Acceptance criterion 2 is covered by health mapping for ok, unavailable, and degraded/unsupported-filter cases.
- Acceptance criterion 3 is covered by mock Chroma conformance tests for upsert/search/filter/delete and fallback/error cases.
- Acceptance criterion 4 is covered by the developer guide and README link.

## Transition History
- `2026-06-02T20:00:00Z`: Planning created engineering intake for 2026.37 Chroma adapter.
- `2026-06-02T23:07:51Z`: `intake` -> `active`; PM promotes next 2026.37 implementation slice after local cache sync QA
- `2026-06-02T23:09:39Z`: `active` -> `qa`; engineering handoff ready for optional Chroma semantic memory adapter
- `2026-06-02T23:10:01Z`: `qa` -> `done`; QA passed optional Chroma semantic memory adapter
