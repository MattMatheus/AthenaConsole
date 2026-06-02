<!-- AUDIENCE: Internal/Technical -->

# ADR 0024: Semantic Memory Retrieval And Sync Strategy

## Status

Accepted.

## Context

ADR 0019 defines durable memory as a first-class Team Orchestrator domain with a remote-capable source of truth. ADR 0020 defines the durable memory provider interface. ADR 0021 defines namespace and provenance rules. ADR 0022 defines the local cache boundary. ADR 0023 selects internal Team Orchestrator server mode as the first remote backend posture.

The `2026.35` remote memory MVP and `2026.36` memory governance work established durable-memory storage, API routes, remote provider client behavior, readiness/config visibility, manifest permissions, runtime context, usage events, proposal review, artifact promotion, and memory-aware run detail.

The next durable-memory epic, `2026.37 Semantic Memory And Sync Backends`, adds semantic retrieval, hybrid ranking, optional backend adapters, local cache synchronization, reindex/backfill behavior, and retrieval diagnostics.

The architecture risk is that vector, sync, or external memory backend concepts could leak into the Team Orchestrator memory model. Operators and agents should continue to use durable memory through the canonical memory contract, while providers and indexes remain replaceable implementation details.

## Decision

Add semantic retrieval and sync capabilities as additive layers behind the canonical durable memory service.

The canonical Team Orchestrator memory service owns:

- namespace/provenance validation,
- authorization and manifest permission checks,
- embedding/index lifecycle state exposed to operators,
- hybrid retrieval request/response semantics,
- local cache status and degraded-read behavior,
- retrieval diagnostics shape,
- event/audit emission,
- provider conformance expectations.

Provider adapters own backend-specific mechanics:

- vector storage/upsert/delete,
- backend search/filter translation,
- backend capability reporting,
- backend request/retry/failure behavior,
- provider-specific health details.

The product API must not expose Chroma, AthenaMemory, vector ids, embedding collection names, or backend-specific filtering as the user-facing memory model. Those details may appear in internal provider metadata or diagnostic evidence when useful for engineering support, but operator-facing durable memory remains scoped records, provenance, retrieval explanations, cache status, and provider readiness.

## Embedding Lifecycle

Durable memory records may have an embedding/index lifecycle, but canonical memory content remains valid even when no semantic index exists.

The service should represent lifecycle state separately from record existence:

- `not-indexed`: record has no semantic index entry,
- `queued`: record is scheduled for embedding/index work,
- `indexed`: record has a current semantic index entry,
- `stale`: record content, metadata, namespace, provenance, sensitivity, or embedding model requirements changed after indexing,
- `failed`: indexing failed and requires retry or operator-visible investigation,
- `unsupported`: selected provider mode does not support semantic indexing.

Embedding metadata should include:

- embedding provider id or configured provider key,
- model name and version when available,
- vector/index backend kind,
- index revision or fingerprint,
- indexed timestamp,
- failure code/reason safe for operator display,
- reindex reason when stale or queued.

Do not put raw vectors in API responses, events, artifacts, or operator UI. Do not infer a default external embedding provider from semantic retrieval being enabled. Embedding provider configuration must be explicit, and data egress risk must be visible through readiness/config diagnostics.

## Hybrid Retrieval Contract

Memory search should support a hybrid retrieval mode that combines:

- keyword/full-text match,
- semantic similarity when available,
- namespace and metadata filters,
- sensitivity/authorization filtering,
- recency,
- provenance and source-kind signals,
- archived/deleted state,
- cache freshness/degraded-read status.

Hybrid retrieval should preserve the existing durable-memory operation shape. Agents and operators should not need backend-specific query syntax to use semantic retrieval.

Search requests may specify retrieval intent such as:

- `keyword`,
- `semantic`,
- `hybrid`,
- `auto`.

`auto` may use semantic retrieval only when provider capability, embedding lifecycle state, authorization, and request policy allow it. Otherwise it should degrade to keyword/filter retrieval and report the degradation reason.

Search results should include enough normalized explanation metadata for diagnostics:

- result source signals used,
- normalized score bands or score components,
- matched fields/snippet,
- applied filters,
- omitted-result categories when available,
- provider capability/degradation status,
- cache freshness status.

The service should normalize result shape. Provider-specific score scales must not be treated as comparable without service-level normalization.

## Provider Adapter Conformance

Semantic or sync-capable providers must pass conformance tests for the canonical memory contract rather than only backend-specific happy paths.

Minimum conformance expectations:

1. Preserve namespace, provenance, sensitivity, retention, archive/delete, and provider revision metadata.
2. Support search by canonical filters or report unsupported filters explicitly.
3. Report capability flags for keyword search, semantic search, hybrid search, local cache support, snapshots, archive/delete, and degraded/offline behavior.
4. Report backend failure and unsupported-operation states without throwing away canonical memory records.
5. Keep provider metadata optional and bounded so API/console callers can ignore it safely.
6. Avoid storing connector secrets, provider credentials, raw transcript bodies, or raw artifact payloads in vector/index storage.

Provider adapters may be implemented as:

- authoritative durable-memory providers,
- semantic index adapters attached to the authoritative provider,
- import/sync sources,
- local development/test providers.

The selected mode must be explicit in readiness/config status.

## Chroma Posture

Chroma is the preferred near-term semantic index proving ground for `2026.37` if it satisfies local/server deployment, metadata filtering, and operational visibility needs.

Chroma should be treated first as an optional semantic index adapter behind Team Orchestrator durable memory, not as the canonical record store. Chroma can store vectors and bounded searchable metadata needed for retrieval, but canonical record content, namespace/provenance rules, governance, proposals, archive/delete, snapshots, and events remain owned by Team Orchestrator durable memory services unless a later ADR changes that posture.

Chroma implementation must include:

- local/server configuration and readiness reporting,
- conformance fixtures for filters, archive/delete propagation, stale index state, and provider unavailability,
- manual smoke instructions using a local or containerized Chroma instance,
- fallback behavior when Chroma is unavailable.

## AthenaMemory Posture

AthenaMemory compatibility remains exploratory until an evidence-backed evaluation maps its concepts to the Team Orchestrator memory contract.

The evaluation should decide whether AthenaMemory is:

- an adapter-supported backend,
- an import or sync source,
- a conceptual reference for episodes, snapshots, or governed mutation,
- out of scope for the current product.

The evaluation must not rewrite Team Orchestrator's canonical durable-memory model around AthenaMemory concepts. If AthenaMemory has richer domain concepts, they should map through provider metadata, import transforms, or explicit follow-on ADRs.

## Local Cache Sync

ADR 0022 remains the cache boundary. This ADR narrows the sync behavior needed for semantic and remote retrieval.

Cache/sync implementation should support:

- startup refresh for configured namespaces,
- operator-triggered refresh,
- refresh after successful provider mutations,
- invalidation after provider config changes, namespace permission changes, snapshot restore, archive/delete, detected revision mismatch, or index model changes,
- stale/degraded labels in API and console responses,
- safe cache clear without deleting provider records,
- refresh/reindex separation so semantic index repair does not masquerade as authoritative memory sync.

Remote-provider degraded behavior:

- Reads may use fresh-enough cache only when request policy allows cached results.
- Stale cache results must be labelled as stale or degraded.
- Writes should default to proposal/queued-intent only for low-risk operations and only after current authorization can be revalidated on replay.
- Archive/delete/snapshot restore should fail fast or require operator review while remote authority is unavailable.

Do not implement broad offline mutation/conflict resolution as part of the first semantic/sync epic. Treat it as future work unless PM explicitly promotes a narrower follow-up story.

## Retrieval Diagnostics

Retrieval diagnostics are required for operator trust. The product should explain why memory was selected, filtered, omitted, or degraded without exposing raw backend internals as the memory model.

Diagnostics should support:

- selected result explanations,
- filter application summaries,
- omitted categories such as unauthorized, archived, namespace-mismatch, not-indexed, stale-index, provider-unavailable, sensitivity-filtered, and unsupported-filter,
- retrieval mode used,
- fallback/degradation reason,
- cache status,
- provider capability summary,
- trace/request id for support correlation.

Diagnostics must not include raw vectors, connector secrets, provider credentials, raw transcript bodies, raw artifact payloads, or full memory bodies in events. Console diagnostics may show bounded snippets already available through authorized memory results.

## Reindex And Backfill

Reindex/backfill tools should be explicit maintenance operations.

They should support:

- namespace-bounded reindex,
- model/provider revision reindex,
- stale-index discovery,
- failed-index retry,
- dry-run summary,
- progress/status events,
- safe cancellation,
- operator-visible completion/failure evidence.

Reindexing changes index state, not canonical memory provenance. If reindexing changes a search result order, diagnostics should be able to show that the index/model revision changed.

## Implementation Sequence

Recommended `2026.37` sequence:

1. Embedding lifecycle: add lifecycle/status/model metadata, stale markers, failure states, and reindex markers.
2. Hybrid retrieval: add normalized retrieval modes, fallback behavior, scoring/explanation metadata, and quality fixtures.
3. Local cache sync: implement refresh/invalidation/degraded-read behavior needed for remote and semantic retrieval.
4. Chroma adapter: add optional semantic index adapter with conformance tests and local/server readiness.
5. AthenaMemory adapter evaluation: decide adapter/import/reference posture using a contract comparison matrix.
6. Retrieval diagnostics: expose operator-facing explanations in API/console once retrieval metadata is stable.

PM may swap local cache sync and Chroma adapter if implementation evidence shows cache semantics depend on adapter behavior, but diagnostics should remain after hybrid retrieval metadata is stable.

## Alternatives Considered

### Chroma As Canonical Durable Memory Store

Rejected for the current epic. Chroma is useful for semantic retrieval, but canonical memory also needs namespace/provenance governance, proposals, snapshots, archive/delete, audit events, local cache posture, and provider replacement flexibility.

### Semantic-Only Retrieval

Rejected. Keyword, metadata filters, recency, provenance, and authorization remain important. Semantic similarity alone is not explainable enough for governed memory.

### Keyword-Only Until Hosted Backend Exists

Rejected. This avoids privacy and ranking complexity, but it delays the core `2026.37` value and prevents local/server semantic adapter learning.

### Expose Backend Query Syntax To Agents

Rejected. It would leak backend concepts into plugin and agent behavior, making future provider changes harder and weakening the canonical memory contract.

### Treat AthenaMemory As The Product Model

Rejected for now. AthenaMemory may become an adapter, import source, or conceptual reference, but Team Orchestrator's durable-memory model remains canonical.

### Canonical Service With Optional Semantic Index Adapters

Accepted. This preserves product consistency, allows Chroma or other vector backends to prove value, keeps governance in Team Orchestrator, and supports future backend changes.

## Consequences

Semantic retrieval can improve memory quality without changing the agent-facing durable-memory API.

Engineering must add conformance tests for provider capability, unsupported filters, fallback behavior, stale index state, and retrieval diagnostics before treating a semantic adapter as production-ready.

Operator-facing status needs to include both provider/cache freshness and semantic index state. A memory record can be durable and current while its semantic index is missing, stale, failed, or unsupported.

Embedding provider choices become part of readiness/config review because memory bodies may leave the local environment when external embedding providers are configured.

Local cache sync remains bounded. Broad offline mutation and multi-writer conflict resolution are still deferred.

## Follow-On Work

Refine and execute the `2026.37` engineering sequence:

1. `STORY-20260602-memory-embedding-lifecycle`
2. `STORY-20260602-memory-hybrid-retrieval`
3. `STORY-20260602-memory-local-cache-sync`
4. `STORY-20260602-memory-chroma-adapter`
5. `STORY-20260602-memory-athena-adapter-evaluation`
6. `STORY-20260602-memory-retrieval-diagnostics`

If the AthenaMemory evaluation recommends adapter support, create a separate implementation story with conformance tests and clear boundaries.

If Chroma cannot satisfy filtering, deployment, or readiness expectations, PM should pause the adapter story and substitute a narrower semantic-index spike or alternative backend evaluation.

## Validation

Architecture QA should confirm that this ADR:

- identifies canonical service, provider adapter, cache, and console diagnostics boundaries,
- preserves ADR 0019 through ADR 0023,
- keeps Chroma and AthenaMemory behind the durable-memory contract,
- defines embedding lifecycle, hybrid retrieval, cache sync, diagnostics, and reindex/backfill expectations,
- includes privacy/safety constraints for embedding provider configuration and memory data egress,
- gives PM a concrete engineering sequence for `2026.37`.
