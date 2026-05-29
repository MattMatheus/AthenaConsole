<!-- AUDIENCE: Internal/Technical -->

# Team Orchestrator Flight Path

This roadmap describes the current build sequence after the 2026 product-direction reset.

Team Orchestrator is a web-first, local-first agent orchestration product. The current product center is manifest-backed agents, tasks, missions, workflow templates, durable SQLite app state, inspectable runs and artifacts, runtime safety controls, and an operator console.

## Current Baseline

The foundation reset is complete.

Delivered tracks include:

- Foundation app-state, plugin, agent, task, mission, run, event, artifact, schedule, and workflow-template models.
- Local agent catalog and console surfaces.
- Task workbench, mission workbench, run inspection, and schedule UI.
- Workflow-template DAG execution, restart recovery, scheduled DAG execution, and console graph/status inspection.
- Run templates, verification evidence, runtime policy packs, and A2A observability reframing.
- State ownership map, startup diagnostics, SQLite migrations for operator-owned control-plane resources, artifact classification, and removal of legacy workflow file-state runtime paths.

Canonical direction:

- `docs/product/direction/current-direction.md`

Canonical architecture records:

- `docs/product/architecture/decisions/0006-team-orchestrator-direction-and-agent-model.md`
- `docs/product/architecture/decisions/0015-canonical-orchestration-state-model.md`
- `docs/product/architecture/decisions/0016-core-service-decomposition-plan.md`

## Completed Roadmap Tracks

### 2026.17 Workflow DAG Engine

Status: Complete.

Outcome: workflow templates now create durable canonical workflow DAG runs, scheduled workflow-template execution uses DAG runs, stale DAG steps recover on startup, and the console links operators into dependency-aware DAG run inspection.

Source epic:

- `docs/product/epics/refinement/2026.17.00-epic-workflow-dag-engine.md`

### 2026.22 State Ownership And SQLite Migration

Status: Complete.

Outcome: durable state ownership is explicit, startup diagnostics show active stores, directives/harness profiles/run templates use SQLite app-state, artifact payloads are intentionally classified as filesystem-owned, and legacy file-backed workflow runtime APIs are removed.

Source epic:

- `docs/product/epics/refinement/2026.22.00-epic-state-ownership-and-sqlite-migration.md`

## Active Roadmap Track

### 2026.23 Operator Readiness And First-Run Experience

Status: Complete.

Goal: make the product understandable and useful to a new local operator within the first few minutes after clone/startup.

Why now:

- The runtime foundation is coherent enough to demonstrate end to end.
- The public README is moving toward a public-facing landing page.
- The Flywheel queue is empty, so the next work should improve the operator entry path before adding deeper platform features.

Target outcome:

- A new operator can start the stack, see whether the system is healthy, understand what to do next, run a representative sample, and inspect the resulting run/workflow/artifacts without reading internal planning docs.

Source epic:

- `docs/product/epics/refinement/2026.23.00-epic-operator-readiness-first-run.md`

Ready story sequence:

1. `flywheel/backlog/engineering/done/STORY-20260528-first-run-health-readiness.md`
2. `flywheel/backlog/engineering/done/STORY-20260528-sample-plugin-workflow-demo.md`
3. `flywheel/backlog/engineering/done/STORY-20260528-console-empty-states-onboarding.md`
4. `flywheel/backlog/engineering/done/STORY-20260528-quickstart-demo-docs-alignment.md`

### 2026.24 Console Product Surface Polish

Status: Planning intake.

Goal: make the console feel like a coherent Team Orchestrator product surface after the product-direction reset and first-run work.

Why now:

- The first-run path is complete enough for outside review.
- Visible console cruft from older product direction can distract from the current operator workflow.
- UI polish should happen before adding deeper features so new work lands into a cleaner information architecture.

Target outcome:

- A new or returning operator sees Team Orchestrator branding, clear primary workflows, and advanced/legacy tools that are contained rather than promoted as the main path.

Source epic:

- `docs/product/epics/refinement/2026.24.00-epic-console-product-surface-polish.md`

Candidate story sequence:

1. `flywheel/backlog/engineering/done/STORY-20260528-console-product-identity-polish.md`
2. `flywheel/backlog/engineering/done/STORY-20260528-console-navigation-surface-grouping.md`
3. `flywheel/backlog/engineering/done/STORY-20260528-operator-dashboard-polish.md`
4. `flywheel/backlog/engineering/done/STORY-20260528-legacy-advanced-surface-containment.md`

## Near-Term Principles

- Prefer complete local operator loops over new isolated backend features.
- Keep the first-run path honest: only document and expose workflows that actually work in the current product.
- Treat docs, console empty states, diagnostics, and sample data as product surfaces.
- Do not reintroduce legacy compatibility shims for removed control-plane paths.
- Keep Flywheel as the operational source of truth for active and queued work.

## Archived Roadmap Context

The superseded pre-reset roadmap snapshot is archived at:

- `docs/product/archive/2026-product-direction-reset/roadmap-snapshot/vision-roadmap.md`
