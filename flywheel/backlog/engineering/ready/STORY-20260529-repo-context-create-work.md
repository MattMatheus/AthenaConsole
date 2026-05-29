---
kind: story
id: STORY-20260529-repo-context-create-work
status: ready
owner_role: Software Engineer
source: epic
success_metric: Tasks and workflows can receive selected connected repo context through structured inputs.
release_scope: next
ready: true
---

# Story: Repo Context In Create Work

## Metadata
- `id`: STORY-20260529-repo-context-create-work
- `owner_role`: Software Engineer
- `status`: ready
- `source`: epic
- `decision_refs`: [ADR-0007, ADR-0009, ADR-0018]
- `epic`: docs/product/epics/refinement/2026.26.00-epic-real-work-repo-connection.md
- `success_metric`: Tasks and workflows can receive selected connected repo context through structured inputs.
- `release_scope`: next

## Problem Statement

Connecting a repo is only useful if work creation can pass that repo into agents and workflow templates consistently.

## Initial Scope

- In: task/workflow create forms can select connected repo, structured `repo` input context, API validation helpers, compatibility with existing raw inputs.
- Out: generalized schema rendering, write approvals, provider setup.

## Acceptance Criteria

1. Task creation can include a selected connected repo as structured `inputs.repo`.
2. Workflow-template instantiation can include a selected connected repo in input bindings.
3. Existing raw JSON input behavior remains available for advanced use.
4. UI shows missing/invalid repo status before run creation.
5. New examples/docs converge on structured `repo` context while tolerating `repoPath` for existing plugins.

## Validation

- `npm --workspace @athena/core run typecheck`
- `npm --workspace apps/console run typecheck`
- `npm --workspace apps/console run lint`
- Focused core/console tests for repo input shaping.
- Browser QA for task and workflow create paths.
- `./flywheel/tools/validate_workflow_state.sh`

## Refinement Notes

This is a bridge story before full manifest-driven input forms.

## Transition History
- `2026-05-29T03:08:43Z`: PM refinement created ready engineering story
