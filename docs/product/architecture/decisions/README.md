<!-- AUDIENCE: Internal/Technical -->

# Architecture

Architecture notes and decisions for Team Orchestrator.

## Canonical History Rule

This directory is the primary long-term record for product decision history.

- Keep decisions here when they establish or revise product direction, architecture, ownership, or invariants.
- Prefer linking epics and stories back to the relevant ADRs instead of duplicating decision rationale in later implementation docs.
- If an implementation file is only preserving old reasoning, summarize the outcome in the relevant ADR and remove the superseded implementation detail.

## Current Direction

- [ADR 0006: Team Orchestrator Direction and Formal Agent Model](0006-team-orchestrator-direction-and-agent-model.md)

## Reset ADRs

- [ADR 0007: Agent Manifest and Lifecycle Contract](0007-agent-manifest-and-lifecycle-contract.md) - Accepted
- [ADR 0008: Plugin Package Format](0008-plugin-package-format.md) - Accepted
- [ADR 0009: Task, Mission, and Run Domain Model](0009-task-mission-run-domain-model.md) - Accepted
- [ADR 0010: SQLite App-State Architecture](0010-sqlite-app-state-architecture.md) - Accepted
- [ADR 0011: Runtime Backend Interface](0011-runtime-backend-interface.md) - Accepted
- [ADR 0012: Event and Artifact Observability Model](0012-event-artifact-observability-model.md) - Accepted
- [ADR 0013: Safety, Approval, and Loop Limit Model](0013-safety-approval-and-loop-limit-model.md) - Accepted
- [ADR 0014: Scheduling Model](0014-scheduling-model.md) - Accepted
- [ADR 0015: Canonical Orchestration State Model](0015-canonical-orchestration-state-model.md) - Accepted
- [ADR 0016: Core Service Decomposition Plan](0016-core-service-decomposition-plan.md) - Accepted
- [ADR 0017: Repo Wiring Operating Model](0017-repo-wiring-operating-model.md) - Accepted
- [ADR 0018: Real Work Enablement Operating Model](0018-real-work-enablement-operating-model.md) - Accepted
- [ADR 0019: Durable Memory Domain Architecture](0019-durable-memory-domain-architecture.md) - Accepted
- [ADR 0020: Durable Memory Provider Interface](0020-durable-memory-provider-interface.md) - Accepted
- [ADR 0021: Durable Memory Namespace And Provenance Model](0021-durable-memory-namespace-and-provenance-model.md) - Accepted
- [ADR 0022: Durable Memory Local Cache Boundary](0022-durable-memory-local-cache-boundary.md) - Accepted
- [ADR 0023: Durable Memory Remote Backend Recommendation](0023-durable-memory-remote-backend-recommendation.md) - Accepted
- [ADR 0024: Semantic Memory Retrieval And Sync Strategy](0024-semantic-memory-retrieval-and-sync-strategy.md) - Accepted
- [ADR 0026: Formal Agent Manifest Convention For The Agentic Workbench Pilot](0026-formal-agent-manifest-convention.md) - Accepted

## Archived Records

Pre-reset architecture notes, Foundry-first records, ProjectAthena docs-ingestion contracts, and older UI/RBAC design records were retired during the docs consolidation. The accepted ADRs above are the canonical decision record.
