---
kind: architecture_story
id: ARCH-20260602-memory-remote-backend-recommendation
status: done
owner_role: architect
source: planning
decision_owner: architect
success_metric: Durable memory has a first remote backend posture that supports the 2026.35 MVP without pulling in hosted, semantic, or third-party service complexity too early.
ready: true
---

# Architecture Story: Durable Memory Remote Backend Recommendation

## Metadata
- `id`: ARCH-20260602-memory-remote-backend-recommendation
- `owner_role`: architect
- `status`: done
- `source`: planning
- `decision_refs`: [ADR-0019, ADR-0020, ADR-0021, ADR-0022, docs/product/epics/refinement/2026.34.00-epic-durable-memory-service-architecture.md]
- `decision_owner`: architect
- `success_metric`: Durable memory has a first remote backend posture that supports the 2026.35 MVP without pulling in hosted, semantic, or third-party service complexity too early.

## Decision Scope
- Choose the first remote service posture for durable memory.
- Compare internal Team Orchestrator server mode, standalone service, AthenaMemory-compatible service, hosted database-backed service, and vector/semantic service-first options.
- Define the minimum storage, API, deployment, auth, migration, and observability expectations for the first remote memory MVP.
- Define what remains deferred to semantic memory, hosted deployment, connector ingestion, and governance stories.

## Problem Statement
- ADR 0019 through ADR 0022 define the durable memory product domain, provider interface, namespace/provenance rules, and local-cache boundary.
- The next implementation epic, `2026.35 Remote Memory MVP`, needs one recommended remote posture before engineering work begins.
- If the backend choice jumps straight to hosted/multi-tenant, semantic/vector, or third-party memory-service integration, it will likely exceed the local-first release posture and delay useful remote continuity.
- If the backend remains local-only, Team Orchestrator will not satisfy the product goal of memory continuity across laptop, local server, and remote server environments.

## Inputs
- Existing decisions:
  - `docs/product/architecture/decisions/0019-durable-memory-domain-architecture.md`
  - `docs/product/architecture/decisions/0020-durable-memory-provider-interface.md`
  - `docs/product/architecture/decisions/0021-durable-memory-namespace-and-provenance-model.md`
  - `docs/product/architecture/decisions/0022-durable-memory-local-cache-boundary.md`
- Existing roadmap/epics:
  - `docs/product/roadmap/future-horizon.md`
  - `docs/product/epics/refinement/2026.34.00-epic-durable-memory-service-architecture.md`
  - `docs/product/epics/refinement/2026.35.00-epic-remote-memory-mvp.md`
  - `docs/product/epics/refinement/2026.37.00-epic-semantic-memory-and-sync-backends.md`
- Existing deployment posture:
  - `README.md`
  - `docker-compose.server.yml`
  - `docs/developer/product-dev-guides/local-server-deployment.md`
- External references reviewed:
  - Chroma official docs and GitHub repository for local/self-hosted/cloud vector retrieval posture.
  - AthenaMemory search did not surface a stable primary repository in the current pass, so it should not be selected as the first product dependency.
- Constraints:
  - Do not implement backend code in this story.
  - Do not choose hosted multi-tenant architecture as the first MVP.
  - Do not make Chroma or AthenaMemory the product data model.
  - Do not change current memory routes in this story.

## Outputs Required
- Decision updates:
  - New architecture record for durable memory remote backend recommendation.
- Architecture artifacts:
  - Update architecture index and current direction if the decision is accepted.
- Risks and tradeoffs:
  - Single-server server-mode limits versus standalone service flexibility.
  - SQLite/Postgres/schema choices versus provider abstraction.
  - Semantic retrieval timing.
  - Migration from legacy diagnostic memory routes.
  - Auth and secret handling for trusted-LAN versus hosted deployment.

## Alternatives Considered
- Internal Team Orchestrator server mode over HTTP.
- Standalone memory service.
- AthenaMemory-compatible first backend.
- Hosted database-backed service first.
- Chroma/vector service first.
- Local-only SQLite first.

## Operational Impact
- Engineering can start `2026.35` with a remote HTTP provider served by the Team Orchestrator API/server deployment path.
- The first remote MVP can reuse the existing trusted-LAN deployment story while keeping hosted multi-tenant work deferred.
- Semantic/vector backends remain adapters/indexes behind the provider contract rather than the first source of truth.

## Acceptance Criteria
1. Decision selects one first remote backend posture and explains why it fits 2026.35.
2. Decision compares internal server mode, standalone service, AthenaMemory-compatible service, hosted database-backed service, Chroma/vector-first service, and local-only SQLite.
3. Decision defines minimum API, storage, deployment, auth, migration, observability, backup/restore, and local-cache expectations for the first remote MVP.
4. Decision identifies which current memory routes remain legacy diagnostic behavior and which new durable-memory API shape should be introduced.
5. Decision defines follow-on engineering/planning work for 2026.35 and defers semantic retrieval, hosted multi-tenant deployment, and third-party adapters to later epics.

## Review Focus
- Confirm the selected posture satisfies remote continuity without exceeding current product/deployment scope.
- Confirm third-party semantic/memory services are treated as future adapters, not product-domain dependencies.
- Confirm the recommendation gives engineering enough direction to start the remote memory MVP.

## Next Step
- Architecture should promote this story to active, produce ADR 0023, then move to QA for review against the acceptance criteria.

## Intake Promotion Checklist
- [x] Decision scope is explicit and bounded.
- [x] Problem statement explains why the decision is needed now.
- [x] Inputs are listed and available.
- [x] Outputs are concrete and reviewable.
- [x] Alternatives and operational impact are explicit.
- [x] Follow-on implementation work is split out when needed.

## Architecture Handoff
- `decision_summary`: Added accepted ADR 0023, recommending internal Team Orchestrator server mode over HTTP as the first durable-memory remote backend posture for the 2026.35 MVP.
- `alternatives_considered`: Standalone memory service first; AthenaMemory-compatible service first; hosted database-backed service first; Chroma/vector service first; local-only SQLite first; accepted internal Team Orchestrator server mode.
- `operational_impact`: Engineering can plan 2026.35 around explicit durable-memory API routes served by the Team Orchestrator API/server deployment path, while keeping current `/api/v1/memory/*` routes as legacy diagnostics and deferring Chroma/AthenaMemory/hosted/Postgres/standalone-service work.
- `follow_on_work`: Refine 2026.35 engineering stories for durable-memory routes, server-mode provider implementation, storage adapter, validation helpers, events, and smoke tests.

## QA Verdict
- `verdict`: Pass. ADR 0023 satisfies the remote-backend recommendation acceptance criteria and gives `2026.35` an implementation posture without expanding into hosted, semantic, standalone-service, or third-party memory dependencies.
- `evidence_quality`: Good. QA checked selected posture, alternatives comparison, API shape, storage posture, trusted-LAN deployment fit, auth expectations, migration posture for current memory routes, observability, backup/restore, local-cache expectations, and deferred work.
- `defects`: None found.
- `state_transition`: Move to `done`.

## Transition History
- `2026-06-02T15:34:37Z`: `intake` -> `active`; next durable memory architecture story refined and ready
- `2026-06-02T15:36:28Z`: `active` -> `qa`; durable memory remote backend recommendation ADR ready for architecture QA
- `2026-06-02T15:37:01Z`: `qa` -> `done`; QA passed durable memory remote backend recommendation ADR
