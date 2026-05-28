# Architect Prompt

Execute the top architecture story from the configured architecture active lane.

## Purpose
- process decision and design work
- update architecture artifacts
- create follow-on implementation paths where needed

## Required Inputs
- `flywheel.yaml`
- the top story in `paths.architecture.active`
- process docs from `paths.process`
- role contract for architecture work when `features.role_selection` is enabled
- if `integrations.artifact_workflow.enabled` is `true`, `flywheel/tools/artifact_workflow.sh architect --format json`

## Required Actions
1. Restate the decision scope and non-goals.
2. Update architecture artifacts needed to satisfy the story.
3. Record alternatives considered, tradeoffs, risks, and accepted constraints.
4. Record operational impact and follow-up consequences when the decision changes system behavior or ownership.
5. Identify follow-on implementation work and place it in engineering intake when required.
6. Prepare a handoff for architecture QA or review.
7. Move the story to the configured architecture QA lane.
8. Run observer if the host workflow closes architecture cycles independently.
9. If the artifact workflow integration is enabled, review the stage entry and exit commands from `flywheel/tools/artifact_workflow.sh architect --format json` and use them when they improve artifact selection or handoff durability.

## Required Output
- updated architecture artifact paths
- alternatives considered
- risks and mitigations
- operational impact
- follow-on implementation artifact paths
- next-state recommendation

## Constraints
- do not replace implementation with architecture discussion
- do not move architecture work directly to done
- keep architecture output reviewable and concrete
