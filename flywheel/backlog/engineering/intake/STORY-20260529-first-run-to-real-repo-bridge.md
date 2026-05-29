---
kind: story
id: STORY-20260529-first-run-to-real-repo-bridge
status: intake
owner_role: Software Engineer
source: epic
success_metric: Operators can move from the sample demo to running useful work against their own local repository.
release_scope: follow-up
ready: false
---

# Story: First-Run To Real-Repo Bridge

## Metadata
- `id`: STORY-20260529-first-run-to-real-repo-bridge
- `owner_role`: Software Engineer
- `status`: intake
- `source`: epic
- `decision_refs`: [ADR-0006, ADR-0008, ADR-0011]
- `epic`: docs/product/epics/refinement/2026.25.00-epic-operator-workflow-clarity-repo-wiring.md
- `success_metric`: Operators can move from the sample demo to running useful work against their own local repository.
- `release_scope`: follow-up

## Problem Statement

The first-run demo proves the product works, but it does not yet clearly show how to adapt the flow to a real local repository.

## Initial Scope

- In: README/getting-started and console guidance from sample plugin/demo to local repo work, validation commands, next-action links.
- Out: new runtime backend, remote repo clone, plugin authoring UI.

## Draft Acceptance Criteria

1. Docs explain the path from sample plugin usage to real repo work.
2. Console guidance explains where repo context and plugin-provided agents fit.
3. Existing first-run demo remains intact.
4. Guidance avoids implying that agents are created directly in the console.
5. Docs and browser smoke checks verify the bridge is discoverable.

## Validation

- Docs link/path smoke checks.
- `npm --workspace @athena/core run validate:manifests` if sample/plugin docs change.
- `npm --workspace apps/console run typecheck` and lint if console copy changes.
- Browser QA for affected console routes.
- `./flywheel/tools/validate_workflow_state.sh`

## Refinement Notes

Should follow repo wiring guidance so docs and console tell the same story.

## Engineering Handoff
- `change_summary`:
- `validation_evidence`:
- `qa_focus`:
- `open_risks`:

## QA Verdict
- `verdict`:
- `evidence_quality`:
- `defects`:
- `state_transition`:

## Transition History
- `2026-05-29T01:30:00Z`: planning intake created for first-run to real-repo bridge
