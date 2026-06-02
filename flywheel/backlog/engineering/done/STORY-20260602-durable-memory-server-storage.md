---
kind: story
id: STORY-20260602-durable-memory-server-storage
status: done
owner_role: Software Engineer
source: epic
success_metric: Server-mode durable memory has a replaceable storage adapter that persists records, proposals, snapshots, provenance, and sync metadata without using legacy app-state tables as the provider contract.
release_scope: post-release
ready: false
---

# Story: Durable Memory Server Storage Adapter

## Metadata
- `id`: STORY-20260602-durable-memory-server-storage
- `owner_role`: Software Engineer
- `status`: done
- `source`: epic
- `decision_refs`: [ADR-0019, ADR-0020, ADR-0021, ADR-0022, ADR-0023]
- `epic`: docs/product/epics/refinement/2026.35.00-epic-remote-memory-mvp.md
- `success_metric`: Server-mode durable memory has a replaceable storage adapter that persists records, proposals, snapshots, provenance, and sync metadata without using legacy app-state tables as the provider contract.
- `release_scope`: post-release

## Problem Statement

The first remote memory MVP needs authoritative server-owned storage, but the storage layer must remain behind the durable-memory provider boundary so future Postgres, hosted, or standalone service adapters can replace it.

## Initial Scope

- In: server-mode storage adapter and repository boundary for durable records, proposals, snapshots, namespace/provenance metadata, revision/etag fields, archive/delete state, and basic search fields.
- In: migrations or initialization for dedicated durable-memory storage.
- In: backup/restore documentation notes for server-mode storage.
- Out: public API routes, HTTP provider client, console UI, semantic/vector indexing, hosted database support, and legacy `/api/v1/memory/*` migration.

## Acceptance Criteria

1. Durable records persist with namespace, provenance, source kind, sensitivity, revision, created/updated timestamps, archived/deleted state, and provider/storage ids.
2. Proposals persist separately from accepted records and retain provenance plus target namespace.
3. Snapshots can be created/listed/restored at the storage boundary without widening namespace scope.
4. Storage adapter is isolated behind interfaces so future Postgres/hosted storage can replace it.
5. App-state SQLite tables are not treated as the provider contract; any SQLite use is dedicated durable-memory storage.
6. Tests cover CRUD/list/search/archive/delete/proposal/snapshot storage behavior and namespace isolation.

## Validation

- `npm --workspace @athena/core run typecheck`
- Focused core storage/repository tests.
- `npm --workspace @athena/core run check:schemas` if API/component schemas are touched.
- `git diff --check`
- `./flywheel/tools/validate_workflow_state.sh --format json`

## Dependencies

- `STORY-20260602-durable-memory-contracts`

## Engineering Handoff

- `completed_at`: 2026-06-02T17:06:00Z
- `change_summary`: Added a dedicated durable-memory server storage module with a `DurableMemoryServerStorage` interface and SQLite implementation. The adapter initializes dedicated durable-memory records/proposals/snapshots tables, persists namespace/provenance/source-kind/provider metadata, supports list/search/archive/delete, keeps proposals separate from accepted records, creates/list/restores snapshots without widening namespace scope, and exports the storage module from core. Added server-mode backup/restore notes to the 2026.35 epic.
- `files_changed`:
  - `packages/core/src/durable-memory/index.ts`
  - `packages/core/src/durable-memory/server-storage.ts`
  - `packages/core/src/index.ts`
  - `packages/core/tests/durable-memory.server-storage.test.ts`
  - `docs/product/epics/refinement/2026.35.00-epic-remote-memory-mvp.md`
  - `docs/product/direction/current-direction.md`
  - `flywheel/backlog/README.md`
  - `flywheel/backlog/engineering/active/README.md`
  - `flywheel/backlog/engineering/intake/README.md`
- `validation_evidence`: Focused durable-memory contracts/storage tests, core typecheck, workflow validation, and whitespace validation passed.
  - `npm --workspace @athena/core exec -- vitest run tests/durable-memory.contracts.test.ts tests/durable-memory.server-storage.test.ts`
  - `npm --workspace @athena/core run typecheck`
  - `./flywheel/tools/validate_workflow_state.sh --format json`
  - `git diff --check`
- `qa_focus`: Confirm storage uses dedicated durable-memory tables and interface boundaries, records/proposals/snapshots preserve namespace and provenance metadata, namespace isolation prevents sibling leakage, and snapshot restore cannot target a broader namespace.
- `open_risks`: This is not yet wired into API routes or runtime services. SQLite is the first server-mode adapter implementation detail and remains replaceable by future Postgres/hosted storage.

## QA Verdict

- `verdict`: pass
- `qa_timestamp`: 2026-06-02T17:07:00Z
- `evidence_quality`: Good. QA reran focused durable-memory contracts/storage tests, core typecheck, workflow validation, and whitespace validation.
- `acceptance_coverage`:
  - AC1: Records persist namespace, provenance, source kind, sensitivity, revision/provider metadata, timestamps, archive/delete state, and storage ids in dedicated durable-memory tables.
  - AC2: Proposals persist separately from accepted records and retain target namespace, provenance, source kind, reason, and review state.
  - AC3: Snapshots create/list/restore at the storage boundary and reject restore into a broader namespace.
  - AC4: Storage is exposed through `DurableMemoryServerStorage` and `SqliteDurableMemoryServerStorage`, keeping future storage adapters replaceable.
  - AC5: Storage uses dedicated `durable_memory_*` tables and does not treat app-state tables as the provider contract.
  - AC6: Tests cover record persistence, list/search namespace isolation, archive/delete, proposal review, snapshot lifecycle, and restore namespace guardrails.
- `validation_evidence`: `npm --workspace @athena/core exec -- vitest run tests/durable-memory.contracts.test.ts tests/durable-memory.server-storage.test.ts`; `npm --workspace @athena/core run typecheck`; `./flywheel/tools/validate_workflow_state.sh --format json`; `git diff --check`.
- `defects`: None found.
- `state_transition`: Move to `done`.

## Transition History
- `2026-06-02T15:42:00Z`: PM refinement created engineering intake story
- `2026-06-02T17:01:11Z`: `intake` -> `active`; Engineering starts durable memory server storage adapter
- `2026-06-02T17:05:39Z`: `active` -> `qa`; engineering handoff ready for durable memory server storage QA
- `2026-06-02T17:06:30Z`: `qa` -> `done`; QA passed durable memory server storage adapter
