<!-- AUDIENCE: Internal/Technical -->

# ADR 0019: Durable Memory Domain Architecture

## Status

Accepted.

## Context

Team Orchestrator `2026.1` shipped a local-first baseline with SQLite app-state for operator-facing control-plane records, file-backed artifact payloads, manifest-backed plugins and agents, workflow DAG runs, task runs, readiness diagnostics, and sample plugin-backed agents.

The current memory surface is not a durable product memory system. It is a local diagnostic/search surface:

- `GET /api/v1/memory/search` searches local markdown memory inputs and optional transcript content.
- `POST /api/v1/memory/get` reads bounded line ranges from workspace-local memory markdown files.
- `memory://...` artifact URIs are used for task-run artifact preview content that is selected from run output.

Those surfaces are useful, but they do not solve the post-release product goal: memory should travel when an operator moves between a laptop, local server, and future remote server environments. Copying a local SQLite app-state database between machines is not an acceptable product memory strategy because it couples durable memory to one runtime workspace, risks stale or conflicting state, and blurs app-state ownership with long-lived knowledge.

The future horizon roadmap therefore needs a first architecture decision that defines what durable memory means before provider interfaces, remote service work, agent write permissions, semantic retrieval, or connector ingestion are implemented.

## Decision

Define durable memory as a first-class Team Orchestrator domain with a remote-capable source of truth and local-first ergonomics.

Durable product memory is separate from local SQLite app-state. SQLite may remain useful for development, tests, local cache, offline fallback, and existing diagnostic search behavior, but it is not the cross-machine source of truth for product memory.

Durable memory records are scoped knowledge records that can be attached to operators, workspaces, projects, repositories, agents, tasks, runs, artifacts, and teams. Every durable memory write must carry provenance that explains where the memory came from, which actor or agent proposed or wrote it, and which task/run/artifact/operator action produced it.

The first durable memory implementation should be designed behind a provider contract. The product should support local execution with remote continuity, not remote execution as a requirement.

## Memory Domain

A durable memory record should include:

- stable id
- namespace
- memory type
- title
- body or structured payload
- tags
- source kind
- source uri
- sensitivity
- retention policy
- created and updated timestamps
- provenance linking source agent, task, run, artifact, repository, workspace, and operator action
- optional embedding or index status

Namespaces must be explicit. At minimum, the architecture must be able to represent:

- account or operator
- workspace
- project
- repository
- team
- agent
- task
- run
- artifact

Namespace design is part of the follow-on `2026.34.03` story. Until that is accepted, no implementation should assume that repository path alone is a sufficient memory scope.

## Service Contract

The durable memory service should expose a canonical contract shaped around these operations:

- `writeMemory`
- `proposeMemoryWrite`
- `getMemory`
- `searchMemory`
- `listMemory`
- `archiveMemory`
- `deleteMemory`
- `createSnapshot`
- `listSnapshots`
- `restoreSnapshot`

This ADR accepts the operation set as the product contract, not as final TypeScript signatures. The provider-interface story should define exact request and response shapes after reviewing current task, run, artifact, plugin, provider, and authorization contracts.

## Provider Posture

The provider layer should allow these roles:

- `local-sqlite`: development, tests, local cache, and offline fallback.
- `remote-http`: preferred durable product path.
- `semantic-vector`: optional retrieval backend behind the canonical memory contract.
- `athena-memory-compatible`: optional adapter if AthenaMemory becomes the backing service.

The first implementation does not need all providers. It does need a provider boundary so future backend choices do not leak into agents, task runs, workflow runs, or console API contracts.

## Current Surface Mapping

Existing memory/search routes should be treated as local diagnostic compatibility until a follow-on story maps them into the durable memory contract.

- `/api/v1/memory/search` maps conceptually to `searchMemory`, but its current file/SQLite-FTS behavior is local diagnostic search.
- `/api/v1/memory/get` maps conceptually to `getMemory`, but its current behavior reads workspace-relative markdown files.
- `memory://...` artifact URIs are artifact preview addresses, not durable memory ids.
- Session transcript indexing can inform future search behavior, but transcripts remain file-backed artifacts/support state unless a future ADR changes that ownership.

No current route should be silently redefined as durable remote memory without an explicit migration story and operator-visible behavior change.

## Safety And Permissions

Agents must not gain implicit durable memory write access.

Memory-aware agents should declare memory permissions in their manifests before they read, propose, write, archive, or delete durable memory. Operator review is required for sensitive writes and for any memory write that could leak private repo, workspace, credential-adjacent, or team context across scopes.

The first permission model should distinguish:

- read/search memory
- propose memory write
- write approved memory
- archive/delete memory
- manage snapshots

Every accepted write should produce inspectable provenance and an audit/event trail that can be correlated with task/run/artifact history.

## Local Cache Boundary

Local SQLite can be used as a cache or development backend, but cache records must be treated as replicas or local-only test data unless the selected provider explicitly makes local SQLite the chosen backend for a single-machine development mode.

Local cache behavior should define:

- how records are invalidated or refreshed
- what happens offline
- whether writes queue, fail, or become local-only proposals
- how conflicts are detected
- which data is safe to retain locally

These details are deferred to follow-on architecture and implementation stories.

## Alternatives Considered

### Keep Memory Local-Only In SQLite

This preserves local simplicity, but it fails the product goal of memory continuity across laptop, local server, and remote server environments. It also encourages operators to copy DB files, which risks stale state and scope leakage. Rejected as the durable product strategy.

### Treat Memory As Filesystem Artifacts Only

This keeps memory inspectable and local, but it does not provide durable scoped search, governance, snapshots, provider adapters, or cross-machine continuity. Rejected for product memory, while filesystem artifacts remain valid for payloads and evidence.

### Build A Remote Memory Backend Immediately

This could move quickly but would lock in backend and namespace assumptions before the provider contract, permissions, provenance, and local-cache boundary are understood. Rejected for this story.

### Use An AthenaMemory-Compatible Backend First

This may be a good adapter if the backend is available and aligned, but accepting that dependency now would overfit the product architecture. Deferred to the backend recommendation story.

### Define Provider Contract First, Then Choose Backend

Accepted. This preserves local-first execution, enables remote continuity, and keeps agents/runtime/console code from depending directly on one storage backend.

## Consequences

Team Orchestrator gains a clear post-release memory direction without adding new implementation surface yet.

Future memory work must not use copied app-state DB files as the durable memory product path.

The current local memory search and memory-backed artifact preview surfaces remain useful, but they are explicitly not durable memory.

Provider-interface work can proceed without needing to decide final backend hosting, semantic retrieval, connector ingestion, or multi-tenant deployment.

## Follow-On Work

Refine and execute the remaining `2026.34` architecture sequence:

1. `2026.34.02 Provider Interface` - define TypeScript provider interfaces and request/response shapes without changing product behavior.
2. `2026.34.03 Namespace And Provenance Model` - specify scope ids, provenance fields, permission checks, and audit/event correlation.
3. `2026.34.04 Local Cache Boundary` - decide how current local SQLite/FTS behavior maps to cache, development backend, or legacy diagnostic search.
4. `2026.34.05 Remote Backend Recommendation` - choose the first remote posture: internal server mode, standalone service, AthenaMemory-compatible service, or hosted database-backed service.

Only after those stories are accepted should `2026.35` remote memory MVP implementation be activated.

## Risks

- Remote memory can become too abstract if follow-on provider-interface work does not produce concrete TypeScript contracts.
- Namespace mistakes can leak private context between repositories, workspaces, teams, or operators.
- Premature backend choice can lock in weak retrieval, sync, or governance behavior.
- Local cache behavior can confuse operators if cache records look like authoritative product memory.

## Validation

This ADR should be reviewed against:

- current task, mission, run, event, artifact, plugin, agent, provider, and authorization models
- `docs/product/architecture/state-ownership-map.md`
- `docs/product/roadmap/future-horizon.md`
- `docs/product/epics/2026.34.00-epic-durable-memory-service-architecture.md`

Architecture QA should confirm that this decision is specific enough to start provider-interface refinement and narrow enough to avoid implementing remote memory in the ADR story.
