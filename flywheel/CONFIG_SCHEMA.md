# Flywheel Config Schema

`flywheel.yaml` defines the host-project interface for the Flywheel harness.

## Goals
- Keep the harness generic.
- Remove hardcoded product-specific repo layout.
- Support both greenfield repos and existing repos.

## Keys

### `version`
- Schema version for future migrations.
- First pass uses `1`.

### `workflow.required_branch`
- Branch that stage launchers require before they run.
- Replaces hardcoded branch assumptions like `dev`.

### `workflow.cycle_commit_format`
- Commit subject template for completed cycles.
- `{cycle_id}` is the only required placeholder in the first pass.

### `paths.prompts`
- Directory containing stage prompts.

### `paths.roles`
- Directory containing role/persona contracts.

### `paths.process`
- Directory containing workflow/process docs.

### `paths.templates`
- Directory containing reusable markdown templates.

### `paths.artifacts.*`
- Output locations for generated workflow artifacts.
- `planning`: planning notes created during planning stage.
- `observer`: observer reports created at cycle closure. These should capture objective, evidence, validation, risks, action class, approval context, and next step.
- `release`: optional release bundle location.

### `paths.engineering.*`
- Logical lane locations for engineering workflow state.
- Required lanes:
  - `intake`
  - `ready`
  - `active`
  - `qa`
  - `done`
  - `blocked`
  - `archive`

### `paths.architecture.*`
- Logical lane locations for architecture workflow state.
- Same required lanes as engineering.

### `templates.*`
- Template filenames resolved relative to `paths.templates`.
- First-pass required templates:
  - story
  - bug
  - architecture_story
  - observer_report
- Host repos may extend template structure, but Flywheel expects reviewable artifacts with explicit scope, evidence, risks, and next-state recommendation.

### `artifacts.*_pattern`
- Naming patterns for generated files.
- First-pass placeholders:
  - `{date}`
  - `{slug}`
  - `{cycle_id}`
  - `{release_id}`

### `features.*`
- Optional harness capabilities.
- `planning_notes`: whether planning writes a note artifact.
- `release_bundles`: whether release bundles are part of the workflow.
- `api_adapter`: whether launch/observer tools include policy/API adapter behavior.
- `role_selection`: whether prompts explicitly route through role contracts.

### `integrations.artifact_workflow.*`
- Optional artifact-tool bridge for repos that want Flywheel to surface artifact selection and manifest commands without hard-coupling the harness to that tool.
- `enabled`: when `true`, stage launch and observer tools print artifact-tool commands relevant to that stage.
- `command`: shell command used to invoke the artifact tool, typically a wrapper such as `/Users/.../Tools/artifacts/flywheel-artifacts`.
- `flywheel/tools/artifact_workflow.sh` supports `--format text|json` so wrappers can consume the integration hints without parsing human-oriented stage output.

## First-Pass Constraints
- All configured paths should be repo-relative.
- Flywheel should not assume a product-specific top-level directory.
- Planning and PM remain first-class stages, but they must target configured artifact paths instead of project-specific research or roadmap directories.
- Observer remains part of the core harness.
- Risky or sensitive actions should be governed by host-repo approval policy layered on top of the harness docs and prompts.

## Stage Contracts
- `flywheel/stage_contracts.yaml` defines machine-readable stage launch contracts.
- Stage contracts include prompt filename, lane inputs and outputs, checklist, exit gates, and forbidden actions.
- `flywheel/tools/launch_stage.sh` reads this file and emits either text or JSON launch context.

## Examples
- `flywheel/examples/` may contain documentation-only examples.
- Example files must not be placed in configured backlog or artifact lanes.
- Live backlog and artifact lanes should start blank except for lane `README.md` files.

## Backlog Item Frontmatter
- Backlog templates should include YAML frontmatter for machine-readable identity and routing.
- Recommended fields:
  - `kind`
  - `id`
  - `status`
  - `ready`
  - role/source fields relevant to the item type
- Markdown metadata remains the human-readable compatibility layer until existing items are migrated.

## Implementation Guidance
- Tools should load `flywheel.yaml` before resolving any workflow paths.
- Prompts and entry docs should reference logical artifact types, not hardcoded repo folders, unless those paths are provided by config.
- If a feature is disabled, tools should degrade cleanly rather than require placeholder files.
- Optional integrations should surface guidance or hooks only when explicitly enabled in config.
- Agent-facing tools should prefer explicit `--format json` output when their output is consumed by automation.
- Workflow validation should check local lane directories, item metadata, status-to-lane consistency, duplicate IDs, filename families, and active queue references.
- Shell tools should remain the stable command entrypoints, while structured parsing, validation, and state mutation logic should move into Python modules under `flywheel/tools/lib/`.
- State mutation tools should update file location, metadata status, and transition history together.
- Observer tools should write both a human-readable markdown report and an agent-readable JSON trace sidecar.
- Approval-governed actions should write explicit records with `flywheel/tools/flywheel_approval.sh`.
