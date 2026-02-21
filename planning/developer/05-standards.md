# 05 - Development and Test Standards

## Purpose

This document defines mandatory engineering and quality standards for ProjectAthena development. It is the source of truth for:

- development workflow expectations
- test design and coverage requirements
- release/merge quality gates
- reliability, security, and observability validation

## Scope

Applies to all code changes under `/src`, `/tests`, `/scripts`, and docs changes that affect runtime behavior.

Out of scope:

- purely editorial docs changes with no behavioral impact
- temporary local experiments not proposed for merge

## Normative Terms

- `MUST`: required for merge
- `SHOULD`: expected unless a documented exception exists
- `MAY`: optional guidance

## Core Quality Invariants

All changes MUST preserve these invariants:

1. State files remain schema-versioned and backward-compatible with defined migrations.
2. Runtime metadata reflects actual execution outcomes (not requested/default inputs).
3. Lock and running/draining flags always clear via best-effort `finally` paths.
4. Filesystem paths derived from external input are validated and boundary-checked.
5. Shared DTOs remain canonical in `src/shared/contracts.ts` and schema generation remains in sync.

## Development Standards

### 1) Planning and Requirements

Before implementation, each task MUST define:

- objective and non-objective
- acceptance criteria in verifiable form
- primary risk areas (correctness, reliability, security)
- required test levels (unit/integration/contract/e2e)

### 2) Implementation

Code changes MUST:

- keep interfaces stable and versioned through `src/shared/contracts.ts`
- avoid duplicate DTO definitions in API-layer files
- use append-safe and atomic persistence for state writes
- use resolver helpers (not string concatenation) for lock/state paths
- include structured error codes for recoverable/unrecoverable classes

### 3) Determinism and Reproducibility

Tests and runtime behavior SHOULD be deterministic where possible:

- inject clocks/IDs/randomness boundaries when feasible
- avoid unbounded sleeps in tests; use bounded polling and explicit timeouts
- capture explicit fixtures for failure-mode reproduction
- ensure repeated runs yield stable results for same inputs

## Test Strategy Standards

## Required Test Levels by Change Type

| Change type | Unit | Integration | Contract | E2E |
| --- | --- | --- | --- | --- |
| Pure function/business logic | MUST | MAY | MAY | MAY |
| Filesystem persistence/locks | MUST | MUST | MAY | SHOULD |
| CLI command behavior | MUST | MUST | MAY | SHOULD |
| Shared DTO/schema change | MUST | SHOULD | MUST | MAY |
| Provider/runtime control flow | MUST | MUST | SHOULD | SHOULD |
| Scheduling/timeout/cancellation | MUST | MUST | SHOULD | MUST |

Any omitted level MUST be justified in PR notes with residual risk.

### Unit Test Standards

Unit tests MUST cover:

- normal path
- boundary conditions (min/max/empty)
- negative inputs and validation failures
- error classification and structured error payload shape

### Integration Test Standards

Integration tests MUST verify:

- cross-module behavior and persisted side effects
- lock semantics under concurrent access attempts
- crash-recovery cleanup for stale running/draining flags
- provider fallback and retry behavior under controlled failures

### Contract Test Standards

Contract tests MUST verify:

- generated schemas match shared contracts
- API payload compatibility for required fields and enum values
- no silent schema drift

### End-to-End Test Standards

E2E tests SHOULD focus on critical paths:

- `athena run` full turn lifecycle with persistence artifacts
- work queue enqueue/drain/status lifecycle
- schedule add/tick/run/logs/remove lifecycle
- timeout/cancellation interaction with cleanup guarantees

## Acceptance Criteria Template (Mandatory)

Each feature PR MUST include acceptance criteria in this form:

1. `Given` initial state and configuration
2. `When` a specific user/system action occurs
3. `Then` observable outcomes include:
   - output/return object behavior
   - persisted artifact/state behavior
   - log/telemetry behavior
   - failure behavior (error code/classification)

Example:

- Given a running scheduled task, when another tick targets the same schedule concurrently, then the second run is rejected as already-running and no duplicate state mutation occurs.

## Negative and Boundary Coverage Checklist

Every non-trivial PR MUST explicitly evaluate:

- invalid IDs and path traversal attempts
- empty payloads and oversized payloads
- stale lock files and interrupted prior runs
- timeout boundaries (just below/at/above threshold)
- retry exhaustion and fallback exhaustion
- partial write/interrupted write recovery

## Reliability and Performance Standards

### Reliability

Changes affecting runtime loop, queues, schedules, providers, or context pipeline MUST include failure-injection tests for at least one of:

- injected I/O failure
- provider timeout/abort
- lock acquisition failure
- overflow/compaction retry path

### Performance

Changes MUST avoid unbounded complexity in hot paths. If a change touches hot-path logic, include one of:

- a benchmark comparison, or
- a complexity/risk note with justification and expected scale limits

## Security and Hardening Standards

All externally supplied identifiers MUST be validated before use.

Filesystems operations MUST:

- resolve through trusted base directories
- perform boundary checks before read/write
- avoid direct path concatenation with untrusted input

When adding new CLI inputs or API fields, include negative tests for malformed and out-of-policy values.

## Observability and Debuggability Standards

Feature changes SHOULD emit structured metadata sufficient to debug failures without reproducing from scratch.

At minimum, changes affecting execution lifecycle SHOULD include:

- operation identifier (`sessionId`, `scheduleId`, etc.)
- result classification (`ok`, `failed`, `timeout`, `cancelled`, `already-running`)
- timing data (latency/duration)
- retry/fallback counters where relevant

## Mandatory Regression Commands (Pre-Handoff)

Unless explicitly waived by maintainers, every behavioral change MUST pass:

```bash
npm run check:schemas
npm run typecheck
npm test
```

For runtime isolation benchmark harness smoke validation, also run:

```bash
npm run test:runtime-isolation-benchmark:smoke
```

If a targeted test suite is used instead of full `npm test`, the PR MUST document:

- reason full suite was not run
- exact tests run
- residual risk

## PR Quality Checklist (Merge Gate)

A PR is merge-ready only when all are true:

1. Acceptance criteria are listed and mapped to tests.
2. New/changed behavior has appropriate test-level coverage.
3. Negative/boundary cases are addressed.
4. Schema generation and contract checks pass for DTO-affecting changes.
5. Reliability/cleanup behavior is verified for stateful flows.
6. Docs are updated for user-visible or operator-visible behavior.
7. Required regression commands have passed.

## Flaky Test Policy

Flaky tests MUST be treated as defects:

1. Capture failure signature and suspected nondeterministic source.
2. Stabilize test via deterministic control (clock, fixture, polling bound, dependency fake).
3. If immediate stabilization is not possible, quarantine only with linked follow-up issue and owner.
4. Quarantined tests MUST not remain unresolved beyond one release cycle.

## Traceability Matrix Guidance

For medium/large changes, include a lightweight matrix in PR description:

| Acceptance Criterion | Test ID/File | Test Level | Status |
| --- | --- | --- | --- |
| AC-1 | `tests/runtime/...` | Integration | Pass |
| AC-2 | `tests/contracts/...` | Contract | Pass |

## Versioning and Maintenance

- Release/story/handoff identifiers MUST follow the project versioning scheme `YYYY.IncrementingValue`.
  - Example release train: `2026.02`
  - Example story IDs: `2026.02.01-*`, `2026.02.02-*`
- New backlog stories, handoff records, and seed prompts MUST preserve this sequence to keep planning deterministic across agent cycles.
- Document owner: engineering maintainers
- Review cadence: once per stage completion or major architecture change
- This file should be updated when quality gates or required test commands change
