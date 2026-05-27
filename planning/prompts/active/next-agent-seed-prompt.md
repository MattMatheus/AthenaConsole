<!-- AUDIENCE: Internal/Technical -->

# Next Agent Directive

Your task is to execute the next Team Orchestrator story.

## Primary Task

- **Backlog Item:** `planning/backlog/active/2026.16.06-add-durable-schedule-run-history.md`

Read the active story, then review its source decisions:

- `planning/architecture/0014-scheduling-model.md`
- `planning/backlog/completed/2026.15.01-add-task-schedule-model-and-api.md`
- `planning/backlog/completed/2026.15.02-add-local-scheduler-service.md`
- `planning/backlog/completed/2026.15.03-build-schedule-ui.md`
- `planning/backlog/completed/2026.16.05-schedule-workflow-templates.md`
- `planning/backlog/refinement/2026.15.00-epic-scheduling.md`
- `planning/backlog/refinement/2026.14.00-epic-missions-workflow-templates.md`

## Current Context

The foundation track now has SQLite app state, manifest schemas, local plugin indexing, task/mission/run/event/artifact repositories, local agent catalog API/service surfaces, console catalog/detail pages, task workbench APIs, manual task creation UI, local-process task execution, run inspection, container-command and HTTP/API task backends, approval/limit defaults, mission APIs, workflow template indexing/listing, sequential mission task execution, task-target schedules, local due-schedule execution, schedule management UI, backend workflow-template instantiation, console workflow-template instantiation, a mission workbench UI, durable mission run history, and workflow-template schedules that instantiate fresh missions/tasks.

The next slice should make schedule execution history durable for app-state schedules. Task schedules and workflow-template schedules should both retain recent execution attempts after refresh/restart, and the schedule UI should expose those attempts with task run and mission links.

## Agent Workflow (Mandatory)

This project uses a single-agent directive model. As the active agent, you are responsible for the entire lifecycle of your assigned task.

Upon successful completion and validation of your work, you must prepare for the next agent. Before ending your session, you are required to:

1. Update the handoff artifact by truncating `planning/vision/handoff.md` and populating it with a concise summary of planning decisions, validation results, and any context necessary for the next agent.
2. Update the backlog by moving completed stories through the project workflow and updating `planning/backlog/active/README.md` so the next story is clear.
3. Update this directive to point to the next planning or implementation artifact.
