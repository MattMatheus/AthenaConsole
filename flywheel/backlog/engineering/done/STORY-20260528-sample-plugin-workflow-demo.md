---
kind: story
id: STORY-20260528-sample-plugin-workflow-demo
status: done
owner_role: Software Engineer
source: epic
success_metric: A local sample plugin/workflow demonstrates the canonical run loop and produces inspectable status/artifacts.
release_scope: follow-up
ready: true
---

# Story: Sample Plugin Workflow Demo

## Metadata
- `id`: STORY-20260528-sample-plugin-workflow-demo
- `owner_role`: Software Engineer
- `status`: done
- `source`: epic
- `decision_refs`: [ADR-0008, ADR-0012, ADR-0015]
- `epic`: docs/product/epics/refinement/2026.23.00-epic-operator-readiness-first-run.md
- `success_metric`: A local sample plugin/workflow demonstrates the canonical run loop and produces inspectable status/artifacts.
- `release_scope`: follow-up
- `pm_refinement`: Use a dedicated local demo plugin/workflow asset rather than repurposing specialist fixtures. The sample should prove the canonical workflow DAG loop and remain covered by automated tests.

## Problem Statement

The product has strong primitives, but there is no single maintained sample path that proves the first-run operator loop from plugin discovery through workflow DAG status inspection.

## Scope

- In: dedicated sample plugin/agent/workflow template assets, canonical DAG run path, status/event/artifact inspection path, focused integration tests, minimal docs hooks.
- Out: broad sample library, hosted demos, new runtime backend behavior, console onboarding copy.

## Acceptance Criteria

1. A dedicated sample plugin/agent/workflow template is available in local development and discoverable through the existing plugin/template catalog path.
2. The sample can instantiate and run through the canonical workflow DAG executor path without using removed legacy workflow APIs.
3. Resulting run status, events, and artifacts are inspectable from current APIs.
4. The sample leaves deterministic, non-secret demo evidence suitable for quickstart documentation.
5. Tests prevent the sample path from drifting from the implemented runtime.

## Validation

- Required checks: core typecheck; focused plugin/workflow-template/catalog tests; canonical workflow DAG status/API test; artifact/event inspection test or assertion; `./flywheel/tools/validate_workflow_state.sh`.

## Dependencies

- Recommended after `STORY-20260528-first-run-health-readiness`.

## Risks

- Sample assets can become stale if they are not covered by automated validation.

## Next Step

Engineering should implement a small dedicated demo plugin/workflow scenario that exercises one successful dependency path and produces inspectable event/artifact evidence.

## Engineering Handoff
- `change_summary`: Added a checked-in `sample-plugins/first-run-demo` plugin with one local-process demo agent and a two-step workflow template. Local control-plane startup now indexes configured plugins into SQLite app-state, default local config includes `sample-plugins`, and re-indexing preserves task/run history by not deleting referenced agents. Added canonical `POST /api/v1/workflow-runs/:runId/execute` so the first-run sample can be listed, instantiated, executed, and inspected through current APIs. Updated quickstart commands and manifest validation coverage.
- `validation_evidence`: `npm --workspace @athena/core run typecheck`; `npm --workspace @athena/core run validate:manifests`; `npm --workspace @athena/core exec vitest run tests/control-plane.first-run-demo.test.ts tests/control-plane.plugin-loader.test.ts tests/control-plane.workflow-template-catalog.test.ts tests/control-plane.workflow-dag-executor.test.ts tests/api.workflow-template-catalog.test.ts tests/control-plane.readiness.test.ts tests/api.schemas.test.ts tests/control-plane.api-contracts.test.ts tests/api.server.test.ts`; `npm --workspace @athena/core run test:unit`; `./flywheel/tools/validate_workflow_state.sh`; `git diff --check`.
- `qa_focus`: Verify the sample is discoverable from the plugin/template APIs, executes through the canonical DAG executor API, leaves inspectable workflow status/events/task-run artifact metadata, does not leak secrets, and that startup re-indexing does not break historical task references.
- `open_risks`: The sample produces metadata-only `memory://` artifact references; a later docs/first-run story may choose to add file-backed sample artifact payloads if operators need downloadable demo files.

## QA Verdict
- `verdict`: Pass.
- `evidence_quality`: Good. QA reran core typecheck, sample manifest validation, focused first-run demo/plugin/catalog/DAG/API tests, full core unit suite, workflow-state validation, and whitespace checks.
- `defects`: None. During engineering, the demo test exposed stale startup re-index behavior against historical task references; that was fixed and covered by the end-to-end sample test.
- `state_transition`: Move to `done`.

## Transition History
- `2026-05-28T22:38:02Z`: `intake` -> `ready`; PM refinement complete for sample demo
- `2026-05-28T22:58:27Z`: `ready` -> `active`; Engineering starts sample plugin workflow demo
- `2026-05-28T23:07:03Z`: `active` -> `qa`; Engineering handoff complete for sample plugin workflow demo
- `2026-05-28T23:07:37Z`: `qa` -> `done`; QA passed for sample plugin workflow demo
