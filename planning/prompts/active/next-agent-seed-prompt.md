<!-- AUDIENCE: Internal/Technical -->

# Next Agent Directive

Your task is to execute the next Team Orchestrator story.

## Primary Task

- **Backlog Item:** `planning/backlog/active/2026.17.02-implement-workflow-state-store-and-resumption-logic.md`

Read the active story, then review its source decisions:

- `planning/architecture/0008-plugin-package-format.md`
- `planning/architecture/0009-task-mission-run-domain-model.md`
- `planning/architecture/0011-runtime-backend-interface.md`
- `planning/architecture/0012-event-artifact-observability-model.md`
- `planning/backlog/refinement/26.00-epic-workflow-dag-engine.md`
- `planning/backlog/refinement/2026.14.00-epic-missions-workflow-templates.md`
- `planning/backlog/completed/2026.17.01-implement-workflow-dag-definition-parser.md`

## Current Context

The foundation track now has SQLite app state, manifest schemas, local plugin indexing, task/mission/run/event/artifact repositories, local agent catalog API/service surfaces, console catalog/detail pages, task workbench APIs, manual task creation UI, local-process task execution, run inspection, container-command and HTTP/API task backends, approval/limit defaults, mission APIs, workflow template indexing/listing, sequential mission task execution, task-target schedules, local due-schedule execution, schedule management UI, backend workflow-template instantiation, console workflow-template instantiation, a mission workbench UI, durable mission run history, workflow-template schedules, durable schedule run history for task and workflow-template schedules, and a workflow-template DAG parser/validator.

The next slice should add durable workflow run state and resumption logic. Start from the parsed workflow-template DAG output and existing mission/run/event repositories, while preserving current mission run and workflow-template instantiation behavior.

## Agent Workflow (Mandatory)

This project uses a single-agent directive model. As the active agent, you are responsible for the entire lifecycle of your assigned task.

Upon successful completion and validation of your work, you must prepare for the next agent. Before ending your session, you are required to:

1. Update the handoff artifact by truncating `planning/vision/handoff.md` and populating it with a concise summary of planning decisions, validation results, and any context necessary for the next agent.
2. Update the backlog by moving completed stories through the project workflow and updating `planning/backlog/active/README.md` so the next story is clear.
3. Update this directive to point to the next planning or implementation artifact.
