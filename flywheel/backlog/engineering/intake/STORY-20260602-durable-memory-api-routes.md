---
kind: story
id: STORY-20260602-durable-memory-api-routes
status: intake
owner_role: Software Engineer
source: epic
success_metric: Team Orchestrator exposes authenticated durable-memory API routes without changing legacy diagnostic memory routes.
release_scope: post-release
ready: false
---

# Story: Durable Memory API Routes

## Metadata
- `id`: STORY-20260602-durable-memory-api-routes
- `owner_role`: Software Engineer
- `status`: intake
- `source`: epic
- `decision_refs`: [ADR-0020, ADR-0021, ADR-0022, ADR-0023]
- `epic`: docs/product/epics/refinement/2026.35.00-epic-remote-memory-mvp.md
- `success_metric`: Team Orchestrator exposes authenticated durable-memory API routes without changing legacy diagnostic memory routes.
- `release_scope`: post-release

## Problem Statement

ADR 0023 recommends explicit durable-memory routes under the Team Orchestrator API/server process. Those routes need to be added as a new authenticated route family while keeping `/api/v1/memory/search` and `/api/v1/memory/get` diagnostic-only.

## Initial Scope

- In: route registration, request parsers, service boundary, schemas, and tests for durable-memory records, list/search/get, proposals, approve/reject, archive/delete, snapshots, restore, and health/status.
- In: authorization checks using the existing server auth posture and explicit namespace/provenance validation.
- Out: console UI, semantic retrieval, legacy route migration, connector ingestion, and automatic agent writes.

## Acceptance Criteria

1. New durable-memory route family is explicit and does not reuse `/api/v1/memory/*`.
2. All mutation routes validate namespace, provenance, source kind, reason requirements, and authorization before storage writes.
3. Responses include operator-visible status where relevant and do not include secrets or event payload bodies.
4. API tests cover unauthenticated rejection, valid mutations, invalid provenance, archive/delete reason requirements, snapshot restore constraints, and route registration/schema inclusion.
5. Existing diagnostic memory route tests still pass unchanged.

## Validation

- `npm --workspace @athena/core run typecheck`
- Focused API route/parser/schema tests.
- Existing memory CLI/API parity tests.
- `npm --workspace @athena/core run check:schemas`
- `git diff --check`
- `./flywheel/tools/validate_workflow_state.sh --format json`

## Dependencies

- `STORY-20260602-durable-memory-contracts`
- `STORY-20260602-durable-memory-server-storage`

## Transition History
- `2026-06-02T15:42:00Z`: PM refinement created engineering intake story
