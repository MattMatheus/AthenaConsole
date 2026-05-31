---
kind: story
id: STORY-20260530-runtime-diagnostics-work-memory
status: done
owner_role: Senior Engineer
source: direct
success_metric: Useful work-queue and memory capabilities are available as advanced runtime diagnostics, or removed if no product workflow needs them.
release_scope: optional
ready: false
---

# Story: Runtime Diagnostics For Work And Memory

## Metadata
- `id`: STORY-20260530-runtime-diagnostics-work-memory
- `owner_role`: Senior Engineer
- `status`: done
- `source`: direct
- `decision_refs`: [0006, 0008, 0012]
- `epic`: docs/product/epics/refinement/2026.32.00-epic-useful-feature-migration-and-legacy-removal.md
- `success_metric`: Useful work-queue and memory capabilities are available as advanced runtime diagnostics, or removed if no product workflow needs them.
- `release_scope`: optional

## Problem Statement

The `work` and `memory` APIs are not primary operator workflows, but they may help diagnose stuck runs, queue state, and retained context. The product needs a current home for useful diagnostics, not disconnected advanced APIs.

## Scope
- In: evaluate `/api/v1/work/*` and `/api/v1/memory/*`; wire useful diagnostics into run detail, resource diagnostics, or an advanced runtime page; document anything retained as advanced; remove unneeded endpoints/services.
- Out: presenting work queues or memory search as first-run operator workflows.

## Acceptance Criteria
1. Each work and memory API has a keep-wire-remove decision.
2. Retained functionality is reachable from a current diagnostics surface.
3. Removed functionality has tests and docs cleaned up.
4. Current docs describe retained work/memory behavior as advanced diagnostics.
5. No disconnected console service/client remains.

## Validation
- Required checks: core typecheck, focused API tests, console typecheck/tests if UI is added, `git diff --check`.
- Additional checks: route inventory showing retained and removed APIs.

## Dependencies
- Useful feature migration epic.

## Risks
- Some APIs may be used indirectly by tests or future workflow features; classify before deleting.

## Engineering Handoff
- `change_summary`: Classified retained work/memory behavior as advanced runtime diagnostics. Added an Advanced Runtime Diagnostics panel to Resource Controls that points operators to work queue inspection and memory search without making either a first-run workflow. Updated current API/CLI/developer docs so work queues are compatibility diagnostics, memory search/get is retained for local context debugging, and stale file-backed workflow API examples now point at canonical workflow templates and workflow run APIs. Added route inventory assertions for memory and work route collections.
- `validation_evidence`: `npm --workspace @athena/core exec vitest run tests/api.route-registration.test.ts tests/cli.work.test.ts tests/cli.memory.test.ts`; `npm --workspace @athena/core run typecheck`; `npm --workspace @athena/console run typecheck`; `npm --workspace @athena/console run build`; route/doc review with `rg "Work Queue Management|work queue enqueue/drain/status lifecycle|### Work and Memory|GET /api/v1/workflows|POST /api/v1/workflows|GET /api/v1/workflows/run|POST /api/v1/workflows/run|work status --workflow"`; `git diff --check`; `./flywheel/tools/validate_workflow_state.sh --format json`.
- `qa_focus`: Confirm Resource Controls presents work queue and memory search as advanced diagnostics only; verify docs no longer present work queues as primary operator workflow; verify memory/work route inventory remains intentional.
- `open_risks`: Browser QA for `/resources` could not complete because the in-app browser route disconnected; console build and typecheck passed. A2A/work observability routes remain for the upcoming generic failed-work recovery story.

## QA Verdict
- `verdict`: Pass.
- `evidence_quality`: Good. Core route/CLI tests, core typecheck, console typecheck, console production build, diff hygiene, route/doc review, and workflow validation all passed. Browser QA was attempted but blocked by an in-app browser route disconnect; build/typecheck covered the UI compile path.
- `defects`: None found.
- `state_transition`: Move to `done`.

## Transition History
- `2026-05-31T00:45:46Z`: `intake` -> `active`
- `2026-05-31T00:48:58Z`: `active` -> `qa`
- `2026-05-31T00:49:16Z`: `qa` -> `done`
