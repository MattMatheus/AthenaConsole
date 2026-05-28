<!-- AUDIENCE: Internal/Technical -->

# Current Product Direction

## Product

Team Orchestrator is a local-first, web-first agent orchestration product.

The product center is:

- manifest-backed agents packaged in plugins,
- task and mission work management,
- workflow templates that produce repeatable missions/tasks,
- durable SQLite app state,
- inspectable runs, events, artifacts, and histories,
- safety defaults for approvals, limits, and pluggable runtimes,
- a console that lets an operator create, run, inspect, and schedule work.

## Canonical Direction

Current product direction starts from the accepted reset ADRs:

- `docs/product/architecture/decisions/0006-team-orchestrator-direction-and-agent-model.md`
- `docs/product/architecture/decisions/0007-agent-manifest-and-lifecycle-contract.md`
- `docs/product/architecture/decisions/0008-plugin-package-format.md`
- `docs/product/architecture/decisions/0009-task-mission-run-domain-model.md`
- `docs/product/architecture/decisions/0010-sqlite-app-state-architecture.md`
- `docs/product/architecture/decisions/0011-runtime-backend-interface.md`
- `docs/product/architecture/decisions/0012-event-artifact-observability-model.md`
- `docs/product/architecture/decisions/0013-safety-approval-and-loop-limit-model.md`
- `docs/product/architecture/decisions/0014-scheduling-model.md`

Pre-reset ProjectAthena, Foundry-first, fleet-governance, persona-kit, and A2A-observability records are archived historical context unless rewritten against this direction.

## Delivered Baseline

The reset implementation has delivered:

- SQLite app-state repositories for plugins, agents, tasks, missions, runs, events, artifacts, schedules, and schedule history.
- Plugin and agent manifest validation/indexing.
- Agent catalog API and console surfaces.
- Task creation, execution, run inspection, local-process/container-command/http-api backends, and safety defaults.
- Mission APIs, mission workbench, sequential mission runs, and durable mission run history.
- Workflow-template indexing, instantiation, and schedule support.
- Schedule creation, due execution, workflow-template schedules, and durable schedule run history.
- Workflow-template DAG parsing/validation for dependency-safe future execution.

## Current Roadmap

### 2026.17 Workflow DAG Engine

Goal: evolve workflow templates from sequential mission creation into restart-safe DAG-capable workflow execution.

Stories:

- `docs/product/history/completed-stories/2026.17.01-implement-workflow-dag-definition-parser.md`
- `flywheel/backlog/engineering/active/STORY-20260528-workflow-state-store-resumption.md`
- Candidate next: visualizer-friendly workflow status API.

Source epic:

- `docs/product/epics/refinement/2026.17.00-epic-workflow-dag-engine.md`

### Later Candidate Tracks

These need PM refinement before activation:

- Run templates for repeatable operator-triggered jobs. Refined track: `docs/product/epics/refinement/2026.18.00-epic-run-templates.md`.
- Verification/evidence model for output quality gates.
- Richer runtime isolation and policy packs.
- A2A observability, if it is reframed against Team Orchestrator’s current event/run model.

## Promotion Rule

A story should not become active unless it has:

- a Flywheel item in `flywheel/backlog/engineering/active/` or `flywheel/backlog/architecture/active/`,
- a source epic or ADR in the current Team Orchestrator direction,
- acceptance criteria and validation expectations,
- an entry in `flywheel/backlog/engineering/active/README.md`,
- valid Flywheel metadata/frontmatter.

Old or candidate material can inspire stories, but it must be rewritten into this structure before execution.
