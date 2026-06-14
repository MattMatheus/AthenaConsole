<!-- AUDIENCE: Internal/Technical -->

# Team Orchestrator Agent Guide

## Product Identity

This repository is **Team Orchestrator**, a web-first, local-first and enterprise-capable agent work control plane.

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

- Formal manifest-backed agents and capability packs are the product center.
- Plugins package agents, workflows, docs, fixtures, and connector integrations.
- Tasks, missions, workflow runs, events, artifacts, and memory records are the inspectable work model.
- The web console is the primary operator and admin interface.
- Local execution remains the default posture; trusted-server and enterprise operation are active product directions.
- Workspaces, RBAC, cost governance, distributed coordination, and Postgres readiness are now in scope per ADR 0027.
- SQLite remains the default local app-state store; server profiles must avoid SQLite-only assumptions.
- Safety should use permissions, loop limits, risk-based approvals, audit trails, and budget controls.

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
- `docs/product/architecture/decisions/0027-enterprise-multi-user-direction.md`

## Current State

The completed foundation reset is recorded in:

- `docs/product/epics/completed/2026.10.00-epic-team-orchestrator-foundation-reset.md`

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
