# Plan 040: Introduce a shared app-state access boundary for already-seamed services

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the next
> step. If anything in the "STOP conditions" section occurs, stop and report;
> do not improvise. When done, update the status row for this plan in
> `plans/README.md` unless a reviewer dispatched you and told you they maintain
> the index.
>
> **Drift check (run first)**:
> `git diff --stat c082a64..HEAD -- docs/product/architecture/postgres-migration-design.md docs/product/epics/active/2026.46.00-epic-postgres-readiness-interface-freeze.md packages/core/src/control-plane/services.ts packages/core/src/control-plane/services packages/core/src/control-plane/plugins/local-loader.ts packages/core/src/control-plane/app-state packages/core/tests`
>
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code. If already-seamed services no
> longer call `openAppStateDatabase` directly, stop and report that this plan is
> stale.

## Status

- **Priority**: P2
- **Effort**: L
- **Risk**: MED
- **Depends on**: plans/039-retire-file-backed-schedule-manager.md recommended
- **Category**: tech-debt/migration
- **Planned at**: commit `c082a64`, 2026-06-17

## Why this matters

The enterprise/Postgres direction depends on keeping app-state access behind a
swappable repository boundary. Several services already have an `options.appState`
seam but still fall back to opening SQLite directly. Converting the
already-seamed cluster first reduces direct SQLite coupling without changing
behavior and creates the pattern for the harder state-store cluster.

## Current state

Relevant files:

- `docs/product/architecture/postgres-migration-design.md` inventories direct
  `openAppStateDatabase` call sites.
- `docs/product/epics/active/2026.46.00-epic-postgres-readiness-interface-freeze.md`
  defines the active Postgres-readiness work.
- `packages/core/src/control-plane/services.ts` is the composition root.
- Service files under `packages/core/src/control-plane/services/` contain direct
  app-state fallbacks.
- `packages/core/src/control-plane/plugins/local-loader.ts` already accepts an
  `options.appState` seam.

The migration design gives the live inventory command:

```md
<!-- docs/product/architecture/postgres-migration-design.md:71-72 -->
Live command:
`grep -rn "openAppStateDatabase" packages/core/src --include='*.ts' | grep -v "app-state/index"`.
```

It identifies already-seamed call sites:

```md
<!-- docs/product/architecture/postgres-migration-design.md:76-89 -->
`packages/core/src/control-plane/plugins/local-loader.ts:153` ... Already accepts
`options.appState`; make callers supply the app-state provider instead of opening locally.

`packages/core/src/control-plane/services/local-services.ts:1145` ...
Already checks `this.options.appState`; make the option mandatory or provider-backed.

`packages/core/src/control-plane/services/task-workbench.ts:1023` ...
Already checks `this.options.appState`; replace fallback open with injected provider.
```

The active epic scopes the first story:

```md
<!-- docs/product/epics/active/2026.46.00-epic-postgres-readiness-interface-freeze.md:55-68 -->
Convert services that already check `options.appState` to use injected
app-state/repository providers without local fallback opens.
Include local-loader, local schedule service, task workbench, workflow queue
status, workflow template catalog, mission workbench, workflow status,
workflow DAG executor, worker heartbeats, and agent catalog.

Acceptance:
- The already-seamed cluster no longer calls `openAppStateDatabase` directly.
- Behavior is unchanged for current local construction paths.
```

Current composition root opens app-state directly:

```ts
// packages/core/src/control-plane/services.ts:209-217
export function createLocalControlPlaneServices(options: LocalControlPlaneOptions): ControlPlaneServices {
  const appState = openAppStateDatabase(options.config);
  try {
    indexConfiguredLocalPlugins(options.config, { appState });
    recoverStaleTaskAndMissionRuns(appState);
    recoverStaleWorkflowDagRuns(appState);
  } finally {
    appState.close();
  }
```

Schedule service has a local fallback:

```ts
// packages/core/src/control-plane/services/local-services.ts:1141-1162
private withAppState<T>(access: (appState: AppStateDatabase) => T): T {
  if (this.options.appState) {
    return access(this.options.appState);
  }
  const appState = openAppStateDatabase(this.config);
  try {
    return access(appState);
  } finally {
    appState.close();
  }
}
```

## Commands you will need

| Purpose | Command | Expected on success |
| --- | --- | --- |
| Direct-open inventory | `grep -rn "openAppStateDatabase" packages/core/src --include='*.ts' | grep -v "app-state/index"` | already-seamed services removed from the output after this plan |
| Core typecheck | `npm --workspace @athena/core run typecheck` | exits 0 |
| App-state contract tests | `npm --workspace @athena/core run test:unit -- app-state-contract` | exits 0 |
| Core unit tests | `npm --workspace @athena/core run test:unit` | exits 0 |
| Manifest/schema guard | `npm --workspace @athena/core run validate:manifests && npm --workspace @athena/core run check:schemas` | exits 0 |
| Whitespace guard | `git diff --check` | exits 0 |

## Scope

**In scope**:

- A small app-state access helper/type under `packages/core/src/control-plane/app-state/`
  or `packages/core/src/control-plane/services/`.
- `packages/core/src/control-plane/services.ts`
- Already-seamed service constructors and helpers that currently accept
  `options.appState`.
- `packages/core/src/control-plane/plugins/local-loader.ts` only if needed to
  make composition pass app-state explicitly.
- Focused tests around service construction and app-state contract behavior.

**Out of scope**:

- Do not convert the whole `SqliteHarnessProfileStateStore` cluster; that is a
  separate 2026.46 story.
- Do not implement a Postgres backend.
- Do not change app-state schema or migrations.
- Do not combine this with policy/task-workbench decomposition beyond the
  minimal constructor/helper changes.

## Git workflow

- Branch: `advisor/040-app-state-access-boundary`
- Commit message: `Refactor app-state access seams`
- Do not push or open a PR unless the operator asks.

## Steps

### Step 1: Add an app-state access abstraction

Introduce a tiny helper such as `AppStateProvider` or `withAppState` that can:

- run a synchronous callback with an `AppStateDatabase`
- run an async callback with an `AppStateDatabase`
- own closing behavior when it opens a local SQLite database
- wrap an already-open `AppStateDatabase` for tests

Keep the helper boring. Do not add a general dependency-injection framework.

**Verify**: `npm --workspace @athena/core run typecheck` exits 0.

### Step 2: Wire the provider from the composition root

In `createLocalControlPlaneServices`, construct one provider and pass it into
already-seamed services instead of letting those services open SQLite by
themselves. Preserve the startup indexing and stale-run recovery behavior.

**Verify**: `npm --workspace @athena/core run typecheck` exits 0.

### Step 3: Convert already-seamed services

For services that already have `options.appState` or equivalent local
`withAppState` helpers, replace fallback `openAppStateDatabase(this.config)`
calls with the provider from Step 1.

Start with the lowest-risk cluster:

- local-loader call path
- `LocalScheduleService` if plan 039 has not removed the fallback already
- `LocalTaskWorkbenchService`
- workflow queue/status/catalog services that already accept app-state options
- agent catalog/worker heartbeat services if they already have a seam

After each small cluster, run typecheck.

**Verify**: `grep -rn "openAppStateDatabase" packages/core/src --include='*.ts' | grep -v "app-state/index"` no longer lists the converted already-seamed files.

### Step 4: Update tests

Adjust tests to pass an already-open app-state or provider wrapper where they
previously relied on helper-local SQLite opens. Add one focused test that proves
a service can operate through an injected provider.

**Verify**:

- `npm --workspace @athena/core run test:unit -- app-state-contract` exits 0.
- `npm --workspace @athena/core run test:unit` exits 0.

### Step 5: Update migration docs

Update `docs/product/architecture/postgres-migration-design.md` and the
2026.46 epic status notes for the call sites converted in this plan. Do not mark
the whole epic done unless all listed acceptance criteria are satisfied.

**Verify**: `npm run check:docs` exits 0 if docs changed.

## Test plan

- Existing core unit tests must pass.
- App-state contract tests must pass.
- Add or update a focused service-construction test if no existing test would
  fail when the provider is ignored.

## Done criteria

- [x] Converted already-seamed services no longer call `openAppStateDatabase`
  directly.
- [x] Direct-open inventory still lists only intentionally deferred clusters.
- [x] Behavior is unchanged for local service construction.
- [x] Core typecheck and full core unit tests pass.
- [x] `git diff --check` exits 0.
- [x] `plans/README.md` status row updated.

## STOP conditions

Stop and report back if:

- A target service lacks an actual app-state seam and conversion would require
  a larger interface redesign.
- The helper begins to look like a generic service locator.
- Removing a direct open changes transaction boundaries or database lifetime in
  a way existing tests cannot characterize.

## Maintenance notes

This is the first mechanical slice of the Postgres-readiness work. Reviewers
should look for behavior changes hiding in constructor refactors. The next slice
should handle the `SqliteHarnessProfileStateStore` cluster separately.
