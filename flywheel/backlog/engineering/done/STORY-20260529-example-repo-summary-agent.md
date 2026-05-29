---
kind: story
id: STORY-20260529-example-repo-summary-agent
status: done
owner_role: Software Engineer
source: epic
success_metric: Operators can run a useful read-only repo summarizer agent against a connected repository.
release_scope: next
ready: true
---

# Story: Example Repo Summary Agent

## Metadata
- `id`: STORY-20260529-example-repo-summary-agent
- `owner_role`: Software Engineer
- `status`: done
- `source`: epic
- `decision_refs`: [ADR-0007, ADR-0008, ADR-0018]
- `epic`: docs/product/epics/refinement/2026.28.00-epic-agent-sdk-and-examples.md
- `success_metric`: Operators can run a useful read-only repo summarizer agent against a connected repository.
- `release_scope`: next

## Problem Statement

The product needs a non-demo agent that proves connected repo context can produce useful output.

## Initial Scope

- In: example plugin using SDK, repo summary agent manifest, read-only repo inspection, markdown summary artifact, tests/fixtures, docs.
- Out: file edits, model-required behavior unless provider readiness is already available, remote push.

## Acceptance Criteria

1. Example plugin provides a repo summarizer agent that accepts structured `inputs.repo`.
2. Agent inspects repo files read-only and emits a markdown summary artifact.
3. Agent runs with mock/local deterministic behavior when no real provider is configured.
4. Plugin manifests validate and appear in the agent catalog.
5. Docs explain how to run it against a connected repo.

## Validation

- `npm --workspace @athena/core run validate:manifests`
- Example plugin tests or smoke command.
- Core/console smoke if catalog indexing changes.
- Browser QA showing agent appears in catalog.
- `./flywheel/tools/validate_workflow_state.sh`

## Refinement Notes

This is the first “actually does something” proof. Keep it read-only and dependable.

## Engineering Handoff

- `completed_at`: 2026-05-29T20:24:30Z
- `change_summary`: Added a checked-in `repo-summary` sample plugin with a PDK-backed local repo summarizer agent, structured `inputs.repo`, deterministic read-only repo scanning, markdown artifact output metadata, docs, and an API integration smoke test.
- `files_changed`:
  - `sample-plugins/repo-summary/plugin.yaml`
  - `sample-plugins/repo-summary/agents/repo-summary.agent.yaml`
  - `sample-plugins/repo-summary/agents/repo-summary-runner.mjs`
  - `sample-plugins/repo-summary/schemas/repo-summary-input.schema.json`
  - `sample-plugins/repo-summary/docs/README.md`
  - `packages/core/tests/control-plane.repo-summary-sample.test.ts`
- `validation_evidence`: Manifest validation, focused sample-plugin API smoke, first-run sample regression smoke, PDK tests, core typecheck, browser catalog QA, whitespace validation, and Flywheel workflow validation passed.
  - `npm --workspace @athena/pdk run build`
  - `npm --workspace @athena/core run validate:manifests`
  - `npm --workspace @athena/core exec -- vitest run tests/control-plane.repo-summary-sample.test.ts`
  - `npm --workspace @athena/core exec -- vitest run tests/control-plane.first-run-demo.test.ts tests/control-plane.repo-summary-sample.test.ts`
  - `npm --workspace @athena/pdk run test`
  - `npm --workspace @athena/core run typecheck`
  - Browser QA at `http://127.0.0.1:5173/agents` against local API with `ATHENA_PLUGIN_PATHS=sample-plugins`: verified Repo Summary plugin and `repo.summary.local@0.1.0` appeared in the catalog with repo capabilities and no provider requirement.
  - `git diff --check`
  - `./flywheel/tools/validate_workflow_state.sh`
- `qa_focus`: Confirm the sample plugin remains read-only, its manifests validate, catalog indexing sees the agent, the local deterministic run emits markdown artifact metadata, and docs explain how to point it at a connected repo.
- `open_risks`: The artifact content is represented in run output and metadata using a memory URI; persistent artifact-file materialization remains runtime/platform scope.

## QA Verdict

- `verdict`: pass
- `qa_timestamp`: 2026-05-29T20:25:30Z
- `evidence_quality`: Fresh QA covered manifest validation, package build dependency, deterministic API run smoke, first-run sample regression, core typecheck, PDK tests, browser catalog visibility, whitespace validation, and Flywheel workflow validation.
- `acceptance_coverage`:
  - AC1: `repo.summary.local` manifest accepts structured `inputs.repo` with `repo.path` documented by `schemas/repo-summary-input.schema.json`.
  - AC2: `repo-summary-runner.mjs` scans repository files read-only and emits `Repo summary` markdown artifact metadata with a deterministic `summaryMarkdown` output.
  - AC3: The runner is local and deterministic with no provider requirement; API smoke completed with no model provider configured.
  - AC4: `validate:manifests`, API catalog smoke, and Firefox catalog QA confirmed the plugin manifests validate and the agent appears in the catalog.
  - AC5: `sample-plugins/repo-summary/docs/README.md` explains how to run the agent against a connected or cloned local repo.
- `validation_evidence`: `npm --workspace @athena/pdk run build`; `npm --workspace @athena/core run validate:manifests`; `npm --workspace @athena/core exec -- vitest run tests/control-plane.repo-summary-sample.test.ts`; `npm --workspace @athena/core exec -- vitest run tests/control-plane.first-run-demo.test.ts tests/control-plane.repo-summary-sample.test.ts`; `npm --workspace @athena/pdk run test`; `npm --workspace @athena/core run typecheck`; browser QA at `http://127.0.0.1:5173/agents`; `git diff --check`; `./flywheel/tools/validate_workflow_state.sh`.
- `defects`: None found.
- `state_transition`: Move to `done`.
- `notes`: Firefox was used only for a new local QA tab; the browser process/session was left running. Dev API and Vite servers were stopped after QA.

## Transition History
- `2026-05-29T03:08:43Z`: PM refinement created ready engineering story
- `2026-05-29T20:18:17Z`: `ready` -> `active`; Engineering starts example repo summary agent
- `2026-05-29T20:24:35Z`: `active` -> `qa`; Engineering handoff complete for example repo summary agent
- `2026-05-29T20:24:35Z`: `qa` -> `done`; QA passed for example repo summary agent
