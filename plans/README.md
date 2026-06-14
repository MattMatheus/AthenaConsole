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
| 021 | Design workspace lifecycle + server-bound scoped RBAC (spike) | P1 | M | ADR 0027 | direction/security | DONE |
| 022 | Design cost governance (budgets/caps/alerts) | P2 | M | ADR 0027 (soft 021) | direction | DONE |
| 023 | Postgres-readiness spike: repo contract tests vs SQLite | P2 | M | ADR 0027 (soft) | direction/tests | DONE |

Status values: TODO | IN PROGRESS | DONE | BLOCKED (one-line reason) | REJECTED (one-line rationale) | SUPERSEDED BY <reason>.

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

## Findings considered and NOT planned (so they are not re-audited)

- **CORS default `["*"]` + Origin reflection + credentials** (`api/server.ts:107`): real but narrow — auth is header/bearer (no cookies), so the credentialed angle is moot; the only live risk is the local default (any visited site can call `127.0.0.1:8787`). Worth a follow-up to default `allowedOrigins` to a loopback allowlist + add a Host check, but lower leverage than the planned set. Not selected by the operator this round.
- **Client-asserted scope headers not server-bound** (`middleware/auth.ts:36`): confirmed NOT privilege escalation (server-side role resolution wins; scopes are self-asserted UX filters today). It is a design footgun if scopes are ever relied on for confinement — revisit when/if service-token scoping is introduced. Not an active break.
- **ADR 0016 service decomposition** (`task-workbench.ts` 3350 LOC): real, high-value, but L-effort and already an accepted ADR with its own plan. Execute incrementally per ADR 0016, not as a single advisor plan.
- **Managed-clone accepts absolute-local/any-http source** (`repositories.ts:323`): LOW impact for local-first (operator already controls the host); argument injection is blocked (`--` + execFile). Document as accepted local behavior if clone is ever exposed beyond a trusted operator.
- **`run-service` has no direct test** (M): covered transitively by control-plane suites; add characterization tests before any refactor of that module, not preemptively.
- **`finalizeRun` fragile `every(completed)` + dead `skipped` state** (`workflow-state.ts:310`): latent, not currently reachable. Harden opportunistically when touching that file (e.g. during plan 006/007).

### Direction round (`improve next`, 2026-06-13) — surfaced but not selected for plans

- **D5 — Formalize the agent eval/quality harness as a product surface**: `eval_suites`/`eval_runs`/`eval_results` tables (`migrations.ts:519-568`) + golden fixtures (`bundled-plugins/software-team/evals/golden/*.json`) exist with no epic, no direction doc, and no described console surface. Real opportunity as bundled packs grow, but it needs a product call (author-facing PDK feature vs. operator-facing surface) before a useful spike; not selected this round.
- **D6 — Resume the deferred knowledge-work connector arc (2026.43)**: its blocker (2026.42 product-intuition) is now complete and a Jira *read* connector already landed in the enterprise push, so the documented next connector is partly pre-empted. Lower strategic urgency than resolving workspace/RBAC/cost/Postgres readiness, and it adds SaaS auth, privacy, retention, and approval surface that should wait for the enterprise governance boundaries. Revisit after plans 021-023 are reviewed. Not selected this round.
- **Client-asserted workspace scope is now load-bearing**: the prior round noted client-asserted scope headers (`auth.ts:36`) were "not an active break" because scopes were UX-only. With the workspace tenancy model now in the schema, this footgun is on the critical path for multi-user safety — it is folded into plan 021's design rather than tracked separately.
