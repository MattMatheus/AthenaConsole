<!-- AUDIENCE: Internal/Technical -->

# Stage 1: CLI-First Runtime Baseline

## Objectives

- Implement a runnable CLI command for single-session turns.
- Persist session and transcript state locally.
- Add write serialization to prevent transcript corruption.
- Introduce baseline structured runtime errors and retries.

## Implemented

- CLI command:
  - `athena run --session <id> --input <text> [--provider <id>] [--model <id>]`
  - Version command: `athena --version`
- Runtime and persistence:
  - Session records at `.athena/sessions/<sessionId>.json`
  - JSONL transcript entries at `.athena/transcripts/<sessionId>.jsonl`
  - Lockfiles at `.athena/locks/<sessionId>.lock`
- Turn lifecycle (baseline):
  - prepare session and history
  - assemble context payload (raw strategy)
  - invoke provider adapter
  - append user/assistant transcript entries
- Provider wiring:
  - Provider registry with default mock provider adapter
- Error and retry behavior:
  - typed runtime errors (`AthenaError`)
  - bounded retry loop for retryable provider failures

## Verification

- `npm run typecheck`: passed
- `npm test`: passed
- `npm run build`: passed

## Tests Added

- `tests/cli.test.ts`
  - CLI version path
  - `run` path with persisted session/transcript artifacts
- `tests/runtime.lock.test.ts`
  - concurrent writes to same session are serialized and transcript remains valid

## Known Gaps (Intentional)

- Provider support currently includes only mock adapter.
- Transcript sanitation/repair and compaction are not implemented yet.
- Work queue and follow-up modes are Stage 3 scope.
