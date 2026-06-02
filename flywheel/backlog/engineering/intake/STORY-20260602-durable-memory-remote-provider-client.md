---
kind: story
id: STORY-20260602-durable-memory-remote-provider-client
status: intake
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
- `status`: intake
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

## Transition History
- `2026-06-02T15:42:00Z`: PM refinement created engineering intake story
