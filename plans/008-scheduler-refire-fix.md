# Plan 008: Fix file-backed scheduler re-fire on failure

> **Executor instructions**: Follow this plan step by step. Run every verification
> command and confirm the expected result before moving on. If anything in "STOP
> conditions" occurs, stop and report — do not improvise. When done, update the
> status row for this plan in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 182e9ba..HEAD -- packages/core/src/schedule/index.ts`
> If it changed, compare the "Current state" excerpts before proceeding; on a mismatch, STOP.

## Why this matters

The file-backed `ScheduleManager` advances `nextRunAt` on a **successful** run but
not on a **failed** one. Because `runDue` selects schedules where
`task.enabled && task.nextRunAt <= now`, a schedule whose handler keeps failing
stays perpetually due and re-fires on **every** scheduler tick — a tight retry
loop with no backoff that can hammer the backend/model provider until the
underlying failure clears. The canonical SQLite schedule path already handles this
correctly (it advances `nextRunAt` and moves the schedule to `error`), so this is
a divergence in the still-live legacy path (`LocalScheduleService.runDue` invokes
both paths — see `services/local-services.ts:834`).

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW (isolated module; one behavioral decision)
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `182e9ba`, 2026-06-13

## Current state

`packages/core/src/schedule/index.ts` — the success path advances `nextRunAt`:

```ts
// schedule/index.ts:197 (success)
await this.withGlobalLock(async () => {
  const tasks = await this.loadTasks();
  const current = tasks.find((row) => row.id === id);
  if (current) {
    current.running = false;
    current.lastRunAt = finish;
    current.nextRunAt = addMinutes(finish, current.everyMinutes);   // advances
    current.updatedAt = finish;
    await this.saveTasks(tasks);
  }
});
```

The failure path does NOT advance `nextRunAt`:

```ts
// schedule/index.ts:223 (failure catch)
} catch (error) {
  const finish = new Date().toISOString();
  const message = error instanceof Error ? error.message : String(error);
  const errorCode = asErrorCode(error);
  await this.withGlobalLock(async () => {
    const tasks = await this.loadTasks();
    const current = tasks.find((row) => row.id === id);
    if (current) {
      current.running = false;
      current.updatedAt = finish;            // <-- no nextRunAt advance
      await this.saveTasks(tasks);
    }
  });
  ...
}
```

And `runDue` re-selects anything still due:

```ts
// schedule/index.ts:262
async runDue(at: Date, handler: ScheduleRunHandler): ... {
  const now = at.toISOString();
  const tasks = await this.listTasks();
  const due = tasks.filter((task) => task.enabled && task.nextRunAt <= now);
  ...
}
```

`addMinutes` is already imported and used in this file (success path, line 203).

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Typecheck core | `npm --workspace @athena/core run typecheck` | exit 0 |
| Schedule tests | `npm --workspace @athena/core run test:unit -- schedule` | all pass |
| All core tests | `npm --workspace @athena/core run test:unit` | all pass |

## Scope

**In scope**:
- `packages/core/src/schedule/index.ts` (advance `nextRunAt` in the failure catch)
- The existing schedule-manager test file (find with `ls packages/core/tests | grep -i schedule`; the failure test asserts "records failed runs and clears running flag")

**Out of scope** (do NOT touch):
- The canonical SQLite schedule path in `services/local-services.ts` — it already handles failure correctly.
- `LocalScheduleService.runDue` merge logic.
- Backoff strategy beyond "advance by `everyMinutes`" — keep it simple; a fancier backoff is a separate decision.

## Git workflow

- Branch: `advisor/008-scheduler-refire-fix`
- One commit; message e.g. `fix(schedule): advance nextRunAt when a scheduled run fails`.
- Do NOT push or open a PR unless instructed.

## Steps

### Step 1: Advance `nextRunAt` on failure

In the failure catch block (`schedule/index.ts:227-235`), set `nextRunAt` the same
way the success path does:

```ts
if (current) {
  current.running = false;
  current.nextRunAt = addMinutes(finish, current.everyMinutes);   // add this line
  current.updatedAt = finish;
  await this.saveTasks(tasks);
}
```

This makes a failing schedule wait its normal interval before the next attempt,
matching the success cadence and stopping the tight re-fire loop.

**Verify**: `npm --workspace @athena/core run typecheck` → exit 0.

### Step 2: Add/extend the failure test

In the schedule-manager test file, extend the existing failure test (or add a new
one) to assert that after a failed run, `nextRunAt` is strictly in the future
(greater than the run's finish time) — i.e. the schedule is no longer immediately
due. Model it on the existing failure test's setup.

**Verify**: `npm --workspace @athena/core run test:unit -- schedule` → all pass, including the new assertion.

## Test plan

- Extend the schedule-manager failure test: after a handler throws, assert
  `nextRunAt > finishedAt` (schedule not still due) and that `running` is cleared.
- Optionally add a `runDue` test: a schedule whose handler throws is NOT picked up
  again on an immediately-following `runDue(sameNow)` call.
- Verification: `npm --workspace @athena/core run test:unit` → all pass.

## Done criteria

ALL must hold:

- [ ] The failure catch in `schedule/index.ts` advances `nextRunAt` via `addMinutes(finish, current.everyMinutes)`
- [ ] `npm --workspace @athena/core run typecheck` exits 0
- [ ] `npm --workspace @athena/core run test:unit` exits 0; failure test asserts `nextRunAt` advancement
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report if:

- The success/failure blocks no longer match the excerpts (drift).
- There is an existing, intentional immediate-retry semantic documented for failed schedules (search `docs/` and the test file) — if so, report it rather than changing behavior.

## Maintenance notes

- The longer-term fix is to unify scheduling onto the SQLite app-state path (see the audit's direction note D3 / the dual-scheduler asymmetry). This plan is the minimal correctness fix for the legacy path until that consolidation happens.
- Reviewer should confirm the success and failure paths now advance `nextRunAt` identically.
