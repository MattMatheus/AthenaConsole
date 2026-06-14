# Plan 022: Design cost governance — budgets, caps, and alerts on the usage ledger

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **This is a design plan.** The deliverable is a design ADR. You will NOT add
> enforcement code, schemas, or APIs. Markdown only; read-only `grep` allowed.
>
> **Drift check (run first)**:
> `git diff --stat 635289b..HEAD -- packages/core/src/control-plane/services/operations.ts packages/core/src/control-plane/services/task-workbench.ts packages/core/src/shared/contracts/operations.ts packages/core/src/control-plane/app-state/domain-repositories/usage-ledger.ts`
> If any changed since this plan was written, compare the "Current state"
> excerpts against live code before proceeding; on a mismatch, STOP.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW (design only)
- **Depends on**: ADR 0027 accepted. The workspace *entity* already exists
  (migration 20), so per-workspace
  budgets can target real workspaces today; per-user budgets that must be
  enforced across users **soft-depend on** plan 021's server-bound membership
  model (otherwise "user" is a client-asserted identity, not a trusted one).
- **Category**: direction
- **Planned at**: commit `635289b`, 2026-06-13

## Why this matters

The enterprise push shipped cost **observability** but not cost **governance**.
The system records every run's token usage and estimated spend in a usage ledger
and reports it broken down by agent, provider, model, user, and workspace — but
there are **no budgets, no spend caps, and no alerts**. An agent in a loop, a
misconfigured schedule, or a careless operator can run up unbounded provider
spend, and the only feedback is an after-the-fact cost report.

This is a natural and high-value extension because the product *already* treats
runaway cost as a safety concern. ADR 0013 ("Safety, Approval, and Loop Limit
Model") justifies loop and tool-call limits explicitly so agents "do not burn
tokens or thrash through tools indefinitely." Spend caps are the missing member
of that same safety family — they convert the existing passive cost ledger into
an active control, and they reuse the approval/limit machinery that already
exists.

This plan designs the model: what a budget is, what scope it applies to, where
enforcement hooks into the run lifecycle, and what an alert is. It does not build
it — the implementation is a follow-up epic.

## Current state

Cost is recorded and reported, but never enforced. Confirm by reading:

- **Recording**: usage is written per run in
  `packages/core/src/control-plane/services/task-workbench.ts:2081`:
  ```ts
  const record = appState.usageLedger.upsert({
  ```
  (one ledger row per run; the table has `unique(run_id)` —
  `migrations.ts:606`).

- **Ledger shape**:
  `packages/core/src/control-plane/app-state/domain-repositories/usage-ledger.ts:29-52`
  — `UsageLedgerRecord` has `inputTokens`, `outputTokens`, `totalTokens`,
  `costUsd`, `agentId`, `provider`, `model`, `userId`, `workspaceId`,
  `recordedAt`. `ListUsageLedgerOptions` (lines 78-88) already supports filtering
  by `agentId`, `provider`, `model`, `userId`, `workspaceId`, and a
  `windowStart`/`windowEnd` time range — so the data needed to evaluate a budget
  is queryable today.

- **Reporting only**: `packages/core/src/control-plane/services/operations.ts`
  `computeCostSummary` (line ~253) aggregates spend. Confirm there is **no**
  budget/cap/alert logic:
  `grep -in "budget\|cap\|alert\|threshold\|enforce" packages/core/src/control-plane/services/operations.ts`
  → matches are only `limit: 500` (query row limits) and pricing — none are spend
  caps.

- **Cost summary contract**:
  `packages/core/src/shared/contracts/operations.ts:68-93` —
  `OperationsCostSummary` (breakdowns + `dailyTrend` + `tokenMix`) and
  `ProviderTokenPricing` / `ProviderCostSettings`. Note spend is **estimated**
  from operator-maintained `ProviderTokenPricing` (lines 82-93), so budgets must
  be documented as enforcing against *estimates*, not billed amounts.

- **The safety model this extends**: ADR 0013
  (`docs/product/architecture/decisions/0013-safety-approval-and-loop-limit-model.md`)
  — loop/tool-call limits are mandatory run safety controls. Quote its
  token-burn rationale in the design.

Conventions: ADR structure as in plans 021/022. Next free ADR number after 0028
(plan 021) is **0029**.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Drift check | `git diff --stat 635289b..HEAD -- packages/core/src/control-plane/services/operations.ts` | empty or understood |
| Confirm no enforcement today | `grep -in "budget\|spend cap\|alert\|threshold" packages/core/src/control-plane/services/operations.ts` | no spend-cap matches |
| Doc-link check | `npm run check:docs` | exit 0 |

## Scope

**In scope** (the only files you create or modify):

- `docs/product/architecture/decisions/0029-cost-governance-budgets-and-alerts.md` (create)
- `docs/product/architecture/decisions/README.md` (add index bullet, `- Proposed`)
- `plans/README.md` (status row)

**Out of scope** (do NOT touch):

- `operations.ts`, `task-workbench.ts`, `usage-ledger.ts`, the operations
  contract, migrations — no code. This is design only.
- The provider pricing mechanism — do not redesign how `ProviderTokenPricing` is
  maintained; budgets consume its estimates as-is.
- Plan 021's workspace entity — reference it for per-workspace budgets but do not
  design the workspace table here.

## Git workflow

- Branch: `advisor/022-cost-governance-design`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Write the cost-governance design ADR

Create `docs/product/architecture/decisions/0029-cost-governance-budgets-and-alerts.md`.
Required sections:

- Header + `# ADR 0029: Cost Governance — Budgets And Alerts`.
- `## Status` → `Proposed.`
- `## Context` — State that cost is recorded (`task-workbench.ts:2081`) and
  reported (`operations.ts` `computeCostSummary`) but never enforced. Quote ADR
  0013's token-burn rationale and position spend caps as the missing safety
  control. Note that spend is *estimated* from operator pricing
  (`operations.ts` contract lines 82-93), so caps gate estimates, not invoices.
- `## Decision` — Design these explicitly:
  1. **Budget scope dimensions.** Which of `{global, workspace, user, agent,
     provider}` a budget can target. Recommend a minimum viable set (suggest:
     global + per-agent first, since those need no workspace entity; per-workspace
     and per-user follow plan 021). Map each dimension to the
     `ListUsageLedgerOptions` filter that already supports it
     (`usage-ledger.ts:78-88`).
  2. **Budget period.** Calendar month (matches `computeCostSummary`'s `month`
     window) vs rolling window. Recommend one.
  3. **Budget actions on breach.** Define a small enum, e.g.
     `warn` (alert only) | `require-approval` (new runs need approval once over
     budget — reuse the existing approval machinery) | `block` (refuse new runs).
     Recommend defaults per scope.
  4. **Enforcement hook point.** Identify *where* in the run lifecycle a budget
     is checked. The natural point is the run-creation path that also writes the
     ledger (`task-workbench.ts` around the `usageLedger.upsert` at line 2081 and
     the run-create entry). Specify pre-run check (budget evaluated before a run
     starts) vs in-run interruption, and recommend pre-run as the v1 (simpler,
     reuses readiness gates).
  5. **Alerts.** What an alert is (an event? a readiness warning? a
     console banner?), at what thresholds (e.g. 80% / 100%), and whether alerts
     persist as events in the existing event store.
  6. **Data model sketch.** A `budgets` table column list (scope type, scope id,
     period, limit_usd, action, created/updated) — sketch only, no migration.
- `## Reused Machinery` — Explicitly list what this design reuses rather than
  reinvents: the usage ledger + its filters, `ProviderTokenPricing` estimates,
  the approval flow (ADR 0013), and the event store for alerts.
- `## Open Questions` — At minimum: estimate-vs-actual divergence; what happens
  to in-flight runs when a budget trips; whether scheduled runs are blocked or
  deferred when over budget.
- `## Risks` — Estimated spend ≠ billed spend; blocking runs could surprise
  operators; per-user budgets require the workspace/identity model from plans
  ADR 0027 and plan 021.

### Step 2: Index and validate

Add a bullet to `docs/product/architecture/decisions/README.md` in the "## Reset
ADRs" list, matching the exact Markdown-link shape of the surrounding bullets
(copy an existing line and edit it): label `ADR 0029: Cost Governance — Budgets
And Alerts`, target filename `0029-cost-governance-budgets-and-alerts.md`,
trailing status ` - Proposed`.

**Verify**: `npm run check:docs` → exit 0.

## Test plan

No code tests (design plan). Verification:

- The ADR defines budget scope dimensions, period, breach actions, a named
  enforcement hook point with a `file:line` anchor into `task-workbench.ts`, and
  an alert model.
- `npm run check:docs` passes.

## Done criteria

ALL must hold:

- [ ] `docs/product/architecture/decisions/0029-cost-governance-budgets-and-alerts.md` exists, Status `Proposed.`, has `## Decision`, `## Reused Machinery`, `## Open Questions`.
- [ ] The `## Decision` section names a concrete enforcement hook point referencing `task-workbench.ts` and maps each budget scope dimension to a `ListUsageLedgerOptions` filter.
- [ ] `grep -c "0029" docs/product/architecture/decisions/README.md` ≥ 1.
- [ ] `git diff --name-only` shows ONLY the three in-scope files.
- [ ] `npm run check:docs` exits 0.
- [ ] `plans/README.md` status row updated.

## STOP conditions

Stop and report back if:

- The drift check shows budget/cap/alert enforcement was already added to
  `operations.ts` or `task-workbench.ts` since `635289b` (the design may already
  exist).
- `grep -in "budget" packages/core/src/control-plane/services/operations.ts`
  reveals existing budget logic — report it; this plan may be redundant.
- ADR 0027 is missing — this plan is gated on it.
- You feel you must write enforcement code or a migration to make the design
  concrete — describe it in the ADR instead.

## Maintenance notes

- This ADR is `Proposed` and gated on ADR 0027. The workspace entity
  already exists, so global, per-agent, and per-workspace budgets can all be
  implemented without plan 021; only per-*user* budgets that confine spend across
  distinct users depend on plan 021's server-bound membership (until then "user"
  is a client-asserted identity).
- The implementer must treat all spend figures as **estimates** from
  `ProviderTokenPricing`; a budget that silently blocks runs on a wrong price
  table is worse than no budget. Surfacing the estimate basis in the UI is part
  of the eventual build.
- A reviewer should check the enforcement hook is on the run-*creation* path so
  budgets are evaluated before spend is incurred, not only after the ledger row
  is written.
- Deferred out of this plan: the `budgets` table, enforcement code, alert
  events, and console surfaces.
