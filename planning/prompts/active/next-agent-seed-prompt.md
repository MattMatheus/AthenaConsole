<!-- AUDIENCE: Internal/Technical -->

# Next Agent Directive

Your task is to execute the next Team Orchestrator story.

## Primary Task

- **Backlog Item:** `planning/backlog/active/2026.15.03-build-schedule-ui.md`

Read the active story, then review its source decisions:

- `planning/architecture/0007-agent-manifest-and-lifecycle-contract.md`
- `planning/architecture/0008-plugin-package-format.md`
- `planning/architecture/0009-task-mission-run-domain-model.md`
- `planning/architecture/0010-sqlite-app-state-architecture.md`
- `planning/architecture/0011-runtime-backend-interface.md`
- `planning/architecture/0014-scheduling-model.md`
- `planning/backlog/completed/2026.12.01-add-task-apis.md`
- `planning/backlog/completed/2026.12.02-build-manual-task-create-flow.md`
- `planning/backlog/completed/2026.12.03-implement-local-process-task-runs.md`
- `planning/backlog/completed/2026.12.04-build-run-inspection-view.md`
- `planning/backlog/completed/2026.13.01-add-container-command-backend.md`
- `planning/backlog/completed/2026.13.02-add-http-api-backend-prototype.md`
- `planning/backlog/completed/2026.13.03-enforce-approval-and-limit-defaults.md`
- `planning/backlog/completed/2026.14.01-add-mission-apis.md`
- `planning/backlog/completed/2026.14.02-add-workflow-template-indexing.md`
- `planning/backlog/completed/2026.14.03-run-sequential-mission-plans.md`
- `planning/backlog/completed/2026.15.01-add-task-schedule-model-and-api.md`
- `planning/backlog/completed/2026.15.02-add-local-scheduler-service.md`
- `planning/backlog/refinement/2026.15.00-epic-scheduling.md`
- `planning/backlog/refinement/2026.14.00-epic-missions-workflow-templates.md`

## Current Context

The foundation track now has SQLite app state, manifest schemas, local plugin indexing, task/mission/run repositories, a local agent catalog API/service surface, console catalog/detail pages, task workbench APIs, the first manual task creation UI, local-process task execution, the first run inspection view, container-command and HTTP/API task backends, first-pass approval/limit enforcement, mission creation/task-ordering APIs, workflow template manifest indexing/listing, sequential mission task execution, task-target schedule configuration APIs, and local due-schedule execution through the task workbench. The next slice builds the first console schedule management surface for task-target schedules.

## Agent Workflow (Mandatory)

This project uses a single-agent directive model. As the active agent, you are responsible for the entire lifecycle of your assigned task.

Upon successful completion and validation of your work, you must prepare for the next agent. Before ending your session, you are required to:

1.  **Update the Handoff Artifact:** Truncate `planning/vision/handoff.md` and populate it with a concise summary of planning decisions, validation results, and any context necessary for the next agent.
2.  **Update the Backlog:** Move completed stories through the project workflow and update `planning/backlog/active/README.md` so the next story is clear.
3.  **Update this Directive:** Modify this file (`planning/prompts/active/next-agent-seed-prompt.md`) to point to the next planning or implementation artifact once the roadmap is rebuilt.
