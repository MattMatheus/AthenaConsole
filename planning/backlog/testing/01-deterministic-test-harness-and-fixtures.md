# 01 - Deterministic Test Harness and Fixtures

## Goal

Eliminate avoidable test nondeterminism and make failure reproduction one-command repeatable.

## Scope

- Test utilities for deterministic clock/time behavior
- Stable fixture helpers for filesystem state and provider outputs
- Common bounded polling utilities for async assertions

## Acceptance Criteria

1. Given a runtime test that depends on time, when executed repeatedly, then results are deterministic under injected/frozen clock controls.
2. Given filesystem-backed tests, when executed in parallel, then no shared fixture state leaks across tests.
3. Given async lifecycle assertions, when waiting for state transitions, then all waits use bounded polling helpers with explicit timeout messages.
4. Given a failed CI run, when re-running locally with provided command, then the failure is reproducible with same fixture seed.

## Test Levels

- Unit: utility helpers
- Integration: representative runtime/work/schedule tests migrated to deterministic helpers

## Risks Addressed

- flaky tests from wall-clock timing
- hidden coupling through shared temp directories
- opaque async failures with weak assertion diagnostics

## Deliverables

- deterministic test utility module(s)
- migrated high-value reliability tests
- short usage guide in test utilities or contributor docs
