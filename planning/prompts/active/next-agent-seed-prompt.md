<!-- AUDIENCE: Internal/Technical -->

# Next Agent Directive

Your task is to begin the next development cycle by executing the top story in the active backlog.

## Primary Task

- **Backlog Item:** `planning/backlog/active/05.01-create-fleet-api-service-for-ui.md`

Review the story and its acceptance criteria, then implement a typed Fleet API service for UI usage. Focus on `/fleet/summary` request handling, contract-aligned response typing, and clear error handling behavior for UI consumers.

## Agent Workflow (Mandatory)

This project uses a single-agent directive model. As the active agent, you are responsible for the entire lifecycle of your assigned task.

Upon successful completion and validation of your work, you must prepare for the next agent. Before ending your session, you are required to:

1.  **Update the Handoff Artifact:** Truncate `planning/vision/handoff.md` and populate it with a concise summary of your deliverables, validation results, and any context necessary for the next agent. Aggressively truncate any information not required for the handoff. You may preview the next task to determine relevant handoff information.
2.  **Update the Backlog:** Move your completed story from `planning/backlog/active/` to `planning/backlog/completed/` and update `planning/backlog/active/README.md`.
3.  **Update this Directive:** Modify this file (`planning/prompts/active/next-agent-seed-prompt.md`) to point to the *next* story in the backlog.
