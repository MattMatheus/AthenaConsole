<!-- AUDIENCE: Internal/Technical -->

# Handoff Summary

## Delivered

- Completed `planning/backlog/completed/2026.16.05-schedule-workflow-templates.md`.
- Added backend/API support for `targetType: "workflow-template"` schedules.
- Workflow-template schedules store version/plugin/input disambiguation in `inputBindings`, instantiate fresh missions/tasks through the workflow-template instantiation service, and return created `missionId`/`taskIds` in schedule run results.
- Schedule metadata now exposes `lastMissionId` from durable `failurePolicy.lastAttempt` data, keeping `lastRunId` reserved for run records.
- The console schedule UI can switch between task and workflow targets, render workflow-template inputs/defaults, create workflow-template schedules, and link created missions from run results and schedule rows.
- Promoted `planning/backlog/active/2026.16.06-add-durable-schedule-run-history.md` as the next story.

## Validation

- Pass: `npm --workspace @athena/core run generate:schemas`
- Pass: `npm --workspace @athena/core run typecheck`
- Pass: `npm --workspace @athena/core exec -- vitest run tests/control-plane.task-schedules.test.ts tests/api.task-schedules.test.ts`
- Pass: `npm --workspace @athena/core exec -- vitest run tests/api.schemas.test.ts tests/control-plane.api-contracts.test.ts tests/api.route-registration.test.ts tests/control-plane.task-schedules.test.ts tests/api.task-schedules.test.ts`
- Pass: `npm --workspace @athena/console run typecheck`
- Pass: `npm --workspace @athena/console run test`
- Pass: `npm --workspace @athena/console run lint`
- Pass: `npm --workspace @athena/console run build`
- Pass: Safari verification at `http://127.0.0.1:5179/schedules` against seeded local API data on `127.0.0.1:8799`
- Pass: `git diff --check`

## Next Work

- Execute `planning/backlog/active/2026.16.06-add-durable-schedule-run-history.md`.
- Start from the app-state schedule execution path in `LocalScheduleService`, the existing legacy `GET /api/v1/schedules/:id/logs` surface, and the schedule console run-result/list UI.
- Preserve task and workflow-template schedule behavior while adding durable app-state history for prior executions.
