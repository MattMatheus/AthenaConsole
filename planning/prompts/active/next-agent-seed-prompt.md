<!-- AUDIENCE: Internal/Technical -->

# Next Agent Directive

Your task is to execute the next Team Orchestrator story.

## Primary Task

- **Backlog Item:** `planning/backlog/active/2026.16.03-build-mission-workbench-ui.md`

Read the active story, then review its source decisions:

- `planning/architecture/0009-task-mission-run-domain-model.md`
- `planning/architecture/0010-sqlite-app-state-architecture.md`
- `planning/architecture/0011-runtime-backend-interface.md`
- `planning/backlog/completed/2026.14.01-add-mission-apis.md`
- `planning/backlog/completed/2026.14.03-run-sequential-mission-plans.md`
- `planning/backlog/completed/2026.16.01-instantiate-workflow-templates.md`
- `planning/backlog/completed/2026.16.02-build-workflow-template-instantiation-ui.md`
- `planning/backlog/refinement/2026.14.00-epic-missions-workflow-templates.md`

## Current Context

The foundation track now has SQLite app state, manifest schemas, local plugin indexing, task/mission/run repositories, local agent catalog API/service surfaces, console catalog/detail pages, task workbench APIs, manual task creation UI, local-process task execution, run inspection, container-command and HTTP/API task backends, approval/limit defaults, mission APIs, workflow template indexing/listing, sequential mission task execution, task-target schedules, local due-schedule execution, schedule management UI, backend workflow-template instantiation, and a console workflow-template instantiation surface.

The next slice should make missions first-class in the console. It should list missions, show ordered mission tasks, start sequential mission runs through `POST /api/v1/missions/:id/run`, and link workflow-template instantiation results to the mission workbench once that route exists.

## Agent Workflow (Mandatory)

This project uses a single-agent directive model. As the active agent, you are responsible for the entire lifecycle of your assigned task.

Upon successful completion and validation of your work, you must prepare for the next agent. Before ending your session, you are required to:

1. Update the handoff artifact by truncating `planning/vision/handoff.md` and populating it with a concise summary of planning decisions, validation results, and any context necessary for the next agent.
2. Update the backlog by moving completed stories through the project workflow and updating `planning/backlog/active/README.md` so the next story is clear.
3. Update this directive to point to the next planning or implementation artifact.
