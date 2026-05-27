<!-- AUDIENCE: Internal/Technical -->

# Team Orchestrator Agent Guide

## Product Identity

This repository is **Team Orchestrator**, a web-first, local-first agent orchestration product.

The remote/repo name may still be `AthenaConsole`, but new product work should use the Team Orchestrator direction unless the user says otherwise.

## Start Here

For a fresh session, read these first:

1. `README.md`
2. `planning/vision/handoff.md`
3. `planning/backlog/active/README.md`
4. `planning/prompts/active/next-agent-seed-prompt.md`
5. The active story file named in the active backlog, if one exists.

If the active backlog is empty, do not resume legacy fleet, Azure, Foundry, RBAC, evidence, or Athena-persona work by default. Use the reset roadmap and refinement epics to prepare the next Team Orchestrator story.

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

- `planning/architecture/0006-team-orchestrator-direction-and-agent-model.md`
- `planning/architecture/0007-agent-manifest-and-lifecycle-contract.md`
- `planning/architecture/0008-plugin-package-format.md`
- `planning/architecture/0009-task-mission-run-domain-model.md`
- `planning/architecture/0010-sqlite-app-state-architecture.md`
- `planning/architecture/0011-runtime-backend-interface.md`
- `planning/architecture/0012-event-artifact-observability-model.md`
- `planning/architecture/0013-safety-approval-and-loop-limit-model.md`
- `planning/architecture/0014-scheduling-model.md`

## Current State

The completed foundation reset lives in:

- `planning/backlog/completed/2026-product-direction-reset/`

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

1. Update the active story handoff/QA sections.
2. Update `planning/vision/handoff.md`.
3. Move completed stories from `planning/backlog/active/` to `planning/backlog/completed/`.
4. Update `planning/backlog/active/README.md`.
5. Update `planning/prompts/active/next-agent-seed-prompt.md`.
