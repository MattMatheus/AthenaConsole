---
kind: architecture_story
id: ARCH-20260602-memory-domain-adr
status: done
owner_role: architect
source: planning
decision_owner: architect
success_metric: Durable memory ADR accepts the product contract, remote-source-of-truth stance, scope boundaries, and follow-on refinement sequence.
ready: true
---

# Architecture Story: Durable Memory Domain ADR

## Metadata
- `id`: ARCH-20260602-memory-domain-adr
- `owner_role`: architect
- `status`: done
- `source`: planning
- `decision_refs`: [docs/product/epics/refinement/2026.34.00-epic-durable-memory-service-architecture.md, docs/product/roadmap/future-horizon.md]
- `decision_owner`: architect
- `success_metric`: Durable memory ADR accepts the product contract, remote-source-of-truth stance, scope boundaries, and follow-on refinement sequence.

## Decision Scope
- Define the first durable memory architecture decision for post-`2026.1` work.
- Accept or revise the product stance that durable memory should be remote-capable and should not rely on copying local SQLite app-state files between machines.
- Establish the memory domain terms, high-level service contract, local-cache boundary, provenance posture, and sequencing assumptions needed before provider-interface implementation.

## Problem Statement
- Team Orchestrator has local memory/search diagnostics, but the product now needs memory that can travel across laptop, local server, and future remote server environments.
- Current SQLite app-state is appropriate for local control-plane state, but it is not a durable cross-machine product memory source of truth.
- Before implementation work starts, the team needs an accepted architecture record that bounds what "memory" means, how it is scoped, what must be proven later, and which implementation stories are deliberately deferred.

## Inputs
- Existing decisions:
  - `docs/product/architecture/decisions/0006-team-orchestrator-direction-and-agent-model.md`
  - `docs/product/architecture/decisions/0009-task-mission-run-domain-model.md`
  - `docs/product/architecture/decisions/0010-sqlite-app-state-architecture.md`
  - `docs/product/architecture/decisions/0012-event-artifact-observability-model.md`
  - `docs/product/architecture/decisions/0013-safety-approval-and-loop-limit-model.md`
  - `docs/product/architecture/decisions/0015-canonical-orchestration-state-model.md`
- Existing architecture artifacts:
  - `docs/product/architecture/state-ownership-map.md`
  - `docs/product/direction/current-direction.md`
  - `docs/product/roadmap/future-horizon.md`
  - `docs/product/epics/refinement/2026.34.00-epic-durable-memory-service-architecture.md`
- Constraints:
  - Do not implement remote memory in this story.
  - Do not make SQLite the cross-machine durable memory source of truth.
  - Preserve local-first ergonomics and explicit operator safety posture.
  - Keep follow-on implementation stories separate from the ADR.

## Outputs Required
- Decision updates:
  - New ADR under `docs/product/architecture/decisions/` for durable memory domain architecture.
- Architecture artifacts:
  - Any needed update to `docs/product/direction/current-direction.md` or `docs/product/roadmap/future-horizon.md` if the ADR changes the sequencing.
- Risks and tradeoffs:
  - Local cache versus remote source of truth.
  - Scope/namespace leakage risk.
  - Backend lock-in risk.
  - Agent permission and provenance requirements.

## Alternatives Considered
- Keep memory local-only in SQLite.
- Treat memory as filesystem artifacts only.
- Build a remote memory backend immediately without an ADR.
- Use an AthenaMemory-compatible backend as the first product source of truth.
- Define a provider contract first, then choose backend later.

## Operational Impact
- Operators should eventually be able to move between local and server environments without copying DB files.
- Agents should eventually declare memory permissions before reading or writing durable memory.
- Local SQLite can remain useful for development, tests, cache, and offline fallback, but must be named honestly.

## Acceptance Criteria
1. ADR accepts a durable memory product contract and explicitly rejects copied SQLite app-state files as the cross-machine memory strategy.
2. ADR defines the memory domain, initial service operations, namespace/provenance requirements, local-cache boundary, and first follow-on work.
3. ADR preserves out-of-scope boundaries for remote service implementation, semantic retrieval, connector ingestion, and hosted multi-tenant deployment.
4. Follow-on Flywheel refinement recommendations are explicit and map to `2026.34.02` through `2026.34.05`.

## Review Focus
- Confirm the ADR is concrete enough to guide provider-interface work without pretending implementation is already decided.
- Confirm the safety/provenance posture matches existing task, run, artifact, plugin, and approval models.
- Confirm the local-first product baseline is preserved while enabling remote continuity.

## Next Step
- Refine `2026.34.02 Provider Interface` as the next durable memory architecture item.

## Intake Promotion Checklist
- [x] Decision scope is explicit and bounded.
- [x] Problem statement explains why the decision is needed now.
- [x] Inputs are listed and available.
- [x] Outputs are concrete and reviewable.
- [x] Alternatives and operational impact are explicit.
- [x] Follow-on implementation work is split out when needed.

## Architecture Handoff
- `decision_summary`: Added accepted ADR 0019, defining durable memory as a first-class remote-capable Team Orchestrator domain with local-first ergonomics, explicit namespace/provenance requirements, a canonical operation set, provider-boundary posture, and a local-cache boundary that rejects copied SQLite app-state DB files as the cross-machine product memory strategy.
- `alternatives_considered`: Kept memory local-only in SQLite; treated memory as filesystem artifacts only; built a remote backend immediately; used an AthenaMemory-compatible backend first; accepted defining a provider contract before choosing a backend.
- `operational_impact`: Operators should eventually be able to move across laptop, local server, and future remote server environments without copying DB files. Agents should declare memory permissions before durable memory reads/writes, and memory writes need inspectable provenance and audit/event correlation.
- `follow_on_work`: Refine `2026.34.02 Provider Interface`, `2026.34.03 Namespace And Provenance Model`, `2026.34.04 Local Cache Boundary`, and `2026.34.05 Remote Backend Recommendation` before activating `2026.35` remote memory MVP implementation.

## QA Verdict
- `verdict`: Pass. ADR 0019 satisfies the acceptance criteria for the durable memory domain decision and keeps implementation out of scope.
- `evidence_quality`: Good. QA checked ADR 0019 against the story criteria, existing SQLite/state ownership/memory-search architecture, current memory route behavior, direction docs, Flywheel workflow validation, and `git diff --check`.
- `defects`: None found.
- `state_transition`: Move to done.

## Transition History
- `2026-06-02T14:54:00Z`: `intake` -> `active`; post-release durable memory architecture refinement starts
- `2026-06-02T14:56:40Z`: `active` -> `qa`; durable memory domain ADR ready for architecture QA
- `2026-06-02T14:57:51Z`: `qa` -> `done`; QA passed durable memory domain ADR
