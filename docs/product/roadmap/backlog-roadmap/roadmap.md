<!-- AUDIENCE: Internal/Technical -->

# Team Orchestrator Roadmap

This roadmap tracks the reset-aligned Team Orchestrator product direction.

Current concise direction:

- `docs/product/direction/current-direction.md`

## Current Baseline

Team Orchestrator is a web-first, local-first agent orchestrator for solo developers and product operators.

Accepted baseline:

- `docs/product/architecture/decisions/0006-team-orchestrator-direction-and-agent-model.md`

Accepted architecture set:

- `docs/product/architecture/decisions/0007-agent-manifest-and-lifecycle-contract.md`
- `docs/product/architecture/decisions/0008-plugin-package-format.md`
- `docs/product/architecture/decisions/0009-task-mission-run-domain-model.md`
- `docs/product/architecture/decisions/0010-sqlite-app-state-architecture.md`
- `docs/product/architecture/decisions/0011-runtime-backend-interface.md`
- `docs/product/architecture/decisions/0012-event-artifact-observability-model.md`
- `docs/product/architecture/decisions/0013-safety-approval-and-loop-limit-model.md`
- `docs/product/architecture/decisions/0014-scheduling-model.md`

## Delivered Milestones

### Milestone 1: Foundation Reset

Goal: Establish the durable product substrate before rebuilding user-facing flows.

- Refinement epic: `docs/product/epics/refinement/2026.10.00-epic-team-orchestrator-foundation-reset.md`
- ADRs 0007 through 0014 accepted.
- Choose SQLite library and migration approach.
- Define first manifest schemas for plugins, agents, tasks, runs, and artifacts.
- Create a migration plan from current persona/session/fleet concepts to task/agent/run concepts.

### Milestone 2: Local Agent Catalog

Goal: Make formal agents visible and runnable from local plugin manifests.

- Refinement epic: `docs/product/epics/refinement/2026.11.00-epic-local-agent-catalog.md`
- Load local plugins from configured folders.
- Validate plugin and agent manifests.
- Index plugin and agent metadata into SQLite.
- Show base agents and installed plugin agents in the console.
- Render agent detail pages with inputs, capabilities, runtimes, permissions, and limits.

### Milestone 3: Task Workbench

Goal: Let a solo operator create and run useful manual tasks.

- Refinement epic: `docs/product/epics/refinement/2026.12.00-epic-task-workbench.md`
- Create tasks manually in the console.
- Assign compatible agents.
- Validate task inputs against the agent manifest.
- Start local-process task runs.
- Inspect run status, logs, events, artifacts, and final outputs.
- Capture follow-up tasks as proposed work.

### Milestone 4: Runtime Backends and Safety

Goal: Make execution pluggable and bounded.

- Refinement epic: `docs/product/epics/refinement/2026.13.00-epic-runtime-safety-backends.md`
- Add container-command backend.
- Add HTTP/API backend.
- Add JS/TS and Python module adapters if still warranted after local-command experience.
- Add LangGraph wrapper prototype.
- Enforce runtime duration, tool-call, retry, and repeated-action limits.
- Add risky-action approval records.

### Milestone 5: Missions and Workflow Templates

Goal: Compose tasks into repeatable work.

- Refinement epic: `docs/product/epics/refinement/2026.14.00-epic-missions-workflow-templates.md`
- Create missions with ordered tasks.
- Store dependency edges for future DAG execution.
- Add workflow templates supplied by plugins.
- Run sequential mission plans.
- Persist mission run history and task run lineage.

### Milestone 6: Scheduling

Goal: Make repeatable workflows run later or recurringly.

- Refinement epic: `docs/product/epics/refinement/2026.15.00-epic-scheduling.md`
- Add schedule creation for tasks, missions, and workflow templates.
- Add one-shot and recurring local schedules.
- Show schedule history, next run, last run, pause/resume/delete.
- Define missed-run behavior.

### Milestone 7: Workflow Template Operations

Goal: Make workflow templates practical to instantiate, run, schedule, and inspect.

- Completed stories: `docs/product/history/completed-stories/2026.16.01-instantiate-workflow-templates.md` through `docs/product/history/completed-stories/2026.16.06-add-durable-schedule-run-history.md`
- Instantiate workflow templates into executable missions.
- Add console flows for workflow-template instantiation and mission workbench operation.
- Persist mission run history.
- Schedule workflow templates.
- Record durable schedule run history.

## Current Milestone

### Milestone 8: Workflow DAG Engine

Goal: evolve workflow templates from sequential mission creation into restart-safe, DAG-capable workflow execution.

- Refinement epic: `docs/product/epics/refinement/2026.17.00-epic-workflow-dag-engine.md`
- Completed: `docs/product/history/completed-stories/2026.17.01-implement-workflow-dag-definition-parser.md`
- Active: `flywheel/backlog/engineering/active/STORY-20260528-workflow-state-store-resumption.md`
- Candidate next: visualizer-friendly workflow status API.

## Deferred

- Enterprise fleet governance.
- Cloud-first deployment.
- Remote plugin registry.
- Natural-language task planning as the primary workflow.
- Autonomous multi-agent proposal systems.
- Run templates, verification/evidence, and A2A observability until each is rewritten against the current task/mission/run/event model.

## Archived Snapshot

The superseded roadmap was archived to:

- `docs/product/archive/2026-product-direction-reset/roadmap-snapshot/backlog-roadmap.md`

Do not treat the archived fleet-governance/Azure-centered roadmap as active execution priority without rewriting it against the reset baseline.
