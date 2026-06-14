# Plan 015: Add ESLint to core/api/pdk

> **Executor instructions**: Follow this plan step by step. Run every verification
> command and confirm the expected result before moving on. If anything in "STOP
> conditions" occurs, stop and report — do not improvise. When done, update the
> status row for this plan in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 182e9ba..HEAD -- packages/core/package.json apps/api/package.json packages/pdk/package.json`

## Why this matters

Only the console has a real linter. `packages/core` (the largest workspace) aliases
its `lint` script to `tsc --noEmit` — that is type-checking, not linting, so it
catches none of the things a linter would (unused code, shadowing, floating
promises, etc.). `apps/api` and `packages/pdk` have no `lint` script at all. Adding
ESLint to these workspaces gives the backend the same baseline quality gate the
console already has, and makes the CI lint step (plan 016) meaningful for core.

## Status

- **Priority**: P3
- **Effort**: M
- **Risk**: MED (turning on rules across untouched code can surface a backlog — handled below by starting non-type-aware and downgrading noisy rules to warnings)
- **Depends on**: none
- **Category**: dx
- **Planned at**: commit `182e9ba`, 2026-06-13

## Current state

- `packages/core/package.json`: `"lint": "tsc -p tsconfig.json --noEmit"` (an alias of `typecheck`; no ESLint config in the package).
- `apps/api/package.json`, `packages/pdk/package.json`: no `lint` script.
- The console already uses ESLint flat config — `apps/console/eslint.config.js` (the pattern to mirror, minus the React-specific bits):
  ```js
  import js from "@eslint/js";
  import globals from "globals";
  import tseslint from "typescript-eslint";
  export default tseslint.config(
    { ignores: ["dist"] },
    { extends: [js.configs.recommended, ...tseslint.configs.recommended], files: ["**/*.{ts,tsx}"], languageOptions: { ... } }
  );
  ```
- ESLint deps available in the repo (console devDeps): `eslint@^9`, `@eslint/js@^9`, `globals`, `typescript-eslint@^8`.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Install | `npm install` (repo root) | exit 0 |
| Lint core | `npm --workspace @athena/core run lint` | exit 0 |
| Lint api | `npm --workspace @athena/api run lint` | exit 0 |
| Lint pdk | `npm --workspace @athena/pdk run lint` | exit 0 |
| Typecheck (all) | `npm run typecheck` | exit 0 |
| Tests (core) | `npm --workspace @athena/core run test:unit` | all pass |

## Scope

**In scope**:
- `packages/core/eslint.config.js`, `apps/api/eslint.config.js`, `packages/pdk/eslint.config.js` (new flat configs, Node env, non-type-aware to start)
- `packages/core/package.json`, `apps/api/package.json`, `packages/pdk/package.json` (set `"lint": "eslint ."`; add ESLint devDeps where missing)
- `package-lock.json`

**Out of scope** (do NOT touch):
- `apps/console` ESLint config — it already exists; leave it.
- Source-code logic. You may apply trivial autofixes (`eslint --fix`) for purely
  mechanical rules, but any change that alters behavior is a STOP condition.
- Enabling type-aware rules (`parserOptions.project`, `no-floating-promises`) — defer
  to a follow-up; this plan establishes the baseline only.

## Git workflow

- Branch: `advisor/015-eslint-core-api-pdk`
- Commit per workspace or one commit; short imperative messages.
- Do NOT push or open a PR unless instructed.

## Steps

### Step 1: Add a Node-env flat config to each backend workspace

Create `packages/core/eslint.config.js` (and the same shape for `apps/api` and
`packages/pdk`, adjusting nothing else):

```js
import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist", "**/*.d.ts"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.ts"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: globals.node,
    },
  }
);
```

### Step 2: Add scripts and devDependencies

In each of `packages/core`, `apps/api`, `packages/pdk` `package.json`:
- Set `"lint": "eslint ."` (replacing core's `tsc` alias).
- Ensure `devDependencies` include `eslint`, `@eslint/js`, `globals`, `typescript-eslint`
  at the same majors the console uses (`eslint ^9`, `@eslint/js ^9`, `typescript-eslint ^8`, `globals ^16`). If they resolve via the workspace root/hoisting you may still add them explicitly for clarity.

Run `npm install`.

**Verify**: `npm install` exits 0.

### Step 3: Run lint and triage the backlog

Run each workspace's lint:

```
npm --workspace @athena/core run lint
npm --workspace @athena/api run lint
npm --workspace @athena/pdk run lint
```

- Apply `eslint --fix` for mechanical issues only.
- For genuine rule violations that are **errors** and would be a large/behavioral
  cleanup, downgrade those specific rules to `"warn"` in the config (so `eslint .`
  exits 0) and record a TODO list of the warned rules in your report for a later
  cleanup pass. Do NOT mass-edit source to satisfy rules in this plan.
- Document the count of errors found per workspace and which rules you downgraded.

**Verify**: each `lint` command exits 0 (warnings allowed); `npm run typecheck` still exits 0; `npm --workspace @athena/core run test:unit` still passes.

## Test plan

- No new tests. Lint passing (exit 0) on all three workspaces is the verification.
- Report the lint findings summary (errors fixed, rules downgraded to warn).

## Done criteria

ALL must hold:

- [ ] `packages/core`, `apps/api`, `packages/pdk` each have an `eslint.config.js` and a `"lint": "eslint ."` script
- [ ] `npm --workspace @athena/core run lint` exits 0 (warnings allowed)
- [ ] `npm --workspace @athena/api run lint` and `npm --workspace @athena/pdk run lint` exit 0
- [ ] `npm run typecheck` exits 0; `npm --workspace @athena/core run test:unit` passes
- [ ] No behavioral source changes (`git diff` shows only config/manifest changes + mechanical autofixes)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report if:

- An `eslint --fix` would change runtime behavior — leave it and report.
- The error backlog is so large that downgrading is impractical to summarize — report the totals and ask how to proceed.

## Maintenance notes

- Follow-up: enable type-aware linting (`parserOptions.project`) and promote the
  downgraded `warn` rules back to `error` after a cleanup pass — especially
  `@typescript-eslint/no-floating-promises`, valuable in this async-heavy backend.
- Plan 016 (CI) will run these lint scripts; this plan must land first for core lint to be meaningful.
- Reviewer should confirm no source behavior changed and that the warned-rule list has a tracking note.
