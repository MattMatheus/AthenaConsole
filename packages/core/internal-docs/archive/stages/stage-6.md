# Stage 6: System Scheduling Integration (Completed)

## Objectives (from plan)

- Implement a local scheduled task runner interface.
- Add scheduler-focused CLI commands.
- Add scheduled run registration, execution logs, and overlap guardrails.

## Implemented In This Slice

- New scheduling module:
  - file: `src/schedule/index.ts`
  - persisted schedule definitions at `.athena/schedule/tasks.json`
  - persisted run logs at `.athena/schedule/logs/<schedule-id>.jsonl`
  - lock files at `.athena/schedule/locks/*.lock`
- New scheduling contracts:
  - `ScheduledTask`
  - `ScheduleRunLog`
- Scheduler overlap protections:
  - in-process re-entrancy guard per schedule id
  - filesystem lock per schedule id for cross-instance serialization
  - persisted `running` flag reset via `finally` cleanup path
- CLI scheduling commands added:
  - `athena schedule add --id <id> --session <id> --input <text> --every-minutes <n> [--start-now true|false]`
  - `athena schedule list`
  - `athena schedule run --id <id> [--provider <id>] [--model <id>]`
  - `athena schedule tick [--at <iso-datetime>] [--provider <id>] [--model <id>]`
  - `athena schedule logs --id <id> [--limit <n>]`
  - `athena schedule remove --id <id>`
- Runtime integration for scheduled executions:
  - schedule runs call the same `createRuntime().run()` path as interactive runs
  - schedule-trigger metadata added to runtime call metadata

## Verification

- `npm run typecheck`: passed
- `npm test`: passed
- `npm run build`: passed

## Tests Added

- `tests/schedule.manager.test.ts`
  - task persistence across manager instances
  - overlap guard behavior (`already-running`)
  - due-task execution and next-run updates
  - failure logging and running-flag cleanup
- `tests/cli.schedule.test.ts`
  - add/list/run/logs/remove CLI flow

## Exit Criteria Status

- Local scheduled runs execute through the same runtime pipeline: met.
- Scheduled run registration and logs are persisted: met.
- Overlap guardrails for schedule executions are implemented: met.
