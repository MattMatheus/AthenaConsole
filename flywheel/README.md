# flywheel

Flywheel is a configurable workflow harness for human+agent delivery.

It is optimized for explicit queue movement, reviewable markdown artifacts, and cycle closure with durable observer records.

It preserves a staged operating model:
- planning
- architect
- engineering
- qa
- pm
- cycle

The harness is intended to run either:
- in a new repository with Flywheel-owned directories
- inside an existing repository by mapping Flywheel paths in `flywheel.yaml`

## Start
1. Review `flywheel.yaml`.
2. Read `flywheel/HUMANS.md`.
3. Read `flywheel/DEVELOPMENT_CYCLE.md`.
4. Read the stage prompts, process docs, and templates.
5. Populate the configured prompt, role, process, template, and backlog paths.
6. Run the harness tools from `flywheel/tools/` against the configured paths.

## Typical Use

### Add Flywheel To An Existing Repo
1. Copy `flywheel.yaml` to the repo root.
2. Copy the `flywheel/` directory into the repo.
3. Keep the default local paths if you want a self-contained workflow.
4. Edit `flywheel.yaml` only if you want Flywheel to point at existing repo directories.
5. Run `./flywheel/tools/run_doc_tests.sh`.

### Example Remap For An Existing Repo
If an existing project already has its own work directories, keep the Flywheel system under `flywheel/` and remap only the workflow-owned state:

```yaml
paths:
  prompts: "flywheel/prompts"
  roles: "flywheel/roles"
  process: "flywheel/process"
  templates: "flywheel/templates"
  artifacts:
    planning: "ops/planning"
    observer: "ops/observer"
    release: "ops/release"
  engineering:
    intake: "work/engineering/intake"
    ready: "work/engineering/ready"
    active: "work/engineering/active"
    qa: "work/engineering/qa"
    done: "work/engineering/done"
    blocked: "work/engineering/blocked"
    archive: "work/engineering/archive"
  architecture:
    intake: "work/architecture/intake"
    ready: "work/architecture/ready"
    active: "work/architecture/active"
    qa: "work/architecture/qa"
    done: "work/architecture/done"
    blocked: "work/architecture/blocked"
    archive: "work/architecture/archive"
```

This keeps the harness system contained in `flywheel/` while allowing backlog state and generated artifacts to live in project-native locations.

### Use Flywheel As A Self-Contained Local Workflow
- backlog state lives under `flywheel/backlog/`
- planning notes live under `flywheel/artifacts/planning/`
- observer reports live under `flywheel/artifacts/observer/`
- prompts, roles, process docs, and templates stay under `flywheel/`
- tools run from `flywheel/tools/`

## Operating Expectations
- artifact readiness is explicit, not implied
- handoffs record evidence, risks, and next-state recommendation
- observer reports act as compact execution traces, not just end-of-cycle notes
- risky or sensitive actions require explicit approval and recorded outcome

### Launch A Stage
- `./flywheel/tools/launch_stage.sh planning`
- `./flywheel/tools/launch_stage.sh architect`
- `./flywheel/tools/launch_stage.sh engineering`
- `./flywheel/tools/launch_stage.sh qa`
- `./flywheel/tools/launch_stage.sh pm`
- `./flywheel/tools/launch_stage.sh cycle`

For agent-native launch context, add `--format json`. The JSON form returns the selected stage, prompt path, selected story when one exists, input and output lanes, checklist items, exit gates, forbidden actions, and optional artifact workflow guidance.

### Validate Local Workflow State
- `./flywheel/tools/validate_workflow_state.sh`
- `./flywheel/tools/validate_workflow_state.sh --format json`

This validates configured backlog lanes, item metadata, status-to-lane consistency, duplicate IDs, expected item filename families, and active queue references. It is broader than intake validation and is intended as the local consistency gate for agent execution.

### Check Harness Health
- `./flywheel/tools/flywheel_doctor.sh`
- `./flywheel/tools/flywheel_doctor.sh --format json`

The doctor command checks required harness files, config loading, stage contracts, and local workflow state.

### Move Local Workflow State
- `./flywheel/tools/flywheel_state.sh move <item> <from-lane> <to-lane>`
- `./flywheel/tools/flywheel_state.sh move STORY-20260524-example active qa --reason "engineering handoff ready"`
- `./flywheel/tools/flywheel_state.sh move ARCH-20260524-example active qa --domain architecture --format json`

The state tool moves an item between configured lanes, updates its metadata status, and appends a transition history entry unless `--no-history` is passed. Use this instead of manually moving backlog files when practical.

### Record Explicit Approvals
- `./flywheel/tools/flywheel_approval.sh record --action-class risky-write --summary "<summary>" --approved-by "<name>"`
- `./flywheel/tools/flywheel_approval.sh record --action-class sensitive-or-production --summary "<summary>" --approved-by "<name>" --scope "<scope>" --risks "<risks>"`

Approval records are written under the configured observer artifact directory in `approvals/`. Use these records when work crosses from local write into risky, sensitive, or production-impacting action classes.

### Close A Cycle
- `./flywheel/tools/run_observer_cycle.sh --cycle-id <cycle-id>`

Observer closure writes both a markdown report and a structured JSON trace sidecar next to it. The markdown remains the human-readable record; the JSON sidecar is the agent-readable execution trace scaffold.

### Optional Artifact Workflow
Flywheel can surface artifact-tool commands without making that tool part of the harness contract.

Enable `integrations.artifact_workflow.enabled` in `flywheel.yaml` and point `integrations.artifact_workflow.command` at a wrapper such as `/Users/foundry/AgenticDevelopment/Tools/artifacts/flywheel-artifacts`.

When enabled:
- `launch_stage.sh` prints stage-specific artifact selection and manifest commands
- `run_observer_cycle.sh` prints a cycle-closure manifest command after writing the observer report
- `artifact_workflow.sh --format json` returns the same hints in machine-readable form for wrappers or agent tooling
- `artifact_workflow_commands.sh --stage <stage> --phase <entry|exit>` returns only the commands for one phase, which is usually the simplest interface for agents

## Blank Harness State
The distributed harness should start with empty live backlog and artifact lanes. Keep examples under `flywheel/examples/`, not in configured backlog or artifact directories.

## Core Files
- `flywheel.yaml`
- `flywheel/CONFIG_SCHEMA.md`
- `flywheel/HUMANS.md`
- `flywheel/AGENTS.md`
- `flywheel/DEVELOPMENT_CYCLE.md`

## First-Pass Intent
- Keep the workflow generic.
- Remove product-specific payload.
- Resolve all workflow locations through config.

## Tooling Direction
- Keep shell scripts as the stable local command surface.
- Move structured parsing, validation, and state logic into Python under `flywheel/tools/lib/`.
- Preserve markdown and YAML as the reviewable local source of truth.
- Prefer Python-backed tools for stage contracts, state mutation, validation, and observer trace generation.
- Keep editable stage behavior in `flywheel/stage_contracts.yaml`.
- Prefer YAML frontmatter in backlog items for machine-readable identity, status, kind, readiness, and routing metadata.
