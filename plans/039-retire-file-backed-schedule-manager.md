# Plan 039: Retire legacy file-backed schedule manager from API runtime paths

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the next
> step. If anything in the "STOP conditions" section occurs, stop and report;
> do not improvise. When done, update the status row for this plan in
> `plans/README.md` unless a reviewer dispatched you and told you they maintain
> the index.
>
> **Drift check (run first)**:
> `git diff --stat c082a64..HEAD -- packages/core/src/control-plane/services/local-services.ts packages/core/src/schedule/index.ts packages/core/src/control-plane/state-store.ts packages/core/src/cli packages/core/tests docs/product/architecture/state-ownership-map.md docs/developer/product-dev-guides/06-cli-reference.md`
>
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against live code. If the API-facing schedule service
> no longer constructs or reads from `ScheduleManager`, stop and report that this
> plan is stale.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: none
- **Category**: tech-debt
- **Planned at**: commit `c082a64`, 2026-06-17

## Why this matters

Schedules are documented as canonical SQLite app-state, but the runtime still
merges SQLite schedules with an older file-backed `ScheduleManager`. That dual
path makes schedule behavior harder to reason about, keeps legacy file state
alive in API responses, and is a bad fit for the enterprise/Postgres direction.
Retiring the file-backed schedule path simplifies the service and makes the
state ownership map true in code.

## Current state

Relevant files:

- `packages/core/src/control-plane/services/local-services.ts` contains
  `LocalScheduleService`, the API-facing schedule service.
- `packages/core/src/schedule/index.ts` contains the legacy file-backed
  `ScheduleManager`.
- `packages/core/src/control-plane/state-store.ts` still exposes schedule reads
  through `ScheduleManager`.
- `packages/core/tests/control-plane.task-schedules.test.ts`,
  `packages/core/tests/api.task-schedules.test.ts`, and
  `packages/core/tests/schedule.manager.test.ts` cover schedule behavior.
- `docs/product/architecture/state-ownership-map.md` declares schedule ownership.

The state map is clear:

```md
<!-- docs/product/architecture/state-ownership-map.md:45-46 -->
| Schedules | SQLite, `schedules` | SQLite app-state | Keep in SQLite. |
| Schedule history | SQLite, `schedule_run_history` | SQLite app-state | Keep in SQLite, including workflow DAG run correlation. |
```

But `LocalScheduleService` still constructs the legacy manager:

```ts
// packages/core/src/control-plane/services/local-services.ts:735-746
export class LocalScheduleService implements ScheduleService {
  private readonly manager: ScheduleManager;
  private readonly runningAppStateScheduleIds = new Set<string>();

  constructor(
    private readonly config: AthenaConfig,
    private readonly backend: ExecutionBackend,
    private readonly policyService: PolicyService,
    private readonly options: { appState?: AppStateDatabase } = {}
  ) {
    this.manager = new ScheduleManager(config);
  }
```

It merges new and legacy schedules:

```ts
// packages/core/src/control-plane/services/local-services.ts:748-757
async list(): Promise<ScheduledTask[]> {
  return [...(await this.listAppStateSchedules()), ...(await this.manager.listTasks())];
}

async get(id: string): Promise<ScheduledTask | undefined> {
  const appStateSchedule = this.withAppState((appState) => appState.schedules.get(id));
  if (appStateSchedule) {
    return mapScheduleRecord(appStateSchedule);
  }
  return (await this.manager.listTasks()).find((schedule) => schedule.id === id);
}
```

It also executes and logs legacy schedules:

```ts
// packages/core/src/control-plane/services/local-services.ts:832-862
const appStateResult = await this.runDueAppStateSchedules(at, options);
const legacyResult = await this.manager.runDue(at, async (task, runOptions) => { ... });
return {
  run: [...appStateResult.run, ...legacyResult.run],
  skipped: appStateResult.skipped + legacyResult.skipped
};

const legacyLogs = await this.manager.readLogs(id, limit);
return [...appStateLogs, ...legacyLogs]
```

The legacy manager persists JSON files:

```ts
// packages/core/src/schedule/index.ts:54-65
export class ScheduleManager {
  private readonly scheduleRoot: string;
  private readonly tasksPath: string;
  private readonly logsDir: string;
  private readonly locksDir: string;

  constructor(private readonly config: AthenaConfig) {
    this.scheduleRoot = resolve(this.config.workspaceRoot, this.config.stateDir, "schedule");
    this.tasksPath = resolve(this.scheduleRoot, "tasks.json");
    this.logsDir = resolve(this.scheduleRoot, "logs");
    this.locksDir = resolve(this.scheduleRoot, "locks");
  }
```

## Commands you will need

| Purpose | Command | Expected on success |
| --- | --- | --- |
| Core typecheck | `npm --workspace @athena/core run typecheck` | exits 0 |
| Schedule tests | `npm --workspace @athena/core run test:unit -- schedule` | exits 0; if filter misses tests, run the focused files below |
| Task schedule tests | `npm --workspace @athena/core run test:unit -- control-plane.task-schedules api.task-schedules` | exits 0 |
| Full core tests | `npm --workspace @athena/core run test:unit` | exits 0 |
| Manifest/schema guard | `npm --workspace @athena/core run validate:manifests && npm --workspace @athena/core run check:schemas` | exits 0 |
| Docs check if docs changed | `npm run check:docs` | exits 0 |
| Whitespace guard | `git diff --check` | exits 0 |

## Scope

**In scope**:

- `packages/core/src/control-plane/services/local-services.ts`
- `packages/core/src/control-plane/state-store.ts` only for removing schedule
  methods that are no longer part of the active `StateStore` boundary.
- `packages/core/src/control-plane/state-store/types.ts` if interface cleanup is needed.
- `packages/core/src/schedule/index.ts` and `packages/core/tests/schedule.manager.test.ts` if the manager becomes unused and can be deleted.
- Schedule API/core tests under `packages/core/tests`.
- Docs that mention old file-backed schedule state.

**Out of scope**:

- Do not change public schedule route URLs.
- Do not change `ScheduledTask` or `ScheduleRunLog` response shapes except to
  remove legacy-only fields that are provably unreachable and already absent
  from SQLite schedules.
- Do not implement a migration importer from `.athena/schedule/tasks.json`
  unless the operator explicitly requests backwards migration support.
- Do not refactor workflow DAG execution beyond what schedule execution needs.

## Git workflow

- Branch: `advisor/039-retire-file-backed-schedule-manager`
- Commit message: `Remove legacy file-backed schedule runtime`
- Do not push or open a PR unless the operator asks.

## Steps

### Step 1: Add or confirm characterization tests for SQLite schedules

Before removing the legacy path, make sure app-state schedules cover:

- list/get/create/update/delete
- run one task schedule
- run due schedules
- schedule logs from `schedule_run_history`
- overlap handling through `runningAppStateScheduleIds`
- workflow-template schedule execution if existing tests cover it

Use existing schedule tests as the pattern. Prefer updating
`control-plane.task-schedules.test.ts` and `api.task-schedules.test.ts`.

**Verify**: `npm --workspace @athena/core run test:unit -- control-plane.task-schedules api.task-schedules` exits 0.

### Step 2: Remove `ScheduleManager` from `LocalScheduleService`

In `LocalScheduleService`:

- Delete the `private readonly manager: ScheduleManager` field.
- Remove `this.manager = new ScheduleManager(config)`.
- Make `list`, `get`, `upsert`, `remove`, `run`, `runDue`, and `logs` use only
  `appState.schedules` and `appState.scheduleRunHistory`.
- For `upsert`, reject old request shapes that lack `targetType` with a clear
  `CONFIG_ERROR` explaining that schedules now require a target type.

**Verify**: `npm --workspace @athena/core run typecheck` exits 0.

### Step 3: Remove state-store schedule bridge if unused

Search for `listSchedules()` and `getScheduleLogs()` on `StateStore`. If only
the legacy schedule bridge uses them, remove those methods from
`StateStore`, `FileStateStore`, `SqliteHarnessProfileStateStore`, and related
tests.

**Verify**: `rg -n "listSchedules\\(|getScheduleLogs\\(" packages/core/src packages/core/tests` shows no unintended active schedule bridge call sites.

### Step 4: Delete or isolate the legacy manager

If `packages/core/src/schedule/index.ts` is no longer imported by production
code, delete it and its direct test file. If CLI or tests still need a legacy
schedule type, move only shared types to a contract file and remove file IO.

**Verify**: `rg -n "ScheduleManager|../schedule/index|from \"\\.\\./schedule" packages/core/src packages/core/tests` returns no production use of `ScheduleManager`.

### Step 5: Update docs

Update docs that imply file-backed schedule state is active. Keep the state
ownership map consistent with the final code.

**Verify**: `npm run check:docs` exits 0 if docs changed.

### Step 6: Run full verification

Run the core suite and guards.

**Verify**:

- `npm --workspace @athena/core run test:unit` exits 0.
- `npm --workspace @athena/core run validate:manifests && npm --workspace @athena/core run check:schemas` exits 0.
- `git diff --check` exits 0.

## Test plan

Add or preserve tests for the SQLite schedule behavior listed in Step 1. Remove
tests that only prove file-backed `tasks.json` compatibility after the runtime
path is removed. Full core tests are required because schedules touch workflow
template instantiation and runtime execution.

## Done criteria

- [x] `LocalScheduleService` no longer constructs `ScheduleManager`.
- [x] Schedule API runtime paths read/write only SQLite app-state schedules.
- [x] `rg -n "ScheduleManager" packages/core/src` returns no active production
  use, or only a clearly isolated non-runtime compatibility module approved by
  the operator.
- [x] Focused and full core tests pass.
- [x] `git diff --check` exits 0.
- [x] `plans/README.md` status row updated.

## STOP conditions

Stop and report back if:

- A public CLI command still depends on creating old `sessionId`/`input` schedules
  and the operator has not approved breaking that compatibility.
- Removing `StateStore` schedule methods forces unrelated session/run-evidence
  refactors.
- Existing tests reveal behavior differences in app-state schedules that are
  not simple legacy-compatibility removals.

## Maintenance notes

This plan intentionally does not import old `.athena/schedule/tasks.json`
records. If a real deployment needs migration, write a separate one-shot import
tool rather than keeping a permanent read bridge in the API service.
