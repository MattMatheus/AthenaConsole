<!-- AUDIENCE: Internal/Technical -->

# 02 - Timeout, Cancellation, and Lock Contention Suite

## Goal

Expand reliability coverage for concurrency and lifecycle control paths where defects are high impact.

## Scope

- Runtime timeout and explicit cancellation behavior
- Schedule overlap and lock contention handling
- Cleanup guarantees for stale running/draining state after failures

## Acceptance Criteria

1. Given a long-running provider call, when runtime timeout elapses, then `RUN_TIMEOUT` is returned and cleanup is complete.
2. Given an active run and cancellation signal, when cancellation is requested, then run exits in bounded time with structured cancellation outcome.
3. Given concurrent schedule executions of the same schedule id, when overlap occurs, then exactly one execution proceeds and others resolve to already-running classification.
4. Given lock acquisition failure or stale lock artifacts, when retry/recovery is attempted, then state is not corrupted and stale running flags are cleared.

## Test Levels

- Unit: timeout/cancellation helpers and error classification
- Integration: runtime, schedule, and work queue race/recovery scenarios
- E2E: CLI command-level timeout/cancellation smoke path

## Risks Addressed

- partial writes during lifecycle interrupts
- stale lock/running state after crashes
- inconsistent error semantics under concurrent operations

## Deliverables

- expanded reliability suite with targeted race-condition tests
- explicit matrix mapping lifecycle scenarios to expected classifications
