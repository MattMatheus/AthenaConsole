---
kind: story
id: STORY-20260602-durable-memory-console-inspector
status: intake
owner_role: Software Engineer
source: epic
success_metric: Operators can inspect durable memory records, namespaces, provenance, proposal state, snapshots, and provider status from the console.
release_scope: post-release
ready: false
---

# Story: Durable Memory Console Inspector

## Metadata
- `id`: STORY-20260602-durable-memory-console-inspector
- `owner_role`: Software Engineer
- `status`: intake
- `source`: epic
- `decision_refs`: [ADR-0021, ADR-0022, ADR-0023]
- `epic`: docs/product/epics/refinement/2026.35.00-epic-remote-memory-mvp.md
- `success_metric`: Operators can inspect durable memory records, namespaces, provenance, proposal state, snapshots, and provider status from the console.
- `release_scope`: post-release

## Problem Statement

Durable memory becomes trustworthy only if operators can inspect what exists, where it came from, what scope it belongs to, and whether it is remote-current, cached, stale, local-dev-only, or diagnostic-only.

## Initial Scope

- In: console service client and inspector page/panel for namespaces, records, search results, provenance summaries, proposals, archive/delete state, snapshots, and provider/readiness status.
- In: clear labels distinguishing durable memory from legacy diagnostic memory search.
- Out: rich editing workflows, connector ingestion, semantic relevance tuning, and automatic agent memory writes.

## Acceptance Criteria

1. Operators can list/search durable memory records by namespace and inspect provenance without exposing raw event payloads.
2. Console shows provider status and operator-visible cache/remote/local-dev/diagnostic labels.
3. Proposals and snapshots are visible enough to support follow-on approval/restore workflows.
4. Legacy diagnostic memory search remains labelled as local context debugging.
5. Console tests and browser QA cover empty, unavailable, populated, stale/cache, and proposal/snapshot states.

## Validation

- Focused console service/component tests.
- `npm --workspace apps/console run typecheck`
- `npm --workspace apps/console run lint`
- Browser QA across desktop/mobile.
- `git diff --check`
- `./flywheel/tools/validate_workflow_state.sh --format json`

## Dependencies

- `STORY-20260602-durable-memory-api-routes`
- `STORY-20260602-durable-memory-readiness-config`

## Transition History
- `2026-06-02T15:42:00Z`: PM refinement created engineering intake story
