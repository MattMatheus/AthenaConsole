<!-- AUDIENCE: Internal/Technical -->

# AthenaMemory Adapter Evaluation

## Status

Complete.

## Sources Reviewed

- Team Orchestrator durable-memory ADRs 0019 through 0024.
- `docs/product/epics/refinement/2026.37.00-epic-semantic-memory-and-sync-backends.md`
- Public repository: `https://github.com/MattMatheus/AthenaMemory`

## External Source Summary

The reviewed AthenaMemory repository is `MattMatheus/AthenaMemory`, a public Go/Shell repository with the product root described as AthenaMind. The README identifies the current delivery as a local-first memory write and retrieve workflow, governance-aware mutation lifecycle, snapshot lifecycle, episode write-back/retrieval, deterministic crawl ingestion for local docs, and a CLI under `cmd/memory-cli`.

The command surface listed in the README includes `write`, `retrieve`, `evaluate`, `bootstrap`, `verify`, `reindex-all`, `crawl`, `snapshot create/list/restore`, `episode write/list`, `serve-read-gateway`, and `api-retrieve`.

## Contract Comparison Matrix

| Team Orchestrator need | AthenaMemory observed fit | Compatibility | Notes |
| --- | --- | --- | --- |
| Canonical record id/body/type/sensitivity/status | Has local memory write/retrieve workflow and typed writes in CLI examples | Partial | Mapping likely possible, but schema is not yet reviewed deeply enough to treat as a drop-in record store. |
| Namespace hierarchy | Uses memory root/domain style in examples | Weak | Team Orchestrator requires account/operator/workspace/project/repository/team/agent/task/run/artifact namespace references and parent rules. |
| Provenance | Governance-aware mutation lifecycle is present | Partial | Team Orchestrator requires source-kind-specific provenance and audit linkage to tasks, runs, artifacts, agents, connectors, and operators. |
| Proposals/governed mutation | Governance-aware mutation lifecycle is a strong conceptual match | Partial | Could inform proposal/review UX and mutation states, but direct provider compatibility is unproven. |
| Snapshots | Snapshot create/list/restore exists | Strong concept fit | Snapshot concepts are compatible enough to study as reference behavior or import metadata. |
| Episodes | Episode write/list exists | Reference fit | Episodes may map to run-derived or artifact-derived memory proposals, not canonical Team Orchestrator scopes by default. |
| Search/retrieve | Retrieve and API retrieve commands exist | Partial | Retrieval behavior may inform import/sync or evaluation fixtures, but Team Orchestrator hybrid retrieval contract remains canonical. |
| Semantic retrieval/indexing | Reindex command exists; details not established in this pass | Unknown | Do not depend on it for semantic provider support without deeper code-level evaluation. |
| Local cache sync | Local-first root and reindex workflow exist | Reference fit | Not a replacement for ADR 0022 cache authority/degraded-read semantics. |
| Remote source of truth | README emphasizes local-first memory root | Weak for remote provider | Team Orchestrator selected internal server-mode HTTP as first remote posture in ADR 0023. |
| Adapter conformance | No Team Orchestrator contract implementation exists | Not ready | Would need namespace/provenance transform, provider operations, auth, events, snapshots, archive/delete, and conformance tests. |

## Recommendation

Treat AthenaMemory as a **conceptual reference and possible future import/sync source**, not as an adapter-supported backend for the current `2026.37` implementation sequence.

Rationale:

- AthenaMemory has useful adjacent concepts: governance-aware mutation, snapshots, episodes, crawl ingestion, retrieve, and reindex commands.
- The reviewed source does not prove compatibility with Team Orchestrator's canonical namespace hierarchy, provenance requirements, provider interface, remote source-of-truth posture, cache/degraded-read semantics, or audit/event model.
- Adopting AthenaMemory as a backend now would risk rewriting Team Orchestrator's durable-memory product model around an adjacent local-first CLI/domain.
- Chroma is already the better-scoped semantic index proving ground for `2026.37`, while AthenaMemory is better evaluated as an import/sync/reference path after retrieval diagnostics and connector pack priorities are clearer.

## Follow-On Decision

No production AthenaMemory adapter story should be created now.

Explicitly defer adapter implementation until all of the following are true:

1. Team Orchestrator has completed retrieval diagnostics for canonical memory search.
2. A concrete user need exists for importing or syncing AthenaMemory/AthenaMind memory roots.
3. A code-level schema review identifies stable AthenaMemory record, episode, snapshot, governance, and retrieval contracts.
4. PM accepts a narrow import/sync story with conformance tests and no product-model rewrite.

## Potential Future Story

Deferred candidate:

`STORY-YYYYMMDD-athenamemory-import-spike`

Purpose:

- Evaluate importing AthenaMemory memory roots into Team Orchestrator durable-memory proposals with namespace/provenance transforms and dry-run reporting.

Acceptance sketch:

1. Spike maps AthenaMemory records/episodes/snapshots into Team Orchestrator proposal/import shapes without writing directly to broad scopes.
2. Dry-run report identifies incompatible fields and missing provenance.
3. No adapter support is enabled by default.

## Risks

- AthenaMemory naming similarity can create false confidence that schemas are already compatible.
- Episode and snapshot concepts could tempt direct model adoption instead of provenance-preserving import/proposal flows.
- A local-first memory root is not equivalent to Team Orchestrator's remote-capable durable memory source of truth.

## Validation

This evaluation satisfies the active story by:

- mapping observed AthenaMemory concepts against Team Orchestrator records, namespaces, provenance, proposals, snapshots, and search,
- documenting gaps and adapter risks,
- recommending reference/import-source treatment rather than current adapter support,
- explicitly deferring follow-on implementation until a narrower PM-approved import/sync spike is justified.
