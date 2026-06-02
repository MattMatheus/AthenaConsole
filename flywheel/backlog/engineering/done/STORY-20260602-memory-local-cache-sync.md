---
kind: story
id: STORY-20260602-memory-local-cache-sync
status: done
owner_role: Software Engineer
source: planning
success_metric: Remote durable memory cache refresh, invalidation, and degraded-read behavior are predictable, testable, and visible to operators.
release_scope: post-release
ready: false
---

# Story: Memory Local Cache Sync

## Metadata
- `id`: STORY-20260602-memory-local-cache-sync
- `owner_role`: Software Engineer
- `status`: done
- `source`: planning
- `decision_refs`: [ADR-0020, ADR-0021, ADR-0022, ADR-0023, ADR-0024]
- `epic`: docs/product/epics/refinement/2026.37.00-epic-semantic-memory-and-sync-backends.md
- `success_metric`: Remote durable memory cache refresh, invalidation, and degraded-read behavior are predictable, testable, and visible to operators.
- `release_scope`: post-release

## Problem Statement

Remote-capable memory needs local cache behavior that operators can trust when the remote provider is slow, unavailable, stale, or partially synchronized.

## Scope
- In: cache refresh triggers, invalidation markers, stale/degraded/offline read behavior, provider status reporting, sync tests, and operator-facing status labels.
- Out: offline local mutation conflict resolution, multi-writer synchronization, connector-specific sync, and hosted service operations.

## Assumptions
- ADR-0022 remains the local cache boundary unless the architecture strategy updates it.
- Remote source of truth behavior stays explicit; local cache is not silently promoted to durable source of truth.
- Console status surfaces can reuse or extend the durable-memory inspector model.

## Acceptance Criteria
1. Cache records and provider status can distinguish fresh, stale, unavailable, degraded, and refresh-failed states.
2. Refresh and invalidation behavior is deterministic and covered by tests.
3. Remote-unavailable reads follow a documented degraded behavior without pretending stale cache is current.
4. Operator-visible status labels are exposed through API/console models.

## Validation
- Required checks: cache/provider tests, durable-memory API tests, console parser/model tests if status labels change, core/console typecheck as affected, `git diff --check`, Flywheel workflow validation.
- Additional checks: manual smoke simulating remote unavailable and cache refresh recovery.

## Dependencies
- `ARCH-20260602-semantic-memory-backend-strategy`

## Risks
- Cache sync can expand into offline edit/conflict resolution if scope is not held tightly.
- Stale status semantics can confuse operators if labels differ between API and console.

## Open Questions
- Which refresh triggers are required first: startup, manual refresh, schedule, or write-through updates?
- Should reindex/backfill jobs share cache sync state or remain separate?

## Next Step

PM refinement should sequence this after architecture strategy and before backend-heavy adapter work if cache assumptions affect provider conformance.

## Engineering Handoff
- `change_summary`: Added deterministic server-storage cache refresh and invalidation operations, preserved provider revision/fetch/stale metadata, and made search results aggregate operator-visible degraded status from returned cached records.
- `validation_evidence`: Focused durable-memory storage/contract tests passed; focused console durable-memory parser/model tests passed; core and console typechecks passed.
- `qa_focus`: Verify cache refresh marks records `cache-current`, invalidation marks stale/offline states with `staleAt`, remote-unavailable reads return cached records with `remote-unavailable`, and namespace mismatches cannot refresh cache metadata.
- `open_risks`: This slice intentionally avoids offline mutation conflict resolution, queued write replay, hosted sync, and connector-specific synchronization.

### Change Summary

- Added `refreshRecordCache` and `invalidateRecordCache` to server-mode durable-memory storage.
- Added deterministic provider metadata transitions for `cache-current`, `cache-stale`, and `remote-unavailable`/`offline`.
- Added aggregate search `operatorStatus` so degraded cache reads do not masquerade as `remote-current`.
- Covered cache refresh, stale invalidation, provider-unavailable invalidation, degraded read, and namespace mismatch behavior in tests.

### Validation Evidence

- `npm --workspace @athena/core exec -- vitest run tests/durable-memory.server-storage.test.ts tests/durable-memory.contracts.test.ts` passed: 2 files, 16 tests.
- `npm --workspace @athena/console exec -- vitest run src/features/durable-memory/api.test.ts src/features/durable-memory/inspectorModel.test.ts` passed: 2 files, 7 tests.
- `npm --workspace @athena/core run typecheck` passed.
- `npm --workspace @athena/console run typecheck` passed.

### QA Focus

- Confirm refresh and invalidation are namespace-scoped.
- Confirm cache-current, cache-stale, offline, and remote-unavailable labels are preserved in provider metadata and search status.
- Confirm degraded reads still return cached records but expose degraded operator status.
- Confirm no offline write replay or conflict-resolution behavior was introduced.

### Open Risks

- Cache operations are server-storage primitives; API endpoints for manual refresh/clear can be added in later operator-control work if needed.
- Search status aggregation is conservative and should be revisited when multi-provider cache behavior expands.

## QA Verdict
- `verdict`: Pass. Local cache sync satisfies the bounded acceptance criteria for deterministic refresh, invalidation, degraded-read status, and operator-visible status labels.
- `evidence_quality`: Strong for the implemented storage/API-model slice. Tests cover cache-current refresh, cache-stale invalidation, provider-unavailable/offline invalidation, degraded reads, namespace mismatch protection, and console status parsing/model labels. Core and console typechecks passed.
- `defects`: None.
- `state_transition`: Move to `done`.

### QA Evidence

- `npm --workspace @athena/core exec -- vitest run tests/durable-memory.server-storage.test.ts tests/durable-memory.contracts.test.ts` passed: 2 files, 16 tests.
- `npm --workspace @athena/console exec -- vitest run src/features/durable-memory/api.test.ts src/features/durable-memory/inspectorModel.test.ts` passed: 2 files, 7 tests.
- `npm --workspace @athena/core run typecheck` passed.
- `npm --workspace @athena/console run typecheck` passed.

### QA Assessment

- Acceptance criterion 1 is covered by provider metadata states for cache-current, cache-stale, offline, and remote-unavailable.
- Acceptance criterion 2 is covered by deterministic `refreshRecordCache` and `invalidateRecordCache` tests.
- Acceptance criterion 3 is covered by degraded search reads returning cached records with `remote-unavailable` rather than `remote-current`.
- Acceptance criterion 4 is covered by existing API/console status models and focused parser/model tests.

## Transition History
- `2026-06-02T20:00:00Z`: Planning created engineering intake for 2026.37 local cache sync.
- `2026-06-02T23:04:52Z`: `intake` -> `active`; PM promotes next 2026.37 implementation slice after hybrid retrieval QA
- `2026-06-02T23:06:55Z`: `active` -> `qa`; engineering handoff ready for durable memory local cache sync
- `2026-06-02T23:07:22Z`: `qa` -> `done`; QA passed durable memory local cache sync
