---
kind: story
id: STORY-20260531-demo-artifact-preview-confidence
status: intake
owner_role: Software Engineer
source: operator-testing
success_metric: First-run and sample task artifacts either preview successfully or show explicit metadata-only/unsupported states before opening.
release_scope: next
ready: false
---

# Story: Demo Artifact Preview Confidence

## Metadata
- `id`: STORY-20260531-demo-artifact-preview-confidence
- `owner_role`: Software Engineer
- `status`: intake
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

