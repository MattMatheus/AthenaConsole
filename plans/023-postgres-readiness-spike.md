# Plan 023: Postgres-readiness spike — repository contract tests against SQLite

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **This is a spike plan with real code: it adds TESTS only.** You will write a
> backend-agnostic "contract test" suite that exercises the existing app-state
> repositories through their public methods. You will NOT add a Postgres
> implementation, change any repository, change any schema, or touch services.
>
> **Drift check (run first)**:
> `git diff --stat 635289b..HEAD -- packages/core/src/control-plane/app-state docs/product/architecture/postgres-migration-design.md`
> If any of those changed since this plan was written, compare the "Current
> state" excerpts against live code before proceeding; on a mismatch, STOP.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW (adds tests only; no production code changes)
- **Depends on**: ADR 0027 accepted (soft — contract tests are valuable before
  any Postgres implementation)
- **Category**: direction / tests
- **Planned at**: commit `635289b`, 2026-06-13

## Why this matters

`docs/product/architecture/postgres-migration-design.md` lays out a plan to move
app-state off single-file SQLite so the control plane can run multi-node — which
the codebase already gestures at with Kubernetes-lease distributed locking
(`distributed-lock/k8s-lease.ts`) and a `worker_heartbeats` table. Single-file
SQLite cannot safely back multiple API/worker nodes, so if the enterprise
direction (ADR 0027) holds, a different backend is eventually required.

The migration design's own first two steps are:

> 1. Freeze domain repository interfaces and remove direct SQLite assumptions from services.
> 2. Add contract tests for each repository against SQLite.

This plan does step 2 (and surfaces the blockers for step 1) **without** building
Postgres. A contract-test suite — one that exercises each repository purely
through its public method surface, with no SQLite-specific assumptions — is the
de-risking artifact: it pins the behavioral contract a future Postgres
implementation must satisfy, and it is immediately useful as regression coverage
even if Postgres never ships. It also concretely reveals which repositories are
clean (testable through their interface) and which leak SQLite details, turning
step 1 from a guess into a checklist.

## Current state

- The repository surface is the `AppStateDatabase` interface,
  `packages/core/src/control-plane/app-state/database.ts:40-67`. It exposes ~25
  repositories (e.g. `tasks`, `runs`, `missions`, `schedules`, `usageLedger`,
  `workspaces`, `modelProviderConfigs`, `connectedRepositories`, `evals`,
  `workerHeartbeats`, `artifacts`, `runEvents`). Each is a class with public
  methods (e.g. `usageLedger.upsert(...)`, `usageLedger.list(...)`,
  `usageLedger.getByRunId(...)`).

- A test opens app-state against a temp dir. The existing pattern to copy is
  `packages/core/tests/control-plane.usage-ledger.test.ts:1-45`:
  ```ts
  import { mkdtempSync, rmSync } from "node:fs";
  import { tmpdir } from "node:os";
  import { join } from "node:path";
  import { describe, expect, it } from "vitest";
  import { openAppStateDatabase } from "../src/control-plane/app-state/index.js";
  import { loadConfig } from "../src/shared/config.js";

  describe("UsageLedgerRepository", () => {
    it("...", () => {
      const dir = mkdtempSync(join(tmpdir(), "athena-usage-ledger-"));
      try {
        const appState = openAppStateDatabase(loadConfig(dir));
        try {
          // ... exercise repository methods, assert ...
        } finally {
          appState.close();
        }
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });
  });
  ```
  (`openAppStateDatabase` runs migrations by default — `database.ts:73-88`.)

- Core tests live in `packages/core/tests/*.test.ts` and run with vitest:
  `npm --workspace @athena/core run test:unit` (`packages/core/package.json:27`,
  `"test:unit": "vitest run"`). Typecheck is
  `npm --workspace @athena/core run typecheck` (`tsc -p tsconfig.json --noEmit`).

- Existing repository tests to model structure on:
  `control-plane.usage-ledger.test.ts`, `control-plane.app-state.test.ts`,
  `control-plane.workspace-repositories.test.ts` (all in `packages/core/tests/`).

- The migration design's "Blocking SQLite Assumptions"
  (`docs/product/architecture/postgres-migration-design.md:24-30`): some services
  open app-state directly; offset-oriented pagination; opaque JSON columns; local
  filesystem artifact paths. Confirmed example of "services open app-state
  directly": `packages/core/src/control-plane/services/model-providers.ts:158`
  and `local-services.ts:1145` both call `openAppStateDatabase(...)` directly
  rather than receiving repositories.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Drift check | `git diff --stat 635289b..HEAD -- packages/core/src/control-plane/app-state` | empty or understood |
| Typecheck core | `npm --workspace @athena/core run typecheck` | exit 0, no errors |
| Run the new test file | `npm --workspace @athena/core run test:unit -- app-state-contract` | the new tests pass |
| Run full core unit suite | `npm --workspace @athena/core run test:unit` | all pass (no regressions) |
| Doc-link check | `npm run check:docs` | exit 0 |

## Scope

**In scope** (the only files you create or modify):

- `packages/core/tests/control-plane.app-state-contract.test.ts` (create) — the
  contract-test suite.
- `docs/product/architecture/postgres-migration-design.md` (append ONE section,
  "## Contract Test Coverage And Step-1 Findings", recording which repositories
  are interface-clean vs. which leak SQLite specifics).
- `plans/README.md` (status row)

**Out of scope** (do NOT touch):

- Any file under `packages/core/src/` — no production code changes. Do NOT add a
  Postgres implementation, do NOT extract repository interfaces, do NOT refactor
  services. This spike only *characterizes* behavior; the interface freeze and
  Postgres impl are follow-up implementation work.
- The repository classes themselves — if a repository cannot be tested through
  its public surface without reaching into SQLite, that is a *finding to record*
  in the doc, not a thing to fix here.

## Git workflow

- Branch: `advisor/023-postgres-readiness-spike`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Write the contract-test suite

Create `packages/core/tests/control-plane.app-state-contract.test.ts`, modeled
structurally on `control-plane.usage-ledger.test.ts` (temp dir +
`openAppStateDatabase(loadConfig(dir))` + `try/finally` cleanup).

Cover at least these repositories through their **public methods only** (no raw
`appState.db` SQL, no SQLite pragmas — the whole point is backend-agnostic
behavior):

1. `tasks` — create, get, list (and list bounding/limit if the method supports it).
2. `runs` — create, get/list, and a status transition if the API exposes one.
3. `missions` — create, get, list.
4. `schedules` — create/upsert, get, list.
5. `usageLedger` — upsert (including the upsert-idempotency on the same `runId`,
   which the existing test already demonstrates), `getByRunId`, `list` with a
   `windowStart`/`windowEnd` filter.
6. `workspaces` — `get('default')` returns the seeded default; `list()` includes it.

For each repository, assert the **observable contract** a Postgres impl would
also have to satisfy: created records are retrievable; lists return inserted
records; the `usageLedger` `unique(run_id)` upsert replaces rather than
duplicates; window filters include/exclude by `recordedAt`. Keep assertions on
return values, not on database internals.

Write a short file-level comment at the top stating the suite's purpose: "Backend
-agnostic contract for app-state repositories — any future backend (e.g.
Postgres, per postgres-migration-design.md) must satisfy these behaviors through
the same public methods."

**Verify**: `npm --workspace @athena/core run test:unit -- app-state-contract`
→ the new tests pass.

### Step 2: Record step-1 findings in the design doc

While writing the tests you will discover which repositories are cleanly testable
through their interface and which require SQLite-specific setup or expose
SQLite-shaped return values. Append a section to
`docs/product/architecture/postgres-migration-design.md`:

`## Contract Test Coverage And Step-1 Findings`

- A table: repository | covered by contract test (yes/no) | interface-clean
  (yes/no) | note (what would block a Postgres impl, if anything).
- A short list of the concrete "services open app-state directly" call sites you
  can confirm by grep (start from `model-providers.ts:158`,
  `local-services.ts:1145`), since step 1 of the migration requires removing
  those direct opens.

Do NOT change any source to fix findings — only record them.

**Verify**: `npm run check:docs` → exit 0 (the doc edit adds no broken links).

### Step 3: Confirm no regressions

**Verify**:
- `npm --workspace @athena/core run typecheck` → exit 0.
- `npm --workspace @athena/core run test:unit` → all pass (the new file plus the
  existing suite; baseline at plan time was 82 files / 391 tests passing per the
  2026.1 release doc — expect that plus your new tests).

## Test plan

- New file `packages/core/tests/control-plane.app-state-contract.test.ts` with
  one `describe` per repository listed in Step 1, each asserting create→retrieve,
  list-includes, and the named edge cases (usage-ledger upsert idempotency,
  usage-ledger window filtering, seeded default workspace).
- Structural pattern: model after
  `packages/core/tests/control-plane.usage-ledger.test.ts`.
- Verification: `npm --workspace @athena/core run test:unit` → all pass including
  the new tests.

## Done criteria

ALL must hold:

- [ ] `packages/core/tests/control-plane.app-state-contract.test.ts` exists and exercises ≥ 6 repositories through public methods only (no `appState.db` raw SQL in the test).
- [ ] `npm --workspace @athena/core run test:unit -- app-state-contract` passes.
- [ ] `npm --workspace @athena/core run test:unit` passes with no regressions.
- [ ] `npm --workspace @athena/core run typecheck` exits 0.
- [ ] `postgres-migration-design.md` has a new `## Contract Test Coverage And Step-1 Findings` section with the per-repository table.
- [ ] `git diff --name-only` shows ONLY the in-scope files (one test file, one doc, `plans/README.md`) — no `packages/core/src/` changes.
- [ ] `npm run check:docs` exits 0.
- [ ] `plans/README.md` status row updated.

## STOP conditions

Stop and report back if:

- The drift check shows a Postgres backend, a repository-interface extraction, or
  `postgres-migration-design.md` changes already happened since `635289b`.
- A repository genuinely cannot be exercised through its public methods without
  reaching into `appState.db` raw SQL — record it as a finding and SKIP that
  repository in the suite; do NOT modify the repository to make it testable.
- `npm --workspace @athena/core run test:unit` was already failing before your
  changes (report the pre-existing failure; do not try to fix unrelated tests).
- You feel you must change a repository, service, or schema to make a test pass —
  that means the test is asserting an implementation detail; rewrite the
  assertion to be backend-agnostic, or record the limitation and move on.

## Maintenance notes

- These are **characterization/contract tests**: they pin current behavior so a
  future Postgres backend (or any repository refactor) has a safety net. If a
  repository's behavior is intentionally changed later, update the contract test
  deliberately — a failing contract test on a refactor is the signal it exists to
  give.
- The natural follow-up (a separate plan/epic, gated on ADR 0027) is
  migration-design step 1: remove the direct `openAppStateDatabase` calls from
  services so they receive repositories, then introduce a Postgres implementation
  behind the same interfaces and run this same contract suite against it.
- A reviewer should confirm the tests assert observable return values, not
  SQLite internals — any test that reads `appState.db` directly defeats the
  purpose.
