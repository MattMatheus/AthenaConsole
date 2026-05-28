---
kind: story
id: STORY-20260528-app-state-list-query-bounds
status: done
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
- `status`: done
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
Continue with the next active backlog item.

## Engineering Handoff
- `change_summary`: Moved task and run repository filtering into SQL with bounded list limits; added SQL-backed schedule status/due filtering and schedule counts for due execution; updated stale run recovery to page through bounded running-run queries; added seeded repository/service regression tests for task, run, schedule, service response, and stale recovery interactions.
- `validation_evidence`: `npm --workspace @athena/core run test:unit -- tests/control-plane.domain-repositories.test.ts tests/control-plane.task-workbench.test.ts tests/control-plane.task-schedules.test.ts tests/control-plane.stale-run-recovery.test.ts`; `npm --workspace @athena/core run typecheck`; `npm --workspace @athena/core run test:unit`.
- `qa_focus`: Verify query-level filters preserve archived/status/mission behavior, target type/id run behavior, schedule due behavior, default bounds, service response shapes, and stale recovery across more than one bounded run-list page.
- `open_risks`: Public list APIs still do not expose cursor pagination; this story applies conservative internal caps and leaves API pagination as a later contract story.

## QA Verdict
- `verdict`: Pass.
- `evidence_quality`: Focused tests cover SQL-backed task status/mission/archive behavior, default task caps, run target/status filters, schedule status/due filters, task service response shape, and stale recovery across more than one bounded run-list page. Full core unit suite and typecheck passed.
- `defects`: None found.
- `state_transition`: Ready for engineering done.

## Transition History
- `2026-05-28T16:23:39Z`: `intake` -> `active` by `Codex`; PM refined and queued for engineering
- `2026-05-28T17:26:33Z`: `active` -> `qa` by `Codex`; Engineering handoff complete
- `2026-05-28T17:27:11Z`: `qa` -> `done` by `Codex`; QA passed
