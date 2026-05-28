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
- `docs/product/architecture/decisions/0015-canonical-orchestration-state-model.md`
- `docs/product/architecture/decisions/0016-core-service-decomposition-plan.md`

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
- Durable workflow DAG run state, resumable stale-step recovery, and visualizer-friendly workflow status APIs.
- Workflow-template instantiation and scheduled workflow-template execution now create and expose a canonical workflow DAG run envelope.
- Run templates, verification evidence, runtime policy packs, and A2A observability reframing migrated into the current Team Orchestrator model.
- Startup recovery for stale task and mission runs left `running` after API/service restart.
- SQL-backed bounded task, run, and schedule list queries for current app-state console/API surfaces.
- A core service decomposition plan that starts with a no-behavior-change app-state repository split.
- App-state domain repositories split by aggregate while preserving the public app-state export surface.

## Current Roadmap

### 2026.17 Workflow DAG Engine

Goal: evolve workflow templates from sequential mission creation into restart-safe DAG-capable workflow execution.

Completed foundation:

- `docs/product/history/completed-stories/2026.17.01-implement-workflow-dag-definition-parser.md`
- `flywheel/backlog/engineering/done/STORY-20260528-workflow-state-store-resumption.md`
- `flywheel/backlog/engineering/done/STORY-20260528-workflow-status-api.md`
- `flywheel/backlog/engineering/done/STORY-20260528-workflow-template-dag-run-envelope.md`
- `flywheel/backlog/architecture/done/ARCH-20260528-canonical-orchestration-state-model.md`

Next implementation refinement:

- No active DAG implementation story is queued; route the next DAG executor slice through PM refinement.

Source epic:

- `docs/product/epics/refinement/2026.17.00-epic-workflow-dag-engine.md`

### Current Flywheel Priorities

Flywheel lanes are the operational source of truth. No engineering or architecture items are active right now.

Recently completed tracks now live in Flywheel done history:

- `flywheel/backlog/engineering/done/STORY-20260528-run-templates.md`
- `flywheel/backlog/engineering/done/STORY-20260528-run-template-console.md`
- `flywheel/backlog/engineering/done/STORY-20260528-verification-evidence-model.md`
- `flywheel/backlog/engineering/done/STORY-20260528-run-verification-inspection.md`
- `flywheel/backlog/engineering/done/STORY-20260528-runtime-policy-pack-resolver.md`
- `flywheel/backlog/engineering/done/STORY-20260528-runtime-isolation-policy-packs.md`
- `flywheel/backlog/engineering/done/STORY-20260528-a2a-observability-reframe.md`
- `flywheel/backlog/engineering/done/STORY-20260528-legacy-a2a-surface-labeling.md`
- `flywheel/backlog/engineering/done/STORY-20260528-app-state-list-query-bounds.md`
- `flywheel/backlog/engineering/done/STORY-20260528-workflow-template-dag-run-envelope.md`
- `flywheel/backlog/engineering/done/STORY-20260528-split-app-state-domain-repositories.md`
- `flywheel/backlog/architecture/done/ARCH-20260528-service-decomposition-plan.md`

Deferred implementation candidates that need PM refinement:

- None currently queued.

## Promotion Rule

A story should not become active unless it has:

- a Flywheel item in `flywheel/backlog/engineering/active/` or `flywheel/backlog/architecture/active/`,
- a source epic or ADR in the current Team Orchestrator direction,
- acceptance criteria and validation expectations,
- an entry in `flywheel/backlog/engineering/active/README.md`,
- valid Flywheel metadata/frontmatter.

Old or candidate material can inspire stories, but it must be rewritten into this structure before execution.
