<!-- AUDIENCE: Internal/Technical -->

# Stage 5: Context Management + Distill Placeholder Hardening (Completed)

## Objectives (from plan)

- Add strategy-based context compilation (`raw`, `summary`, `distill` placeholder).
- Add context budget handling before provider invocation.
- Add bounded overflow recovery sequence.
- Persist context compaction metadata for observability.

## Implemented In This Slice

- Contracts extended for context observability:
  - `ContextCompileStats`
  - `ContextRecoveryStep`
  - `ContextCompactionMetadata`
  - `RunResult.contextMeta?`
  - `TranscriptEntry.metadata?` for persisted per-turn metadata
- Config extended with context controls under `context.*`:
  - `strategy`
  - `maxChars`
  - `reserveChars`
  - `maxOverflowRetries`
  - `summaryMaxChars`
  - `maxToolResultChars`
- Context compiler upgraded in `src/context/index.ts`:
  - structured message compilation
  - deterministic `summary` strategy with bounded summary section
  - hardened `distill` placeholder (explicit notes + compile stats)
  - oversized tool-result truncation helper
- Runtime integration in `src/runtime/index.ts`:
  - context compile pipeline now runs before provider call
  - overflow recovery sequence:
    - switch to `summary`
    - then truncate oversized tool results
    - bounded by `context.maxOverflowRetries`
  - throws structured `CONTEXT_OVERFLOW` error when unrecoverable
  - persists context metadata into assistant transcript entries
  - returns context metadata on `RunResult.contextMeta`
- Runtime error codes extended in `src/runtime/errors.ts`:
  - added `CONTEXT_OVERFLOW`

## Verification

- `npm run typecheck`: passed
- `npm test`: passed
- `npm run build`: passed

## Tests Added/Updated

- Added `tests/context.compiler.test.ts`:
  - raw compile determinism
  - summary compaction behavior
  - tool-result truncation helper coverage
- Added `tests/runtime.context-overflow.test.ts`:
  - summary overflow recovery path
  - tool-result truncation fallback path
  - unrecoverable overflow structured error path
  - transcript metadata persistence check
- Updated `tests/config.test.ts`:
  - coverage for context env/config parsing
- Updated `tests/contracts.test.ts`:
  - distill placeholder compile contract with new structured compile request

## Exit Criteria Status

- Context overflow handling is stable and bounded: met.
- Distill integration point exists with explicit placeholder contract: met.
- Context compaction metadata persisted for observability: met.
