---
kind: story
id: STORY-20260602-durable-memory-server-storage
status: intake
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
- `status`: intake
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

## Transition History
- `2026-06-02T15:42:00Z`: PM refinement created engineering intake story
