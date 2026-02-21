<!-- AUDIENCE: Internal/Technical -->

# Stage 5: Context Management + Distill Placeholder Hardening (Implementation Prep)

## Objective

Implement a bounded context pipeline before provider execution with deterministic overflow recovery and observable compaction metadata persistence.

## Current Baseline

- Context compilation is currently a single join operation in `src/context/index.ts`.
- Runtime always compiles with `strategy: "raw"` in `src/runtime/index.ts`.
- No context budget estimation, overflow handling, or compaction metadata persistence exists yet.

## Phase 5 Scope

1. Add a real `ContextCompiler` pipeline with strategy-specific behavior:
- `raw`: existing behavior with deterministic message assembly.
- `summary`: compact older history into bounded summary text.
- `distill`: explicit placeholder strategy with stronger notes/metadata contract (no-op content path remains acceptable for now).

2. Add budget-aware context assembly before provider call:
- Introduce configurable max context chars and reserve chars.
- Track pre-compile and post-compile context sizes.

3. Add overflow recovery sequence (bounded attempts):
- Attempt `summary` compaction for oversized context.
- If still oversized, truncate oversized tool-result-style entries (when present).
- Retry provider call with bounded overflow attempts.

4. Persist context-compaction metadata for observability:
- Per-turn metadata should include:
  - strategy used
  - overflow recovery path taken
  - attempt count
  - size before/after compaction
  - whether truncation fallback was applied

## OpenClaw References Used

- Overflow/compaction retry loop:
  - `openclaw/src/agents/pi-embedded-runner/run.ts`
- Tool-result truncation recovery helper:
  - `openclaw/src/agents/pi-embedded-runner/tool-result-truncation.ts`
- Compaction diagnostics and post-compaction token estimation:
  - `openclaw/src/agents/pi-embedded-runner/compact.ts`
- Concept docs for expected behavior:
  - `openclaw/docs/concepts/context.md`
  - `openclaw/docs/concepts/compaction.md`

## Proposed Athena Changes

1. `src/shared/contracts.ts`
- Add context metadata types:
  - `ContextCompileStats`
  - `ContextRecoveryStep`
  - `ContextCompactionMetadata`
- Add optional `contextMeta?: ContextCompactionMetadata` on `RunResult` or persisted turn metadata shape.

2. `src/shared/config.ts`
- Add `context` config block:
  - `strategy: "raw" | "summary" | "distill"`
  - `maxChars: number`
  - `reserveChars: number`
  - `maxOverflowRetries: number`
  - `summaryMaxChars: number`
  - `maxToolResultChars: number`

3. `src/context/index.ts`
- Replace single function behavior with:
  - `compileContext(request)`
  - `estimateContextChars(messages)`
  - `summarizeMessages(messages, limit)`
  - `truncateOversizedToolResults(messages, maxChars)`
- Return richer compile result with stats and recovery notes.

4. `src/runtime/index.ts`
- Build a context-compile + overflow recovery loop before `runWithProviderFallback`.
- Inject final `contextMeta` into run metadata for observability.
- Keep existing provider fallback semantics unchanged.

5. Persistence surface
- Minimal Phase 5 path: persist compaction metadata in transcript assistant entry `metadata` extension field or session-side turn metadata file under `.athena/sessions`.
- Ensure append-safe/atomic write semantics.

## Testing Plan

Add focused coverage:

- `tests/context.compiler.test.ts`
  - raw strategy assembly
  - summary strategy compaction bounds
  - distill placeholder contract
  - deterministic results for same inputs
- `tests/runtime.context-overflow.test.ts`
  - overflow triggers summary retry path
  - overflow triggers truncation fallback path
  - bounded retry exhaustion returns structured error
  - compaction metadata persisted and includes before/after sizes
- `tests/config.test.ts`
  - context config/env parsing coverage

## Acceptance Criteria

- Runtime no longer sends unbounded context to provider.
- Overflow recovery is deterministic and bounded by config.
- Distill strategy remains placeholder but has explicit observable metadata.
- Context-compaction metadata is persisted and queryable from state artifacts.
- `npm run typecheck`, `npm test`, and `npm run build` pass.

## Out Of Scope

- Full Distill implementation beyond placeholder behavior.
- Token-accurate accounting across heterogeneous providers.
- Channel/integration-specific context composition.
