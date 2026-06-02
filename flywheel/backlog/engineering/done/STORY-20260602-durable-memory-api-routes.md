---
kind: story
id: STORY-20260602-durable-memory-api-routes
status: done
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
- `status`: done
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

## Engineering Handoff

- `change_summary`: Added explicit `/api/v1/durable-memory/*` routes, parsers, service wiring, authorization, API contracts, operation schemas, and focused tests without changing legacy `/api/v1/memory/*` diagnostic routes.
- `validation_evidence`: Focused durable-memory/API suite passed: 6 files / 64 tests; core typecheck passed; API schema check passed; workflow validation passed before QA move; `git diff --check` passed.
- `qa_focus`: Verify route separation from diagnostic memory, auth behavior, mutation guardrails, schema registration, snapshot restore constraints, and response payload redaction expectations.
- `open_risks`: Remote HTTP provider client, console inspector, readiness/config, and proposal-to-record promotion semantics remain follow-on stories.

Implemented the explicit durable-memory API family under `/api/v1/durable-memory/*` without reusing or changing legacy `/api/v1/memory/*` diagnostic routes.

Changed:

- Added durable-memory request parsers for namespace/provenance validation, mutation reason requirements, list/search/get, proposals, archive/delete, snapshots, restore, and health.
- Added `DURABLE_MEMORY_ROUTES` with explicit route family metadata and wired it into the API route table.
- Added a durable-memory service boundary backed by `SqliteDurableMemoryServerStorage` and authorized through the existing request auth context.
- Registered durable-memory API contracts and operation schemas for route/schema completeness checks.
- Added focused parser, route registration, contract, and server integration tests covering unauthenticated rejection, valid mutations, invalid provenance, archive/delete reason requirements, snapshot restore constraints, and legacy memory route preservation.

Validation evidence:

- `npm --workspace @athena/core exec -- vitest run tests/api.request-parsers.test.ts tests/api.route-registration.test.ts tests/control-plane.api-contracts.test.ts tests/api.server.test.ts tests/durable-memory.server-storage.test.ts tests/durable-memory.contracts.test.ts` passed: 6 files / 64 tests.
- `npm --workspace @athena/core run typecheck` passed.
- `npm --workspace @athena/core run check:schemas` passed.
- `./flywheel/tools/validate_workflow_state.sh --format json` passed with no failures or warnings.
- `git diff --check` passed.

QA focus:

- Confirm durable-memory routes stay distinct from diagnostic `/api/v1/memory/*` routes.
- Check auth behavior on read and mutation routes, especially unauthenticated rejection and Operator/Admin mutation requirements.
- Inspect response bodies and observability behavior for accidental secret or raw event payload leakage.
- Exercise restore/archive/delete constraint failures and verify they return operator-usable errors.

Open risks:

- The route family is server-mode/local SQLite backed in this story; remote HTTP provider client and console inspector remain follow-on stories.
- Proposal approval currently records approval status and does not yet promote proposal bodies into records; promotion semantics should stay with the later provider/client workflow slice.

## QA Verdict

- `verdict`: pass
- `evidence_quality`: Focused server/parser/route-registration/API-contract/storage/contract tests passed, core typecheck passed, schema check passed, workflow validation passed, and diff hygiene passed.
- `state_transition`: Move engineering QA to done.

Acceptance coverage:

- New durable-memory route family is explicit under `/api/v1/durable-memory/*`; existing `/api/v1/memory/*` route tests remain in the passing API server suite.
- Mutation parsers validate namespace/provenance/source kind and reason requirements before service writes; invalid provenance and missing archive/delete/proposal/snapshot reasons are covered.
- Auth rejection is covered for durable-memory health when API auth is enabled; mutation route authorization is enforced through `AuthorizedDurableMemoryService`.
- Route registration/API contracts/API schemas include the durable-memory route family and operation definitions.
- Snapshot restore namespace mismatch returns a 400 validation error.

Defects:

- None found.

## Transition History
- `2026-06-02T15:42:00Z`: PM refinement created engineering intake story
- `2026-06-02T17:09:40Z`: `intake` -> `active`; PM promotes durable memory API routes as the next 2026.35 implementation slice
- `2026-06-02T17:19:50Z`: `active` -> `qa`; engineering handoff ready for durable memory API routes QA
- `2026-06-02T17:21:16Z`: `qa` -> `done`; QA passed durable memory API routes
