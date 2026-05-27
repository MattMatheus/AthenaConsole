<!-- AUDIENCE: Internal/Technical -->

# Handoff Summary

## Delivered

- Completed `planning/backlog/completed/2026.16.06-add-durable-schedule-run-history.md`.
- Added SQLite-backed `schedule_run_history` for app-state schedules with target metadata, timestamps, run id, mission id, task ids, missed/next run metadata, skip reason, and failure details.
- Updated `LocalScheduleService` so task and workflow-template schedule attempts record durable history, including failed task runs and in-process overlap skips.
- Updated the existing schedule logs service/API path to merge durable app-state history with legacy JSONL schedule logs, newest first.
- Extended schedule log contracts and regenerated API component schemas.
- Updated the console Schedules page with selected schedule rows and a Run History panel that links task runs and missions.
- Promoted `planning/backlog/active/2026.17.01-implement-workflow-dag-definition-parser.md` as the next story.

## Validation

- Pass: `npm --workspace @athena/core run generate:schemas`
- Pass: `npm --workspace @athena/core run typecheck`
- Pass: `npm --workspace @athena/core exec -- vitest run tests/control-plane.task-schedules.test.ts tests/api.task-schedules.test.ts`
- Pass: `npm --workspace @athena/core run check:schemas`
- Pass: `npm --workspace @athena/console run typecheck`
- Pass: `npm --workspace @athena/console run test`
- Pass: `npm --workspace @athena/console run lint`
- Pass: `npm --workspace @athena/console run build`
- Pass: Safari verification at `http://127.0.0.1:5178/schedules` against seeded local API data on `127.0.0.1:8787`
- Pass: `git diff --check`

## Next Work

- Execute `planning/backlog/active/2026.17.01-implement-workflow-dag-definition-parser.md`.
- Start from workflow-template manifest validation/indexing and instantiation paths.
- Preserve current sequential workflow behavior while adding explicit dependency parsing, cycle/reference validation, and deterministic topological ordering for downstream mission/task creation.
