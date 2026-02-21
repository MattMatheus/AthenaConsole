# Testing Backlog

This directory tracks SDET-owned strategy improvements and test-system extensions that run in parallel with development stories.

## Objectives

- increase confidence in operational reliability for Stage 8 work
- reduce escaped defects through stronger negative/boundary/failure-path coverage
- keep schema/contract drift and observability regressions visible and blocking

## How To Use

1. Keep items small enough to complete within one development cycle.
2. For each item, include acceptance criteria, scope, test levels, and risks.
3. Move completed items to `internal-docs/backlog/completed/` or mark complete in this directory if they remain test-infrastructure specific.

## Initial Items

- `internal-docs/backlog/testing/01-deterministic-test-harness-and-fixtures.md`
- `internal-docs/backlog/testing/02-timeout-cancellation-and-lock-contention-suite.md`
- `internal-docs/backlog/testing/03-telemetry-retention-and-debuggability-contracts.md`
- `internal-docs/backlog/testing/04-reliability-fault-injection-framework.md`
- `internal-docs/backlog/testing/10.02-route-registration-shared-metadata-sdet-preflight.md`
