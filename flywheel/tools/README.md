# Flywheel Tool Commands

These commands are the stable local interface for humans and agents. Shell scripts are the command surface; Python modules in `flywheel/tools/lib/` own structured logic.

## Stage Launch

```bash
./flywheel/tools/launch_stage.sh engineering
./flywheel/tools/launch_stage.sh engineering --format json
```

Use this to get stage context, selected work, lanes, checklist, exit gates, forbidden actions, and optional artifact workflow guidance.

## Workflow State Validation

```bash
./flywheel/tools/validate_workflow_state.sh
./flywheel/tools/validate_workflow_state.sh --format json
```

Use this after backlog state changes and before cycle closure.

## State Movement

```bash
./flywheel/tools/flywheel_state.sh move STORY-20260524-example active qa --reason "engineering handoff ready"
./flywheel/tools/flywheel_state.sh move ARCH-20260524-example active qa --domain architecture --format json
```

Use this instead of manually moving backlog files when practical. It moves the file, updates metadata status, and appends transition history.

## Observer Closure

```bash
./flywheel/tools/run_observer_cycle.sh --cycle-id <cycle-id>
./flywheel/tools/run_observer_cycle.sh --cycle-id <cycle-id> --story <path> --format json
```

Writes a markdown observer report plus a structured JSON trace sidecar.

## Approval Records

```bash
./flywheel/tools/flywheel_approval.sh record --action-class risky-write --summary "<summary>" --approved-by "<name>"
./flywheel/tools/flywheel_approval.sh record --action-class sensitive-or-production --summary "<summary>" --approved-by "<name>" --scope "<scope>" --risks "<risks>"
```

Use this when work requires explicit approval.

## Harness Doctor

```bash
./flywheel/tools/flywheel_doctor.sh
./flywheel/tools/flywheel_doctor.sh --format json
```

Runs local harness health checks for config, stage contracts, command files, and workflow state.

## Artifact Workflow Integration

```bash
./flywheel/tools/artifact_workflow.sh engineering --format json
./flywheel/tools/artifact_workflow_commands.sh --stage engineering --phase entry
```

Only emits guidance when `integrations.artifact_workflow.enabled` is `true` in `flywheel.yaml`.
