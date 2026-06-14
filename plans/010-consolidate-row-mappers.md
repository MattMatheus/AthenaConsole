# Plan 010: Consolidate duplicated task/run-event row-mappers

> **Executor instructions**: Follow this plan step by step. Run every verification
> command and confirm the expected result before moving on. If anything in "STOP
> conditions" occurs, stop and report — do not improvise. When done, update the
> status row for this plan in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 182e9ba..HEAD -- packages/core/src/control-plane/services/task-workbench.ts packages/core/src/control-plane/services/mission-workbench.ts`

## Why this matters

`mapTaskRecord` and `mapRunEventRecord` are implemented twice — once in
`task-workbench.ts` and once in `mission-workbench.ts` — and `mapTaskRecord` has
**drifted**: the task-workbench version attaches `latestRun`, the mission version
does not. So the same task object is shaped differently depending on whether it is
listed via the task workbench or via a mission, and any future field change must be
made in lockstep across both. Consolidating onto one canonical mapper removes the
drift and the lockstep maintenance hazard. `mission-workbench.ts` already imports
from `task-workbench.ts`, so this is a low-risk export-and-reuse.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW (pure functions; mission-listed tasks gain `latestRun`, an additive change)
- **Depends on**: none (do before plan 011 to reduce churn in `task-workbench.ts`)
- **Category**: tech-debt (duplication / drift)
- **Planned at**: commit `182e9ba`, 2026-06-13

## Current state

Canonical, `packages/core/src/control-plane/services/task-workbench.ts:3091`:

```ts
function mapTaskRecord(record: TaskRecord, appState?: AppStateDatabase): TaskWorkbenchTask {
  const latestRun = appState?.runs.list({ targetType: "task", targetId: record.id, limit: 1 })[0];
  return {
    ...
    ...(appState ? { runReadiness: evaluateTaskRunReadiness(appState, record) } : {}),
    ...(latestRun ? { latestRun: mapRunSummaryRecord(latestRun) } : {})   // <-- present here
  };
}
```

Divergent copy, `packages/core/src/control-plane/services/mission-workbench.ts:429`
— identical EXCEPT it omits the `latestRun` lines:

```ts
function mapTaskRecord(record: TaskRecord, appState?: AppStateDatabase): TaskWorkbenchTask {
  return {
    ...
    ...(appState ? { runReadiness: evaluateTaskRunReadiness(appState, record) } : {})   // no latestRun
  };
}
```

`mapRunEventRecord` is byte-identical in both (`task-workbench.ts:3178`,
`mission-workbench.ts:504`).

`mission-workbench.ts:27` already imports from task-workbench:
`import { evaluateTaskRunReadiness, LocalTaskWorkbenchService } from "./task-workbench.js";`

mission-workbench call sites that use the local copies:
- `:333` `... .map((task) => mapTaskRecord(task, appState))`
- `:369` `events: appState.runEvents.listForRun(run.id).map(mapRunEventRecord)`

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Typecheck core | `npm --workspace @athena/core run typecheck` | exit 0 |
| Mission/task tests | `npm --workspace @athena/core run test:unit -- workbench` | all pass |
| All core tests | `npm --workspace @athena/core run test:unit` | all pass |

## Scope

**In scope**:
- `packages/core/src/control-plane/services/task-workbench.ts` (export the two canonical mappers)
- `packages/core/src/control-plane/services/mission-workbench.ts` (import them; delete local copies)

**Out of scope** (do NOT touch):
- `mapRunSummaryRecord`, `mapMissionRecord`, `mapMissionRunRecord`, `mapTaskRunRecord` — leave as-is. (`mapMissionRecord` is also duplicated in `workflow-template-catalog.ts`, but consolidating that is a separate, lower-value change — note it, do not do it here.)
- The contract types in `shared/contracts`.

## Git workflow

- Branch: `advisor/010-consolidate-row-mappers`
- One commit; message e.g. `refactor(core): share task/run-event mappers, fix latestRun drift`.
- Do NOT push or open a PR unless instructed.

## Steps

### Step 1: Export the canonical mappers

In `task-workbench.ts`, add `export` to the two functions:
- `export function mapTaskRecord(record: TaskRecord, appState?: AppStateDatabase): TaskWorkbenchTask {` (line 3091)
- `export function mapRunEventRecord(record: RunEventRecord): TaskWorkbenchRunEvent {` (line 3178)

**Verify**: `npm --workspace @athena/core run typecheck` → exit 0.

### Step 2: Reuse them in mission-workbench

In `mission-workbench.ts`:
- Extend the existing task-workbench import: `import { evaluateTaskRunReadiness, LocalTaskWorkbenchService, mapTaskRecord, mapRunEventRecord } from "./task-workbench.js";`
- Delete the local `function mapTaskRecord(...)` (`:429`) and `function mapRunEventRecord(...)` (`:504`).
- Leave the call sites at `:333` and `:369` unchanged — they now resolve to the imported versions.

**Verify**: `npm --workspace @athena/core run typecheck` → exit 0 (a leftover local definition would now collide with the import).

### Step 3: Run the suites and reconcile the intentional change

The intentional behavior change: mission-listed tasks now include `latestRun` (a
superset of before). Run the suites:

```
npm --workspace @athena/core run test:unit -- workbench
```

If a mission-workbench test asserts the exact task object shape and now sees an
extra `latestRun`, update that assertion (the new shape is correct and consistent
with the task workbench) and note it in your report.

**Verify**: `npm --workspace @athena/core run test:unit` → all pass.

## Test plan

- No new test files required; this is a consolidation. Existing workbench tests verify behavior.
- If you update any assertion for the additive `latestRun`, list it in your report.
- Verification: `npm --workspace @athena/core run test:unit` → all pass.

## Done criteria

ALL must hold:

- [ ] `mapTaskRecord` and `mapRunEventRecord` are defined once (exported from `task-workbench.ts`)
- [ ] `grep -n "function mapTaskRecord\|function mapRunEventRecord" packages/core/src/control-plane/services/mission-workbench.ts` returns no matches
- [ ] `npm --workspace @athena/core run typecheck` exits 0
- [ ] `npm --workspace @athena/core run test:unit` exits 0
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report if:

- The two `mapTaskRecord` bodies differ in more than the `latestRun` lines (drift beyond what's documented) — report the full diff before merging behavior.
- Exporting `mapTaskRecord` creates an import cycle that breaks the build (it should not — mission-workbench already depends on task-workbench, not vice-versa).

## Maintenance notes

- A future ADR-0016 decomposition could move these mappers to a dedicated `services/.../mappers.ts`; this plan just removes the duplication now.
- Reviewer should confirm mission-listed task responses now consistently include `latestRun`.
- `mapMissionRecord` duplication (`mission-workbench.ts` vs `workflow-template-catalog.ts`) remains; address it opportunistically when next touching those files.
