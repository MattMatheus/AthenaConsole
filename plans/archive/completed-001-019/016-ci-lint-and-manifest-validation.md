# Plan 016: Add lint + manifest validation to CI

> **Executor instructions**: Follow this plan step by step. Run every verification
> command and confirm the expected result before moving on. If anything in "STOP
> conditions" occurs, stop and report — do not improvise. When done, update the
> status row for this plan in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 182e9ba..HEAD -- .github/workflows/local-server-validation.yml`

## Why this matters

CI runs typecheck, schema check, doc-link check, and tests — but **never runs lint
or manifest validation**. The console has a real ESLint config and a `lint` script,
yet CI never invokes it, so lint regressions land on `main` undetected; the one
quality gate that exists is effectively dead in CI. Likewise, `validate:manifests`
(listed as a validation default in `AGENTS.md`) is not enforced, so a broken
plugin/agent manifest example can merge. Adding these two steps closes the gap.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW (may surface an existing lint/manifest backlog on first run — see STOP conditions)
- **Depends on**: plans/015-eslint-core-api-pdk.md (soft — without 015, the lint step only meaningfully lints the console; that is still a net improvement)
- **Category**: dx
- **Planned at**: commit `182e9ba`, 2026-06-13

## Current state

`.github/workflows/local-server-validation.yml` — current steps (no lint, no manifest validation):

```yaml
- name: Typecheck core
  run: npm --workspace @athena/core run typecheck
- name: Check generated schemas
  run: npm --workspace @athena/core run check:schemas
- name: Check documentation links
  run: npm run check:docs
- name: Test core
  run: npm --workspace @athena/core run test:unit
- name: Test PDK
  run: npm --workspace @athena/pdk test
- name: Typecheck console
  run: npm --workspace @athena/console run typecheck
- name: Test console
  run: npm --workspace @athena/console run test
- name: Validate compose files
  run: ...
- name: Validate smoke command wiring
  run: npm run smoke:product -- --help
```

- `npm run lint` is the root turbo lint task — it runs each workspace's `lint`
  script (console = eslint; core = eslint after plan 015, else `tsc`; api/pdk run
  eslint after plan 015 or are skipped if they have no `lint` script).
- `npm --workspace @athena/core run validate:manifests` exists and validates manifest examples.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Lint (all) | `npm run lint` | exit 0 |
| Manifest validation | `npm --workspace @athena/core run validate:manifests` | exit 0 |

(Run both locally first to confirm they pass on the current tree before adding to CI.)

## Scope

**In scope**:
- `.github/workflows/local-server-validation.yml` (add two steps)

**Out of scope** (do NOT touch):
- ESLint configs or source — if lint fails, that is fixed by plan 015 or a separate cleanup, not here.
- Other CI jobs/steps.

## Git workflow

- Branch: `advisor/016-ci-lint-and-manifest-validation`
- One commit; message e.g. `ci: run lint and manifest validation`.
- Do NOT push or open a PR unless instructed.

## Steps

### Step 1: Confirm the commands pass locally

```
npm run lint
npm --workspace @athena/core run validate:manifests
```

If either fails on the current tree, STOP and report — CI should not be set to a
red baseline. (Plan 015 should land first to make `npm run lint` green for the
backend; `validate:manifests` is expected to already pass.)

### Step 2: Add the CI steps

In `.github/workflows/local-server-validation.yml`, add two steps in the `validate`
job. Place the lint step near the typecheck steps and the manifest step near the
test steps:

```yaml
      - name: Lint
        run: npm run lint

      - name: Validate manifest examples
        run: npm --workspace @athena/core run validate:manifests
```

Keep the existing steps unchanged.

**Verify**: the YAML is valid — `npm run check:docs` is unaffected; if a YAML linter
is available run it, otherwise confirm indentation matches the surrounding steps
exactly (2-space, under `steps:`).

## Test plan

- No application tests. The verification is that both commands pass locally and the
  workflow YAML is well-formed.
- (If you can push to a branch and the operator permits, the real proof is a green
  CI run — but do NOT push unless instructed.)

## Done criteria

ALL must hold:

- [ ] `.github/workflows/local-server-validation.yml` contains a `Lint` step running `npm run lint`
- [ ] It contains a `Validate manifest examples` step running `npm --workspace @athena/core run validate:manifests`
- [ ] `npm run lint` and `npm --workspace @athena/core run validate:manifests` pass locally
- [ ] YAML indentation matches the existing steps (no parse errors)
- [ ] No files outside the workflow are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report if:

- `npm run lint` fails on the current tree (land plan 015 / a lint cleanup first).
- `npm --workspace @athena/core run validate:manifests` fails (fix the manifest examples first, separately).

## Maintenance notes

- Once plan 015 lands, confirm the CI `Lint` step actually exercises core/api/pdk
  ESLint (not just the console).
- Reviewer should confirm the new steps run on both `pull_request` and `push` (they
  inherit the job triggers, so no extra config needed).
