---
kind: story
id: STORY-20260528-app-state-list-query-bounds
status: active
owner_role: Software Engineer
source: planning
success_metric: Task, run, and schedule list APIs use bounded SQL queries for common console filters.
release_scope: deferred
ready: true
---

# Story: Bound App-State List Queries

## Metadata
- `id`: STORY-20260528-app-state-list-query-bounds
- `owner_role`: Software Engineer
- `status`: active
- `source`: planning
- `decision_refs`: [ADR-0010]
- `success_metric`: Task, run, and schedule list APIs use bounded SQL queries for common console filters.
- `release_scope`: deferred

## Problem Statement
Several SQLite app-state repositories read whole tables and filter in memory. This is acceptable for demo-sized state but becomes a scaling cliff for real task, run, and schedule history.

## Scope
- In: SQL-backed filters for task, run, and schedule listing; bounded limits for repository/service calls that feed current console/API list surfaces; tests with seeded row counts.
- Out: UI pagination redesign, cursor-based public API redesign, or broad repository splitting.

## Assumptions
- Existing response shapes should remain stable unless PM explicitly accepts an API contract change.
- Query ordering must match current behavior or be intentionally documented.

## Acceptance Criteria
1. Task list filtering for archived/status/mission paths is pushed into SQL.
2. Run list filtering for target type/id paths is pushed into SQL.
3. Schedule due/list filtering is bounded or query-backed.
4. Existing API/service response shapes remain compatible.
5. Tests seed enough rows to prove bounded reads and behavior parity.

## Validation
- Required checks: repository unit tests, service list regression tests, `npm --workspace @athena/core run typecheck`.
- Additional checks: lightweight benchmark or query instrumentation at 10k rows.

## Dependencies
- None required.

## Risks
- Query-level filtering can subtly change null handling, ordering, or archived behavior.

## Open Questions
- Should cursor pagination become a later public API story after query bounding lands?

## Next Step
Promote to engineering active after stale run recovery unless the team needs a lower-risk implementation item while architecture is in progress.

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
- `2026-05-28T16:23:39Z`: `intake` -> `active` by `Codex`; PM refined and queued for engineering
