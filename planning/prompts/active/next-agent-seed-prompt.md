<!-- AUDIENCE: Internal/Technical -->

# Next Agent Directive

Your task is to execute the next Team Orchestrator story.

## Primary Task

- **Backlog Item:** `planning/backlog/active/2026.13.01-add-container-command-backend.md`

Read the active story, then review its source decisions:

- `planning/architecture/0007-agent-manifest-and-lifecycle-contract.md`
- `planning/architecture/0009-task-mission-run-domain-model.md`
- `planning/architecture/0011-runtime-backend-interface.md`
- `planning/architecture/0012-event-artifact-observability-model.md`
- `planning/architecture/0013-safety-approval-and-loop-limit-model.md`
- `planning/backlog/refinement/2026.12.00-epic-task-workbench.md`
- `planning/backlog/completed/2026.12.01-add-task-apis.md`
- `planning/backlog/completed/2026.12.02-build-manual-task-create-flow.md`
- `planning/backlog/completed/2026.12.03-implement-local-process-task-runs.md`
- `planning/backlog/completed/2026.12.04-build-run-inspection-view.md`
- `planning/backlog/refinement/2026.13.00-epic-runtime-safety-backends.md`

## Current Context

The foundation track now has SQLite app state, manifest schemas, local plugin indexing, task/mission/run repositories, a local agent catalog API/service surface, console catalog/detail pages, task workbench APIs, the first manual task creation UI, local-process task execution, and the first run inspection view. The next slice starts the Runtime Backends and Safety milestone with a container-command task execution backend.

## Agent Workflow (Mandatory)

This project uses a single-agent directive model. As the active agent, you are responsible for the entire lifecycle of your assigned task.

Upon successful completion and validation of your work, you must prepare for the next agent. Before ending your session, you are required to:

1.  **Update the Handoff Artifact:** Truncate `planning/vision/handoff.md` and populate it with a concise summary of planning decisions, validation results, and any context necessary for the next agent.
2.  **Update the Backlog:** Move completed stories through the project workflow and update `planning/backlog/active/README.md` so the next story is clear.
3.  **Update this Directive:** Modify this file (`planning/prompts/active/next-agent-seed-prompt.md`) to point to the next planning or implementation artifact once the roadmap is rebuilt.
