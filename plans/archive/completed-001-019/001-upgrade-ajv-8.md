# Plan 001: Upgrade ajv 6 -> 8 in manifest validation

> **Executor instructions**: Follow this plan step by step. Run every verification
> command and confirm the expected result before moving on. If anything in "STOP
> conditions" occurs, stop and report. When done, update the status row for this
> plan in `plans/README.md`.
>
> **Revision note**: This plan was revised after two dry runs showed the original
> scope was too narrow. Ajv 8 requires a named import under this repo's NodeNext
> TypeScript settings, and the manifest schemas trigger Ajv 8's union-type strict
> warning unless `allowUnionTypes` is enabled.
>
> **Drift check (run first)**:
>
> ```
> git diff --stat 182e9ba..HEAD -- packages/core/src/control-plane/manifests/validation.ts packages/core/package.json
> ```
>
> If either file changed in the relevant snippets below, compare the plan against
> the live code before proceeding. Adjust only if the live code makes the same
> migration smaller or clearer; otherwise stop and report.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: MED (Ajv 8 changes module typing and stricter schema diagnostics)
- **Depends on**: none
- **Category**: migration
- **Planned at**: commit `182e9ba`, 2026-06-13
- **Revised**: 2026-06-14

## Why this matters

`ajv@6` is an old major that no longer receives fixes. The codebase validates
plugin, agent, and workflow manifests through one small surface, so the migration
is still contained, but it must explicitly account for Ajv 8's module typing and
strict-type diagnostics.

## Current state

- `packages/core/package.json` declares `"ajv": "^6.14.0"` under `dependencies`.
- Ajv is imported and used in one source file:
  `packages/core/src/control-plane/manifests/validation.ts`.
  - Current import: `import Ajv, { type ErrorObject, type ValidateFunction } from "ajv";`
  - Current constructor: `const ajv = new Ajv({ allErrors: true });`
  - Current error path mapping: `path: error.dataPath || "$",`
- Dry-run evidence:
  - With Ajv 8, the default import fails typecheck under NodeNext:
    `TS2351: This expression is not constructable`.
  - `import { Ajv, type ErrorObject, type ValidateFunction } from "ajv";`
    typechecks in a NodeNext ESM sandbox with Ajv 8.
  - The agent manifest schema uses a JSON Schema union type:
    `"type": ["string", "number", "boolean"]`.
  - Ajv 8 compiles that schema but logs a strict warning unless constructed with
    `allowUnionTypes: true`.
  - No real JSON Schema `"format"` keyword is used in manifest schemas; existing
    `format` occurrences are property names under `properties`.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Install | `npm install` | exit 0 |
| Typecheck core | `npm --workspace @athena/core run typecheck` | exit 0, no errors |
| Manifest validation | `npm --workspace @athena/core run validate:manifests` | exit 0, no Ajv strict warnings |
| Unit tests | `npm --workspace @athena/core run test:unit` | all pass |

## Scope

**In scope**:
- `packages/core/package.json` (bump Ajv from `^6.14.0` to `^8.17.1`)
- `packages/core/src/control-plane/manifests/validation.ts`
  - change Ajv default import to named import
  - add `allowUnionTypes: true` to the Ajv constructor
  - rename `error.dataPath` to `error.instancePath`
- `package-lock.json` (updated by `npm install`)

**Out of scope**:
- Schema rewrites. The union-type schema is valid JSON Schema and should be
  handled with `allowUnionTypes`, not rewritten.
- Adding `ajv-formats`. Only add it in a new plan if a real JSON Schema
  `"format"` keyword appears.
- TypeScript module configuration changes.
- Other dependency upgrades.

## Git workflow

- Branch: `advisor/001-upgrade-ajv-8`
- One commit is fine; short imperative message, e.g.
  `chore(core): upgrade ajv 6 to 8`.
- Do NOT push or open a PR unless instructed.

## Steps

### Step 1: Confirm schema format usage

Run:

```
grep -rn '"format"' packages/core/schemas/team-orchestrator/manifests/v1/
```

Expected: only property names under schema `properties` or `required` arrays, not
JSON Schema string format assertions such as `"format": "uri"` or
`"format": "date-time"`.

If a real JSON Schema format assertion exists, STOP and report. That requires
`ajv-formats`, which is outside this revised plan.

### Step 2: Bump Ajv

In `packages/core/package.json`, change:

```
"ajv": "^6.14.0"   ->   "ajv": "^8.17.1"
```

Run:

```
npm install
```

Verify from `packages/core`:

```
node -e "console.log(require('ajv/package.json').version)"
```

Expected: an `8.x` version.

### Step 3: Update the Ajv import

In `packages/core/src/control-plane/manifests/validation.ts`, change:

```ts
import Ajv, { type ErrorObject, type ValidateFunction } from "ajv";
```

to:

```ts
import { Ajv, type ErrorObject, type ValidateFunction } from "ajv";
```

Do not change TypeScript config or use `createRequire`; the named import is the
smallest ESM-compatible Ajv 8 fix.

### Step 4: Preserve current schema behavior

Change the Ajv constructor from:

```ts
const ajv = new Ajv({ allErrors: true });
```

to:

```ts
const ajv = new Ajv({ allErrors: true, allowUnionTypes: true });
```

This keeps strict mode enabled while allowing the existing JSON Schema union type
used by manifest enum values.

### Step 5: Rename the Ajv error path field

In `mapAjvErrors`, change:

```ts
path: error.dataPath || "$",
```

to:

```ts
path: error.instancePath || "$",
```

Ajv 8 exposes `instancePath`; `dataPath` must not remain in source.

### Step 6: Verify typecheck and manifest validation

Run:

```
npm --workspace @athena/core run typecheck
npm --workspace @athena/core run validate:manifests
```

Expected:
- typecheck exits 0
- manifest validation exits 0
- manifest validation does not print Ajv strict-mode warnings

If manifest validation fails for a non-format schema reason, STOP and report the
exact output.

### Step 7: Run unit tests

Run:

```
npm --workspace @athena/core run test:unit
```

Expected: all tests pass.

Existing manifest-validation tests should keep the same user-facing error path
shape. If a test asserts an Ajv 6-specific path value, update the assertion only
to match the Ajv 8 `instancePath` equivalent and mention it in the close reason.

## Done criteria

ALL must hold:

- [ ] `packages/core/package.json` declares Ajv `^8.x`
- [ ] `package-lock.json` resolves Ajv 8 for `packages/core`
- [ ] `packages/core/src/control-plane/manifests/validation.ts` uses named
  `Ajv` import from `"ajv"`
- [ ] Ajv is constructed with `allErrors: true` and `allowUnionTypes: true`
- [ ] `grep -rn "dataPath" packages/core/src/` returns no matches
- [ ] `npm --workspace @athena/core run typecheck` exits 0
- [ ] `npm --workspace @athena/core run validate:manifests` exits 0 without Ajv
  strict warnings
- [ ] `npm --workspace @athena/core run test:unit` exits 0
- [ ] No files outside the in-scope list are modified by this plan
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report if:

- A real JSON Schema `"format"` assertion exists in the manifest schemas.
- Ajv 8 requires schema rewrites instead of `allowUnionTypes: true`.
- Typecheck still fails after the named import, `allowUnionTypes`, and
  `instancePath` changes.
- Manifest validation fails for any reason other than the known union-type strict
  warning, or still prints strict warnings after `allowUnionTypes: true`.
- More Ajv 6-only APIs surface outside `validation.ts`.

## Maintenance notes

- Keep using the default Ajv draft-07 validator unless the schemas declare a
  newer `$schema`.
- If `ajv-formats` is ever needed, register it once next to `new Ajv(...)`.
- Reviewer should confirm the validation issue `path` strings remain compatible
  for callers.
