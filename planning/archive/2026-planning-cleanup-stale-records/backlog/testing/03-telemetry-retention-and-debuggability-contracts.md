<!-- AUDIENCE: Internal/Technical -->

# 03 - Telemetry, Retention, and Debuggability Contracts

## Goal

Make operational telemetry and retention behavior testable, stable, and safe against data-loss regressions.

## Scope

- Contract tests for reliability metadata payloads
- Retention pruning policy behavior (age/count constraints)
- Debuggability checks for required structured fields

## Acceptance Criteria

1. Given runtime/schedule/work results, when telemetry is emitted, then required fields (id, status, timings, counters) are present and contract-validated.
2. Given retention policy boundaries, when prune operation runs, then only eligible records are deleted and active/current artifacts are preserved.
3. Given repeated prune execution, when run multiple times without new data, then behavior is idempotent.
4. Given failure events, when logs/transcripts are inspected, then triage-critical metadata is available without code-level reproduction.

## Test Levels

- Contract: metadata shape and schema constraints
- Integration: retention behavior with realistic artifact sets
- E2E: basic operator workflow check for telemetry visibility

## Risks Addressed

- accidental data loss from retention misconfiguration
- missing metadata that blocks production triage
- silent contract drift in observability surfaces

## Deliverables

- telemetry contract tests
- retention boundary/idempotency suite
- minimum-debuggability checklist embedded in test assertions
