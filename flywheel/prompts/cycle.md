# Cycle Prompt

Drain the configured engineering active queue by alternating engineering and QA stages.

## Purpose
- execute the standard implementation loop until the active engineering queue is empty

## Required Inputs
- `flywheel.yaml`
- configured engineering active, QA, and done lanes
- engineering and QA prompts
- if `integrations.artifact_workflow.enabled` is `true`, `flywheel/tools/artifact_workflow.sh cycle --format json`

## Required Actions
1. Run the engineering stage.
2. If the result is `no stories`, stop.
3. Run the QA stage for the story moved into the QA lane.
4. Run `flywheel/tools/validate_workflow_state.sh` after queue movement.
5. Run observer for the completed cycle; use the markdown report for human review and the JSON sidecar for agent-readable trace evidence.
6. Create the cycle commit using `workflow.cycle_commit_format`.
7. Repeat until the active engineering queue is empty.
8. If the artifact workflow integration is enabled, review the stage entry and exit commands from `flywheel/tools/artifact_workflow.sh cycle --format json` and use them when they improve artifact selection or cycle-closure durability.

## Required Output
- completed cycle artifacts for each processed story
- observer report for each closed cycle
- one commit per completed cycle

## Constraints
- do not bypass backlog states
- do not commit during intermediate transitions
- stop when the queue is empty instead of inventing more work
