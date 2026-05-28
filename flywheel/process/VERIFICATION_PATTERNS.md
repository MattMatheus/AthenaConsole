# Verification Patterns

Use the narrowest credible validation set for the touched change.

## Minimum Expectations
- implementation work includes validation evidence
- QA reviews both acceptance criteria and regression risk
- missing validation evidence is treated as a quality problem
- unavailable checks are recorded explicitly with reason and residual risk
- backlog lane and metadata consistency are checked with `flywheel/tools/validate_workflow_state.sh` when workflow state changes
- observer closure writes a JSON trace sidecar for agent-readable cycle evidence
- handoff sections are validated for QA/done lane items
- approval-governed work has an explicit approval record when practical

## Escalation
- broaden validation when risk is high
- record unavailable tools explicitly rather than silently skipping them
