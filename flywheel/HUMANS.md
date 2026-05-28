# HUMANS

Operator guide for the Flywheel workflow harness.

## Purpose
Flywheel provides a staged workflow for planning, architecture, implementation, QA, PM refinement, and cycle closure.

The harness does not require a product-specific repo layout. Operators should use the locations defined in `flywheel.yaml`.

## Operator Entry
1. Read `flywheel.yaml`.
2. Confirm the current branch matches `workflow.required_branch`.
3. Read `flywheel/DEVELOPMENT_CYCLE.md`.
4. Open the configured engineering active queue.
5. Launch the required stage through `flywheel/tools/launch_stage.sh`.
6. Use `flywheel/tools/launch_stage.sh <stage> --format json` when delegating to an agent that benefits from structured launch context.
7. Use `flywheel/tools/flywheel_doctor.sh` when checking harness readiness.

## Stage Order
- Planning: shape new work and create intake artifacts.
- Architect: process architecture/design decision work.
- Engineering: implement the top active engineering story.
- QA: validate the engineering story and decide `done` or return to `active`.
- PM: refine intake and maintain queue order.
- Cycle: alternate engineering and QA until the active queue is drained.

## Core Rules
- Do not invent work when the configured active queue is empty.
- Use explicit backlog state transitions.
- Do not commit during intermediate stage transitions.
- Close each completed cycle with an observer report.
- Use one commit per completed cycle.
- Prefer `flywheel/tools/flywheel_state.sh move ...` for backlog lane movement so file location, metadata status, and transition history remain synchronized.
- Treat artifact readiness as explicit, not implied.
- Record validation evidence, open risks, and next-state recommendation in handoffs.
- Validate local backlog state with `flywheel/tools/validate_workflow_state.sh` before cycle closure when queue state changed.
- Use the smallest useful action model:
  - `read`
  - `local write`
  - `risky write`
  - `sensitive or production`
- Require explicit human approval for `risky write` and `sensitive or production` actions.
- Record approval outcome when approval-governed work occurs.
- Record approval-governed work with `flywheel/tools/flywheel_approval.sh record ...` when practical.
- Keep prompts, process docs, and tool behavior synchronized when the workflow changes.
- Treat the artifact tool as an optional integration, not required Flywheel core behavior, unless the repo explicitly enables it in config.

## Config-Owned Surfaces
These locations are owned by `flywheel.yaml`:
- prompt directory
- role directory
- process directory
- template directory
- planning artifact directory
- observer artifact directory
- engineering lanes
- architecture lanes

`flywheel/stage_contracts.yaml` owns machine-readable stage launch behavior.

Examples live under `flywheel/examples/` and should not be treated as active work.

## Minimal Operator Checklist
1. Select the stage.
2. Read the stage prompt from the configured prompt directory.
3. Work only in the configured backlog lanes and artifact directories.
4. Produce the required handoff for the stage.
5. Move backlog items with `flywheel/tools/flywheel_state.sh move ...` when practical.
6. Run `flywheel/tools/validate_workflow_state.sh` when backlog state changed.
7. Run `flywheel/tools/run_observer_cycle.sh` at cycle closure.
8. Commit using `workflow.cycle_commit_format`.

If `integrations.artifact_workflow.enabled` is `true`, use the artifact-tool commands surfaced by `launch_stage.sh` and `run_observer_cycle.sh` when they help with artifact selection or durable handoff records.

If you need to automate around those hints, `flywheel/tools/artifact_workflow.sh --format json` provides the same guidance in machine-readable form.

When agents are running a stage, prefer telling them to consult `flywheel/tools/artifact_workflow.sh <stage> --format json` at stage entry and exit instead of relying on prose-only reminders.

If the agent only needs one phase, prefer `flywheel/tools/artifact_workflow_commands.sh --stage <stage> --phase <entry|exit>` to avoid extra parsing.
