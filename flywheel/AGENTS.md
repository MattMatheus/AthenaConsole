# AGENTS

Agent operating guide for the Flywheel workflow harness.

## Mission
Execute work through the configured Flywheel stages without relying on product-specific assumptions.

## First 5 Minutes
1. Read `flywheel.yaml`.
2. Read `flywheel/HUMANS.md`.
3. Read `flywheel/DEVELOPMENT_CYCLE.md`.
4. Read `flywheel/tools/README.md` for the local command surface when needed.
5. Read the stage prompt from `paths.prompts`.
6. Read the relevant role contract from `paths.roles` when role selection is enabled.
7. If `integrations.artifact_workflow.enabled` is `true`, read `flywheel/tools/artifact_workflow.sh <stage> --format json` for stage-specific artifact guidance.
8. Prefer `flywheel/tools/launch_stage.sh <stage> --format json` when you need machine-readable stage context.
9. Treat `flywheel/stage_contracts.yaml` as the editable machine-readable source for stage launch contracts.

## Stage Prompts
Flywheel expects stage prompts for:
- planning
- architect
- engineering
- qa
- pm
- cycle

These should be resolved from `paths.prompts`.

## Mandatory Rules
- Respect `workflow.required_branch`.
- Use only the configured backlog and artifact paths.
- Respect explicit backlog state transitions.
- Do not fabricate work when the active lane is empty.
- Do not commit during intermediate stage transitions.
- Use one commit per completed cycle.
- Generate an observer artifact through `flywheel/tools/run_observer_cycle.sh` at cycle closure.
- Use `flywheel/tools/flywheel_state.sh move ...` for backlog lane movement when practical so status metadata and transition history stay synchronized.
- Treat QA as a gate, not a suggestion.
- Treat artifact readiness as explicit, not implied.
- Record evidence, risks, and next-state recommendation in stage handoffs.
- Treat `flywheel/tools/validate_workflow_state.sh` as the local consistency gate for backlog state before cycle closure or after workflow-state changes.
- Use `flywheel/tools/flywheel_doctor.sh` for whole-harness health checks.
- Treat the JSON trace written by `flywheel/tools/run_observer_cycle.sh` as the machine-readable observer artifact and the markdown report as the human-readable projection.
- Treat the artifact tool as an optional integration and use it only when the repo config enables it.
- When the artifact workflow integration is enabled, treat `flywheel/tools/artifact_workflow.sh --format json` as the canonical machine-readable source for stage entry and exit artifact guidance.
- Interpret the JSON output consistently:
  - `entry` commands help you discover or read the artifact inputs for the current stage.
  - `exit` commands help you write durable handoff or cycle-closure records after the stage work is complete.
- If you only need one phase, prefer `flywheel/tools/artifact_workflow_commands.sh --stage <stage> --phase <entry|exit>` to avoid reparsing the full JSON payload.
- Use the smallest useful action model:
  - `read`
  - `local write`
  - `risky write`
  - `sensitive or production`
- Require explicit human approval for `risky write` and `sensitive or production` actions.
- Record approval outcome when approval-governed work occurs.
- Use `flywheel/tools/flywheel_approval.sh record ...` when approval-governed work occurs.

## Required Sync
When workflow behavior changes, update together:
- `flywheel/HUMANS.md`
- `flywheel/AGENTS.md`
- `flywheel/DEVELOPMENT_CYCLE.md`
- the affected prompts
- the affected process docs
- any affected tool behavior
- `flywheel/stage_contracts.yaml` when launch contract behavior changes

## Scope
Flywheel defines workflow behavior, not product strategy.

If a host repository needs product planning, release management, metrics, or additional governance, those should be layered on top of Flywheel rather than embedded into the core harness.
