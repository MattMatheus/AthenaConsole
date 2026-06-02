---
kind: story
id: STORY-20260602-durable-memory-remote-provider-client
status: done
owner_role: Software Engineer
source: epic
success_metric: Local Team Orchestrator runtimes can use a remote HTTP durable-memory provider client against the server-mode API.
release_scope: post-release
ready: false
---

# Story: Durable Memory Remote Provider Client

## Metadata
- `id`: STORY-20260602-durable-memory-remote-provider-client
- `owner_role`: Software Engineer
- `status`: done
- `source`: epic
- `decision_refs`: [ADR-0020, ADR-0022, ADR-0023]
- `epic`: docs/product/epics/refinement/2026.35.00-epic-remote-memory-mvp.md
- `success_metric`: Local Team Orchestrator runtimes can use a remote HTTP durable-memory provider client against the server-mode API.
- `release_scope`: post-release

## Problem Statement

The remote MVP needs a provider implementation that talks to the internal Team Orchestrator server-mode durable-memory API, so a laptop runtime can read/write the same authoritative memory as a local server.

## Initial Scope

- In: `remote-http` durable-memory provider client, config shape, auth header handling, timeout/retry/error mapping, health check, and cache-aware status fields.
- In: tests using a local fake server or route-level harness.
- Out: rich offline queue, semantic retrieval, console UI, and hosted identity.

## Acceptance Criteria

1. Remote provider client implements the provider operations needed by records, search/list/get, proposals, archive/delete, snapshots, and health/status.
2. Auth token/header handling is redacted in logs/errors and compatible with trusted-LAN server auth.
3. Provider failures map to explicit unavailable, unauthorized, conflict, validation, or retryable statuses.
4. Client does not call legacy diagnostic memory routes.
5. Tests cover success, auth failure, validation failure, server unavailable, conflict, timeout/retry behavior, and response redaction.

## Validation

- `npm --workspace @athena/core run typecheck`
- Focused provider client tests.
- `git diff --check`
- `./flywheel/tools/validate_workflow_state.sh --format json`

## Dependencies

- `STORY-20260602-durable-memory-contracts`
- `STORY-20260602-durable-memory-api-routes`

## Engineering Handoff

- `change_summary`: Added `RemoteHttpDurableMemoryProvider` for the `remote-http` durable-memory provider kind, with explicit route mapping, bearer-token/header handling, timeout/retry behavior, response/error classification, redacted error messages, and operation coverage for records, search/list/get, proposals, archive/delete, snapshots, restore, and health.
- `validation_evidence`: Focused durable-memory/API suite passed: 7 files / 69 tests; core typecheck passed; API schema check passed; workflow validation passed; `git diff --check` passed.
- `qa_focus`: Verify no legacy `/api/v1/memory/*` calls, auth/token redaction, timeout/retry behavior, provider failure classification, and proposal approval return semantics.
- `open_risks`: The provider client is not yet wired into runtime config/readiness or console surfaces; proposal approval returns the reviewed proposal while proposal-to-record promotion remains follow-on workflow semantics.

Implemented:

- Added `packages/core/src/durable-memory/remote-http-provider.ts` with an injectable `fetch` implementation for deterministic tests.
- Added token resolution for `env` and `local-file` token refs, default `x-athena-identity`, bearer authorization, and URL/message redaction.
- Mapped all durable-memory provider operations to the explicit `/api/v1/durable-memory/*` route family.
- Added `DurableMemoryRemoteProviderError` with provider/operator status, status code, retryability, and trace ID.
- Added retry for retryable transport/5xx/429 failures and timeout handling via `AbortController`.
- Updated the durable-memory provider contract so `approveProposal` returns the reviewed proposal, matching the server API and current promotion boundary.
- Added focused tests for success paths, auth failure, validation failure, conflict, server unavailable health, retry behavior, timeout, response redaction, token header handling, and avoiding legacy diagnostic memory routes.

Validation evidence:

- `npm --workspace @athena/core exec -- vitest run tests/durable-memory.remote-http-provider.test.ts tests/durable-memory.contracts.test.ts tests/durable-memory.server-storage.test.ts tests/api.request-parsers.test.ts tests/api.route-registration.test.ts tests/control-plane.api-contracts.test.ts tests/api.server.test.ts` passed: 7 files / 69 tests.
- `npm --workspace @athena/core run typecheck` passed.
- `npm --workspace @athena/core run check:schemas` passed.
- `./flywheel/tools/validate_workflow_state.sh --format json` passed with no failures or warnings.
- `git diff --check` passed.

## QA Verdict

- `verdict`: pass
- `evidence_quality`: Focused provider/API/durable-memory suite passed, core typecheck passed, schema check passed, workflow validation passed, and diff hygiene passed.
- `state_transition`: Move engineering QA to done.

Acceptance coverage:

- Provider operations map to explicit `/api/v1/durable-memory/*` routes and tests assert no legacy `/api/v1/memory/*` calls.
- Auth/token header handling is covered, including bearer token resolution and redacted error messages.
- Failure mapping is covered for unauthorized, validation, conflict, server unavailable, timeout, and retryable 5xx behavior.
- Health/status returns operator-visible unavailable state when the remote server cannot be reached.
- Proposal approval returns the reviewed proposal, matching the server route and keeping proposal promotion as a follow-on concern.

Defects:

- None found.

## Transition History
- `2026-06-02T15:42:00Z`: PM refinement created engineering intake story
- `2026-06-02T17:29:53Z`: `intake` -> `active`; PM promotes durable memory remote provider client as next 2026.35 implementation slice
- `2026-06-02T17:34:11Z`: `active` -> `qa`; engineering handoff ready for durable memory remote provider client QA
- `2026-06-02T17:35:02Z`: `qa` -> `done`; QA passed durable memory remote provider client
