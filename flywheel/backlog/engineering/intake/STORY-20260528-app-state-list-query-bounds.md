---
kind: story
id: STORY-20260528-app-state-list-query-bounds
status: intake
owner_role: Software Engineer
source: planning
success_metric: Task, run, and schedule list APIs use bounded SQL queries for common console filters.
release_scope: deferred
ready: false
---

# Story: Bound App-State List Queries

## Metadata
- `id`: STORY-20260528-app-state-list-query-bounds
- `owner_role`: Software Engineer
- `status`: intake
- `source`: planning
- `decision_refs`: [ADR-0010]
- `success_metric`: Task, run, and schedule list APIs use bounded SQL queries for common console filters.
- `release_scope`: deferred

## Problem Statement
Several SQLite app-state repositories read whole tables and filter in memory. This is acceptable for demo-sized state but becomes a scaling cliff for real task, run, and schedule history.

## Scope
- In: SQL-backed filters for task, run, and schedule listing; limit/offset or cursor contracts where needed; tests with seeded row counts.
- Out: UI pagination redesign unless required to consume the backend contract.

## Assumptions
- Existing response shapes should remain stable unless PM explicitly accepts an API contract change.
- Query ordering must match current behavior or be intentionally documented.

## Acceptance Criteria
1. Task list filtering for archived/status/mission paths is pushed into SQL.
2. Run list filtering for target type/id paths is pushed into SQL.
3. Schedule due/list filtering is bounded or query-backed.
4. Tests seed enough rows to prove bounded reads and behavior parity.

## Validation
- Required checks: repository unit tests, service list regression tests, `npm --workspace @athena/core run typecheck`.
- Additional checks: lightweight benchmark or query instrumentation at 10k rows.

## Dependencies
- None required.

## Risks
- Query-level filtering can subtly change null handling, ordering, or archived behavior.

## Open Questions
- Should API list contracts expose cursor pagination now or keep internal limits only?

## Next Step
PM refinement should define which list surfaces are release-blocking and whether pagination is part of this story.

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
