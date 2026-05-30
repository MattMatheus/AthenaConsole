---
kind: story
id: STORY-20260530-agent-scaffold-command
status: done
owner_role: Senior Engineer
source: planning
success_metric: A user can create a new plugin-backed agent from a template without manually copying duplicate ids.
release_scope: required
ready: true
---

# Story: Agent Scaffold Command

## Metadata
- `id`: STORY-20260530-agent-scaffold-command
- `owner_role`: Senior Engineer
- `status`: done
- `source`: planning
- `decision_refs`: [0007, 0008, 0018]
- `success_metric`: A user can create a new plugin-backed agent from a template without manually copying duplicate ids.
- `release_scope`: required

## Problem Statement

The copy-sample-agent guide is now clear, but manual copy/rename remains error-prone. A small scaffold command would make the happy path safer and reduce duplicate plugin id or agent id mistakes.

## Scope
- In: `athena agent scaffold` local CLI command in `@athena/core`, generated `plugin.yaml`, agent manifest, runner file, README, artifact namespace, validation step, and tests for id derivation/collision handling.
- Out: full plugin marketplace, graphical agent builder, remote publishing.

## Assumptions
- The first command can be local and repo-root oriented.
- Generated output should remain human-readable and editable.
- The first template should be deterministic, local-process, no-network, and ADK-backed rather than model-provider-backed.

## Acceptance Criteria
1. `athena agent scaffold` creates a new plugin directory from a supported local template.
2. The command requires or derives unique plugin id and agent id values.
3. Generated files pass manifest validation.
4. The generated README tells the user how to restart, verify catalog visibility, and run a task.
5. Tests or smoke validation cover duplicate-id avoidance and manifest validity.

## Validation
- Required checks: scaffold smoke into a temp directory, `npm --workspace @athena/core run validate:manifests`, relevant unit tests, `git diff --check`.
- Additional checks: run generated agent through the task workbench with mock/provider config.

## Dependencies
- Agent Developer Kit hardening recommended.

## Risks
- A scaffold command can fossilize current conventions if the template is too rigid.

## Open Questions
- Should later templates include a model-provider-backed variant after the local template is proven?

## Next Step
- Activate for engineering. Implement the core CLI scaffold command, scaffold module, tests, and docs.

## PM Refinement
- `what_changed`: Chose `@athena/core` CLI as the home for the first scaffold command because the existing `athena` CLI and manifest validation APIs already live there.
- `why_it_matters`: A repo-root command can generate a valid local plugin without asking new authors to copy sample plugins and hand-edit duplicate ids.
- `acceptance_criteria`: Command creates a plugin directory; ids are explicit or derived uniquely; generated package validates; README includes restart/catalog/task steps; tests cover id derivation/collision handling and manifest validity.
- `risks_and_assumptions`: Keep the first template local-process/no-network and ADK-backed; model-provider templates can follow after the basic path is stable.
- `next_state_recommendation`: Move to engineering active.

## Engineering Handoff
- `change_summary`: Added `athena agent scaffold` to the core CLI, backed by a new scaffold module that generates a deterministic local-process plugin in `.athena/plugins/` by default. The scaffold writes `plugin.yaml`, an agent manifest, an ADK-backed runner, and a plugin README with restart/catalog/task-run guidance, then validates the generated package before returning. Added tests for CLI generation, manifest validity, repeated-name id/directory allocation, and explicit duplicate-id rejection. Added discoverability notes to the ADK README and CLI reference.
- `validation_evidence`: `npm --workspace @athena/core run typecheck`; `npm --workspace @athena/core run test:unit -- agent-scaffold`; `npm --workspace @athena/core run build`; `npm --workspace @athena/core run validate:manifests`; temp-dir scaffold smoke using built CLI plus direct `validatePluginPackage`; scaffold docs markdown link/path review; `./flywheel/tools/validate_workflow_state.sh --format json`; `git diff --check`.
- `qa_focus`: Confirm the CLI command is reachable through `athena agent scaffold`, generated plugin and agent ids are valid and collision-safe, generated files pass manifest validation, README guidance covers restart/catalog/task run, and tests cover duplicate-id avoidance.
- `open_risks`: The first scaffold template is intentionally local-process/no-network only; model-provider scaffolds remain future work.

## QA Verdict
- `verdict`: Pass.
- `evidence_quality`: Required checks passed in QA: `npm --workspace @athena/core run typecheck`, `npm --workspace @athena/core run test:unit -- agent-scaffold`, `npm --workspace @athena/core run build`, `npm --workspace @athena/core run validate:manifests`, temp-dir scaffold smoke with built CLI plus direct `validatePluginPackage`, scaffold docs markdown link/path review, `./flywheel/tools/validate_workflow_state.sh --format json`, and `git diff --check`.
- `defects`: None found.
- `state_transition`: Ready for engineering done.

## Transition History
- `2026-05-30T22:37:20Z`: `intake` -> `active`; PM refined and activated agent scaffold command
- `2026-05-30T22:42:53Z`: `active` -> `qa`; agent scaffold command engineering handoff ready
- `2026-05-30T22:44:04Z`: `qa` -> `done`; QA passed agent scaffold command
