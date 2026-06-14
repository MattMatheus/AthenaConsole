# Plan 005: Align vitest to v4 across all workspaces

> **Executor instructions**: Follow this plan step by step. Run every verification
> command and confirm the expected result before moving on. If anything in "STOP
> conditions" occurs, stop and report — do not improvise. When done, update the
> status row for this plan in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 182e9ba..HEAD -- packages/core/package.json apps/console/package.json apps/api/package.json`

## Why this matters

The repo runs three vitest versions inconsistently:
- `packages/core` → `vitest ^4.1.7` (+ `@vitest/coverage-v8 ^4.1.7`)
- `apps/console` → `vitest ^3.2.4` — **below the advisory fix line** (`npm audit` flags `vitest <3.2.6`, GHSA-5xrq-8626-4rwp) and a different major than core
- `apps/api` → runs `vitest run` in its `test` script but declares **no** vitest devDependency (relies on a hoisted version)

Two coexisting majors increase install size and config drift, the console carries a
dev-only critical advisory, and api's test runner is implicit. Standardizing on
vitest 4 across the workspaces clears the advisory and removes the ambiguity.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: MED (vitest 3 → 4 has config/API changes; the console suite must be re-validated)
- **Depends on**: none
- **Category**: dependencies
- **Planned at**: commit `182e9ba`, 2026-06-13

## Current state

- `packages/core/package.json`: `"vitest": "^4.1.7"`, `"@vitest/coverage-v8": "^4.1.7"`. Config: `packages/core/vitest.config.ts`.
- `apps/console/package.json`: `"vitest": "^3.2.4"`. No separate vitest config — vitest reads `apps/console/vite.config.ts`.
- `apps/api/package.json`: `"test": "vitest run"` but no `vitest` in devDependencies.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Install | `npm install` (repo root) | exit 0 |
| Console tests | `npm --workspace @athena/console run test` | all pass |
| Console typecheck | `npm --workspace @athena/console run typecheck` | exit 0 |
| Core tests | `npm --workspace @athena/core run test:unit` | all pass |
| API tests | `npm --workspace @athena/api run test` | passes (or no-op if no test files) |
| Audit check | `npm audit` | vitest `<3.2.6` advisory gone |

## Scope

**In scope**:
- `apps/console/package.json` (bump vitest to `^4`)
- `apps/api/package.json` (add explicit `vitest ^4` devDependency)
- `apps/console/vite.config.ts` and/or any console test setup files — ONLY if a v4 config/API change requires it
- `package-lock.json` (regenerated)

**Out of scope** (do NOT touch):
- `packages/core` vitest version (already on 4).
- Application/source code — this is a test-runner upgrade. If a test's behavior must change for v4, that is allowed; production source changes are a STOP condition.

## Git workflow

- Branch: `advisor/005-align-vitest-v4`
- One commit; message e.g. `chore(deps): align vitest on v4 across workspaces`.
- Do NOT push or open a PR unless instructed.

## Steps

### Step 1: Bump console and add api's explicit dep

- In `apps/console/package.json`, change `"vitest": "^3.2.4"` → `"vitest": "^4.1.7"`.
- In `apps/api/package.json`, add `"vitest": "^4.1.7"` to `devDependencies`.

Then from the repo root: `npm install`.

**Verify**: `npm install` exits 0; `node -e "console.log(require('vitest/package.json').version)"` from `apps/console` prints `4.x`.

### Step 2: Run the console suite and fix v4 breakages

```
npm --workspace @athena/console run test
```

Known vitest 3 → 4 changes to watch for (apply minimal config-level fixes only):
- Coverage provider / reporter option renames (console may not use coverage — ignore if so).
- `environment`/`globals` config keys live under `test:` in `vite.config.ts`; confirm they still parse.
- Deprecated matchers or `vi` API removals surfacing as test errors.

If a failure is a genuine v4 API change, fix it at the config/test level. If a failure indicates a real product bug surfaced by stricter v4 behavior, STOP and report — do not change source to make a test pass.

**Verify**: `npm --workspace @athena/console run test` → all pass.

### Step 3: Re-validate core and api

```
npm --workspace @athena/core run test:unit
npm --workspace @athena/api run test
```

**Verify**: core all pass; api passes (or reports no test files, which is acceptable — note which in your report).

### Step 4: Confirm the advisory cleared

```
npm audit
```

**Verify**: the `vitest <3.2.6` advisory no longer appears. (Other unrelated advisories may remain — out of scope here.)

## Test plan

- No new tests. Existing suites are the verification.
- If any console test needed a v4-specific edit, list each in your report with the reason.

## Done criteria

ALL must hold:

- [ ] `apps/console` and `apps/api` declare `vitest ^4`
- [ ] `npm --workspace @athena/console run test` exits 0
- [ ] `npm --workspace @athena/core run test:unit` exits 0
- [ ] `npm --workspace @athena/api run test` exits 0 (or cleanly reports no tests)
- [ ] `npm audit` no longer reports the `vitest <3.2.6` advisory
- [ ] No production source files modified (`git status`; only package manifests, lockfile, and possibly console test config)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report if:

- The console suite has widespread failures that are not mechanical config fixes (report the count and a representative failure).
- A failure reveals a real product bug rather than a test-runner change.
- A v4 change would require editing production source.

## Maintenance notes

- Keep all workspaces on the same vitest major going forward; a single root devDependency could be considered later, but per-workspace explicit deps are fine.
- Reviewer should confirm `apps/api`'s `test` script now resolves its own declared vitest, not a hoisted one.
