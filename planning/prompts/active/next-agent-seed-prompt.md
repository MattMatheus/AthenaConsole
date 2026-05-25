<!-- AUDIENCE: Internal/Technical -->

# Next Agent Directive

Your task is to choose the next execution slice after the completed Team Orchestrator foundation reset.

## Primary Task

- **Completed Foundation Backlog:** `planning/backlog/completed/2026-product-direction-reset/`

Review the stories and their source ADRs:

- `planning/architecture/0007-agent-manifest-and-lifecycle-contract.md`
- `planning/architecture/0008-plugin-package-format.md`
- `planning/architecture/0010-sqlite-app-state-architecture.md`
- `planning/architecture/0009-task-mission-run-domain-model.md`
- `planning/architecture/0012-event-artifact-observability-model.md`

## Recommended Next Decision

The foundation track now has SQLite app state, manifest schemas, local plugin indexing, and task/mission/run repositories. Decide whether to:

- add API routes over the new repositories,
- start the task workbench console milestone,
- or add runtime backend integration against the new run model.

## Agent Workflow (Mandatory)

This project uses a single-agent directive model. As the active agent, you are responsible for the entire lifecycle of your assigned task.

Upon successful completion and validation of your work, you must prepare for the next agent. Before ending your session, you are required to:

1.  **Update the Handoff Artifact:** Truncate `planning/vision/handoff.md` and populate it with a concise summary of planning decisions, validation results, and any context necessary for the next agent.
2.  **Update the Backlog:** Move completed stories through the project workflow and update `planning/backlog/active/README.md` so the next story is clear.
3.  **Update this Directive:** Modify this file (`planning/prompts/active/next-agent-seed-prompt.md`) to point to the next planning or implementation artifact once the roadmap is rebuilt.
