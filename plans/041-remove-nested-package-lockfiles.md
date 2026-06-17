# Plan 041: Remove stale nested package-lock files from npm workspace packages

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the next
> step. If anything in the "STOP conditions" section occurs, stop and report;
> do not improvise. When done, update the status row for this plan in
> `plans/README.md` unless a reviewer dispatched you and told you they maintain
> the index.
>
> **Drift check (run first)**:
> `git diff --stat c082a64..HEAD -- package.json package-lock.json apps/console/package-lock.json packages/core/package-lock.json README.md GETTING_STARTED.md docs .github/workflows package.json`
>
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against live files. If the nested lockfiles were
> already deleted or intentionally documented as package-level locks, stop and
> report that this plan is stale.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: dx/migration
- **Planned at**: commit `c082a64`, 2026-06-17

## Why this matters

This is an npm workspace with a root `package-lock.json`, but two nested
workspace lockfiles are also tracked. The nested core lock is stale: it still
claims `ajv ^6.14.0` and `applicationinsights ^3.12.0` as direct dependencies
even though `packages/core/package.json` now uses `ajv ^8.17.1` and no longer
declares `applicationinsights`. Keeping stale nested locks creates confusing
dependency audits and invites contributors to run installs from package
directories that do not match CI.

## Current state

Relevant files:

- `package.json` defines the root npm workspace and package manager.
- `package-lock.json` is the root workspace lock used by `npm ci`.
- `apps/console/package-lock.json` is a tracked nested lockfile.
- `packages/core/package-lock.json` is a tracked nested lockfile and is stale.
- `.github/workflows/local-server-validation.yml` runs `npm ci` at the repo root.

Root workspace manifest:

```json
// package.json:3-9
{
  "packageManager": "npm@11.9.0",
  "private": true,
  "workspaces": [
    "apps/*",
    "packages/*"
  ]
}
```

Core manifest current dependencies:

```json
// packages/core/package.json:52-58
"dependencies": {
  "@azure/identity": "^4.6.0",
  "@kubernetes/client-node": "^1.4.0",
  "ajv": "^8.17.1",
  "better-sqlite3": "^12.10.0",
  "ioredis": "^5.4.1",
  "js-yaml": "^4.1.1"
}
```

Stale nested core lock root package:

```json
// packages/core/package-lock.json:12-16
"dependencies": {
  "@azure/identity": "^4.6.0",
  "@kubernetes/client-node": "^1.4.0",
  "ajv": "^6.14.0",
  "applicationinsights": "^3.12.0",
  "better-sqlite3": "^12.10.0"
}
```

The root lock already contains the workspace package dependency block for
`packages/core`, so package-level lockfiles are redundant for normal root
workflow use.

## Commands you will need

| Purpose | Command | Expected on success |
| --- | --- | --- |
| List tracked lockfiles | `git ls-files '*package-lock.json'` | only `package-lock.json` remains after cleanup |
| Install verification | `npm ci --ignore-scripts` | exits 0; uses root lockfile |
| Root typecheck | `npm run typecheck` | exits 0 |
| Root tests | `npm run test` | exits 0 |
| Docs check if docs changed | `npm run check:docs` | exits 0 |
| Whitespace guard | `git diff --check` | exits 0 |

## Scope

**In scope**:

- Delete `apps/console/package-lock.json`.
- Delete `packages/core/package-lock.json`.
- Update docs that mention install workflow if they imply running package-level
  `npm install` or package-local lockfiles.
- Update `.gitignore` only if needed to prevent nested lockfiles from being
  re-added accidentally.

**Out of scope**:

- Do not change dependency versions in `package.json` or `package-lock.json`.
- Do not run `npm update`.
- Do not change package manager from npm.
- Do not remove root `package-lock.json`.

## Git workflow

- Branch: `advisor/041-remove-nested-package-lockfiles`
- Commit message: `Remove stale nested package locks`
- Do not push or open a PR unless the operator asks.

## Steps

### Step 1: Delete nested lockfiles

Remove only:

- `apps/console/package-lock.json`
- `packages/core/package-lock.json`

Do not touch root `package-lock.json`.

**Verify**: `git ls-files '*package-lock.json'` prints only `package-lock.json`.

### Step 2: Prevent accidental reintroduction

If `.gitignore` does not already prevent nested lockfiles, add a narrow ignore
pattern such as:

```gitignore
apps/*/package-lock.json
packages/*/package-lock.json
!package-lock.json
```

Keep the root lockfile tracked.

**Verify**: `git status --short --ignored apps/console/package-lock.json packages/core/package-lock.json` shows deleted tracked files and, after deletion, nested lock paths are ignored if recreated.

### Step 3: Update install docs if needed

Search for package-local install instructions:

```bash
rg -n "cd apps/console|cd packages/core|npm install|npm ci|package-lock" README.md GETTING_STARTED.md docs .github/workflows
```

Keep root `npm install` / root `npm ci` instructions. Remove or clarify any
instruction that implies installing from a workspace package directory.

**Verify**: `npm run check:docs` exits 0 if docs changed.

### Step 4: Verify root workspace flow

Run the root install and validation commands.

**Verify**:

- `npm ci --ignore-scripts` exits 0.
- `npm run typecheck` exits 0.
- `npm run test` exits 0.
- `git diff --check` exits 0.

## Test plan

No new tests are required. The validation is root `npm ci`, root typecheck, and
root tests, proving the root workspace lock is sufficient.

## Done criteria

- [x] Only root `package-lock.json` is tracked.
- [x] Nested lockfiles are ignored or otherwise documented as not allowed.
- [x] Root `npm ci --ignore-scripts` succeeds.
- [x] Root typecheck and tests pass.
- [x] `git diff --check` exits 0.
- [x] `plans/README.md` status row updated.

## STOP conditions

Stop and report back if:

- CI or documented release flow intentionally runs `npm ci` from a workspace
  package directory.
- Removing nested locks causes root `npm ci --ignore-scripts` to fail.
- The operator wants independently publishable package locks for package-level
  release workflows.

## Maintenance notes

After this lands, dependency audits should be run from the repo root. If a
future package becomes independently published and needs its own lockfile, add
that policy explicitly before reintroducing a nested lock.
