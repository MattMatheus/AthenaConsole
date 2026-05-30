---
kind: story
id: STORY-20260530-artifact-content-inspection
status: done
owner_role: Software Engineer
source: operator-testing
success_metric: Operators can open supported run artifacts from the run detail page and inspect their contents.
release_scope: next
ready: false
---

# Story: Run Artifact Content Inspection

## Metadata
- `id`: STORY-20260530-artifact-content-inspection
- `owner_role`: Software Engineer
- `status`: done
- `source`: operator-testing
- `decision_refs`: [ADR-0012]
- `epic`: docs/product/epics/refinement/2026.29.00-epic-real-work-run-loop.md
- `success_metric`: Operators can open supported run artifacts from the run detail page and inspect their contents.
- `release_scope`: next

## Problem Statement

Run detail shows artifact metadata, but not artifact contents. For model-backed and repo-backed agents, operators need to inspect generated markdown, JSON, text, and proposed diff artifacts directly from the console.

## Initial Scope

- In: artifact content API for supported local/memory/file-backed storage URIs, redaction/safety boundary, run detail artifact preview UI, supported format handling for markdown/text/json/diff.
- Out: binary artifact rendering, remote object storage, artifact editing or applying changes.

## Acceptance Criteria

1. Artifact metadata can be resolved to content for supported storage URI schemes.
2. Unsupported schemes return an explicit safe error.
3. Run detail page provides an open/preview path for supported artifacts.
4. Markdown/text/json/diff artifacts render in readable operator views.
5. Artifact content APIs enforce path/scheme boundaries and do not expose arbitrary filesystem reads.
6. Tests cover supported content reads, unsupported schemes, and path traversal prevention.

## Validation

- `npm --workspace @athena/core run typecheck`
- Focused artifact API/service tests.
- `npm --workspace @athena/console run typecheck`
- `npm --workspace @athena/console run test`
- Browser QA on model response artifact preview.
- `git diff --check`

## Refinement Notes

Start with the artifacts produced by `model.prompt.smoke` and `local.user.test`, then generalize only as much as needed for existing sample plugins.

## Transition History
- `2026-05-30T02:46:04Z`: `intake` -> `active`; continue next engineering story

## Engineering Handoff

Completed 2026-05-30.

- `change_summary`: Added a task-run artifact content endpoint, contracts, API schema coverage, bounded memory/local-file resolution, and lazy console artifact previews for markdown, text, JSON, and diff content.
- `validation_evidence`: `npm --workspace @athena/core run typecheck`; `npm --workspace @athena/core exec -- vitest run tests/api.task-workbench.test.ts tests/api.schemas.test.ts tests/control-plane.api-contracts.test.ts tests/control-plane.api-artifact.test.ts`; `npm --workspace @athena/console run typecheck`; `npm --workspace @athena/console run lint`; `npm --workspace @athena/console run test`; `npm --workspace @athena/core run validate:manifests`; `git diff --check`.
- `qa_focus`: Verify a model-backed task run artifact can be opened from the run detail page; confirm markdown renders readably, raw output remains available, and unsupported/path-traversal artifacts show safe errors instead of content.
- `open_risks`: Browser QA was not completed because the in-app Browser tool was not callable in this turn; local file reads are intentionally limited to the producing plugin `artifacts/` directory, so artifacts outside that boundary will require a later storage model decision.

Implemented run artifact content inspection for task runs:

- Added `GET /api/v1/task-runs/:runId/artifacts/:artifactId` and API schema coverage.
- Added `TaskWorkbenchArtifactRecord` content contracts for text and JSON payloads.
- Resolves memory artifacts from run output using explicit `metadata.contentKey` when present plus existing markdown/json conventions.
- Resolves bounded local file artifacts under the producing plugin `artifacts/` directory, while rejecting unsupported schemes and path traversal.
- Added run detail artifact preview actions with lazy fetching and readable markdown, text, JSON, and diff rendering.

Validation run:

- `npm --workspace @athena/core run typecheck`
- `npm --workspace @athena/core exec -- vitest run tests/api.task-workbench.test.ts tests/api.schemas.test.ts tests/control-plane.api-contracts.test.ts tests/control-plane.api-artifact.test.ts`
- `npm --workspace @athena/console run typecheck`
- `npm --workspace @athena/console run lint`
- `npm --workspace @athena/console run test`
- `npm --workspace @athena/core run validate:manifests`
- `git diff --check`

Notes for QA:

- Browser plugin tooling was not callable in this turn after discovery, so browser QA is still needed from the running console.
- The API dev server is running on `http://127.0.0.1:8787` and auto-restarted after the backend changes.

QA blocker follow-up:

- Added `latestRun` summaries to task list responses and an Open Latest Run action for completed/historical tasks in the Recent Tasks and Mission Tasks lists.
- Re-ran `npm --workspace @athena/core run typecheck`, `npm --workspace @athena/core exec -- vitest run tests/api.task-workbench.test.ts tests/api.schemas.test.ts`, `npm --workspace @athena/console run typecheck`, `npm --workspace @athena/console run lint`, `npm --workspace @athena/console run test`, and `git diff --check`.
- `2026-05-30T02:55:12Z`: `active` -> `qa`; artifact content inspection implemented

## QA Verdict

- `verdict`: accepted
- `evidence_quality`: Automated API/schema/core/console validation passed; operator confirmed historical task opening issue was fixed after follow-up.
- `defects`: none blocking
- `state_transition`: move to `done`
- `2026-05-30T03:28:15Z`: `qa` -> `done`; operator accepted artifact inspection and history follow-up
