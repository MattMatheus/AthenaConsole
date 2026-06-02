---
kind: architecture_story
id: ARCH-20260602-memory-provider-interface
status: done
owner_role: architect
source: planning
decision_owner: architect
success_metric: Durable memory provider interfaces are specified clearly enough for no-behavior-change implementation without binding the product to one backend.
ready: true
---

# Architecture Story: Durable Memory Provider Interface

## Metadata
- `id`: ARCH-20260602-memory-provider-interface
- `owner_role`: architect
- `status`: done
- `source`: planning
- `decision_refs`: [ADR-0019, docs/product/epics/refinement/2026.34.00-epic-durable-memory-service-architecture.md, docs/product/roadmap/future-horizon.md]
- `decision_owner`: architect
- `success_metric`: Durable memory provider interfaces are specified clearly enough for no-behavior-change implementation without binding the product to one backend.

## Decision Scope
- Define the TypeScript-facing durable memory provider contract implied by ADR 0019.
- Specify request and response shapes for the canonical operations before any remote memory implementation starts.
- Recommend where the provider interfaces should live in the repo and how they should relate to current local diagnostic memory search.
- Preserve no-behavior-change boundaries for existing `/api/v1/memory/search`, `/api/v1/memory/get`, and `memory://` artifact preview behavior.

## Problem Statement
- ADR 0019 accepts durable memory as a remote-capable product domain, but it deliberately does not define final TypeScript signatures.
- Follow-on implementation work needs concrete provider interfaces so runtime, agent, task, artifact, authorization, and console code can depend on stable contracts rather than a backend-specific storage shape.
- Without a provider-interface decision, remote memory MVP work could leak HTTP, SQLite, semantic-vector, or AthenaMemory-specific assumptions into the product domain.

## Inputs
- Existing decisions:
  - `docs/product/architecture/decisions/0019-durable-memory-domain-architecture.md`
  - `docs/product/architecture/decisions/0007-agent-manifest-and-lifecycle-contract.md`
  - `docs/product/architecture/decisions/0009-task-mission-run-domain-model.md`
  - `docs/product/architecture/decisions/0010-sqlite-app-state-architecture.md`
  - `docs/product/architecture/decisions/0012-event-artifact-observability-model.md`
  - `docs/product/architecture/decisions/0013-safety-approval-and-loop-limit-model.md`
  - `docs/product/architecture/decisions/0015-canonical-orchestration-state-model.md`
- Existing implementation surfaces:
  - `packages/core/src/shared/contracts/memory.ts`
  - `packages/core/src/memory/index.ts`
  - `packages/core/src/api/routes/work-memory-routes.ts`
  - `packages/core/src/api/request-parsers/memory.ts`
  - `packages/core/src/control-plane/services/authorization.ts`
  - `packages/core/src/control-plane/services/task-workbench.ts`
- Existing architecture artifacts:
  - `docs/product/architecture/state-ownership-map.md`
  - `docs/product/direction/current-direction.md`
  - `docs/product/epics/refinement/2026.34.00-epic-durable-memory-service-architecture.md`
- Constraints:
  - Do not implement a remote memory backend in this story.
  - Do not change current memory search or artifact preview runtime behavior.
  - Do not decide the first remote backend; that is `2026.34.05`.
  - Do not finalize namespace/provenance field semantics beyond the placeholders needed for interfaces; that is `2026.34.03`.

## Outputs Required
- Decision updates:
  - New architecture record or ADR addendum that defines the durable memory provider interface shape and placement.
- Architecture artifacts:
  - If needed, update ADR 0019 or current direction to link the provider-interface decision.
- Risks and tradeoffs:
  - Interface granularity and backend leakage.
  - How much namespace/provenance detail can be represented before `2026.34.03`.
  - Compatibility with current diagnostic memory search.
  - Authorization and approval boundary assumptions.

## Alternatives Considered
- Keep the provider contract only in prose until implementation.
- Add backend-specific interfaces for local SQLite and remote HTTP separately.
- Reuse current `MemoryManager` and `MemorySearchResult` as the durable product interface.
- Define one backend-neutral provider interface with typed operations and backend-specific adapters behind it.

## Operational Impact
- Future memory providers should be swappable without rewriting agent/runtime contracts.
- Agent-facing behavior should remain stable while backend choices evolve.
- Existing local diagnostic memory search should remain available until a migration story maps it into or retires it from the durable memory contract.

## Acceptance Criteria
1. Provider-interface decision defines TypeScript request/response shapes for `writeMemory`, `proposeMemoryWrite`, `getMemory`, `searchMemory`, `listMemory`, `archiveMemory`, `deleteMemory`, `createSnapshot`, `listSnapshots`, and `restoreSnapshot`.
2. Decision identifies the recommended repo/package location for the interfaces and how they relate to current `packages/core/src/shared/contracts/memory.ts` and `packages/core/src/memory/index.ts`.
3. Decision explains which fields are stable now and which namespace/provenance details are deferred to `2026.34.03`.
4. Decision preserves current `/api/v1/memory/search`, `/api/v1/memory/get`, and `memory://` artifact-preview behavior as no-behavior-change compatibility.
5. Decision includes follow-on implementation guidance for a no-behavior-change provider-interface story, plus explicit deferrals for backend selection, semantic retrieval, connector ingestion, and hosted deployment.

## Review Focus
- Confirm the interface is concrete enough for TypeScript implementation and tests.
- Confirm it does not smuggle in a specific backend or remote service choice.
- Confirm it leaves namespace/provenance and local-cache boundary decisions to their dedicated stories without blocking provider-interface implementation.

## Next Step
- Architecture QA should review ADR 0020 against the acceptance criteria, then move this story to done or return it to active with specific required changes.

## Intake Promotion Checklist
- [x] Decision scope is explicit and bounded.
- [x] Problem statement explains why the decision is needed now.
- [x] Inputs are listed and available.
- [x] Outputs are concrete and reviewable.
- [x] Alternatives and operational impact are explicit.
- [x] Follow-on implementation work is split out when needed.

## Architecture Handoff
- `decision_summary`: Added accepted ADR 0020, defining a backend-neutral `DurableMemoryProvider` interface with request/response shapes for write, propose, get, search, list, archive, delete, snapshot creation/listing, and snapshot restore. The decision recommends adding the interfaces under `packages/core/src/memory/durable-provider.ts` as additive contracts while preserving existing diagnostic memory behavior.
- `alternatives_considered`: Kept the provider contract only in prose; added backend-specific local/remote interfaces first; reused current `MemoryManager`; accepted one backend-neutral provider interface with adapters behind it.
- `operational_impact`: Future providers can be swapped without rewriting agent/runtime contracts. Existing `/api/v1/memory/search`, `/api/v1/memory/get`, and `memory://` artifact previews remain no-behavior-change compatibility surfaces until a dedicated migration story changes them.
- `follow_on_work`: Implement the provider interface types additively with type-focused validation; then refine `2026.34.03 Namespace And Provenance Model`, `2026.34.04 Local Cache Boundary`, and `2026.34.05 Remote Backend Recommendation` before remote memory MVP work.

## QA Verdict
- `verdict`: Pass. ADR 0020 satisfies the provider-interface acceptance criteria and keeps runtime behavior unchanged.
- `evidence_quality`: Good. QA checked the ADR for all ADR 0019 operations, concrete TypeScript request/response shapes, additive package placement, compatibility with current diagnostic memory search and artifact preview behavior, explicit namespace/provenance deferrals, workflow validation, and `git diff --check`.
- `defects`: None found.
- `state_transition`: Move to done.

## Transition History
- `2026-06-02T15:02:45Z`: `intake` -> `active`; next durable memory architecture story refined and ready
- `2026-06-02T15:14:06Z`: `active` -> `qa`; durable memory provider-interface ADR ready for architecture QA
- `2026-06-02T15:14:55Z`: `qa` -> `done`; QA passed durable memory provider-interface ADR
