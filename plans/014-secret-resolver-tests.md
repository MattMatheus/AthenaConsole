# Plan 014: Add a dedicated `secret-resolver` test suite

> **Executor instructions**: Follow this plan step by step. Run every verification
> command and confirm the expected result before moving on. If anything in "STOP
> conditions" occurs, stop and report — do not improvise. When done, update the
> status row for this plan in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 182e9ba..HEAD -- packages/core/src/control-plane/services/secret-resolver.ts`

## Why this matters

`SecretResolver` is on the credential-resolution critical path (model providers,
connectors) and includes a hand-rolled `.env` parser (quote stripping, comment
skipping, `=`-in-value handling) plus local-file resolution rules — yet it has **no
dedicated test**; it is only exercised transitively. A regression in the parser
surfaces as a hard-to-diagnose "secret not configured" at runtime. The audit-emit
behavior (which must include only `kind`+`name`, never the value) is also untested.
This plan adds focused, fast unit tests with no production-code changes.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW (tests only)
- **Depends on**: none
- **Category**: tests
- **Planned at**: commit `182e9ba`, 2026-06-13

## Current state

`packages/core/src/control-plane/services/secret-resolver.ts` — public API
`resolve(secret, audit?)`; behavior to cover:

- `kind: "env"`: returns `process.env[name]`, else falls back to a `.env` value in
  `config.workspaceRoot`; throws `CONFIG_ERROR` if neither is set (`resolveValue`, lines 32-39).
- `kind: "local-file"`: requires an **absolute** path (else `CONFIG_ERROR`), the file
  must exist (else `CONFIG_ERROR`), and content is `.trim()`ed and must be non-empty
  (else `CONFIG_ERROR`) (lines 40-52).
- `.env` parser `readDotEnvValue` (lines 80-102): skips blank lines and lines
  starting with `#`; ignores lines where `=` is at index `<= 0`; matches the exact
  key; returns the value after the first `=`, trimmed, with surrounding single/double
  quotes stripped. (So a value containing `=` is preserved after the first `=`.)
- Audit (`emitSecretReadAudit`, lines 56-77): when an `eventService` and an `audit`
  context are provided, emits a `secret.read` event whose payload `reference`
  contains only `{ kind, name }` — **never the secret value** — plus `purpose`,
  `subject` (default `"system"`), and optional `resourceId`. Emission is best-effort
  (errors swallowed).

The `ModelProviderSecretReference` type comes from
`shared/contracts/model-providers.js`; `SecretResolver` takes an `AthenaConfig`
(only `workspaceRoot` matters here) and `{ eventService? }`.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Typecheck core | `npm --workspace @athena/core run typecheck` | exit 0 |
| Run new test | `npm --workspace @athena/core run test:unit -- secret-resolver` | all pass |
| All core tests | `npm --workspace @athena/core run test:unit` | all pass |

## Scope

**In scope**:
- `packages/core/tests/control-plane.secret-resolver.test.ts` (new test file)

**Out of scope** (do NOT touch):
- `secret-resolver.ts` — this plan only adds tests. If a test reveals a real bug,
  STOP and report it (do not change source under this plan).

## Git workflow

- Branch: `advisor/014-secret-resolver-tests`
- One commit; message e.g. `test(core): cover SecretResolver env/dot-env/local-file/audit paths`.
- Do NOT push or open a PR unless instructed.

## Steps

### Step 1: Set up the test file

Create `packages/core/tests/control-plane.secret-resolver.test.ts`. For
construction patterns (building an `AthenaConfig`, temp dirs, event-service stubs),
open an existing test that constructs `SecretResolver` or a config — e.g. search:

```
grep -rln "SecretResolver\|loadConfig\|workspaceRoot" packages/core/tests | head
```

Use Node's `fs`/`os` to create a temp workspace dir for `.env` and local-file cases
(`mkdtempSync(join(os.tmpdir(), "secret-resolver-"))`), and clean it up in
`afterEach`. Save/restore any `process.env` keys you mutate.

### Step 2: Write the cases

Cover at minimum:
- **env hit**: `process.env.FOO = "bar"`; `resolve({ kind: "env", name: "FOO" })` → `"bar"`.
- **env missing, dot-env fallback**: no `process.env.FOO`; a `.env` in the temp
  workspace with `FOO=bar` → `"bar"`.
- **dot-env quoting**: `.env` line `FOO="ba=r"` → value `ba=r` (quotes stripped,
  `=` after the first preserved); a commented line `# FOO=ignored` is skipped.
- **env not configured**: neither source set → throws `CONFIG_ERROR`.
- **local-file relative path** → throws `CONFIG_ERROR` ("absolute path").
- **local-file missing** → throws `CONFIG_ERROR` ("does not exist").
- **local-file empty (whitespace)** → throws `CONFIG_ERROR` ("empty").
- **local-file happy path**: absolute temp file with `  secret\n` → `"secret"` (trimmed).
- **audit emission**: pass an `eventService` stub capturing `emit` calls and an
  `audit` context; assert one `secret.read` event whose `payload.reference` is
  `{ kind, name }` and **does not contain the secret value anywhere** (assert the
  serialized payload does not include the resolved value string).

**Verify**: `npm --workspace @athena/core run test:unit -- secret-resolver` → all pass.

## Test plan

- One new file with the cases above (env, dot-env + quoting/comments, local-file
  variants, audit redaction). All should pass against the current implementation.
- Verification: `npm --workspace @athena/core run test:unit` → all pass.

## Done criteria

ALL must hold:

- [ ] `packages/core/tests/control-plane.secret-resolver.test.ts` exists with the cases above
- [ ] `npm --workspace @athena/core run test:unit -- secret-resolver` passes
- [ ] `npm --workspace @athena/core run test:unit` exits 0
- [ ] No production source files modified (`git status` shows only the new test)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report if:

- A case fails against the current implementation — that is a real bug; report it with the failing input rather than weakening the test or editing source.
- The `secret-resolver.ts` behavior no longer matches the excerpts (drift).

## Maintenance notes

- If a new secret `kind` is added, extend this suite.
- Reviewer should confirm the audit-redaction test would actually fail if the value
  were ever included in the event payload (assert on the serialized payload, not
  just the reference object).
