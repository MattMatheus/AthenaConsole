<!-- AUDIENCE: Internal/Technical -->

# ADR 0022: Durable Memory Local Cache Boundary

## Status

Accepted.

## Context

ADR 0019 makes durable memory a remote-capable product domain and rejects copied SQLite app-state files as the cross-machine memory strategy. ADR 0020 defines the provider interface. ADR 0021 defines namespace and provenance rules.

The current product also has existing local memory-like surfaces:

- `packages/core/src/memory/index.ts` indexes `MEMORY.md`, files under `memory/`, and optionally local transcripts.
- `/api/v1/memory/search` and `/api/v1/memory/get` expose that file/transcript search surface.
- `memory://...` artifact storage URIs are used for memory-backed artifact payload preview, not durable product memory.
- SQLite app-state stores tasks, missions, runs, events, artifacts, repositories, providers, schedules, and workflow state.
- The current local memory index may use SQLite FTS when available, but its source of truth is workspace markdown/transcript files.

These surfaces are useful, but they are not yet the durable memory service described by ADR 0019 through ADR 0021. A boundary is needed before provider implementation so Team Orchestrator can keep local-first ergonomics without accidentally treating diagnostic file search or app-state SQLite as remote durable memory.

## Decision

Separate four local roles:

1. **Durable memory local cache**: a replica/cache of records from the selected durable memory provider.
2. **Local development backend**: a single-machine provider implementation used for development, tests, demos, and offline experimentation.
3. **Legacy diagnostic memory search**: the existing markdown/transcript search exposed by current memory routes.
4. **Memory-backed artifact payloads**: local payload storage/preview for run artifacts whose URI starts with `memory://`.

Do not redefine current `/api/v1/memory/search` or `/api/v1/memory/get` as durable memory provider APIs in this architecture cycle. Future migration may add new durable-memory API routes, explicit versioned behavior, or compatibility shims, but that migration must be operator-visible and tested.

Local SQLite may be used for durable memory cache and local development backend storage, but the app-state SQLite database remains app state. Copying `.athena/team-orchestrator.sqlite` remains unsupported as a durable memory migration or sync strategy.

## Local Role Matrix

| Role | Source of truth | Allowed storage | Product status | Can write durable memory? |
| --- | --- | --- | --- | --- |
| Durable memory local cache | Selected durable memory provider | Local SQLite/cache files under managed state | Future provider feature | No direct durable write; syncs provider-confirmed mutations and staged proposals. |
| Local development backend | Local provider implementation | Dedicated local SQLite tables/db or test fixture storage | Dev/test/demo mode | Yes, as the selected provider for that single-machine mode. |
| Legacy diagnostic memory search | `MEMORY.md`, `memory/**/*.md`, optional transcripts | File scan or SQLite FTS index | Compatibility/diagnostic surface | No. It can inform proposals only after explicit migration work. |
| Memory-backed artifact payloads | Task/run artifact payload service | Existing memory-backed artifact storage | Artifact preview support | No. Artifact-derived durable memory requires proposal/promotion with provenance. |
| App-state SQLite | Team Orchestrator app-state repositories | `.athena/team-orchestrator.sqlite` | App state | No. It may hold cache metadata only through explicit durable-memory cache tables. |

## Cache Mode Defaults

Durable memory cache mode should behave as a cache of provider state, not an independent authority.

Defaults:

- Cache records must include provider id, provider record id, namespace, provenance summary, version/etag or equivalent revision, sync status, fetched timestamp, and expiration/staleness metadata.
- Reads may use cache when the caller allows cached data and the cache entry is fresh enough for the request.
- Reads that require current data should ask the provider or report that current data is unavailable.
- Cache refresh should be explicit on startup, on operator action, after provider mutation, and when staleness thresholds are crossed.
- Cache invalidation should happen on provider mutation, namespace permission change, provider config change, snapshot restore, archive/delete, or detected revision mismatch.
- Cache entries should be removable without losing durable memory because the provider remains authoritative.
- Cache storage must not include provider credentials, connector secrets, raw transcript bodies, or raw artifact payloads unless a future retention decision explicitly allows them.

## Offline Behavior

Offline behavior depends on selected mode:

- **Remote provider with cache**: read fresh-enough cached records only when the request allows cached results. Mark results as cached/stale when applicable.
- **Remote provider with cache and write request**: default to proposal/queued-intent mode for safe writes and fail fast for archive/delete/snapshot restore until provider connectivity returns.
- **Local development backend**: continue to read and write locally because local storage is the selected provider for that mode.
- **Legacy diagnostic search**: continue to read local markdown/transcript files when memory indexing is enabled.

Offline write intents must include namespace, provenance, operation kind, reason, actor, created timestamp, and provider target. They must be replayed only after revalidation against current provider state and current authorization.

## Queued Writes And Conflicts

Queued writes are allowed only for low-risk write/proposal operations. They are not allowed by default for archive, delete, hard delete, snapshot restore, broad-scope promotion, or sensitive memory writes.

Conflict defaults:

- If provider revision has changed since the queued write was created, do not auto-merge.
- If namespace permissions changed, discard or block the queued write until operator review.
- If a record was archived/deleted remotely, do not recreate it automatically.
- If a provider snapshot was restored, mark affected cached entries stale and require refresh before mutation replay.
- Conflict records should preserve the queued intent and provider evidence for operator review.

## Local Retention

Local cache retention must be conservative:

- Default retention should be bounded by provider policy or local configuration.
- Sensitive records should have shorter retention or no cache retention unless explicitly allowed.
- Operator-visible cache clear should remove cache records and queued intents that are safe to discard.
- Deleting cache records must not delete provider records.
- Local development backend data should be labelled local-dev-only and not treated as remote durable memory after switching providers.

## Current SQLite/FTS Reuse

Reusable:

- SQLite can store cache records, sync metadata, queued intents, and local development backend records.
- SQLite FTS can index cached durable memory snippets or local development backend records when the selected provider mode allows local indexing.
- Current markdown/transcript FTS patterns can inform implementation mechanics.

Not reusable without migration:

- Current `MemoryRecord` and `MemorySearchResult` contracts are too narrow for durable memory because they lack namespace, provenance, sensitivity, provider identity, sync state, and revision metadata.
- Current `/api/v1/memory/search` query semantics are not scoped durable-memory search semantics.
- Current `memory_get` path rules intentionally limit reads to `MEMORY.md` and `memory/**/*.md`; they are not durable memory record retrieval.
- Current transcript indexing is diagnostic support, not durable memory ingestion.

## Operator-Visible Status

Future durable-memory surfaces should distinguish:

- `remote-current`
- `remote-unavailable`
- `cache-current`
- `cache-stale`
- `queued-intent`
- `conflict-review-required`
- `local-dev-only`
- `diagnostic-only`

Status should appear in API responses or console UI before operators are asked to trust memory results as durable shared context.

## Events And Audit

When durable-memory cache behavior is implemented, product services should emit events for:

- `memory.cache.refreshed`
- `memory.cache.invalidated`
- `memory.cache.stale`
- `memory.offline.detected`
- `memory.offline.recovered`
- `memory.write.queued`
- `memory.write.replayed`
- `memory.write.conflict`
- `memory.cache.cleared`

Events should include namespace, provider id, operation kind, sync status, actor id/type when available, reason when supplied, and trace/request id. Events must not include raw memory bodies, raw artifact payloads, transcript bodies, connector secrets, or provider credentials.

## Migration Posture For Current Routes

Current routes remain compatibility routes:

- `/api/v1/memory/search` remains legacy diagnostic markdown/transcript search until a migration story changes it.
- `/api/v1/memory/get` remains legacy diagnostic markdown file retrieval until a migration story changes it.
- Console copy may continue to describe this surface as local context debugging, not durable memory.

Future durable-memory APIs should use explicit durable-memory naming or versioned semantics so operators and plugins can distinguish diagnostic search from provider-backed durable memory.

## Relationship To Provider Interface

ADR 0020 provider operations remain stable. This ADR adds cache expectations above or beside the provider:

- Provider implementations own provider-side reads/writes.
- Cache implementations own local replica state, staleness, sync metadata, and queued intents.
- Services above provider/cache own authorization, namespace selection, provenance validation, event emission, and operator-visible status.

The provider interface implementation can now add local SQLite cache/dev-backend types as additive contracts, but it should not rewrite current memory routes as provider routes in the same implementation story.

## Alternatives Considered

### Treat App-State SQLite As Durable Memory Source Of Truth

Rejected. This would contradict ADR 0019, make cross-machine continuity depend on copying app-state DB files, and blend app-state ownership with memory provider ownership.

### Keep Workspace Markdown Search As Durable Memory

Rejected. Markdown memory files are useful and inspectable, but they lack namespace/provenance, provider identity, sync state, conflict handling, and cross-machine service semantics.

### Disable Local Caching Until Remote Backend Ships

Rejected. This avoids sync complexity but gives up important local-first ergonomics, testability, and offline read support. The better boundary is to allow cache behavior while keeping the provider authoritative.

### Explicit Cache, Dev Backend, And Diagnostic Roles

Accepted. This preserves current behavior, gives provider implementation a clear target, and avoids accidental product promises around copied SQLite/app-state files.

## Consequences

Provider-interface implementation can proceed without changing existing diagnostic routes.

Local SQLite remains useful, but only under explicit role labels: app-state, durable-memory cache, local development backend, or diagnostic FTS index.

Future durable-memory UI/API work must surface whether results are remote-current, cached, stale, local-dev-only, or diagnostic-only.

Remote-backend selection can focus on provider posture because local-cache semantics are now bounded.

## Follow-On Work

1. Refine `2026.34.05 Remote Backend Recommendation`.
2. Implement provider-interface types with namespace/provenance validation helpers and explicit cache/dev-backend contracts.
3. Add local SQLite cache schema only after remote-backend posture and provider implementation scope are accepted.
4. Defer migration of `/api/v1/memory/*` and console memory-search copy until a dedicated compatibility/API story.
5. Defer memory-aware agent permissions, proposal review UI, and durable memory APIs until the remaining durable-memory architecture decisions are accepted.

## Validation

Architecture QA should confirm that this ADR:

- separates cache, local development backend, diagnostic search, artifact payloads, and app-state roles,
- defines invalidation/refresh, offline, queued write, conflict, and retention defaults,
- explains current SQLite/FTS reuse versus diagnostic-only behavior,
- keeps current memory routes and artifact previews compatible,
- avoids choosing the remote backend,
- gives provider implementation enough direction without introducing runtime behavior changes.
