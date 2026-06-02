---
kind: architecture_story
id: ARCH-20260602-memory-namespace-provenance
status: done
owner_role: architect
source: planning
decision_owner: architect
success_metric: Durable memory namespace and provenance rules are specific enough to prevent cross-scope leakage and guide provider-interface implementation.
ready: true
---

# Architecture Story: Durable Memory Namespace And Provenance Model

## Metadata
- `id`: ARCH-20260602-memory-namespace-provenance
- `owner_role`: architect
- `status`: done
- `source`: planning
- `decision_refs`: [ADR-0019, ADR-0020, docs/product/epics/refinement/2026.34.00-epic-durable-memory-service-architecture.md]
- `decision_owner`: architect
- `success_metric`: Durable memory namespace and provenance rules are specific enough to prevent cross-scope leakage and guide provider-interface implementation.

## Decision Scope
- Define how durable memory records attach to account/operator, workspace, project, repository, team, agent, task, run, and artifact scopes.
- Define minimum provenance fields for operator-created, agent-created, task-run-derived, workflow-run-derived, artifact-derived, imported, and connector-derived memory.
- Define cross-scope read/write rules and leak-prevention defaults.
- Define audit/event correlation requirements for accepted writes, proposals, archives, deletes, and snapshot restores.

## Problem Statement
- ADR 0019 accepts durable memory as scoped product knowledge, and ADR 0020 adds namespace/provenance placeholders to the provider interface.
- The provider-interface implementation can add types, but memory-aware agents and future remote memory services need clearer namespace and provenance semantics before writes or cross-scope reads become product behavior.
- Without explicit namespace rules, memory could leak private repository or workspace context into unrelated tasks, teams, or operators.

## Inputs
- Existing decisions:
  - `docs/product/architecture/decisions/0019-durable-memory-domain-architecture.md`
  - `docs/product/architecture/decisions/0020-durable-memory-provider-interface.md`
  - `docs/product/architecture/decisions/0007-agent-manifest-and-lifecycle-contract.md`
  - `docs/product/architecture/decisions/0009-task-mission-run-domain-model.md`
  - `docs/product/architecture/decisions/0012-event-artifact-observability-model.md`
  - `docs/product/architecture/decisions/0013-safety-approval-and-loop-limit-model.md`
  - `docs/product/architecture/decisions/0015-canonical-orchestration-state-model.md`
- Existing architecture artifacts:
  - `docs/product/architecture/state-ownership-map.md`
  - `docs/product/direction/current-direction.md`
  - `docs/product/epics/refinement/2026.34.00-epic-durable-memory-service-architecture.md`
- Constraints:
  - Do not implement namespace enforcement in this story.
  - Do not change current diagnostic memory routes or artifact preview behavior.
  - Do not decide local-cache behavior; that is `2026.34.04`.
  - Do not choose the remote backend; that is `2026.34.05`.

## Outputs Required
- Decision updates:
  - New architecture record for durable memory namespace and provenance semantics.
- Architecture artifacts:
  - Update architecture index and current direction if the decision is accepted.
- Risks and tradeoffs:
  - Cross-scope leakage risk.
  - Granularity of namespace hierarchy.
  - Required versus optional provenance fields.
  - Audit/event volume and operator inspectability.

## Alternatives Considered
- Use flat namespace strings only.
- Require repository scope for all memory.
- Treat run/artifact provenance as optional metadata.
- Define hierarchical namespace references with required provenance by source kind.

## Operational Impact
- Agents will eventually need explicit permissions and runtime context before memory reads/writes.
- Operators should be able to inspect why a memory exists and which task/run/artifact/operator action produced it.
- Future APIs should default to narrow scopes and require explicit widening for cross-repository, cross-project, or team-level memory.

## Acceptance Criteria
1. Decision defines namespace scopes, hierarchy rules, and default read/write boundaries for account/operator, workspace, project, repository, team, agent, task, run, and artifact scopes.
2. Decision defines required provenance fields by source kind and explains how provenance maps to task/run/artifact/plugin/operator records.
3. Decision defines leak-prevention defaults for cross-scope reads, proposals, writes, archive/delete, and snapshot restore.
4. Decision defines audit/event correlation requirements for memory mutations and proposals.
5. Decision explains which provider-interface fields are now stable and which implementation details remain deferred to local-cache and backend-recommendation stories.

## Review Focus
- Confirm the model is specific enough to guide provider-interface implementation and future memory-aware agents.
- Confirm defaults prevent accidental context leakage across repositories, workspaces, teams, and operators.
- Confirm the model fits current task, workflow run, artifact, plugin, provider, and authorization records.

## Next Step
- Architecture QA should review ADR 0021 against the acceptance criteria, then move this story to done or return it to active with specific required changes.

## Intake Promotion Checklist
- [x] Decision scope is explicit and bounded.
- [x] Problem statement explains why the decision is needed now.
- [x] Inputs are listed and available.
- [x] Outputs are concrete and reviewable.
- [x] Alternatives and operational impact are explicit.
- [x] Follow-on implementation work is split out when needed.

## Architecture Handoff
- `decision_summary`: Added accepted ADR 0021, defining durable memory namespace scopes, hierarchy rules, narrow default read/write boundaries, required provenance by source kind, mutation event requirements, proposal/promotion rules, and archive/delete/snapshot restore defaults.
- `alternatives_considered`: Flat namespace strings only; repository scope for all memory; optional run/artifact provenance; accepted hierarchical namespace references with required provenance.
- `operational_impact`: Future memory-aware agents should only read/write scopes explicitly granted by task/run context and manifest permissions. Operators should be able to inspect memory source, scope, reason, actor, and task/run/artifact correlation without exposing memory body in events.
- `follow_on_work`: Implement provider-interface types with namespace/provenance validation helpers, then refine `2026.34.04 Local Cache Boundary` and `2026.34.05 Remote Backend Recommendation` before memory-aware agent permissions, proposal UI, or durable memory APIs.

## QA Verdict
- `verdict`: Pass. ADR 0021 satisfies the namespace/provenance acceptance criteria and keeps local-cache, backend, API, and runtime enforcement details out of scope.
- `evidence_quality`: Good. QA checked namespace scopes, hierarchy rules, default read/write boundaries, required provenance by source kind, proposal/promotion handling, archive/delete/snapshot restore defaults, provider-interface relationship, Flywheel workflow validation, and whitespace checks.
- `defects`: None found.
- `state_transition`: Move to `done`.

## Transition History
- `2026-06-02T15:18:24Z`: `intake` -> `active`; next durable memory architecture story refined and ready
- `2026-06-02T15:20:10Z`: `active` -> `qa`; durable memory namespace/provenance ADR ready for architecture QA
- `2026-06-02T15:21:45Z`: `qa` -> `done`; QA passed durable memory namespace/provenance ADR
