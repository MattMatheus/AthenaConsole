# Plan 012: Bound run event/artifact reads on the run-detail path

> **Executor instructions**: Follow this plan step by step. Run every verification
> command and confirm the expected result before moving on. If anything in "STOP
> conditions" occurs, stop and report — do not improvise. When done, update the
> status row for this plan in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 182e9ba..HEAD -- packages/core/src/control-plane/app-state/domain-repositories/runs.ts packages/core/src/control-plane/services/task-workbench.ts`

## Why this matters

`RunEventRepository.listForRun` and `ArtifactMetadataRepository.listForRun` take
**no limit** — every other list path in app-state clamps via `clampAppStateListLimit`
(default 500, max 1000). Opening a task-run detail (`GET /tasks/runs/:runId` →
`getRun`) serializes the **entire** event log for the run to the client; for a long
agent run that can be thousands of rows. Separately, fetching a single artifact by
id loads **all** artifacts for the run and `.find`s one. This plan bounds the
detail read and adds a single-row artifact lookup.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED (changes a response the console renders — cap generously and document the follow-up)
- **Depends on**: none
- **Category**: performance (unbounded reads)
- **Planned at**: commit `182e9ba`, 2026-06-13

## Current state

`packages/core/src/control-plane/app-state/domain-repositories/runs.ts`:

```ts
// :398 (RunEventRepository) — no limit
listForRun(runId: string): RunEventRecord[] {
  return this.listForRunStatement.all(runId).map((row) => mapRunEventRow(row as RunEventRow));
}

// :517 (ArtifactMetadataRepository) — no limit
listForRun(runId: string): ArtifactMetadataRecord[] {
  return this.listForRunStatement.all(runId).map((row) => mapArtifactMetadataRow(row as ArtifactMetadataRow));
}
```

`clampAppStateListLimit` is exported from `app-state/domain-repositories/shared.ts:4`
(default 500, max 1000).

Detail-view call sites in `packages/core/src/control-plane/services/task-workbench.ts`:

```ts
// :424-425 (getRun) — unbounded
events: appState.runEvents.listForRun(run.id).map(mapRunEventRecord),
artifacts: appState.artifacts.listForRun(run.id).map(mapArtifactMetadataRecord)

// :546 (getRunArtifact) — loads all artifacts to find one
const artifact = appState.artifacts.listForRun(run.id).find((item) => item.id === artifactId);
```

The artifact list statement (`runs.ts:476`) selects a fixed column set ordered
`created_at asc, rowid asc`. The run-event list statement is prepared similarly in
the `RunEventRepository` constructor (search the file for `listForRunStatement` in
that class).

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Typecheck core | `npm --workspace @athena/core run typecheck` | exit 0 |
| App-state tests | `npm --workspace @athena/core run test:unit -- app-state` | all pass |
| Workbench tests | `npm --workspace @athena/core run test:unit -- workbench` | all pass |
| All core tests | `npm --workspace @athena/core run test:unit` | all pass |

## Scope

**In scope**:
- `packages/core/src/control-plane/app-state/domain-repositories/runs.ts` (optional `limit` on both `listForRun`; add `getForRun(runId, artifactId)` to `ArtifactMetadataRepository`)
- `packages/core/src/control-plane/services/task-workbench.ts` (`getRun` passes a cap; `getRunArtifact` uses the single-row lookup)
- `packages/core/tests/` app-state test for the repositories

**Out of scope** (do NOT touch):
- `exportRunEvidenceBundle` and other callers that legitimately need ALL events/artifacts — leave them unbounded (they are internal, not client-facing per-render).
- The console UI — pagination/"load more" is a separate follow-up (see Maintenance notes).

## Git workflow

- Branch: `advisor/012-bound-run-detail-reads`
- Commit per logical unit; short imperative messages.
- Do NOT push or open a PR unless instructed.

## Steps

### Step 1: Add an optional bounded variant to both `listForRun`

In `runs.ts`, prepare a second statement per repository that appends `LIMIT ?` to
the existing SELECT (same columns, same ORDER BY), e.g. for artifacts:

```ts
this.listForRunLimitedStatement = db.prepare(
  "select ...same columns... from artifact_metadata where run_id = ? order by created_at asc, rowid asc limit ?"
);
```

Change `listForRun` to accept an optional limit, clamping with `clampAppStateListLimit`
(import it from `./shared.js`):

```ts
listForRun(runId: string, options: { limit?: number } = {}): ArtifactMetadataRecord[] {
  if (options.limit === undefined) {
    return this.listForRunStatement.all(runId).map((row) => mapArtifactMetadataRow(row as ArtifactMetadataRow));
  }
  const limit = clampAppStateListLimit(options.limit);
  return this.listForRunLimitedStatement.all(runId, limit).map((row) => mapArtifactMetadataRow(row as ArtifactMetadataRow));
}
```

Do the same for `RunEventRepository.listForRun` (preserving its existing column set
and ORDER BY). Keeping the no-arg behavior identical means existing callers are
unaffected.

**Verify**: `npm --workspace @athena/core run typecheck` → exit 0.

### Step 2: Add a single-row artifact lookup

In `ArtifactMetadataRepository`, add:

```ts
this.getForRunStatement = db.prepare(
  "select ...same columns... from artifact_metadata where run_id = ? and id = ?"
);
...
getForRun(runId: string, artifactId: string): ArtifactMetadataRecord | undefined {
  const row = this.getForRunStatement.get(runId, artifactId) as ArtifactMetadataRow | undefined;
  return row ? mapArtifactMetadataRow(row as ArtifactMetadataRow) : undefined;
}
```

**Verify**: `npm --workspace @athena/core run typecheck` → exit 0.

### Step 3: Use them on the detail path

In `task-workbench.ts`:
- Add a module constant: `const RUN_DETAIL_EVENT_LIMIT = 1000;`
- In `getRun` (`:424-425`), pass the cap:
  ```ts
  events: appState.runEvents.listForRun(run.id, { limit: RUN_DETAIL_EVENT_LIMIT }).map(mapRunEventRecord),
  artifacts: appState.artifacts.listForRun(run.id, { limit: RUN_DETAIL_EVENT_LIMIT }).map(mapArtifactMetadataRecord)
  ```
- In `getRunArtifact` (`:546`), replace the `listForRun(...).find(...)` with:
  ```ts
  const artifact = appState.artifacts.getForRun(run.id, artifactId);
  ```
  Keep the existing `if (!artifact) throw ...` and the content-resolution lines.

**Verify**: `npm --workspace @athena/core run typecheck` → exit 0.

### Step 4: Run the suites

**Verify**: `npm --workspace @athena/core run test:unit -- app-state` and `-- workbench` pass; full `npm --workspace @athena/core run test:unit` → all pass.

## Test plan

- Repository tests: `getForRun` returns the right artifact / `undefined` when absent;
  `listForRun(runId, { limit: N })` returns at most N rows in the same order;
  `listForRun(runId)` (no options) still returns all. Model on existing app-state tests.
- Workbench test: `getRunArtifact` still returns the correct artifact + content (unchanged behavior via the new single-row path).
- Verification: `npm --workspace @athena/core run test:unit` → all pass.

## Done criteria

ALL must hold:

- [ ] Both `listForRun` methods accept an optional clamped `limit`; no-arg behavior unchanged
- [ ] `ArtifactMetadataRepository.getForRun(runId, artifactId)` exists and `getRunArtifact` uses it
- [ ] `getRun` passes `RUN_DETAIL_EVENT_LIMIT`
- [ ] `npm --workspace @athena/core run typecheck` exits 0
- [ ] `npm --workspace @athena/core run test:unit` exits 0; new repository tests pass
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report if:

- A column set in the live statements differs from what you copy into the limited/single-row statements (drift) — use the live SQL.
- Capping `getRun` events breaks a test that asserts a full event list for a run with >1000 events — report it; the cap is intentional but the operator may want a different number.

## Maintenance notes

- The console should add "load more"/pagination for run events; this plan caps the
  payload at 1000 to stop the unbounded read without a UI change. Track the UI
  follow-up separately.
- Reviewer should confirm internal full-read callers (evidence bundle export) still
  call `listForRun(runId)` with no limit.
