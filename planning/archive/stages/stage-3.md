# Stage 3: Work Management System

## Objectives

- Implement per-session persisted work queues.
- Support initial queue modes (`followup`, `collect`).
- Add dedupe/drop controls and drain re-entrancy guard.
- Provide CLI controls for enqueue/status/drain operations.

## Implemented

- Persisted queue state:
  - Path: `.athena/work/queues/<sessionId>.json`
  - Safe write flow via temp file + rename
- Queue features:
  - `enqueue` with mode-aware dedupe options
  - dedupe modes: `dedupe-key`, `payload`, `none`
  - drop policies: `keep-old`, `keep-new`
  - per-session filesystem lock for enqueue/drain mutation serialization
  - drain pipeline with in-process re-entrancy guard
- Drain behavior:
  - `followup` items run one-by-one
  - `collect` items at queue front are aggregated into one payload batch
  - persisted `draining` flag is force-reset in `finally` on failures
- CLI commands:
  - `athena work enqueue --session <id> --input <text> [--mode followup|collect]`
  - `athena work status --session <id>`
  - `athena work drain --session <id> [--provider <id>] [--model <id>]`
  - invalid `--mode` values are rejected (no silent coercion)

## Verification

- `npm run typecheck`: passed
- `npm test`: passed
- `npm run build`: passed

## Tests Added

- `tests/work.manager.test.ts`
  - persistence + restart recovery
  - dedupe/drop behavior
  - drain order for collect/followup
  - re-entrant drain guard
  - failure cleanup for persisted `draining` flag
  - concurrent enqueue serialization (no dropped items)
  - duplicate-drain prevention across manager instances
- `tests/cli.work.test.ts`
  - enqueue/status/drain CLI path
  - strict `--mode` validation

## Known Gaps

- Queue processing runs in-process only; no standalone worker loop yet.
- Queue metrics/telemetry are minimal and will be expanded in later stages.
