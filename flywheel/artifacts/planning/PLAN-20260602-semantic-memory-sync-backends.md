<!-- AUDIENCE: Internal/Technical -->

# Planning Note: 2026.37 Semantic Memory And Sync Backends

## Goal

Start the next post-release epic after the completed durable-memory governance sequence by refining `docs/product/epics/refinement/2026.37.00-epic-semantic-memory-and-sync-backends.md` into Flywheel intake work.

## Context

- `2026.35 Remote Memory MVP` is implemented through durable-memory storage, API routes, remote provider client, readiness/config, and console inspector.
- `2026.36 Memory Governance And Agent Integration` is complete across manifest permissions, runtime context, usage events, proposed review, artifact promotion, and memory-aware run detail.
- The active and ready Flywheel lanes are empty, so execution should route through planning and PM refinement rather than inventing active engineering work.
- The next durable-memory roadmap item is `2026.37 Semantic Memory And Sync Backends`.

## Scope Boundary

In scope for this planning pass:

- Create architecture intake for semantic retrieval and backend sync decisions that must be settled before implementation.
- Create engineering intake stories for embedding lifecycle, hybrid retrieval, Chroma adapter, AthenaMemory adapter evaluation, local cache sync, and retrieval diagnostics.
- Keep all work in intake for PM refinement and sequencing.

Out of scope for this planning pass:

- Production implementation changes.
- Promoting stories to ready or active.
- Selecting a hosted vector service or connector-specific ingestion path.

## Assumptions

- The Team Orchestrator memory contract remains the product-facing API; Chroma, AthenaMemory, and other backends stay behind provider adapters.
- Semantic retrieval should not require agents to change their memory API usage.
- Embedding provider configuration must be explicit enough to avoid accidental data egress.
- The first implementation sequence should prefer inspectability and conformance tests over ranking sophistication.

## Risks

- Embedding model/provider choices can introduce privacy risk if defaults are too eager.
- Hybrid ranking can become difficult to trust without diagnostics explaining score, filters, recency, provenance, and omission reasons.
- Sync behavior can sprawl if offline mutation is attempted before cache refresh/invalidation/degraded-read behavior is well bounded.
- Chroma and AthenaMemory may both require adapter-specific behavior that should not leak into the canonical memory model.

## Created Intake

Architecture intake:

- `flywheel/backlog/architecture/intake/ARCH-20260602-semantic-memory-backend-strategy.md`

Engineering intake:

- `flywheel/backlog/engineering/intake/STORY-20260602-memory-embedding-lifecycle.md`
- `flywheel/backlog/engineering/intake/STORY-20260602-memory-hybrid-retrieval.md`
- `flywheel/backlog/engineering/intake/STORY-20260602-memory-chroma-adapter.md`
- `flywheel/backlog/engineering/intake/STORY-20260602-memory-athena-adapter-evaluation.md`
- `flywheel/backlog/engineering/intake/STORY-20260602-memory-local-cache-sync.md`
- `flywheel/backlog/engineering/intake/STORY-20260602-memory-retrieval-diagnostics.md`

## Recommended Next Stage

Run PM refinement next. Recommended PM sequence:

1. Promote the architecture strategy item first if PM agrees implementation needs an explicit retrieval/backend decision.
2. Refine `STORY-20260602-memory-embedding-lifecycle` as the first engineering slice after the architecture decision is accepted.
3. Keep adapter and diagnostics stories in intake until embedding lifecycle and hybrid retrieval contracts are concrete.
