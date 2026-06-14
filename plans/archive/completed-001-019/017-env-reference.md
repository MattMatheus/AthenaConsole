# Plan 017: Generate/complete the `.env` reference

> **Executor instructions**: Follow this plan step by step. Run every verification
> command and confirm the expected result before moving on. If anything in "STOP
> conditions" occurs, stop and report — do not improvise. When done, update the
> status row for this plan in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 182e9ba..HEAD -- packages/core/src/shared/config.ts server.env.example`

## Why this matters

`packages/core/src/shared/config.ts` reads ~110 distinct `ATHENA_*` environment
variables (auth/authz, providers, durable memory, runtime isolation, sandbox,
context/history, events, telemetry, …), but `server.env.example` documents only ~16
and is narrowly server-deployment focused. An operator configuring security-relevant
behavior (`ATHENA_AUTH_ENABLED`, `ATHENA_AUTHZ_MODE`, `ATHENA_ALLOW_EXTERNAL_UNAUTHENTICATED`,
`ATHENA_ALLOWED_ORIGINS`, provider keys, runtime isolation) has no single reference
and must read `config.ts` to discover them. This plan produces a complete, annotated
environment reference and a check that keeps it from drifting.

## Status

- **Priority**: P3
- **Effort**: M
- **Risk**: LOW (documentation + an optional check script; no runtime behavior change)
- **Depends on**: none
- **Category**: dx (onboarding)
- **Planned at**: commit `182e9ba`, 2026-06-13

## Current state

- `config.ts` reads env vars via patterns like `env.ATHENA_X`, `process.env.ATHENA_X`.
  Enumerate the full set:
  ```
  grep -rhoE "ATHENA_[A-Z0-9_]+" packages/core/src/shared/config.ts | sort -u
  ```
- `server.env.example` documents a small subset (auth token, console password,
  server paths, sandbox host path — ~16 keys).

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Enumerate config vars | `grep -rhoE "ATHENA_[A-Z0-9_]+" packages/core/src/shared/config.ts \| sort -u` | the full var list |
| Doc-link check | `npm run check:docs` | exit 0 |

## Scope

**In scope**:
- A new, comprehensive annotated example file: `server.env.example` (expand it) **or** a new `docs/developer/product-dev-guides/environment-reference.md` linked from the docs map. Prefer expanding `server.env.example` if the existing format is `KEY=value` comments; otherwise create the docs reference and link it.
- Optionally: `scripts/check-env-reference.mjs` (a check that every `ATHENA_*` read in `config.ts` is documented) wired as an npm script.
- If you add a docs page, the relevant `docs/README.md` / docs index link.

**Out of scope** (do NOT touch):
- `config.ts` parsing logic.
- Secret VALUES — document variable NAMES, purpose, whether required, and safe
  defaults only. Never put a real secret in the example.

## Git workflow

- Branch: `advisor/017-env-reference`
- One or two commits; short imperative messages.
- Do NOT push or open a PR unless instructed.

## Steps

### Step 1: Enumerate and group the variables

Run the enumerate command above. Group the variables by concern (Auth & Authz,
Networking/CORS & bind, Model Providers, Durable Memory, Runtime Isolation/Sandbox,
Context/History, Events, Telemetry, Server Paths, Dev). For each variable, read its
use in `config.ts` to capture: purpose (one line), required vs optional, default,
and any validation/allowed values.

### Step 2: Author the reference

Write the grouped, annotated reference (in `server.env.example` or the new docs
page). Each entry: name, one-line purpose, required/optional, default, allowed
values where constrained. Lead with a short "Security-relevant settings" callout
covering `ATHENA_AUTH_ENABLED`, `ATHENA_AUTH_API_TOKEN` (name only — never a value),
`ATHENA_AUTHZ_MODE`, `ATHENA_ALLOW_EXTERNAL_UNAUTHENTICATED`, `ATHENA_ALLOWED_ORIGINS`,
and the trusted-proxy flag `ATHENA_AUTH_TRUSTED_PROXY_CONFIGURED` (cross-link to
`docs/developer/product-dev-guides/trusted-proxy-auth.md`).

### Step 3 (optional but recommended): Add a drift check

Add `scripts/check-env-reference.mjs` that collects `ATHENA_*` names read in
`config.ts` and fails if any is absent from the reference file. Wire it as a root
script (e.g. `"check:env": "node scripts/check-env-reference.mjs"`). This keeps the
doc honest as new vars are added.

**Verify**: if added, `node scripts/check-env-reference.mjs` exits 0 after Step 2.

### Step 4: Verify links

**Verify**: `npm run check:docs` → exit 0 (any new doc links resolve).

## Test plan

- Verification is the drift check (Step 3) passing and `check:docs` passing.
- Manually confirm a spot sample (auth/authz/provider vars) is documented with
  purpose + default.

## Done criteria

ALL must hold:

- [ ] Every `ATHENA_*` variable read in `config.ts` is documented in the reference (verified by the Step 3 check, or by manual diff of the enumerate command output against the file)
- [ ] Security-relevant settings are called out with a cross-link to the trusted-proxy guide
- [ ] No secret values appear anywhere in the file
- [ ] `npm run check:docs` exits 0
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report if:

- A variable's purpose/default cannot be determined from `config.ts` — list the
  ambiguous ones rather than guessing.
- The existing `server.env.example` format conflicts with a complete reference
  (then create the docs page instead and link it).

## Maintenance notes

- The Step 3 check (if added) should run in CI alongside `check:docs` so the
  reference cannot silently drift; consider adding it to the workflow in a follow-up.
- Reviewer should confirm no secret values were introduced and that required-vs-
  optional is accurate for the security settings.
