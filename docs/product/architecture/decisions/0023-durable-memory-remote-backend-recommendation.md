<!-- AUDIENCE: Internal/Technical -->

# ADR 0023: Durable Memory Remote Backend Recommendation

## Status

Accepted.

## Context

ADR 0019 defines durable memory as a remote-capable Team Orchestrator product domain. ADR 0020 defines a provider interface. ADR 0021 defines namespace and provenance rules. ADR 0022 defines the local-cache boundary.

The next implementation epic, `2026.35 Remote Memory MVP`, needs a first remote posture. The candidates named in the roadmap are:

- internal Team Orchestrator server mode,
- standalone service,
- AthenaMemory-compatible service,
- hosted database-backed service,
- semantic/vector service first.

Current product posture matters:

- Team Orchestrator is local-first and already supports a trusted-LAN local server deployment.
- Public hosted/cloud deployment and multi-tenant billing are outside current core scope.
- Existing `/api/v1/memory/search` and `/api/v1/memory/get` remain legacy diagnostic markdown/transcript routes until explicitly migrated.
- Chroma currently offers local, self-hosted, and cloud retrieval/database options with vector, full-text, metadata-filtered, and multimodal retrieval. That is useful for later semantic retrieval, but it does not need to become the first product source of truth.
- A stable AthenaMemory primary repository was not identified in the current review pass, so AthenaMemory compatibility should remain exploratory.

## Decision

Use **internal Team Orchestrator server mode over HTTP** as the first remote backend posture for durable memory.

The first remote memory MVP should add durable-memory service routes to the Team Orchestrator API/server deployment path and implement the ADR 0020 provider contract behind those routes. The server is the authoritative source of truth for the selected workspace/account memory scope. Local clients may cache records per ADR 0022, but they do not become the authority.

The first storage implementation may use server-owned local storage behind the provider repository boundary, but the product contract is the server API, not a copied database file. Storage details must remain replaceable so future hosted/Postgres/vector/third-party backends can be added without changing the product memory model.

Do not make Chroma, AthenaMemory, or any semantic-memory service the first source of truth for durable memory. Treat them as future adapters or indexes behind the Team Orchestrator provider contract.

## Recommended MVP Shape

### Service Posture

- Add durable-memory routes to the Team Orchestrator API/server process.
- Access memory through the provider interface from ADR 0020.
- Keep the first deployment target aligned with `docker-compose.server.yml` and local server documentation.
- Support laptop-to-local-server continuity before public hosted multi-tenant operation.
- Keep standalone memory service extraction possible but not required for the first MVP.

### Storage Posture

- Store memory records in server-owned storage under the durable-memory service boundary.
- Keep app-state SQLite separate from durable-memory storage ownership.
- If SQLite is used first, use dedicated durable-memory tables/storage and label the mode as single-server/trusted-LAN.
- Design repository/storage adapters so Postgres or another hosted database can replace the initial storage later.
- Do not store semantic/vector index state as the canonical memory record store in the first MVP.

### API Shape

Introduce explicit durable-memory routes instead of reusing current diagnostic routes.

Recommended route family:

- `POST /api/v1/durable-memory/records`
- `GET /api/v1/durable-memory/records/:id`
- `GET /api/v1/durable-memory/records`
- `POST /api/v1/durable-memory/search`
- `POST /api/v1/durable-memory/proposals`
- `POST /api/v1/durable-memory/proposals/:id/approve`
- `POST /api/v1/durable-memory/proposals/:id/reject`
- `POST /api/v1/durable-memory/records/:id/archive`
- `POST /api/v1/durable-memory/records/:id/delete`
- `POST /api/v1/durable-memory/snapshots`
- `POST /api/v1/durable-memory/snapshots/:id/restore`

This avoids silently changing `/api/v1/memory/search` and `/api/v1/memory/get`.

### Auth And Deployment

The first MVP should use trusted-LAN server auth posture:

- Require the existing server token/auth model for API access.
- Bind memory requests to operator/workspace context when available.
- Require explicit namespace selection and authorization before cross-scope reads/writes.
- Keep hosted account/team identity deferred until hosted deployment architecture exists.
- Do not expose unauthenticated memory routes.

### Migration

Current diagnostic memory routes stay compatibility routes.

Migration should be explicit:

- Existing `MEMORY.md` and `memory/**/*.md` content may become import sources or proposal sources in a later migration story.
- Transcript-derived memory must remain proposal/import behavior, not automatic durable memory.
- Existing `memory://` artifact payloads can produce artifact-derived proposals only after provenance-preserving promotion is implemented.

### Observability

The first MVP should emit events for:

- durable-memory record created/updated/archived/deleted,
- proposal created/approved/rejected,
- snapshot created/restored,
- provider request failed/retried,
- cache refreshed/invalidated/stale when cache mode is implemented,
- offline queued write created/replayed/conflicted when offline mode is implemented.

Events must include namespace, source kind, provenance ids, provider id, actor, status, and trace/request id. Events must not include memory body, raw artifact payloads, transcript bodies, connector secrets, or provider credentials.

### Backup And Restore

The first MVP should provide an operator-readable backup/restore posture:

- Server-mode backup includes durable-memory storage plus enough metadata to preserve namespace/provenance/provider identity.
- Snapshot restore is a memory-domain operation, not a raw DB copy instruction.
- Restores must preserve or emit audit events and must not widen namespace scope.
- Local cache clear/restore remains separate from provider restore.

## Why Internal Server Mode First

Internal server mode fits the current product:

- It uses existing Team Orchestrator API and trusted-LAN deployment work.
- It gives laptops and local server installs remote continuity without requiring public hosted infrastructure.
- It keeps authorization, namespace/provenance validation, events, artifacts, tasks, runs, and provider settings inside the current service boundary.
- It lets engineering ship the 2026.35 MVP incrementally with fewer external dependencies.
- It preserves a clean path to standalone service or hosted database later if usage proves the need.

## Alternatives Considered

### Standalone Memory Service First

Deferred. A separate service may become appropriate for hosted or multi-team deployments, but it adds deployment, auth, versioning, health, backup, and operator-support complexity before the first remote MVP proves the domain.

### AthenaMemory-Compatible Service First

Deferred. Compatibility may be valuable later, but no stable primary source was identified in the current review pass, and the Team Orchestrator memory domain should not depend on a third-party or adjacent project's schema before the provider contract is implemented.

### Hosted Database-Backed Service First

Deferred. A hosted database such as Postgres is likely the right direction for public hosted or multi-node operation, but hosted multi-tenant deployment is outside the current core scope. The first implementation should keep storage replaceable and avoid hard-coding hosted assumptions.

### Chroma Or Vector Service First

Deferred. Chroma is well aligned with semantic/vector retrieval and supports local, self-hosted, and cloud modes, but durable memory needs canonical namespace, provenance, governance, mutation, archive/delete, and snapshot behavior before semantic retrieval becomes the center. Chroma can become an index or adapter in `2026.37`.

### Local-Only SQLite First

Rejected. Local-only SQLite does not satisfy remote continuity across laptop, local server, and remote environments. SQLite may still serve development, cache, or trusted single-server storage roles under ADR 0022.

### Internal Team Orchestrator Server Mode

Accepted. This is the smallest remote-capable path that matches current deployment scope while preserving future backend flexibility.

## Implementation Guardrails

- Do not change `/api/v1/memory/search` or `/api/v1/memory/get` in the first provider implementation.
- Do not require Chroma, AthenaMemory, Postgres, or hosted infrastructure for the first MVP.
- Do not expose memory reads/writes without authorization and namespace/provenance validation.
- Do not let app-state SQLite tables become the memory provider contract.
- Do not include memory bodies in events.
- Do not auto-ingest transcripts, artifacts, or markdown memory files into durable memory without operator-visible proposal/import flow.

## Follow-On Work

1. Refine `2026.35 Remote Memory MVP` into engineering stories for durable-memory routes, server-mode provider implementation, storage adapter, validation helpers, events, and smoke tests.
2. Implement ADR 0020 provider-interface types with ADR 0021 namespace/provenance validation helpers and ADR 0022 cache/dev-backend contracts.
3. Add explicit durable-memory API schemas and tests without changing legacy diagnostic memory routes.
4. Add a server-mode storage adapter with clear backup/restore documentation.
5. Defer semantic/vector retrieval, Chroma indexing, AthenaMemory compatibility, hosted database/Postgres, and standalone service extraction to `2026.37` or later architecture stories.

## Validation

Architecture QA should confirm that this ADR:

- selects internal Team Orchestrator server mode as the first remote posture,
- compares the candidate postures from the epic,
- defines minimum API, storage, deployment, auth, migration, observability, backup/restore, and local-cache expectations,
- keeps current memory routes as diagnostic compatibility routes,
- avoids choosing Chroma, AthenaMemory, hosted database, or standalone service as the first dependency,
- gives `2026.35` enough direction to start implementation planning.
