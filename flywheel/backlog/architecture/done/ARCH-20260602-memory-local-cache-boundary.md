---
kind: architecture_story
id: ARCH-20260602-memory-local-cache-boundary
status: done
owner_role: architect
source: planning
decision_owner: architect
success_metric: Durable memory local-cache rules are specific enough to distinguish provider cache, local development backend, and legacy diagnostic memory surfaces.
ready: true
---

# Architecture Story: Durable Memory Local Cache Boundary

## Metadata
- `id`: ARCH-20260602-memory-local-cache-boundary
- `owner_role`: architect
- `status`: done
- `source`: planning
- `decision_refs`: [ADR-0019, ADR-0020, ADR-0021, docs/product/epics/refinement/2026.34.00-epic-durable-memory-service-architecture.md]
- `decision_owner`: architect
- `success_metric`: Durable memory local-cache rules are specific enough to distinguish provider cache, local development backend, and legacy diagnostic memory surfaces.

## Decision Scope
- Decide how local SQLite may serve as a durable-memory cache versus a local development backend.
- Decide how current workspace markdown/transcript memory search and `memory://` artifact payload behavior maps forward.
- Define cache invalidation, offline, queued write, conflict, and retention defaults at architecture level.
- Define what remains legacy diagnostic behavior until an explicit migration story changes operator-visible routes or console copy.

## Problem Statement
- ADR 0019 rejects copied SQLite app-state files as the durable memory strategy while allowing SQLite as cache, development backend, or offline support.
- ADR 0020 defines provider operations and leaves local-cache details unresolved.
- ADR 0021 defines namespace/provenance semantics and defers exact cache behavior.
- Current `/api/v1/memory/search` and `/api/v1/memory/get` read workspace markdown/transcript files and are not durable scoped memory provider APIs.
- Without a boundary decision, provider implementation could accidentally treat diagnostic file search, local app-state SQLite, and remote-capable durable memory as the same product surface.

## Inputs
- Existing decisions:
  - `docs/product/architecture/decisions/0019-durable-memory-domain-architecture.md`
  - `docs/product/architecture/decisions/0020-durable-memory-provider-interface.md`
  - `docs/product/architecture/decisions/0021-durable-memory-namespace-and-provenance-model.md`
  - `docs/product/architecture/decisions/0010-sqlite-app-state-architecture.md`
- Existing code/contracts:
  - `packages/core/src/memory/index.ts`
  - `packages/core/src/shared/contracts/memory.ts`
  - `packages/core/src/api/routes/work-memory-routes.ts`
  - `packages/core/src/api/request-parsers/memory.ts`
  - `packages/core/src/control-plane/services/local-services.ts`
- Existing architecture artifacts:
  - `docs/product/direction/current-direction.md`
  - `docs/product/epics/refinement/2026.34.00-epic-durable-memory-service-architecture.md`
- Constraints:
  - Do not implement cache code in this story.
  - Do not rename or change current API routes in this story.
  - Do not choose the remote backend; that is `2026.34.05`.
  - Do not add memory-aware agent permissions or proposal UI in this story.

## Outputs Required
- Decision updates:
  - New architecture record for durable memory local-cache boundary.
- Architecture artifacts:
  - Update architecture index and current direction if the decision is accepted.
- Risks and tradeoffs:
  - Offline writes versus fail-fast behavior.
  - Cache staleness and conflict handling.
  - Local retention of sensitive memory data.
  - Compatibility risk for existing diagnostic memory search and artifact preview.

## Alternatives Considered
- Treat current SQLite app-state as the durable memory source of truth.
- Keep current workspace markdown memory search as durable memory.
- Disable local caching until a remote backend ships.
- Define explicit modes for provider cache, local development backend, and legacy diagnostic surfaces.

## Operational Impact
- Provider-interface implementation can add local SQLite-backed adapters without redefining current diagnostic memory behavior.
- Operators should see clear status when memory is remote-backed, locally cached, local-dev-only, stale, offline, or diagnostic-only.
- Future migration work must be explicit before current `/api/v1/memory/*` routes become durable-memory provider APIs.

## Acceptance Criteria
1. Decision defines separate roles for local cache, local development backend, legacy diagnostic markdown/transcript search, and memory-backed artifact payloads.
2. Decision defines invalidation/refresh, offline, queued write, conflict, and local retention defaults for cache mode.
3. Decision defines which current SQLite/FTS behavior can be reused and which current behavior must remain diagnostic-only until migrated.
4. Decision defines operator-visible status and audit/event expectations for cache sync, offline, conflicts, and local-only writes.
5. Decision explains which implementation details remain deferred to the remote-backend recommendation and provider-interface implementation stories.

## Review Focus
- Confirm the boundary prevents copied SQLite/app-state files from becoming the cross-machine memory strategy.
- Confirm existing diagnostic memory routes and artifact previews remain compatible until explicit migration.
- Confirm local cache behavior is specific enough to guide provider implementation without choosing the remote backend.

## Next Step
- Architecture should promote this story to active, produce ADR 0022, then move to QA for review against the acceptance criteria.

## Intake Promotion Checklist
- [x] Decision scope is explicit and bounded.
- [x] Problem statement explains why the decision is needed now.
- [x] Inputs are listed and available.
- [x] Outputs are concrete and reviewable.
- [x] Alternatives and operational impact are explicit.
- [x] Follow-on implementation work is split out when needed.

## Architecture Handoff
- `decision_summary`: Added accepted ADR 0022, defining separate local roles for durable memory cache, local development backend, legacy diagnostic markdown/transcript search, memory-backed artifact payloads, and app-state SQLite.
- `alternatives_considered`: Treat app-state SQLite as durable memory source of truth; keep workspace markdown search as durable memory; disable local caching until a remote backend ships; accepted explicit cache/dev-backend/diagnostic role separation.
- `operational_impact`: Provider-interface implementation can add local SQLite cache/dev-backend contracts without changing current `/api/v1/memory/*` behavior. Future durable-memory surfaces should show whether results are remote-current, cached, stale, local-dev-only, or diagnostic-only.
- `follow_on_work`: Refine `2026.34.05 Remote Backend Recommendation`, then implement provider-interface types with namespace/provenance validation helpers and explicit cache/dev-backend contracts before adding cache schema, durable-memory APIs, route migration, permissions, or proposal UI.

## QA Verdict
- `verdict`: Pass. ADR 0022 satisfies the local-cache boundary acceptance criteria and keeps current memory routes, artifact preview behavior, remote-backend choice, and provider implementation out of scope.
- `evidence_quality`: Good. QA checked role separation, cache refresh/invalidation, offline behavior, queued writes, conflict defaults, retention rules, current SQLite/FTS reuse limits, operator-visible status, event/audit expectations, and follow-on work.
- `defects`: None found.
- `state_transition`: Move to `done`.

## Transition History
- `2026-06-02T15:27:56Z`: `intake` -> `active`; next durable memory architecture story refined and ready
- `2026-06-02T15:29:43Z`: `active` -> `qa`; durable memory local-cache boundary ADR ready for architecture QA
- `2026-06-02T15:30:16Z`: `qa` -> `done`; QA passed durable memory local-cache boundary ADR
