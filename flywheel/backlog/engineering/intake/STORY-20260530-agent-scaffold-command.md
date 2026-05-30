---
kind: story
id: STORY-20260530-agent-scaffold-command
status: intake
owner_role: Senior Engineer
source: planning
success_metric: A user can create a new plugin-backed agent from a template without manually copying duplicate ids.
release_scope: required
ready: false
---

# Story: Agent Scaffold Command

## Metadata
- `id`: STORY-20260530-agent-scaffold-command
- `owner_role`: Senior Engineer
- `status`: intake
- `source`: planning
- `decision_refs`: [0007, 0008, 0018]
- `success_metric`: A user can create a new plugin-backed agent from a template without manually copying duplicate ids.
- `release_scope`: required

## Problem Statement

The copy-sample-agent guide is now clear, but manual copy/rename remains error-prone. A small scaffold command would make the happy path safer and reduce duplicate plugin id or agent id mistakes.

## Scope
- In: local scaffold command/script, generated `plugin.yaml`, agent manifest, runner file, README, artifact namespace, validation step.
- Out: full plugin marketplace, graphical agent builder, remote publishing.

## Assumptions
- The first command can be local and repo-root oriented.
- Generated output should remain human-readable and editable.

## Acceptance Criteria
1. A command creates a new plugin directory from a supported template.
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
- Should the command live in `packages/core` CLI, `packages/pdk`, or root `dev.sh` helper space?

## Next Step
- Refine after the ADK package boundary is clearer.
