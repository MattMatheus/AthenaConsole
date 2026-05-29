---
kind: story
id: STORY-20260529-first-run-to-real-repo-bridge
status: done
owner_role: Software Engineer
source: epic
success_metric: Operators can move from the sample demo to running useful work against their own local repository.
release_scope: follow-up
ready: true
---

# Story: First-Run To Real-Repo Bridge

## Metadata
- `id`: STORY-20260529-first-run-to-real-repo-bridge
- `owner_role`: Software Engineer
- `status`: done
- `source`: epic
- `decision_refs`: [ADR-0006, ADR-0008, ADR-0011, ADR-0017]
- `epic`: docs/product/epics/refinement/2026.25.00-epic-operator-workflow-clarity-repo-wiring.md
- `success_metric`: Operators can move from the sample demo to running useful work against their own local repository.
- `release_scope`: follow-up

## Problem Statement

The first-run demo proves the product works, but it does not yet clearly show how to adapt the flow to a real local repository.

## Initial Scope

- In: README/getting-started and console guidance from sample plugin/demo to local repo work, validation commands, next-action links.
- Out: new runtime backend, remote repo clone, plugin authoring UI.

## Acceptance Criteria

1. `GETTING_STARTED.md` explains the path from the first-run sample plugin to real local repo work.
2. `README.md` points readers from the first-run demo toward repo wiring and real work.
3. The sample plugin docs clarify that the sample plugin proves the runtime path and should be replaced or supplemented by plugin-backed agents for real repo work.
4. Console guidance makes the demo-to-real-repo bridge discoverable from the Dashboard and points to repo wiring, agent catalog, tasks, and workflows.
5. Existing first-run demo manifests and behavior remain intact.
6. Guidance avoids implying console-native agent authoring, remote clone, Git provider auth, or persisted repository records.

## Validation

- Docs link/path smoke checks.
- `npm --workspace @athena/core run validate:manifests` if sample/plugin docs change.
- `npm --workspace apps/console run typecheck` and lint if console copy changes.
- Browser QA for affected console routes.
- `./flywheel/tools/validate_workflow_state.sh`

## Refinement Notes

PM refinement completed. Implement as docs and console guidance only; do not change the sample plugin manifests, runtime backend, or work creation APIs.

Suggested implementation notes:

- Add a "move from demo to real repo" section to `GETTING_STARTED.md` after the first-run demo workflow.
- Add a short README pointer from Quickstart to the real-repo bridge.
- Add a short sample-plugin docs section explaining what the demo proves and what a real plugin/agent must provide.
- Add a Dashboard bridge panel that links to Workflows for the demo, Resource Controls for repo wiring, Agents for plugin-backed capabilities, and Tasks for first real work.
- Keep wording aligned with ADR-0017: workspace, plugin path, target repo, and run context.

## Engineering Handoff
- `change_summary`: Added a first-run-to-real-repo path to `GETTING_STARTED.md`, linked it from `README.md`, clarified sample plugin docs, and added a Dashboard bridge from demo validation to repo wiring, agent catalog, and task/workflow creation.
- `validation_evidence`: `npm --workspace apps/console run typecheck`; `npm --workspace apps/console run lint`; `npm --workspace @athena/core run validate:manifests`; `git diff --check`; `./flywheel/tools/validate_workflow_state.sh`; docs link/path smoke for the new Getting Started anchor; browser QA for Dashboard at desktop and 390px widths.
- `qa_focus`: Confirm docs and Dashboard guidance do not imply console-native agent authoring, remote clone, Git provider auth, or saved repository records. Verify the first-run demo manifests are unchanged and still validate.
- `open_risks`: The bridge remains guidance-only; real repo success depends on operators adding suitable plugin-backed agents or workflow templates for their repo.

## QA Verdict
- `verdict`: Pass. Docs and Dashboard now bridge first-run validation to real local repo work without changing demo behavior.
- `evidence_quality`: Strong. Console typecheck/lint, manifest validation, diff whitespace, Flywheel validation, docs link smoke, and browser QA all passed.
- `defects`: None found.
- `state_transition`: Move to done.

## Transition History
- `2026-05-29T01:30:00Z`: planning intake created for first-run to real-repo bridge
- `2026-05-29T02:23:04Z`: PM refinement completed; ready for engineering
- `2026-05-29T02:26:54Z`: engineering completed; ready for QA
- `2026-05-29T02:27:23Z`: `active` -> `qa`; Engineering handoff ready for QA
- `2026-05-29T02:27:23Z`: QA passed with no defects
- `2026-05-29T02:23:26Z`: `intake` -> `active`; PM refined; engineering starts first-run to real-repo bridge
- `2026-05-29T02:27:12Z`: `active` -> `qa`; Engineering handoff ready for QA
- `2026-05-29T02:27:53Z`: `qa` -> `done`; QA passed for first-run to real-repo bridge
