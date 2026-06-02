---
kind: story
id: STORY-20260602-durable-memory-readiness-config
status: intake
owner_role: Software Engineer
source: epic
success_metric: Product readiness and configuration distinguish disabled, local-dev-only, remote-current, remote-unavailable, cached, stale, queued, and conflict durable-memory states.
release_scope: post-release
ready: false
---

# Story: Durable Memory Configuration And Readiness

## Metadata
- `id`: STORY-20260602-durable-memory-readiness-config
- `owner_role`: Software Engineer
- `status`: intake
- `source`: epic
- `decision_refs`: [ADR-0022, ADR-0023]
- `epic`: docs/product/epics/refinement/2026.35.00-epic-remote-memory-mvp.md
- `success_metric`: Product readiness and configuration distinguish disabled, local-dev-only, remote-current, remote-unavailable, cached, stale, queued, and conflict durable-memory states.
- `release_scope`: post-release

## Problem Statement

Remote memory failures should degrade visibly before agents run. Operators need configuration, readiness, and documentation that distinguish durable remote memory from legacy diagnostic memory.

## Initial Scope

- In: config parsing for durable-memory provider mode, server URL, token reference, cache mode flags, and local-dev-only mode.
- In: readiness diagnostics for disabled, configured, reachable, unauthorized, stale/cache-only, and conflict states.
- In: docs for local server memory configuration and current legacy route compatibility.
- Out: console inspector UI, full hosted identity, and rich offline queue UI.

## Acceptance Criteria

1. Config supports disabled, server-mode/local-dev, and remote-http durable-memory provider modes.
2. Readiness diagnostics report memory disabled, remote unavailable, unauthorized, remote-current, cache-stale, queued-intent, conflict-review-required, and local-dev-only statuses where applicable.
3. Diagnostics distinguish durable memory from legacy `/api/v1/memory/*` diagnostic search.
4. Secrets/tokens are referenced and redacted consistently with existing provider config posture.
5. Product docs describe local server durable-memory setup, backup expectations, and fallback behavior.

## Validation

- `npm --workspace @athena/core run typecheck`
- Focused config/readiness tests.
- Docs path/link check where applicable.
- `git diff --check`
- `./flywheel/tools/validate_workflow_state.sh --format json`

## Dependencies

- `STORY-20260602-durable-memory-remote-provider-client`

## Transition History
- `2026-06-02T15:42:00Z`: PM refinement created engineering intake story
