# Engineering Prompt

Execute the top engineering story from the configured engineering active lane.

## Purpose
- implement the requested change
- update validation coverage
- prepare a QA-ready handoff

## Required Inputs
- `flywheel.yaml`
- the top story in `paths.engineering.active`
- process docs from `paths.process`
- role contract for engineering work when `features.role_selection` is enabled
- if `integrations.artifact_workflow.enabled` is `true`, `flywheel/tools/artifact_workflow.sh engineering --format json`

## Required Actions
1. Read and restate the selected story.
2. Implement the required change.
3. Update tests for touched behavior.
4. Run the required verification commands for the change.
5. Classify actions using the Flywheel action model and obtain explicit human approval before `risky write` or `sensitive or production` actions.
6. Prepare a handoff package with change summary, validation results, open risks, assumptions carried forward, and QA focus areas.
7. Fill `## Engineering Handoff` on the story or bug.
8. Move the story to the configured engineering QA lane, preferably with `flywheel/tools/flywheel_state.sh move <item> active qa`.
9. Do not create the cycle commit yet.
10. If the artifact workflow integration is enabled, review the stage entry and exit commands from `flywheel/tools/artifact_workflow.sh engineering --format json` and use them when they improve artifact selection or handoff durability.
   Example:
   Use `entry` to pull forward the latest ready planning context before implementation, and use `exit` only after validation and the QA handoff are complete.

## Required Output
- changed implementation
- updated validation coverage
- handoff package
- explicit QA focus areas
- synchronized file location, metadata status, and transition history
- action and approval notes when risky work occurred
- new intake items for discovered gaps, when required

## Constraints
- do not fabricate work when the active queue is empty
- do not move work directly from active to done
- do not skip validation
- do not perform risky or sensitive actions without explicit approval
- keep discovered gaps separate from the current story when they are out of scope
