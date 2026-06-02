---
kind: story
id: STORY-20260602-memory-hybrid-retrieval
status: done
owner_role: Software Engineer
source: planning
success_metric: Memory search can combine keyword, semantic, metadata, recency, and provenance signals without changing the agent-facing memory API.
release_scope: post-release
ready: false
---

# Story: Memory Hybrid Retrieval

## Metadata
- `id`: STORY-20260602-memory-hybrid-retrieval
- `owner_role`: Software Engineer
- `status`: done
- `source`: planning
- `decision_refs`: [ADR-0019, ADR-0020, ADR-0021, ADR-0023, ADR-0024]
- `epic`: docs/product/epics/refinement/2026.37.00-epic-semantic-memory-and-sync-backends.md
- `success_metric`: Memory search can combine keyword, semantic, metadata, recency, and provenance signals without changing the agent-facing memory API.
- `release_scope`: post-release

## Problem Statement

Keyword memory search is not enough for durable agent memory. Operators and agents need higher-quality retrieval that can blend semantic similarity with existing filters, recency, and provenance while keeping results explainable and contract-compatible.

## Scope
- In: hybrid retrieval request/response contract, ranking inputs, provider delegation path, fallback behavior when semantic search is unavailable, and retrieval quality fixtures.
- Out: Chroma-specific adapter code, full console diagnostics UI, connector-specific ingestion, and autonomous memory planning.

## Assumptions
- Embedding lifecycle metadata exists or is being introduced first.
- The memory provider contract can report semantic capability and fallback reasons.
- Keyword-only behavior remains valid when semantic indexing is unavailable.

## Acceptance Criteria
1. Memory search supports a hybrid retrieval mode that preserves existing keyword/filter behavior.
2. Results include enough structured score/source metadata for follow-on diagnostics without exposing backend internals.
3. Semantic-unavailable and partially-indexed cases degrade predictably to keyword/filter retrieval.
4. Retrieval quality fixtures cover semantic match, keyword match, recency, provenance, filter exclusion, and fallback cases.

## Validation
- Required checks: focused durable-memory retrieval tests, provider conformance tests, core typecheck, `git diff --check`, Flywheel workflow validation.
- Additional checks: manual smoke against a seeded local memory dataset when a semantic provider is available.

## Dependencies
- `ARCH-20260602-semantic-memory-backend-strategy`
- `STORY-20260602-memory-embedding-lifecycle`

## Risks
- Ranking can become opaque unless score metadata is designed for diagnostics from the start.
- Hybrid retrieval can overfit to a fixture set if quality cases are too narrow.

## Open Questions
- Should hybrid retrieval be opt-in by mode or automatic based on provider capability?
- Which ranking weights are configurable versus fixed for the first implementation?

## Next Step

PM refinement should sequence this after embedding lifecycle.

## Engineering Handoff
- `change_summary`: Added durable-memory retrieval modes, normalized match/signal metadata, search diagnostics, semantic/hybrid fallback reasons, request parsing, local storage ranking, and console parser support while preserving existing `records` search responses.
- `validation_evidence`: Focused core durable-memory parser/storage/contract tests passed; focused console durable-memory API parser tests passed; core and console typechecks passed.
- `qa_focus`: Verify hybrid mode preserves keyword/filter results, exposes structured match metadata, degrades semantic/hybrid requests to keyword with explicit reasons when no semantic adapter exists, and covers ranking/filter/fallback fixtures.
- `open_risks`: This slice does not implement a semantic adapter or real vector scoring; Chroma/adapter stories own semantic capability and conformance once an index backend exists.

### Change Summary

- Added `keyword`, `semantic`, `hybrid`, and `auto` retrieval modes to durable-memory search requests.
- Added optional `matches` and `diagnostics` metadata to durable-memory search responses.
- Ranked local server-mode search results with keyword, metadata, provenance, and recency signals.
- Returned predictable degradation diagnostics for semantic/hybrid requests when no semantic adapter is configured.
- Added console parser/types for retrieval matches and diagnostics.

### Validation Evidence

- `npm --workspace @athena/core exec -- vitest run tests/api.request-parsers.test.ts tests/durable-memory.server-storage.test.ts tests/durable-memory.contracts.test.ts` passed: 3 files, 42 tests.
- `npm --workspace @athena/console exec -- vitest run src/features/durable-memory/api.test.ts` passed: 1 file, 4 tests.
- `npm --workspace @athena/core run typecheck` passed.
- `npm --workspace @athena/console run typecheck` passed.

### QA Focus

- Confirm existing search callers can still rely on `records`, `total`, and `operatorStatus`.
- Confirm hybrid requests with no semantic adapter report `effectiveMode: keyword` and degradation reasons.
- Confirm match metadata includes score, snippet, and keyword/metadata/provenance/recency signals without backend internals.
- Confirm namespace filter omissions and keyword no-match omissions are reported as diagnostics.

### Open Risks

- Score weights are intentionally simple fixtures for the first hybrid contract; semantic adapter work should revisit normalization once real vector scores exist.
- Console UI does not yet render diagnostics; this story only preserves the API model for follow-on diagnostics work.

## QA Verdict
- `verdict`: Pass. Hybrid retrieval satisfies the acceptance criteria while preserving existing keyword/filter behavior and deferring real semantic adapter scoring to follow-on work.
- `evidence_quality`: Strong for this slice. Focused tests cover mode parsing, keyword/metadata/provenance/recency match metadata, namespace filter omissions, semantic/hybrid fallback, partially indexed/stale/failed lifecycle cases, and console parser preservation. Core and console typechecks passed.
- `defects`: None.
- `state_transition`: Move to `done`.

### QA Evidence

- `npm --workspace @athena/core exec -- vitest run tests/api.request-parsers.test.ts tests/durable-memory.server-storage.test.ts tests/durable-memory.contracts.test.ts` passed: 3 files, 42 tests.
- `npm --workspace @athena/console exec -- vitest run src/features/durable-memory/api.test.ts` passed: 1 file, 4 tests.
- `npm --workspace @athena/core run typecheck` passed.
- `npm --workspace @athena/console run typecheck` passed.

### QA Assessment

- Acceptance criterion 1 is covered by hybrid retrieval mode preserving `records`, namespace filtering, and keyword search behavior.
- Acceptance criterion 2 is covered by `matches` score/signal/snippet metadata.
- Acceptance criterion 3 is covered by semantic/hybrid fallback diagnostics with partially indexed, stale, and failed lifecycle cases.
- Acceptance criterion 4 is covered by retrieval fixtures for keyword, metadata, recency, provenance, namespace filter exclusion, and fallback.

## Transition History
- `2026-06-02T20:00:00Z`: Planning created engineering intake for 2026.37 hybrid retrieval.
- `2026-06-02T23:00:22Z`: `intake` -> `active`; PM promotes next 2026.37 implementation slice after embedding lifecycle QA
- `2026-06-02T23:04:02Z`: `active` -> `qa`; engineering handoff ready for durable memory hybrid retrieval
- `2026-06-02T23:04:26Z`: `qa` -> `done`; QA passed durable memory hybrid retrieval
