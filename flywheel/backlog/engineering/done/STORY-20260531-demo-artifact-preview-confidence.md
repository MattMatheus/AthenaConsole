---
kind: story
id: STORY-20260531-demo-artifact-preview-confidence
status: done
owner_role: Software Engineer
source: operator-testing
success_metric: First-run and sample task artifacts either preview successfully or show explicit metadata-only/unsupported states before opening.
release_scope: next
ready: true
---

# Story: Demo Artifact Preview Confidence

## Metadata
- `id`: STORY-20260531-demo-artifact-preview-confidence
- `owner_role`: Software Engineer
- `status`: done
- `source`: operator-testing
- `decision_refs`: [ADR-0012]
- `epic`: docs/product/epics/refinement/2026.33.00-epic-first-real-work-confidence.md
- `success_metric`: First-run and sample task artifacts either preview successfully or show explicit metadata-only/unsupported states before opening.
- `release_scope`: next

## Problem Statement

The first-run demo records artifact metadata, but opening the recorded demo artifact can show "Artifact content not found." Because inspectable artifacts are a core product promise, the first demo artifact path should not look broken.

## Initial Scope

- In: make first-run demo artifacts previewable where content is available, or mark memory/metadata-only artifacts clearly in the run detail UI.
- In: ensure unsupported artifact states distinguish missing content, metadata-only content, unsupported scheme, and blocked-by-boundary cases.
- Out: binary artifact rendering, arbitrary external storage integrations, artifact editing.

## Acceptance Criteria

1. The first-run demo task artifact no longer opens into a generic missing-content error.
2. Artifact cards show whether preview is available before the operator clicks Open.
3. Metadata-only artifacts have a readable explanation and keep useful metadata visible.
4. Unsupported or blocked artifact schemes return safe, specific messages.
5. Artifact preview behavior is covered by API/service tests and console component tests.

## Validation

- Focused artifact-content API/service tests for memory-backed, metadata-only, unsupported, and missing artifacts.
- Console tests for artifact card preview availability and error-state copy.
- Browser QA on a freshly executed first-run demo task artifact.
- `npm --workspace @athena/core run typecheck`
- `npm --workspace @athena/console run typecheck`
- `npm --workspace @athena/console run test`
- `git diff --check`

## Refinement Notes

This follows up `STORY-20260530-artifact-content-inspection`, which added artifact preview capability but did not make every sample artifact path feel reliable in the first-run experience.

Ready for one-cycle execution. Keep the fix focused on artifact preview state clarity for first-run/sample task artifacts: backend error classification, preview availability cues, and narrow tests that preserve the existing artifact metadata contract.

## Transition History
- `2026-05-31T13:48:55Z`: `intake` -> `active`; promoted for first-run artifact preview confidence cycle

## Engineering Handoff

- `change_summary`: Fixed first-run/sample artifact preview confidence by allowing safe JSON memory artifacts to preview from the task-run output when no explicit `metadata.contentKey` is provided. Metadata-only memory artifacts now return a clear metadata-only message instead of a generic missing-content error, missing file-backed artifacts return a specific missing-file message, unsupported schemes return a scheme-specific message, and boundary violations remain blocked. The task run detail artifact cards now show preview state before opening, including `Preview available`, `Metadata only`, and `Preview blocked` states, and disable Open for states that cannot produce a preview.
- `validation_evidence`: `npm --workspace @athena/core exec -- vitest run tests/api.task-workbench.test.ts tests/control-plane.first-run-demo.test.ts`; `npm --workspace @athena/console exec -- vitest run src/features/task-workbench/runInspectionModel.test.ts`; `npm --workspace @athena/core run typecheck`; `npm --workspace @athena/console run typecheck`; `npm --workspace @athena/console run test`; `npm --workspace @athena/core run validate:manifests`; `git diff --check`; `./flywheel/tools/validate_workflow_state.sh --format json`; live API smoke created and executed first-run workflow `workflow-run-mission-artifact-preview-1780235645`, then confirmed task artifact `first-run-demo-run-dfe50e79-d691-4f3c-b1e4-ea3b610cdb27-verify` returns `application/json` preview content.
- `qa_focus`: Confirm the first-run demo artifact card says `Preview available` before clicking Open; confirm opening the card renders JSON content rather than "Artifact content not found"; confirm metadata-only/unsupported/blocked states remain explicit and safe.
- `open_risks`: The console coverage is model-level rather than DOM component-level because the current console test setup does not include a render harness. Browser QA covered the actual rendered task-run artifact card for the first-run demo path.
- `2026-05-31T13:58:02Z`: `active` -> `qa`; engineering handoff ready

## QA Verdict

- `verdict`: pass
- `qa_timestamp`: 2026-05-31T13:58:12Z
- `evidence_quality`: Strong for core service/API behavior and live first-run demo artifact preview. Moderate for console component-level coverage because the current console test setup does not include a DOM render harness; the run-inspection model test plus browser QA covered the rendered operator path.
- `validation_evidence`: Re-ran focused console artifact preview-state test after final copy tightening: `npm --workspace @athena/console exec -- vitest run src/features/task-workbench/runInspectionModel.test.ts`. Prior engineering evidence also passed: focused core artifact/content tests, core and console typechecks, full console tests, manifest validation, `git diff --check`, Flywheel validation, live API artifact preview, and browser QA at `http://127.0.0.1:5173/tasks/runs/run-dfe50e79-d691-4f3c-b1e4-ea3b610cdb27`.
- `defects`: None blocking.
- `state_transition`: Move to done.
- `notes`: The first-run demo artifact now advertises preview availability before opening and renders JSON preview content instead of the generic "Artifact content not found" failure. Metadata-only, unsupported, and blocked states have distinct labels or safe explanations.
- `2026-05-31T13:58:31Z`: `qa` -> `done`; QA passed demo artifact preview confidence repair
