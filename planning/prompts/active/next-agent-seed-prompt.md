<!-- AUDIENCE: Internal/Technical -->

# Next Agent Directive

Your task is to execute the next Team Orchestrator story.

## Primary Task

- **Backlog Item:** `planning/backlog/active/2026.12.01-add-task-apis.md`

Read the active story, then review its source decisions:

- `planning/architecture/0009-task-mission-run-domain-model.md`
- `planning/architecture/0010-sqlite-app-state-architecture.md`
- `planning/architecture/0011-runtime-backend-interface.md`
- `planning/architecture/0012-event-artifact-observability-model.md`
- `planning/architecture/0013-safety-approval-and-loop-limit-model.md`
- `planning/backlog/refinement/2026.12.00-epic-task-workbench.md`

## Current Context

The foundation track now has SQLite app state, manifest schemas, local plugin indexing, task/mission/run repositories, a local agent catalog API/service surface, and console catalog/detail pages. The next slice starts the task workbench by exposing task APIs over the existing SQLite repositories.

## Agent Workflow (Mandatory)

This project uses a single-agent directive model. As the active agent, you are responsible for the entire lifecycle of your assigned task.

Upon successful completion and validation of your work, you must prepare for the next agent. Before ending your session, you are required to:

1.  **Update the Handoff Artifact:** Truncate `planning/vision/handoff.md` and populate it with a concise summary of planning decisions, validation results, and any context necessary for the next agent.
2.  **Update the Backlog:** Move completed stories through the project workflow and update `planning/backlog/active/README.md` so the next story is clear.
3.  **Update this Directive:** Modify this file (`planning/prompts/active/next-agent-seed-prompt.md`) to point to the next planning or implementation artifact once the roadmap is rebuilt.
