# Development Cycle

Flywheel runs a staged workflow with explicit queue movement and cycle closure.

## Canonical Flow
1. Planning creates or refines intake work.
2. Architect processes architecture decision work when needed.
3. PM maintains clear, ordered active queues.
4. Engineering executes the top active implementation story.
5. QA validates the story and decides `done` or return to `active`.
6. Local workflow state is validated when queue state changed.
7. Observer records the completed cycle as markdown plus structured JSON trace.
8. A single cycle commit closes the work.

## Stages

### Planning
- Capture goals, constraints, and risks.
- Make assumptions explicit.
- Create intake artifacts.
- Recommend the next stage.
- Do not implement production changes.

### Architect
- Execute architecture decision stories.
- Produce decision artifacts with alternatives, tradeoffs, and operational impact.
- Produce follow-on implementation paths.
- Do not replace implementation work with architecture work.

### Engineering
- Execute the top active engineering story.
- Update tests and prepare handoff.
- Record validation evidence, open risks, and QA focus areas.
- Move work to QA.
- Do not create the cycle commit yet.

### QA
- Validate acceptance criteria and regression risk.
- Treat missing validation evidence as a blocking quality issue.
- File defects when required.
- Move the story to `done` or back to `active`.
- Run observer and close the cycle commit.

### PM
- Refine intake items.
- Rank the active queue.
- Keep work bounded, explicit, and testable.

### Cycle
- Alternate engineering and QA until the configured engineering active queue is empty.

## Invariants
- Required branch is set by `workflow.required_branch`.
- Commit format is set by `workflow.cycle_commit_format`.
- Workflow locations are resolved from `flywheel.yaml`.
- Stage launch context is available in human-readable text and machine-readable JSON.
- Stage launch behavior is sourced from `flywheel/stage_contracts.yaml`.
- Backlog movement should use the local state tool when practical so lane placement, frontmatter status, metadata status, transition history, and lane README queues are updated together.
- Backlog state should pass `flywheel/tools/validate_workflow_state.sh` before cycle closure.
- Observer is part of cycle closure, not optional cleanup.
- Artifact readiness must be explicit before promotion.
- Optional artifact-tool usage may be surfaced by config, but Flywheel core does not require that integration.
- When the optional artifact workflow integration is enabled, agents should consult `flywheel/tools/artifact_workflow.sh <stage> --format json` for machine-readable stage entry and exit artifact guidance.
- Risky or sensitive actions require explicit approval and recorded outcome.
- Approval-governed work should use `flywheel/tools/flywheel_approval.sh record ...`.
- Workflow changes require synchronized updates across docs, prompts, and tools.

## Empty Queue Rule
If the configured engineering active lane is empty, the harness should report `no stories` and route work toward planning or PM refinement instead of inventing execution work.

## Examples
Lifecycle examples may live under `flywheel/examples/`. They are not active backlog state and should not be moved through lanes unless copied into intake as real work.
