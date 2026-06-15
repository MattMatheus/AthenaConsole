# Implementation Plans

This directory contains the active implementation/design plans for the enterprise
direction round. Completed plans 001-019 were archived under
`plans/archive/completed-001-019/`, and superseded plan 020 was archived under
`plans/archive/superseded-020-enterprise-direction-adr/`.

Execute active plans in the order below unless dependencies say otherwise. Each
executor: read the plan fully before starting, honor its STOP conditions, run
every verification command, and update the table when done.

> **Direction round appended 2026-06-13 (commit `635289b`).** Plans 020-023 came
> from an `improve next` roadmap/direction pass. The documentation cleanup has
> accepted the enterprise/multi-user direction in ADR 0027, so these plans should
> now be reviewed as follow-up design and validation work for that direction.
> Plan 020 is superseded; plans 021-023 remain live.

> **Second direction round appended 2026-06-13 (commit `0bd2fc8`).** Plans 024-027
> came from a follow-up `improve next` pass run after 021-023 were completed. The
> enterprise design spikes (021-023) produced ADRs 0028/0029 (both `Proposed`) and
> the Postgres contract tests — but nothing is being *built*, and the Flywheel
> backlog is empty. This round promotes the cleared design gates into buildable
> artifacts and surfaces one independent, half-built capability (agent
> certification). All four are design/spike plans — they produce ADRs/epics, not
> production code. See "Direction round (024–027)" below for selection rationale.

These plans are **self-contained**: everything needed is in each file. They were
written for an executor with zero context from the audit session. Do not assume
knowledge from other plans unless a plan lists it under "Depends on".

## Repository quick facts (apply to every plan)

- Monorepo: npm workspaces (`apps/*`, `packages/*`) + Turbo. Node >= 20, TypeScript `strict`.
- Product is **local-first by default and enterprise-capable by design** ("Team Orchestrator"); see ADR 0027.
- Verification commands (verified to exist):
  - Core: `npm --workspace @athena/core run typecheck`, `npm --workspace @athena/core run test:unit`, `npm --workspace @athena/core run validate:manifests`, `npm --workspace @athena/core run check:schemas`
  - Console: `npm --workspace @athena/console run typecheck`, `npm --workspace @athena/console run test`, `npm --workspace @athena/console run lint`, `npm --workspace @athena/console run build`
  - Root (all workspaces via turbo): `npm run typecheck`, `npm run test`, `npm run lint`
- Core tests live in `packages/core/tests/*.test.ts` (vitest). Console tests are co-located `*.test.ts(x)` (vitest).
- Do NOT push or open PRs unless the operator says so. Branch per plan: `advisor/NNN-<slug>`.

## Execution order & status

| Plan | Title | Priority | Effort | Depends on | Category | Status |
|------|-------|----------|--------|------------|----------|--------|
| 021 | Design workspace lifecycle + server-bound scoped RBAC (spike) | P1 | M | ADR 0027 | direction/security | DONE ✓ verified 2026-06-15 |
| 022 | Design cost governance (budgets/caps/alerts) | P2 | M | ADR 0027 (soft 021) | direction | DONE ✓ verified 2026-06-15 |
| 023 | Postgres-readiness spike: repo contract tests vs SQLite | P2 | M | ADR 0027 (soft) | direction/tests | DONE ✓ verified 2026-06-15 |
| 024 | Design agent-certification eval-runner surface (ADR 0030) | P1 | S | none | direction | DONE ✓ verified 2026-06-15 |
| 025 | Promote ADR 0028 → 2026.44 workspace/RBAC impl epic | P1 | M | ADR 0028 | direction/security | DONE ✓ verified 2026-06-15 |
| 026 | Promote ADR 0029 → 2026.45 cost-governance impl epic | P2 | M | ADR 0029 (soft 025) | direction | DONE ✓ verified 2026-06-15 |
| 027 | Postgres step-1 spike: direct-open inventory + 2026.46 epic | P2 | M | plan 023 (DONE) | direction/tech-debt | DONE ✓ verified 2026-06-15 |

Status values: TODO | IN PROGRESS | DONE | BLOCKED (one-line reason) | REJECTED (one-line rationale) | SUPERSEDED BY <reason>.

## Reconcile log — 2026-06-15 (working tree on `main`, base commit `0bd2fc8`)

> ⚠️ **The entire 024–027 round is UNCOMMITTED on `main`** — no branch, no stash.
> That includes the plan files (024–027 are untracked), their design deliverables
> (ADR 0030; epics 2026.44–2026.47; the postgres-migration-design additions), AND
> a workspace-RBAC **implementation** that goes beyond any of these design plans.
> Nothing is lost, but it is one unsaved working tree — commit before any
> branch-switching or cleanup.

**Design plans 021–027 — DONE re-verified.** Each is a design/spike plan whose
deliverable is Markdown, and all deliverables are present:
ADR 0028/0029/0030, epics `2026.44`–`2026.47`, and the postgres migration-design
doc. `npm run check:docs` → "No broken links." These statuses are correct.

**⚠️ Out-of-plan implementation found in the working tree (operator decision needed).**
Beyond the design plans, the tree contains a real, **partial** build of epic
`2026.44` (workspace lifecycle + scoped RBAC). It was not produced by any plan
here — plan 025 is design-only and explicitly forbids touching `packages/`/`apps/`
(it even lists "you must write a migration/route/component" as a STOP condition).
What exists:

- **Implemented = epic story `2026.44.01` (Workspace Lifecycle CRUD) only:**
  `control-plane/services/workspaces.ts` (`LocalWorkspaceService` create/update/delete/get/list),
  `AuthorizedWorkspaceService` (Admin-gated RBAC) in `services/authorization.ts`,
  `api/routes/workspace-routes.ts`, `shared/contracts/workspaces.ts`,
  `apps/console/src/features/workspaces/*` + `WorkspacesPage.tsx`, with tests.
- **NOT implemented — stories `2026.44.02`–`2026.44.05`:**
  - No `workspace_members` table (`grep workspace_members packages/core/src` → none) → **44.02 missing**.
  - `api/middleware/auth.ts:81` still parses `x-athena-scope-workspaces` from the request header, **unmodified** → **44.03 (server-derived scope) missing**. This is the security-critical story.
  - `migrations.ts` unmodified → **44.04 (FK / referential integrity) missing**.

  🔒 **Safety consequence:** workspace scope is still a **client-asserted UX filter,
  not a tenancy boundary**. Per ADR 0028 / epic 2026.44 and plan 025's acceptance,
  **multi-user must not be exposed** on this slice. The epic's `## Status` reads
  "Ready." and its Acceptance Boundary (server-derived scope, per-workspace RBAC,
  referential integrity) is **not met** by what's in the tree — don't read the
  CRUD slice as "RBAC done."

**Coherence check on the uncommitted slice — all green (run 2026-06-15):**
`@athena/core` typecheck ✓ · `@athena/core` test:unit → **535 passed** ✓ ·
`@athena/console` typecheck ✓ · `@athena/console` test → **83 passed** ✓ ·
`check:docs` ✓. So the slice is mergeable as *story 44.01*, not as the epic.

**Recommended operator actions:**
1. Commit the working tree (separate the design-docs commit from the 44.01
   implementation commit if you want clean history), so this round stops living
   as one unsaved diff.
2. Track the 44.01 build under the epic / Flywheel as story `2026.44.01` DONE and
   `2026.44.02`–`.05` as the remaining gate — **do not** advance the epic's status
   past 44.01 or enable multi-user until 44.02–44.04 land.
3. `costBudgetDailyUsd` is still parsed/stored but **never enforced**
   (`shared/contracts/policy.ts:70`; no enforcement call site) — exactly the gap
   plan 026 documented. Epic 2026.45 (cost governance) remains unbuilt; expected.

## Dependency notes

- **007 requires 006**: the concurrency guard relies on each step transition being atomic; do the transaction wrapping first so a serialized transition can't leave partial state.
- **009 requires 004**: backoff application should consume the single consolidated retry-policy parser, not the pre-existing divergent copies.
- **011 soft-depends on 010**: both touch `task-workbench.ts` readiness/mapping; doing the mapper consolidation first reduces merge churn. They can be done independently if needed.
- **016 soft-depends on 015**: 016 adds a CI lint step. Until 015 lands, core's `lint` is just `tsc --noEmit`, so 016 only meaningfully lints the console. Either order works; if 016 lands first, re-confirm the CI lint step covers core after 015.

### Direction round (020–023)

- **020 is superseded by ADR 0027.** The docs cleanup accepted the enterprise/multi-user direction directly, and the plan file is archived under `plans/archive/superseded-020-enterprise-direction-adr/`.
- **021 is now the first design gate**: workspace lifecycle + server-bound scoped RBAC must close the client-asserted scope gap before multi-user exposure.
- **022 depends on the enterprise direction and soft-requires 021**: global/per-agent/per-workspace budgets can be designed on the existing workspace entity; per-user enforcement across distinct users depends on server-bound membership.
- **023 supports the enterprise direction**: backend-agnostic app-state contract tests are useful before Postgres implementation.

### Direction round (024–027)

These are the follow-up to 021–023: the design gates are cleared, so these convert
them into buildable artifacts (or surface a half-built capability). All are
design/spike plans — no production code.

- **024 is independent** of the enterprise arc. It designs the missing *producer*
  for agent certification: the full eval→certification loop already works inside
  `control-plane.software-team-golden-evals.test.ts`, but no product code calls
  `appState.evals.createRun/createResult`, so certification can never reach
  `certified` in a live instance. Latent today (all packs `preview`/`experimental`),
  on the path as packs mature. Smallest effort, highest standalone leverage — do
  first. Produces ADR 0030.
- **025 requires ADR 0028** (the design from plan 021) and recommends accepting it.
  It writes the `2026.44` workspace-lifecycle + scoped-RBAC implementation epic.
  This is the strategic gate: it precedes multi-user exposure, per-user cost
  enforcement (026), and the deferred connector arc. The security-critical story is
  server-derived scope replacing the `x-athena-scope-workspaces` header.
- **026 requires ADR 0029** (from plan 022) and soft-depends on 025. It writes the
  `2026.45` cost-governance epic AND reconciles a gap both prior rounds missed: a
  `costBudgetDailyUsd` policy field already exists, parsed/stored, but is **never
  enforced** (`policy.ts:70`), and ADR 0029 does not mention it. Per-user enforcement
  needs 025's membership; global/per-agent/per-workspace do not.
- **027 follows plan 023 (DONE).** The contract-test slice of Postgres-readiness is
  already complete, so 027 advances to migration-design step 1: inventory the ~20
  direct `openAppStateDatabase` call sites in services and scope the `2026.46`
  interface-freeze epic. Kept readiness-gated — build the refactor when multi-node
  is near, not speculatively.

Recommended order: **024 (independent, smallest) → 025 (strategic gate) → 026
(soft-after 025) → 027 (gated, lowest urgency).**

## Findings considered and NOT planned (so they are not re-audited)

- **CORS default `["*"]` + Origin reflection + credentials** (`api/server.ts:107`): real but narrow — auth is header/bearer (no cookies), so the credentialed angle is moot; the only live risk is the local default (any visited site can call `127.0.0.1:8787`). Worth a follow-up to default `allowedOrigins` to a loopback allowlist + add a Host check, but lower leverage than the planned set. Not selected by the operator this round.
- **Client-asserted scope headers not server-bound** (`middleware/auth.ts:36`): confirmed NOT privilege escalation (server-side role resolution wins; scopes are self-asserted UX filters today). It is a design footgun if scopes are ever relied on for confinement — revisit when/if service-token scoping is introduced. Not an active break.
- **ADR 0016 service decomposition** (`task-workbench.ts` 3350 LOC): real, high-value, but L-effort and already an accepted ADR with its own plan. Execute incrementally per ADR 0016, not as a single advisor plan.
- **Managed-clone accepts absolute-local/any-http source** (`repositories.ts:323`): LOW impact for local-first (operator already controls the host); argument injection is blocked (`--` + execFile). Document as accepted local behavior if clone is ever exposed beyond a trusted operator.
- **`run-service` has no direct test** (M): covered transitively by control-plane suites; add characterization tests before any refactor of that module, not preemptively.
- **`finalizeRun` fragile `every(completed)` + dead `skipped` state** (`workflow-state.ts:310`): latent, not currently reachable. Harden opportunistically when touching that file (e.g. during plan 006/007).

### Direction round (`improve next`, 2026-06-13) — surfaced but not selected for plans

- **D5 — Formalize the agent eval/quality harness as a product surface**: ~~not selected~~ → **now planned as plan 024 (commit `0bd2fc8` round).** The follow-up pass found the smoking gun the prior round lacked: the full eval→certification loop already works in `control-plane.software-team-golden-evals.test.ts` but no product code produces eval runs, so `evaluateAgentCertification` (`agent-catalog.ts:243-304`) permanently downgrades any `certified`-maturity agent. Plan 024 designs the missing producer (ADR 0030). The product call (author/PDK vs operator surface) that blocked it before is now part of the plan, not a blocker to it.
- **D6 — Resume the deferred knowledge-work connector arc (2026.43)**: its blocker (2026.42 product-intuition) is now complete and a Jira *read* connector already landed in the enterprise push, so the documented next connector is partly pre-empted. Lower strategic urgency than resolving workspace/RBAC/cost/Postgres readiness, and it adds SaaS auth, privacy, retention, and approval surface that should wait for the enterprise governance boundaries. **Still deferred in the `0bd2fc8` round**: it should enter the product shell only after plan 025 (workspace/RBAC) and plan 026 (cost governance) define the governance boundary. Not selected.
- **Client-asserted workspace scope is now load-bearing**: the prior round noted client-asserted scope headers (`auth.ts:36`) were "not an active break" because scopes were UX-only. With the workspace tenancy model now in the schema, this footgun is on the critical path for multi-user safety — it is folded into plan 021's design and is the security-critical story of plan 025's implementation epic (2026.44.03).

### Direction round (`improve next`, 2026-06-13, commit `0bd2fc8`) — surfaced but not selected for plans

- **Distributed coordination is half-built**: distributed-lock providers (`redis`, `k8s-lease`, `local-file`, `local-memory`) and a `worker_heartbeats` table exist, but locks are wired only thinly (release calls at `operations.ts:442`, `runtime/index.ts:250`) and there is no multi-node work-claiming. This is real but folds into the Postgres/multi-node readiness gate (plan 027 and its follow-on Postgres-backend epic), not a separate finding — building it has no payoff until multi-node is actually pursued. Not selected as its own plan.
- **Knowledge-work connectors (2026.43)** — see D6 above; deferred behind plans 025/026.
