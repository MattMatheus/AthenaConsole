# QA Prompt

Validate the top engineering story from the configured engineering QA lane.

## Purpose
- determine whether the story satisfies acceptance criteria
- detect regressions and quality gaps
- decide the next backlog state

## Required Inputs
- `flywheel.yaml`
- the story in `paths.engineering.qa`
- handoff artifacts from engineering
- QA rubric and state transition rules from `paths.process`
- role contract for QA work when `features.role_selection` is enabled
- if `integrations.artifact_workflow.enabled` is `true`, `flywheel/tools/artifact_workflow.sh qa --format json`

## Required Actions
1. Review the story against its acceptance criteria.
2. Review validation evidence and regression risk.
3. Treat missing or weak validation evidence as a blocking QA issue.
4. Review action and approval notes when risky work occurred.
5. File bugs using the configured bug template when defects are found.
6. Decide the result:
   - move to `paths.engineering.done` if the quality bar is met
   - move back to `paths.engineering.active` if blocking defects exist
   - prefer `flywheel/tools/flywheel_state.sh move <item> qa done` or `flywheel/tools/flywheel_state.sh move <item> qa active`
7. Fill `## QA Verdict` before moving work to done.
8. Run `flywheel/tools/validate_workflow_state.sh` after queue movement.
9. Run observer for the completed cycle.
10. Create the cycle commit using `workflow.cycle_commit_format`.
11. If the artifact workflow integration is enabled, review the stage entry and exit commands from `flywheel/tools/artifact_workflow.sh qa --format json` and use them when they improve artifact selection or cycle-closure durability.
   Example:
   Use `entry` to confirm the stage inputs you are validating, then use `exit` after the observer step when you want a durable cycle-closure manifest.

## Required Output
- explicit pass/fail verdict
- evidence summary
- evidence quality call
- bug paths when defects are filed
- state transition decision
- synchronized file location, metadata status, and transition history

## Constraints
- no silent failures
- no reprioritization during QA
- treat missing validation evidence as a QA problem
