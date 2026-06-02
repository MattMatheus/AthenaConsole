---
kind: story
id: STORY-20260602-durable-memory-readiness-config
status: done
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
- `status`: done
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

## Engineering Handoff

- `change_summary`: Durable-memory config parsing, readiness diagnostics, lane warnings, API expectations, and local-server docs were updated for disabled/local-dev/server-mode/remote-http operation.
- `validation_evidence`: Focused Vitest suite, typecheck, schema check, workflow validation, and diff whitespace check passed before QA.
- `qa_focus`: Verify redaction, disabled-vs-legacy diagnostic separation, remote-current token posture, unauthorized missing-token posture, and fallback status messaging.
- `open_risks`: Remote availability is represented by config/operator status rather than an active health probe in this readiness slice.

### Change Summary

- Added durable-memory configuration parsing for disabled, local-dev, server-mode, and remote-http modes, including provider IDs/labels, remote URLs, token references, cache mode, timeout, local-dev-only posture, and operator-visible status.
- Added durable-memory readiness diagnostics that distinguish disabled, local-only, server-mode, remote-current/cache-current, remote unavailable, unauthorized token reference, stale cache, queued intent, and conflict-review-required states.
- Updated readiness lanes so real-work, provider setup, and server hardening surface durable-memory warnings before memory-dependent agents run.
- Documented local server durable-memory setup, remote client configuration, backup expectations, and fallback/readiness meanings in `docs/developer/product-dev-guides/local-server-deployment.md`.

### Validation Evidence

- `npm --workspace @athena/core exec -- vitest run tests/config.test.ts tests/control-plane.readiness.test.ts tests/api.server.test.ts tests/durable-memory.remote-http-provider.test.ts tests/durable-memory.contracts.test.ts` passed: 5 files, 51 tests.
- `npm --workspace @athena/core run typecheck` passed.
- `npm --workspace @athena/core run check:schemas` passed.
- `./flywheel/tools/validate_workflow_state.sh --format json` passed.
- `git diff --check` passed.

### QA Focus

- Confirm readiness payloads do not expose durable-memory env var names, local-file token paths, or token values.
- Confirm default disabled durable memory degrades optional readiness and remains separate from legacy `/api/v1/memory/*` diagnostic memory.
- Confirm remote-http with a missing token reference reports an unauthorized degraded state and remote-http with an available token reports remote-current.

### Open Risks

- Reachability is currently driven by provider configuration/operator status rather than an active remote health probe; the remote provider client/story remains the integration point for live server calls.

## QA Verdict

- `verdict`: pass
- `evidence_quality`: Focused service/API/config tests cover supported modes, redaction, legacy route separation, unauthorized token posture, fallback statuses, and default disabled behavior; typecheck, schema check, workflow validation, and whitespace checks passed.
- `state_transition`: Move from engineering QA to done.

### QA Evidence

- `npm --workspace @athena/core exec -- vitest run tests/config.test.ts tests/control-plane.readiness.test.ts tests/api.server.test.ts tests/durable-memory.remote-http-provider.test.ts tests/durable-memory.contracts.test.ts` passed: 5 files, 51 tests.
- `npm --workspace @athena/core run typecheck` passed.
- `npm --workspace @athena/core run check:schemas` passed.
- `./flywheel/tools/validate_workflow_state.sh --format json` passed after structured handoff/backlog formatting fixes.
- `git diff --check` passed.

## Dependencies

- `STORY-20260602-durable-memory-remote-provider-client`

## Transition History
- `2026-06-02T15:42:00Z`: PM refinement created engineering intake story
- `2026-06-02T17:38:42Z`: `intake` -> `active`; PM promotes durable memory readiness config as next 2026.35 implementation slice
- `2026-06-02T17:46:17Z`: `active` -> `qa`; engineering handoff ready for durable memory readiness config QA
- `2026-06-02T17:47:49Z`: `qa` -> `done`; QA passed durable memory readiness config
