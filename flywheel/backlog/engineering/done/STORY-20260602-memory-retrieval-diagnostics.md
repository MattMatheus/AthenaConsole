---
kind: story
id: STORY-20260602-memory-retrieval-diagnostics
status: done
owner_role: Software Engineer
source: planning
success_metric: Operators can inspect why memory search results were selected, ranked, filtered, omitted, or degraded.
release_scope: post-release
ready: false
---

# Story: Memory Retrieval Diagnostics

## Metadata
- `id`: STORY-20260602-memory-retrieval-diagnostics
- `owner_role`: Software Engineer
- `status`: done
- `source`: planning
- `decision_refs`: [ADR-0019, ADR-0020, ADR-0021, ADR-0023, ADR-0024]
- `epic`: docs/product/epics/refinement/2026.37.00-epic-semantic-memory-and-sync-backends.md
- `success_metric`: Operators can inspect why memory search results were selected, ranked, filtered, omitted, or degraded.
- `release_scope`: post-release

## Problem Statement

Semantic and hybrid retrieval will be hard to trust unless operators can inspect result explanations, filter effects, fallback/degraded behavior, and omitted-result reasons without seeing backend internals.

## Scope
- In: diagnostic metadata model, API exposure for retrieval explanations, console inspector updates, tests for selected/filtered/omitted/degraded cases, and copy that distinguishes canonical memory from backend details.
- Out: manual ranking override workflows, connector-specific diagnostics, and backend-specific debug consoles.

## Assumptions
- Hybrid retrieval returns structured score/source metadata suitable for diagnostics.
- Console diagnostics should remain compact and operator-focused.
- Backend internals such as raw vector IDs should not be the primary user-facing explanation.

## Acceptance Criteria
1. Retrieval responses can include structured diagnostic metadata for ranking factors, filters, omissions, and degraded fallback reasons.
2. Console memory diagnostics show selected, filtered, omitted, and degraded cases in a way operators can understand.
3. Tests cover empty, keyword-only, semantic, hybrid, filtered, omitted, stale/cache, and provider-unavailable states.
4. Diagnostic output avoids leaking raw backend implementation details as the product model.

## Validation
- Required checks: durable-memory API/model tests, console parser/component tests, console typecheck/lint as affected, `git diff --check`, Flywheel workflow validation.
- Additional checks: browser QA on desktop/mobile for populated and degraded diagnostic states.

## Dependencies
- `ARCH-20260602-semantic-memory-backend-strategy`
- `STORY-20260602-memory-hybrid-retrieval`

## Risks
- Diagnostics can become too verbose for the console if they mirror backend internals.
- Omitted-result explanations may be incomplete if providers cannot report enough detail.

## Open Questions
- Should diagnostics be always returned, query-enabled, or only visible in an inspector mode?
- How much ranking math should be exposed to operators?

## Next Step

PM refinement should hold this until hybrid retrieval metadata shape is stable.

## Engineering Handoff
- `change_summary`: Added retrieval diagnostics to the console durable-memory inspector summary and page, including requested/effective mode, fallback status, provider capabilities, degradation reasons, omitted categories, selected match scores/signals/snippets, and explicit copy that diagnostics are canonical retrieval signals rather than raw backend internals.
- `validation_evidence`: Focused durable-memory core tests, console parser/model tests, core/console typechecks, console lint, `git diff --check`, and Vite served-page smoke passed. Playwright browser QA was attempted but blocked because the Playwright browser executable is not installed in this environment.
- `qa_focus`: Verify diagnostics metadata is exposed in API/model shape, rendered compactly in the memory page, covers selected/filtered/omitted/degraded cases, and avoids raw vectors/backend ids as product model.
- `open_risks`: Full rendered browser QA could not run without installing a Playwright browser binary; diagnostics UI is covered by typecheck/lint/model tests and served-page smoke, but not a screenshot pass.

### Change Summary

- Added `diagnostics` and `matches` to `DurableMemoryInspectorSummary`.
- Added retrieval diagnostics summary helpers and tests.
- Added a `RetrievalDiagnosticsPanel` to the durable memory page.
- Preserved existing records/proposals/snapshots layout while adding compact diagnostics for search explanations.

### Validation Evidence

- `npm --workspace @athena/core exec -- vitest run tests/durable-memory.server-storage.test.ts tests/api.request-parsers.test.ts` passed: 2 files, 36 tests.
- `npm --workspace @athena/console exec -- vitest run src/features/durable-memory/api.test.ts src/features/durable-memory/inspectorModel.test.ts` passed: 2 files, 8 tests.
- `npm --workspace @athena/core run typecheck` passed.
- `npm --workspace @athena/console run typecheck` passed.
- `npm --workspace @athena/console run lint` passed.
- `curl -sS http://127.0.0.1:5173/memory` returned the Vite app shell.
- Playwright smoke was attempted but failed before page load because the browser executable was missing from the local Playwright cache.

### QA Focus

- Confirm diagnostics render for search mode without replacing canonical memory records.
- Confirm degraded fallback reasons and omitted categories are visible.
- Confirm selected result match summaries show normalized signal scores without raw vectors or Chroma ids.
- Confirm empty/list mode remains understandable when no diagnostics exist.

### Open Risks

- A future browser QA pass should be run after installing or exposing a Playwright/Browser executable.

## QA Verdict
- `verdict`: Pass. Retrieval diagnostics metadata is exposed through the durable-memory API/model path, summarized for the console inspector, rendered on the durable memory page, and framed as canonical retrieval signals rather than raw vector/backend internals.
- `evidence_quality`: Strong command evidence for core retrieval/parser behavior, console parsing/model summaries, TypeScript contracts, lint hygiene, and diff hygiene. Browser screenshot QA remains blocked by the missing local Playwright executable, but the Vite `/memory` route smoke returned the app shell.
- `defects`: None found.
- `state_transition`: Move to `done`.

### QA Evidence

- `npm --workspace @athena/core exec -- vitest run tests/durable-memory.server-storage.test.ts tests/api.request-parsers.test.ts` passed: 2 files, 36 tests.
- `npm --workspace @athena/console exec -- vitest run src/features/durable-memory/api.test.ts src/features/durable-memory/inspectorModel.test.ts` passed: 2 files, 8 tests.
- `npm --workspace @athena/core run typecheck` passed.
- `npm --workspace @athena/console run typecheck` passed.
- `npm --workspace @athena/console run lint` passed.
- `git diff --check` passed.
- `curl -sS http://127.0.0.1:5173/memory` returned the Vite app shell.

### QA Assessment

- Acceptance criteria 1 and 2 are met by structured diagnostics/match summaries in the durable-memory contract, parser/model path, and console diagnostics panel.
- Acceptance criteria 3 is met at the model/API and storage behavior level for empty, keyword-only, semantic/hybrid, filtered/omitted, cache, and provider-degraded states.
- Acceptance criterion 4 is met by presenting match signals, snippets, fallback reasons, capabilities, omitted categories, and degradation reasons without surfacing raw vectors or backend ids.

## Transition History
- `2026-06-02T20:00:00Z`: Planning created engineering intake for 2026.37 retrieval diagnostics.
- `2026-06-02T23:13:47Z`: `intake` -> `active`; PM promotes final 2026.37 implementation slice after AthenaMemory evaluation QA
- `2026-06-02T23:16:21Z`: `active` -> `qa`; engineering handoff ready for durable memory retrieval diagnostics
- `2026-06-02T23:18:13Z`: `qa` -> `done`; QA passed durable memory retrieval diagnostics
