<!-- AUDIENCE: Internal/Technical -->

# ProjectAthena Implementation Plan

## Current Progress Snapshot

- Completed: Stage 0 through Stage 8 (in progress).
- Current focus: Stage 8 implementation kickoff (Phase 2 API bootstrap baseline complete; Phase 3 CLI-as-API-client migration next).
- Source-of-truth status docs:
  - `AGENTS.md`
  - `planning/README.md`
  - `planning/archive/stages/stage-7.md`
- Personas baseline:
  - Repo-local persona definitions under `personas/`.
  - `athena persona run --name <persona>` entrypoint.
  - Persona run artifacts persisted under `.athena/persona-runs/<runId>/`.

## Scope And Guardrails

- Goal: Re-implement the core OpenClaw runtime logic as a standalone tool.
- Interface: CLI-first.
- Integrations allowed:
  - Model providers (local and remote).
  - System scheduling (cron or OS scheduler).
  - Local filesystem and local executables/tools.
- Integrations excluded for initial roadmap:
  - Email, chat, social, or messaging platform integrations.
  - Any channel adapter layer (Slack, Telegram, WhatsApp, etc.).
- Distill support: placeholder only for now; full design to follow later.
- Subagents: deferred.

## Architecture Baseline

Core modules:

1. `runtime`
2. `work-management`
3. `memory`
4. `context` (with Distill placeholder hook)
5. `providers`
6. `cli`
7. `schedule`
8. `personas`

Suggested initial layout:

```text
src/
  cli/
  runtime/
  work/
  memory/
  context/
  providers/
  schedule/
  personas/
  tools/
tests/
docs/
personas/
```

## Staged Implementation Todo List

## Stage 0: Foundation And Repo Scaffolding

1. Define architecture doc and non-goals.
2. Define shared contracts:
   - `RunRequest`, `RunResult`
   - `WorkItem`, `WorkQueueState`
   - `SessionRecord`, `TranscriptEntry`
   - `MemoryRecord`, `MemorySearchResult`
3. Create module skeletons and test harness.
4. Set up lint/test/typecheck scripts.
5. Add local config loading (`.env` + config file).

Exit criteria:

- Project builds and tests run.
- Contracts are documented and referenced by all modules.

## Stage 1: CLI-First Runtime (Single Session)

1. Implement `athena run` command.
2. Add session creation/loading and JSONL transcript persistence.
3. Implement turn lifecycle:
   - prepare session
   - assemble prompt/context
   - call provider
   - persist results
4. Add session lock to prevent concurrent transcript corruption.
5. Add structured error classes and baseline retries.

Exit criteria:

- Repeated turns work in one session.
- Restart does not corrupt transcript.

## Stage 2: Provider Abstraction Layer

1. Define `ProviderAdapter` interface:
   - `generate`
   - optional streaming
   - token accounting hooks
2. Implement at least:
   - one remote provider adapter
   - one local provider adapter (or local-compatible adapter path)
3. Add provider selection and fallback policy:
   - ordered provider/model list
   - retry on recoverable provider errors
4. Persist provider/model metadata per turn.

Exit criteria:

- Runtime can switch providers via config.
- Provider failures can fall back without session loss.

## Stage 3: Work Management System

1. Implement per-session queue with persisted state.
2. Implement initial modes:
   - `followup`
   - `collect`
3. Add dedupe and drop policies.
4. Add drain scheduler with re-entrancy protection.
5. Add crash/restart recovery for pending queue items.

Exit criteria:

- Queued work survives restart and drains correctly.
- No concurrent runs in the same session lane.

## Stage 4: Memory System (Core)

1. Plane A: session history management:
   - truncation and sanitation
   - pairing validation for tool call/result entries
2. Plane B: retrievable memory:
   - index local markdown + optional transcripts
   - `memory_search` and `memory_get`
3. Implement SQLite + FTS baseline.
4. Add source citations and injection budget constraints.

Exit criteria:

- Search and get return bounded, cited snippets.
- History pipeline is deterministic and test-covered.

## Stage 5: Context Management And Distill Placeholder

1. Add `ContextCompiler` abstraction with strategies:
   - `raw`
   - `summary`
   - `distill` (placeholder only)
2. Wire context budget pipeline before provider call.
3. Add overflow recovery sequence:
   - compact/summarize
   - truncate oversized tool outputs
   - retry with bounded attempts
4. Persist context-compaction metadata for observability.

Exit criteria:

- Context overflow handling is stable.
- Distill integration point exists but may be a no-op placeholder.

## Stage 6: System Scheduling Integration

1. Implement local scheduled task runner interface.
2. Add cron/OS scheduler compatibility commands.
3. Add scheduled run registration and run logs.
4. Add guardrails for overlapping schedule executions.

Exit criteria:

- Scheduled runs execute through same runtime pipeline.
- Scheduling is local/system-based only.

## Stage 7: Reliability And Hardening

1. Add atomic file write strategy for state files.
2. Add timeout/abort controls for active runs.
3. Add observability:
   - queue depth
   - turn latency
   - retries/fallbacks
   - compaction counts
4. Add migration/versioning for persisted state.
5. Add end-to-end tests across restart/crash scenarios.

Exit criteria:

- Recovery behavior is predictable across failures.
- Core flows are covered by integration tests.

## Stage 8: Control-Plane API-First Unification (In Progress)

1. Contracts and boundaries:
   - control-plane interfaces
   - backend/state abstractions
   - API contract registry and error/query semantics
2. Service-layer extraction:
   - CLI command logic routed through control-plane services
   - behavior parity with existing reliability/locking semantics
3. Admin API server:
   - `athena api serve`
   - `/api/v1` route bootstrap and request validation
   - envelope and correlation-id conventions
4. CLI as API client:
   - HTTP transport implemented with `local|api|auto` selection
   - `run/cancel`, `work`, `schedule`, `memory`, and `persona run` migrated
   - temporary local fallback kept for test/migration safety
   - parity assertions added for stable JSON surfaces
5. Operational maturity:
   - schema-level DTO validation + machine-readable API artifact generation
   - telemetry/event retention and rotation controls
   - implemented local event-ledger pruning controls (`ATHENA_EVENTS_MAX_RECORDS`, `ATHENA_EVENTS_MAX_AGE_MS`, `ATHENA_EVENTS_MAX_BYTES`)
   - added bounded event history query route (`GET /api/v1/events`) for control-plane telemetry reads
   - implemented versioned persisted policy state at `.athena/policy/policy.json` with legacy migration support
   - enforced policy centrally in control-plane services (concurrency gate + default timeout controls)
   - expanded local fleet summary read-model fields for control-plane/API consumers
   - decomposed API server route flow into route-family handlers while preserving v1 behavior
   - hardened policy concurrency with serialized lease reservations for cross-process `maxConcurrentRuns` safety
   - introduced capability-gated fleet metrics provider scaffolding (`local` + future `k8s` adapter path)
   - added explicit policy-concurrency rejection observability:
     - persisted rejection ledger under `.athena/policy/rejections/events.jsonl`
     - explicit `policy.concurrency.rejected` events emitted on rejected runs
     - bounded operator query surface via `GET /api/v1/policy/rejections`
   - implemented provider-backed `k8s` fleet metrics and capability mapping through `ExecutionBackend.getFleetMetrics()`
   - evolved API dispatch into an explicit route-family matcher table with deterministic precedence tests
   - added explicit cancellation-control read surfaces for active CLI/API runs:
     - `GET /api/v1/runs/active`
     - `GET /api/v1/runs/cancel-requests`
   - wired cancellation-control reads through control-plane/backend boundaries (`RunService` -> `ExecutionBackend` -> `RuntimeCancellationStore`)
   - hardened run-control read models toward timeline-grade auditability:
     - run-scoped correlation fields (`runId`, `traceId`, `startedAt`) added to active/cancellation records
     - keyset cursor pagination introduced for churn-stable reads (legacy offset cursor compatibility preserved)
     - optional `runId` filtering added to run-control query surfaces
   - switched policy write timestamp ownership to server-authored `updatedAt` semantics while preserving backward-compatible policy `PUT` payload handling
   - completed post-slice regression hardening for API/client parity:
     - optional list cursors omitted when absent (schema-safe envelopes)
     - API parity helper server lifecycle race fixed
     - schedule tick vs delete response validator collision fixed
   - policy/fleet hardening for future `k8s` backend parity

Exit criteria:

- Existing CLI capabilities are executable via API-backed command paths with parity.
- API v1 contracts are documented and test-covered.
- Shared domain logic remains centralized in control-plane services.
- Local persistence compatibility and schema migrations remain intact.

## Deferred Tracks

1. Subagents orchestration and policy gates.
2. Distill full implementation (beyond placeholder hook).
3. Non-core integrations (email/chat/channel connectors).
4. Persona operational maturity track (curated context packs, review schema evolution, import snapshots).
5. Learned memory writeback for persona behavior (explicitly deferred in favor of curated, versioned persona context).

## Immediate Next Implementation Steps

1. Continue incremental router decomposition cleanup (shared matcher table + slimmer handler context plumbing).
2. Expand telemetry/event retention controls beyond events ledger to additional artifacts and retention lifecycles.
3. Expand telemetry read models and bounded historical query surfaces.
4. Expand operational docs for retention policy, policy migration lifecycle, and troubleshooting.
5. Add explicit policy/fleet API and CLI parity snapshots for stable operator JSON surfaces.
6. Flesh out provider-backed (`k8s`) fleet metrics adapters beyond scaffold counters/capabilities.
