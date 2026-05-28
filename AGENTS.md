<!-- AUDIENCE: Internal/Technical -->

# Team Orchestrator Agent Guide

## Product Identity

This repository is **Team Orchestrator**, a web-first, local-first agent orchestration product.

The remote/repo name may still be `AthenaConsole`, but new product work should use the Team Orchestrator direction unless the user says otherwise.

## Start Here

For a fresh session, read these first:

1. `README.md`
2. `flywheel.yaml`
3. `flywheel/AGENTS.md`
4. `flywheel/DEVELOPMENT_CYCLE.md`
5. `flywheel/tools/README.md`
6. `docs/product/direction/current-direction.md`

Use `./flywheel/tools/launch_stage.sh <stage> --format json` for stage context. The active work queue lives in Flywheel, not in `planning/`.

If the configured Flywheel active backlog is empty, do not invent work. Route through planning or PM refinement and create/move items with the Flywheel state model.

## Current Direction

- Formal manifest-backed agents are the product center.
- Plugins package one or more agents.
- Tasks are agent-addressable units of work.
- Missions group tasks.
- Runs execute a task or mission.
- SQLite is the local app-state store for v1.
- The web console is the primary operator interface.
- Local execution is preferred, with pluggable backends so cloud/API execution can be added later.
- Safety should use loop limits and risk-based approvals.

Canonical decisions:

- `docs/product/architecture/decisions/0006-team-orchestrator-direction-and-agent-model.md`
- `docs/product/architecture/decisions/0007-agent-manifest-and-lifecycle-contract.md`
- `docs/product/architecture/decisions/0008-plugin-package-format.md`
- `docs/product/architecture/decisions/0009-task-mission-run-domain-model.md`
- `docs/product/architecture/decisions/0010-sqlite-app-state-architecture.md`
- `docs/product/architecture/decisions/0011-runtime-backend-interface.md`
- `docs/product/architecture/decisions/0012-event-artifact-observability-model.md`
- `docs/product/architecture/decisions/0013-safety-approval-and-loop-limit-model.md`
- `docs/product/architecture/decisions/0014-scheduling-model.md`
- `docs/product/architecture/decisions/0015-canonical-orchestration-state-model.md`
- `docs/product/architecture/decisions/0016-core-service-decomposition-plan.md`

## Current State

The completed foundation reset lives in:

- `docs/product/history/completed-stories/2026-product-direction-reset/`

It delivered SQLite app state, manifest schemas, local plugin loading/indexing, and task/mission/run/event/artifact repositories.

Before making changes, check `git status --short` and do not revert user changes.

## Validation Defaults

For core backend work, prefer:

- `npm --workspace @athena/core run typecheck`
- `npm --workspace @athena/core run test:unit`
- `npm --workspace @athena/core run validate:manifests`
- `git diff --check`

For console UI work, inspect package scripts first and run the narrowest meaningful frontend validation.

## Handoff Expectations

At the end of a product work cycle:

1. Update the active Flywheel item handoff/QA sections.
2. Move items through Flywheel lanes with `./flywheel/tools/flywheel_state.sh move ...` when practical.
3. Run `./flywheel/tools/validate_workflow_state.sh`.
4. Close the cycle with `./flywheel/tools/run_observer_cycle.sh --cycle-id <cycle-id>`.
5. Commit once per completed cycle using the Flywheel cycle rules.
