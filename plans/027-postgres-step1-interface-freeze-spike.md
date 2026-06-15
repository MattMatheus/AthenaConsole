# Plan 027: Postgres-readiness step-1 spike — inventory direct app-state opens and scope the interface-freeze epic (2026.46)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **This is a design + inventory spike.** The contract-test slice of
> Postgres-readiness (plan 023) is ALREADY DONE. This plan advances to the *next*
> gated step: migration-design step 1 (remove direct SQLite opens from services
> so they receive repositories). The deliverable is a code-grounded inventory
> appended to the migration design doc plus an implementation epic. You will NOT
> change any production code, add a Postgres backend, or refactor services. Only
> Markdown is created/modified. You MAY run read-only `grep`/`ls`.
>
> **Drift check (run first)**:
> `git diff --stat 0bd2fc8..HEAD -- docs/product/architecture/postgres-migration-design.md packages/core/src/control-plane/services packages/core/tests/control-plane.app-state-contract.test.ts`
> If any changed since this plan was written, compare the "Current state"
> excerpts against live code before proceeding; on a mismatch, STOP.

## Status

- **Priority**: P2
- **Effort**: M (design/inventory only) — the refactor it scopes is L
- **Risk**: LOW (design only)
- **Depends on**: ADR 0027 (Accepted, soft). Plan 023 (contract tests) — DONE; this
  is its named follow-up.
- **Category**: direction / tech-debt
- **Planned at**: commit `0bd2fc8`, 2026-06-13

## Why this matters

`docs/product/architecture/postgres-migration-design.md` lays out moving app-state
off single-file SQLite so the control plane can run multi-node — which the codebase
already gestures at (Kubernetes-lease distributed locking in
`packages/core/src/control-plane/distributed-lock/k8s-lease.ts`, a
`worker_heartbeats` table). The migration design's two opening steps are:

> 1. Freeze domain repository interfaces and remove direct SQLite assumptions from services.
> 2. Add contract tests for each repository against SQLite.

**Step 2 is already done** (plan 023:
`packages/core/tests/control-plane.app-state-contract.test.ts` exists and the
design doc has a `## Contract Test Coverage And Step-1 Findings` section). The next
de-risking artifact is **step 1**: many services bypass dependency injection and
call `openAppStateDatabase(...)` directly, hard-binding them to the SQLite opener.
A Postgres-backed server profile is impossible until those direct opens are
replaced by injected repositories behind a stable interface.

This is a real readiness gate, but it is a **large refactor with low immediate
payoff** while there is no multi-node demand. So this plan does not perform it — it
produces the precise inventory (every direct-open site) and a sequenced epic, so
the operator can decide *when* to spend the L-effort refactor with the cost fully
visible. This matches the recommendation to keep Postgres/multi-node
readiness-gated rather than building the backend now.

## Current state

Read these to confirm — do NOT modify any of them in this plan:

- **The migration design doc** —
  `docs/product/architecture/postgres-migration-design.md`. It already contains
  `## Contract Test Coverage And Step-1 Findings` (from plan 023, line ~31) and a
  "Blocking SQLite Assumptions" list (services open app-state directly;
  offset-oriented pagination; opaque JSON columns; local filesystem artifact
  paths). Your appended section extends the step-1 picture with the *complete*
  direct-open inventory.

- **The contract tests already exist (do not duplicate)** —
  `packages/core/tests/control-plane.app-state-contract.test.ts`. Plan 023's
  deliverable. Confirm it exists: `ls packages/core/tests/control-plane.app-state-contract.test.ts`.

- **The direct-open call sites (the step-1 target)** — services and state stores
  call `openAppStateDatabase(...)` directly instead of receiving repositories.
  Confirm and capture the full list:
  `grep -rn "openAppStateDatabase" packages/core/src --include='*.ts' | grep -v "app-state/index"`
  At plan time this returns ~20 sites across, at least:
  - `control-plane/services.ts:200,257`
  - `control-plane/plugins/local-loader.ts:153`
  - `control-plane/state-store/sqlite-harness-profile-state-store.ts:37,46,55,64,129,138`
  - `control-plane/services/model-providers.ts:158`
  - `control-plane/services/repositories.ts:192,201`
  - `control-plane/services/local-services.ts:1145,1157`
  - `control-plane/services/workflow-queue-status.ts:82`
  - `control-plane/services/operations.ts:420`
  - `control-plane/services/task-workbench.ts:1023,1035`
  - `control-plane/services/workflow-template-catalog.ts:230,242`
  (Re-run the grep for the live list — line numbers may have shifted.)

- **The repository interface** — `AppStateDatabase`
  (`packages/core/src/control-plane/app-state/database.ts:40-67`) exposes ~25
  repositories. Step 1 is about services depending on this interface (injected),
  not on the `openAppStateDatabase` factory.

- **Epic format to follow** — model structurally on
  `docs/product/epics/completed/2026.41.00-epic-github-connector-pack.md`. The
  roadmap reserves **2026.46** (`docs/product/roadmap/flight-path.md`
  "### 2026.46 Postgres Readiness"). Epics index:
  `docs/product/epics/README.md` `## Active Epics`.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Drift check | `git diff --stat 0bd2fc8..HEAD -- packages/core/src/control-plane/services` | empty or understood |
| Confirm contract tests done | `ls packages/core/tests/control-plane.app-state-contract.test.ts` | file exists |
| Direct-open inventory | `grep -rn "openAppStateDatabase" packages/core/src --include='*.ts' | grep -v "app-state/index"` | the full call-site list (paste into the doc) |
| Count direct opens | `grep -rn "openAppStateDatabase" packages/core/src --include='*.ts' | grep -v "app-state/index" | wc -l` | a number you record in the epic |
| Doc-link check | `npm run check:docs` | exit 0 |

## Scope

**In scope** (the only files you create or modify):

- `docs/product/architecture/postgres-migration-design.md` (append ONE section,
  `## Step-1 Direct App-State Open Inventory`)
- `docs/product/epics/active/2026.46.00-epic-postgres-readiness-interface-freeze.md` (create)
- `docs/product/epics/README.md` (add ONE bullet under `## Active Epics`)
- `plans/README.md` (status row)

**Out of scope** (do NOT touch):

- Any `packages/` or `apps/` file — no service refactor, no Postgres backend, no
  repository-interface extraction, no test changes. This spike only *inventories
  and sequences*.
- `control-plane.app-state-contract.test.ts` — it is plan 023's deliverable and is
  done; do not modify or duplicate it.
- The existing `## Contract Test Coverage And Step-1 Findings` section of the
  design doc — append a NEW section after it; do not rewrite it.

## Git workflow

- Branch: `advisor/027-postgres-step1-interface-freeze-spike`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Build the direct-open inventory

Run `grep -rn "openAppStateDatabase" packages/core/src --include='*.ts' | grep -v "app-state/index"`
and record every call site. For each, note in one phrase what the enclosing
service/method is and whether it already has an injectable seam (e.g. an
`options.appState ?? openAppStateDatabase(...)` pattern like
`plugins/local-loader.ts:153`, which is already half-injectable) vs. a hard direct
open. This distinction tells the epic which sites are cheap vs. costly to convert.

**Verify**: you have a table of every direct-open site with file:line and a
cheap/costly classification.

### Step 2: Append the inventory section to the migration design doc

Append a NEW section to the END of
`docs/product/architecture/postgres-migration-design.md`:

`## Step-1 Direct App-State Open Inventory`

- A table: file:line | enclosing service/method | already-injectable seam? (yes/no)
  | conversion note.
- A one-paragraph summary: total count, how many already have an injectable seam,
  and which clusters (e.g. `sqlite-harness-profile-state-store.ts` has 6 opens) are
  the biggest conversion units.

Do NOT rewrite the existing `## Contract Test Coverage And Step-1 Findings`
section — add this as a new section after it.

**Verify**: `npm run check:docs` → exit 0.

### Step 3: Write the interface-freeze epic

Create
`docs/product/epics/active/2026.46.00-epic-postgres-readiness-interface-freeze.md`.
Required sections:

- `<!-- AUDIENCE: Internal/Technical -->` then
  `# Epic 2026.46: Postgres Readiness — Repository Interface Freeze`.
- `## Status` → `Ready (readiness-gated; build only when multi-node is on the near roadmap).`
- `## Goal` — Remove direct `openAppStateDatabase` calls from services so they
  receive repositories through the `AppStateDatabase` interface, enabling a future
  Postgres backend behind the same interface without changing product behavior.
- `## Problem` — Cite the migration-design step 1, the contract tests done (plan
  023), and the inventory from Step 2 (count + clusters). State why this is gated:
  L-effort, no current multi-node demand, so do it deliberately.
- `## Scope` — In: convert direct opens to injected repositories; freeze the
  repository interface. Out: the Postgres implementation itself (a later epic);
  pagination/JSON-column changes (separate blocking-assumption items); any product
  behavior change.
- `## Story Breakdown` — Ordered `### 2026.46.0N <Title>` stories grouped by
  conversion cluster from the inventory, each with `Purpose:` and `Acceptance:`
  (Acceptance names `npm --workspace @athena/core run typecheck`,
  `npm --workspace @athena/core run test:unit`, and the existing contract suite
  `npm --workspace @athena/core run test:unit -- app-state-contract` as the
  regression net). Suggested grouping:
  1. Convert the already-seamed sites (cheap; e.g. `local-loader.ts`).
  2. Convert the `state-store` cluster.
  3. Convert the high-traffic service sites (`task-workbench`, `operations`,
     `local-services`, `model-providers`, `repositories`, `workflow-*`).
  4. Freeze/document the `AppStateDatabase` repository interface as the backend
     contract; the contract suite from plan 023 is the safety net.
- `## Sequencing And Dependencies` — Note this is the prerequisite for any future
  "Postgres backend" epic; the contract tests (plan 023) must stay green
  throughout. State the readiness-gate posture: build when multi-node is near, not
  speculatively.
- `## Acceptance Boundary` — Done when no service calls `openAppStateDatabase`
  directly (`grep` returns only the factory definition and tests), the contract
  suite still passes, and product behavior is unchanged.

### Step 4: Index and validate

Add ONE bullet to `docs/product/epics/README.md` under `## Active Epics`:
`- 2026.46 — Postgres Readiness: Repository Interface Freeze`.

**Verify**: `npm run check:docs` → exit 0.

## Test plan

No code tests (design/inventory plan). Verification:

- The design doc has a complete direct-open inventory table; the epic groups the
  conversion by cluster with the contract suite named as the regression net; the
  acceptance boundary is a `grep` that returns no direct opens in services.
- `npm run check:docs` passes.

## Done criteria

ALL must hold:

- [ ] `docs/product/architecture/postgres-migration-design.md` has a new `## Step-1 Direct App-State Open Inventory` section appended (existing `## Contract Test Coverage And Step-1 Findings` section unchanged).
- [ ] The inventory table lists every site from `grep -rn "openAppStateDatabase" packages/core/src --include='*.ts' | grep -v "app-state/index"`, and the count in the doc matches `... | wc -l`.
- [ ] `docs/product/epics/active/2026.46.00-epic-postgres-readiness-interface-freeze.md` exists with `## Goal`, `## Problem`, `## Scope`, `## Story Breakdown`, `## Acceptance Boundary`, and names the plan-023 contract suite as the regression net.
- [ ] `docs/product/epics/README.md` lists `2026.46` under `## Active Epics`.
- [ ] `git diff --name-only` shows ONLY the in-scope files (no `packages/`, no `apps/`).
- [ ] `npm run check:docs` exits 0.
- [ ] `plans/README.md` status row updated.

## STOP conditions

Stop and report back if:

- The drift check shows the direct opens were already converted to injected
  repositories, or a Postgres backend was added, since `0bd2fc8` — report it; the
  refactor may be underway.
- `ls packages/core/tests/control-plane.app-state-contract.test.ts` fails (the
  plan-023 contract tests are missing) — report it; this plan assumes step 2 is
  done.
- The direct-open grep returns zero hits (step 1 already complete) — report it;
  this epic is then redundant.
- You feel you must change a service to make the inventory or epic concrete — that
  is implementation, out of scope; record it as a story instead.

## Maintenance notes

- Keep this readiness-gated: this epic is the prerequisite for a Postgres backend
  but should be built when multi-node operation is actually near, not
  speculatively. The contract suite (plan 023) is the de-risking artifact that
  makes the eventual refactor safe.
- A reviewer of the eventual refactor must confirm product behavior is unchanged
  (the contract suite stays green) and that `grep -rn "openAppStateDatabase"
  packages/core/src` returns only the factory definition and test helpers when
  done.
- Deferred out of this plan: the service refactor itself, the repository-interface
  extraction, and the Postgres backend implementation (a separate later epic).
</content>
