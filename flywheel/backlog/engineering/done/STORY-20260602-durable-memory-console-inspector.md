---
kind: story
id: STORY-20260602-durable-memory-console-inspector
status: done
owner_role: Software Engineer
source: epic
success_metric: Operators can inspect durable memory records, namespaces, provenance, proposal state, snapshots, and provider status from the console.
release_scope: post-release
ready: false
---

# Story: Durable Memory Console Inspector

## Metadata
- `id`: STORY-20260602-durable-memory-console-inspector
- `owner_role`: Software Engineer
- `status`: done
- `source`: epic
- `decision_refs`: [ADR-0021, ADR-0022, ADR-0023]
- `epic`: docs/product/epics/refinement/2026.35.00-epic-remote-memory-mvp.md
- `success_metric`: Operators can inspect durable memory records, namespaces, provenance, proposal state, snapshots, and provider status from the console.
- `release_scope`: post-release

## Problem Statement

Durable memory becomes trustworthy only if operators can inspect what exists, where it came from, what scope it belongs to, and whether it is remote-current, cached, stale, local-dev-only, or diagnostic-only.

## Initial Scope

- In: console service client and inspector page/panel for namespaces, records, search results, provenance summaries, proposals, archive/delete state, snapshots, and provider/readiness status.
- In: clear labels distinguishing durable memory from legacy diagnostic memory search.
- Out: rich editing workflows, connector ingestion, semantic relevance tuning, and automatic agent memory writes.

## Acceptance Criteria

1. Operators can list/search durable memory records by namespace and inspect provenance without exposing raw event payloads.
2. Console shows provider status and operator-visible cache/remote/local-dev/diagnostic labels.
3. Proposals and snapshots are visible enough to support follow-on approval/restore workflows.
4. Legacy diagnostic memory search remains labelled as local context debugging.
5. Console tests and browser QA cover empty, unavailable, populated, stale/cache, and proposal/snapshot states.

## Validation

- Focused console service/component tests.
- `npm --workspace apps/console run typecheck`
- `npm --workspace apps/console run lint`
- Browser QA across desktop/mobile.
- `git diff --check`
- `./flywheel/tools/validate_workflow_state.sh --format json`

## Engineering Handoff

- `change_summary`: Added a console durable-memory inspector route/page, durable-memory API parser/query/model layer, Configure navigation entry, and focused parser/model tests for records, provenance, proposals, snapshots, provider health, and operator-visible status labels.
- `validation_evidence`: Focused Vitest tests, console typecheck, console lint, desktop/mobile browser QA, workflow validation, and diff whitespace checks passed.
- `qa_focus`: Verify the Memory page distinguishes durable `/api/v1/durable-memory/*` from legacy `/api/v1/memory/*`, renders empty/unavailable states, supports namespace/search controls, and shows proposals/snapshots read-only.
- `open_risks`: Browser QA used the console dev server without a live API backend, so populated durable-memory records/proposals/snapshots were covered through parser/model tests rather than a seeded API visual run.

### Change Summary

- Added `apps/console/src/features/durable-memory/` with parsers, query hook, inspector summary helpers, and tests.
- Added `apps/console/src/pages/DurableMemoryPage.tsx` and wired `/memory` into router/navigation.
- The page shows provider/operator status, namespace/search controls, records with provenance and sync status, proposals, snapshots, and explicit legacy diagnostic-memory labeling.

### Validation Evidence

- `npm --workspace @athena/console exec -- vitest run src/features/durable-memory/api.test.ts src/features/durable-memory/inspectorModel.test.ts src/app/routeModel.test.ts` passed: 3 files, 8 tests.
- `npm --workspace @athena/console run typecheck` passed.
- `npm --workspace @athena/console run lint` passed.
- Browser QA against `http://127.0.0.1:5173/memory` passed for desktop `1440x1000` and mobile `390x844`: expected inspector sections present, no page errors, no main-content overflow.
- `./flywheel/tools/validate_workflow_state.sh --format json` passed.
- `git diff --check` passed.

### QA Focus

- Confirm populated records show namespace, memory type, body/summary preview, provenance references, sensitivity, archive/delete status, and operator-visible provider status without raw event payloads.
- Confirm proposals and snapshots are visible as read-only follow-on workflow support.
- Confirm unavailable/loading states keep the page useful and do not confuse durable memory with local diagnostic memory search.

### Open Risks

- The page is read-only by design; approval/restore workflows remain out of scope.
- Visual QA did not include a seeded live API response because the local dev server was running without a backend API process.

## QA Verdict

- `verdict`: pass
- `evidence_quality`: Focused parser/model tests cover populated records, provenance, provider fallback status, proposals, snapshots, and malformed envelopes; console typecheck/lint passed; browser QA covered desktop/mobile rendering, section presence, JavaScript errors, and main-content overflow.
- `state_transition`: Move from engineering QA to done.

### QA Evidence

- `npm --workspace @athena/console exec -- vitest run src/features/durable-memory/api.test.ts src/features/durable-memory/inspectorModel.test.ts src/app/routeModel.test.ts` passed: 3 files, 8 tests.
- `npm --workspace @athena/console run typecheck` passed.
- `npm --workspace @athena/console run lint` passed.
- Browser QA against `http://127.0.0.1:5173/memory` passed for desktop `1440x1000` and mobile `390x844`: expected inspector sections present, no page errors, no main-content overflow.
- `./flywheel/tools/validate_workflow_state.sh --format json` passed.
- `git diff --check` passed.

## Dependencies

- `STORY-20260602-durable-memory-api-routes`
- `STORY-20260602-durable-memory-readiness-config`

## Transition History
- `2026-06-02T15:42:00Z`: PM refinement created engineering intake story
- `2026-06-02T17:57:24Z`: `intake` -> `active`; PM promotes durable memory console inspector as next 2026.35 implementation slice
- `2026-06-02T18:06:07Z`: `active` -> `qa`; engineering handoff ready for durable memory console inspector QA
- `2026-06-02T18:06:55Z`: `qa` -> `done`; QA passed durable memory console inspector
