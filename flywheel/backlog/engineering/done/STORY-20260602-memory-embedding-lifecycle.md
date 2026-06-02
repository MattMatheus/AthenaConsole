---
kind: story
id: STORY-20260602-memory-embedding-lifecycle
status: done
owner_role: Software Engineer
source: planning
success_metric: Memory records expose embedding lifecycle state, model metadata, reindex markers, and failures through durable storage and API contracts.
release_scope: post-release
ready: false
---

# Story: Memory Embedding Lifecycle

## Metadata
- `id`: STORY-20260602-memory-embedding-lifecycle
- `owner_role`: Software Engineer
- `status`: done
- `source`: planning
- `decision_refs`: [ADR-0019, ADR-0020, ADR-0021, ADR-0023]
- `epic`: docs/product/epics/refinement/2026.37.00-epic-semantic-memory-and-sync-backends.md
- `success_metric`: Memory records expose embedding lifecycle state, model metadata, reindex markers, and failures through durable storage and API contracts.
- `release_scope`: post-release

## Problem Statement

Semantic retrieval needs durable, inspectable embedding lifecycle metadata so memory records can show whether they are unindexed, indexed, stale, failed, queued for reindexing, or tied to a specific embedding model/version.

## Scope
- In: memory record embedding status fields, embedding model metadata, reindex markers, failure reason storage, API contract exposure, and lifecycle tests.
- Out: vector similarity ranking, Chroma adapter implementation, AthenaMemory adapter implementation, and console retrieval explanation UI.

## Assumptions
- Architecture strategy will confirm the final field names and provider boundary.
- Embedding generation may be stubbed or service-only in the first slice if provider wiring is not ready.
- Existing durable-memory list/read/search APIs should preserve backward-compatible envelopes where practical.

## Acceptance Criteria
1. Durable memory records can persist and expose embedding lifecycle status and model metadata.
2. Reindex-required and failure states are represented without deleting canonical memory record content.
3. API contracts and parsers include embedding metadata with focused tests for absent, current, stale, and failed states.
4. Validation includes durable-memory storage/API tests and manifest/runtime checks affected by memory contracts.

## Validation
- Required checks: focused durable-memory unit/API tests, core typecheck, `git diff --check`, Flywheel workflow validation.
- Additional checks: storage migration/backfill test if schema changes are required.

## Dependencies
- `ARCH-20260602-semantic-memory-backend-strategy`

## Risks
- Schema churn if embedding fields are added before the backend strategy is settled.
- Model metadata can accidentally imply provider defaults if naming is too vague.

## Open Questions
- Should embedding lifecycle status live on memory records, sidecar index records, or both?
- Which embedding failure details are safe to expose to operators?

## Next Step

PM refinement should promote this after the architecture strategy is accepted.

## Engineering Handoff
- `change_summary`: Added durable-memory embedding lifecycle metadata to core contracts, write request parsing, SQLite server storage persistence, and console durable-memory parsing/types. Covered indexed/current, stale, failed, and absent lifecycle states without adding embedding generation or vector storage.
- `validation_evidence`: Focused core durable-memory contract/storage tests passed; focused console durable-memory API parser tests passed; core and console typechecks passed.
- `qa_focus`: Verify lifecycle metadata remains optional, persists independently from record status, rejects invalid write-request lifecycle statuses, and is not dropped by the console parser.
- `open_risks`: This story intentionally does not generate embeddings, reindex records, or expose lifecycle controls in the console UI; follow-on 2026.37 stories own those behaviors.

### Change Summary

- Added `DurableMemoryEmbeddingMetadata` and lifecycle statuses to the shared durable-memory contract.
- Added optional `embedding` metadata to durable-memory records and write requests.
- Persisted optional embedding lifecycle metadata in server-mode SQLite storage through `embedding_json`.
- Parsed optional embedding metadata in console durable-memory models.

### Validation Evidence

- `npm --workspace @athena/core exec -- vitest run tests/durable-memory.contracts.test.ts tests/durable-memory.server-storage.test.ts` passed: 2 files, 14 tests.
- `npm --workspace @athena/console exec -- vitest run src/features/durable-memory/api.test.ts` passed: 1 file, 4 tests.
- `npm --workspace @athena/core run typecheck` passed.
- `npm --workspace @athena/console run typecheck` passed.

### QA Focus

- Confirm records without embedding metadata remain valid and parse normally.
- Confirm indexed, stale, and failed lifecycle metadata round-trip through storage/API parser paths.
- Confirm invalid lifecycle statuses are rejected during write-request parsing.
- Confirm lifecycle metadata remains separate from record `active`/`archived`/`deleted` status.

### Open Risks

- Existing durable-memory API schemas may need richer OpenAPI descriptions in a later documentation/API-contract polish pass.
- No UI label was added in this slice; the console parser preserves the data for follow-on retrieval diagnostics and inspector work.

## QA Verdict
- `verdict`: Pass. The embedding lifecycle slice satisfies the acceptance criteria without adding out-of-scope embedding generation or adapter behavior.
- `evidence_quality`: Strong for the slice. Focused tests cover optional metadata, indexed/current, stale, failed, invalid status rejection, storage round-trip, and console parsing. Core and console typechecks passed.
- `defects`: None.
- `state_transition`: Move to `done`.

### QA Evidence

- `npm --workspace @athena/core exec -- vitest run tests/durable-memory.contracts.test.ts tests/durable-memory.server-storage.test.ts` passed: 2 files, 14 tests.
- `npm --workspace @athena/console exec -- vitest run src/features/durable-memory/api.test.ts` passed: 1 file, 4 tests.
- `npm --workspace @athena/core run typecheck` passed.
- `npm --workspace @athena/console run typecheck` passed.

### QA Assessment

- Acceptance criterion 1 is covered by shared contract metadata and SQLite persistence.
- Acceptance criterion 2 is covered by stale/failed metadata on otherwise active records.
- Acceptance criterion 3 is covered by parser and console API tests for absent/current/stale/failed states.
- Acceptance criterion 4 is covered by focused durable-memory storage/API parser tests and typechecks.

## Transition History
- `2026-06-02T20:00:00Z`: Planning created engineering intake for 2026.37 embedding lifecycle.
- `2026-06-02T22:55:31Z`: `intake` -> `active`; PM promotes first 2026.37 engineering slice after accepted ADR 0024
- `2026-06-02T22:59:18Z`: `active` -> `qa`; engineering handoff ready for durable memory embedding lifecycle
- `2026-06-02T22:59:46Z`: `qa` -> `done`; QA passed durable memory embedding lifecycle
