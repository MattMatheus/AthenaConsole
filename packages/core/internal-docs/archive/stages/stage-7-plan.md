# Stage 7 Plan: Reliability And Hardening

## Goal

Complete Stage 7 deliverables with bounded, test-first changes that preserve existing CLI/runtime contracts.

## Current Gaps (from code scan)

1. Runtime has provider-level timeouts, but no end-to-end run timeout/abort budget.
2. Scheduler executes handlers without a hard timeout envelope.
3. Session metadata writes (`.athena/sessions/*.json`) are not atomic.
4. Persisted state has no explicit schema/version marker or migration path.
5. Reliability/observability counters are not exposed on run/schedule/work surfaces.

## Implementation Sequence

1. Add timeout/abort primitives.
   - Introduce shared timeout helper in `src/runtime` (abort signal + timer wrapper).
   - Extend runtime execution path in `src/runtime/index.ts` with configurable run timeout.
   - Ensure timeout errors are classified as structured runtime errors.
2. Apply timeout envelope to schedule executions.
   - Add schedule timeout config in `src/shared/config.ts`.
   - Wrap task handler execution in `src/schedule/index.ts` with timeout-aware failure classification.
   - Preserve existing `finally` cleanup guarantees for lock + `running` flag reset.
3. Add persisted state versioning/migration hooks.
   - Add versioned wrappers for schedule tasks/session records in `src/shared/contracts.ts`.
   - Add migration loader/saver helpers in `src/runtime/session-store.ts` and `src/schedule/index.ts`.
   - Keep v1 readers backward-compatible with current on-disk files.
4. Harden writes and observability metadata.
   - Reuse atomic temp+rename writes for all JSON state artifacts.
   - Add reliability counters to runtime result metadata:
     - retry attempts
     - fallback hops
     - timeout occurrences
     - context compaction counts (already present, normalize exposure)
   - Add schedule/work summary counters in CLI JSON responses where applicable.
5. Add reliability-focused tests and docs sync.
   - Extend runtime/work/schedule tests for timeout, migration, and recovery paths.
   - Add Stage 7 status docs once code lands.

## Planned File Touch List

- `src/shared/contracts.ts`
- `src/shared/config.ts`
- `src/runtime/index.ts`
- `src/runtime/session-store.ts`
- `src/schedule/index.ts`
- `src/cli/index.ts`
- `tests/runtime.*.test.ts`
- `tests/schedule.manager.test.ts`
- `tests/cli.schedule.test.ts`
- `tests/docs.stage-consistency.test.ts`
- `internal-docs/README.md`
- `AGENTS.md`

## Test Matrix

1. Runtime timeout:
   - long-running provider run exceeds limit -> classified timeout error
   - lock release and transcript/session consistency preserved
2. Schedule timeout:
   - timed-out schedule run logs `failed` with timeout reason
   - `running=false` after failure and lock released
3. Migration compatibility:
   - legacy unversioned files load and are upgraded on write
   - already-versioned files load without mutation side effects
4. Atomicity:
   - write interruption scenarios do not leave partial JSON in canonical path
5. Observability counters:
   - retry/fallback/compaction counters populated in run outputs and transcript metadata

## Exit Criteria For Stage 7

1. Timeout/abort controls exist for runtime and scheduler.
2. Session/schedule persisted artifacts support versioned loading with migration hooks.
3. Reliability counters are surfaced and test-covered.
4. Restart/crash-oriented reliability tests pass.
