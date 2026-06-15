# Plan 026: Promote ADR 0029 into the 2026.45 cost-governance implementation epic, reconciling the existing unenforced budget field (spike)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **This is a design + sequencing plan.** The deliverable is an implementation
> **epic** plus a short reconciliation note appended to ADR 0029. You will NOT
> write enforcement code, schemas, migrations, routes, or console surfaces. Only
> Markdown files are created/modified. You MAY run read-only `grep`/`ls`.
>
> **Drift check (run first)**:
> `git diff --stat 0bd2fc8..HEAD -- docs/product/architecture/decisions/0029-cost-governance-budgets-and-alerts.md packages/core/src/shared/contracts/policy.ts packages/core/src/control-plane/services/policy.ts packages/core/src/control-plane/services/operations.ts packages/core/src/control-plane/app-state/domain-repositories/usage-ledger.ts`
> If any changed since this plan was written, compare the "Current state"
> excerpts against live code before proceeding; on a mismatch, STOP.

## Status

- **Priority**: P2
- **Effort**: M (design/sequencing only) — the implementation it scopes is M/L
- **Risk**: LOW (design only)
- **Depends on**: ADR 0027 (Accepted) and ADR 0029 (Proposed). Per-*user*
  enforcement soft-depends on plan 025 (server-bound membership); global/per-agent/
  per-workspace enforcement does not.
- **Category**: direction
- **Planned at**: commit `0bd2fc8`, 2026-06-13

## Why this matters

The product records and reports cost (a usage ledger plus console
`CostAgentBreakdown` / `CostTrendChart`) but does not **govern** it. ADR 0029
(`Proposed`, from plan 022) designs budgets/caps/alerts — but it has **no
implementation epic**, so the work cannot start, and the Flywheel backlog is
empty.

There is also a concrete, overlooked gap that this plan must reconcile: a cost
budget field **already exists in the policy contract and is silently unenforced**.
`costBudgetDailyUsd` is parsed, schema-validated, and persisted on policy
(`packages/core/src/shared/contracts/policy.ts:70`,
`packages/core/src/control-plane/services/policy.ts:2042`), but it has **zero
runtime enforcement references** — it is a dial wired to nothing. ADR 0029 never
mentions it (confirm:
`grep -i "costBudgetDailyUsd" docs/product/architecture/decisions/0029-cost-governance-budgets-and-alerts.md`
→ no matches), so a naive implementation of ADR 0029's fresh `budgets` table would
leave two parallel, divergent budget concepts. The epic must decide whether the
existing field becomes the per-policy hook for the new model or is deprecated in
favor of the `budgets` table.

This plan converts ADR 0029 into a buildable `2026.45` epic and forces that
reconciliation. It does **not** build enforcement.

## Current state

Read these to confirm — do NOT modify any of them in this plan:

- **The design already exists** —
  `docs/product/architecture/decisions/0029-cost-governance-budgets-and-alerts.md`
  (Status `Proposed.`). Read it fully: budget scope dimensions, period, breach
  actions (`warn` / `require-approval` / `block`), enforcement hook point, alerts,
  and a `budgets` table sketch. Your epic sequences this.

- **The overlooked existing field** —
  `packages/core/src/shared/contracts/policy.ts:70`:
  ```ts
  costBudgetDailyUsd?: number;
  ```
  parsed at `packages/core/src/api/request-parsers/policy.ts:37-39`, normalized at
  `packages/core/src/control-plane/services/policy.ts:2042`, and present in the
  API schema (`api-schemas.ts`, `costBudgetDailyUsd`). Confirm it is **never
  enforced**:
  `grep -rn "costBudgetDailyUsd" packages/core/src | grep -v "contracts\|parsers\|schemas\|services/policy.ts"`
  → no enforcement/runtime call sites. It is stored and ignored.

- **Cost is recorded, not enforced** — usage is written per run via
  `appState.usageLedger.upsert(...)` in
  `packages/core/src/control-plane/services/task-workbench.ts` (search
  `usageLedger.upsert`). The ledger
  (`packages/core/src/control-plane/app-state/domain-repositories/usage-ledger.ts`)
  already supports filtering by `agentId`, `provider`, `model`, `userId`,
  `workspaceId`, and a time window — the data needed to evaluate a budget is
  queryable today. `computeCostSummary` in
  `packages/core/src/control-plane/services/operations.ts` aggregates but never
  caps. Confirm no enforcement:
  `grep -in "budget\|spend cap\|threshold\|enforce" packages/core/src/control-plane/services/operations.ts`
  → only query `limit:` and pricing, no caps.

- **Console observability already shipped** —
  `apps/console/src/features/operations/components/CostAgentBreakdown.tsx` and
  `CostTrendChart.tsx`. The epic's alert/budget surfaces extend this area.

- **Spend is estimated** — costs come from operator-maintained
  `ProviderTokenPricing` (the operations cost contract), so budgets gate
  *estimates*, not invoices. The epic must state this.

- **Epic format to follow** — model structurally on
  `docs/product/epics/completed/2026.41.00-epic-github-connector-pack.md`. Epics
  open `<!-- AUDIENCE: Internal/Technical -->`, `# Epic NNNN.NN: Title`,
  `## Status`, `## Goal`, `## Problem`, `## Scope`, `## Story Breakdown` with
  `### NNNN.NN.NN <Title>` (`Purpose:` / `Acceptance:`). The roadmap reserves
  **2026.45** (`docs/product/roadmap/flight-path.md` "### 2026.45 Cost
  Governance"). Epics index: `docs/product/epics/README.md` `## Active Epics`.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Drift check | `git diff --stat 0bd2fc8..HEAD -- docs/product/architecture/decisions/0029-cost-governance-budgets-and-alerts.md` | empty or understood |
| Confirm field unenforced | `grep -rn "costBudgetDailyUsd" packages/core/src` | only contract/parser/schema/policy-service hits, no runtime enforcement |
| Confirm ADR 0029 omits the field | `grep -ci "costBudgetDailyUsd" docs/product/architecture/decisions/0029-cost-governance-budgets-and-alerts.md` | 0 |
| Confirm no enforcement in operations | `grep -in "budget\|spend cap\|threshold" packages/core/src/control-plane/services/operations.ts` | no spend-cap matches |
| Doc-link check | `npm run check:docs` | exit 0 |

## Scope

**In scope** (the only files you create or modify):

- `docs/product/epics/active/2026.45.00-epic-cost-governance-enforcement.md` (create)
- `docs/product/architecture/decisions/0029-cost-governance-budgets-and-alerts.md`
  (append ONE short subsection only — see Step 3; do NOT rewrite the ADR)
- `docs/product/epics/README.md` (add ONE bullet under `## Active Epics`)
- `plans/README.md` (status row)

**Out of scope** (do NOT touch):

- Any `packages/` or `apps/` file — no enforcement code, no `budgets` migration,
  no routes, no console. The epic *describes* the build.
- The provider pricing mechanism — budgets consume `ProviderTokenPricing`
  estimates as-is; do not redesign pricing.
- Plan 025's workspace/membership model — reference it for per-user enforcement;
  do not design it here.

## Git workflow

- Branch: `advisor/026-cost-governance-implementation-epic`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Confirm the reconciliation gap

Run the confirmation greps from "Current state": (a) `costBudgetDailyUsd` exists
but is unenforced, (b) ADR 0029 does not mention it. Capture the `file:line`
anchors.

**Verify**: you can state that a per-policy daily-USD budget field exists,
unenforced, and that ADR 0029's design does not account for it.

### Step 2: Write the implementation epic

Create `docs/product/epics/active/2026.45.00-epic-cost-governance-enforcement.md`.
Required sections:

- `<!-- AUDIENCE: Internal/Technical -->` then
  `# Epic 2026.45: Cost Governance Enforcement`.
- `## Status` → `Ready (pending ADR 0029 acceptance).`
- `## Goal` — Turn passive cost observability into active governance: budgets,
  caps, and alerts that gate runs before spend is incurred, without surprising
  operators or breaking the local default path.
- `## Problem` — Cost is recorded (`task-workbench.ts` `usageLedger.upsert`) and
  reported (`operations.ts` `computeCostSummary`, console cost components) but
  never enforced; AND a `costBudgetDailyUsd` policy field already exists unenforced
  (`policy.ts:70`) that ADR 0029 overlooked. Cite ADR 0029 as the design and ADR
  0013 (loop/tool-call limits) as the safety family this extends.
- `## Scope` — In/Out. Out of scope: redesigning provider pricing; per-user
  enforcement across distinct users until plan 025's membership lands; billing
  integration (estimates only).
- `## Story Breakdown` — Ordered `### 2026.45.0N <Title>` stories, each with
  `Purpose:` and `Acceptance:` (name a validation command from this repo):
  1. **2026.45.01 Reconcile the existing budget field** — decide and document
     whether `costBudgetDailyUsd` becomes the per-policy daily hook into the new
     model or is deprecated in favor of the `budgets` table. Acceptance: a single
     coherent budget concept; no two divergent budget fields after the epic.
  2. **2026.45.02 Budget data model** — implement ADR 0029's `budgets` table
     (scope type, scope id, period, limit_usd, action) and repository. Acceptance:
     budgets can be created/listed per scope; round-trips through app-state.
  3. **2026.45.03 Enforcement hook (pre-run)** — evaluate applicable budgets on
     the run-creation path *before* spend is incurred, mapping each budget scope to
     the existing `ListUsageLedgerOptions` filter. Implement breach actions
     (`warn` / `require-approval` reusing the approval flow / `block`). Acceptance:
     a run that would exceed a `block` budget is refused; `warn` records an alert;
     `require-approval` routes through existing approvals.
  4. **2026.45.04 Alerts + console surface** — emit alerts at thresholds (e.g.
     80%/100%) as events, and extend the operations cost surface to show
     budget/spend status. Acceptance: an over-threshold budget produces a visible
     alert in the console operations area.
  5. **2026.45.05 Per-workspace / per-user scope** — extend enforcement to
     workspace and (gated on plan 025 membership) user scope. Acceptance:
     per-workspace budgets enforce; per-user budgets enforce only once membership
     is server-derived.
- `## Sequencing And Dependencies` — 45.01 first (reconcile before building);
  45.05 per-user soft-depends on plan 025 (44.02/44.03). State that all spend is
  *estimated*, so a wrong price table must never silently block runs (surface the
  estimate basis).
- `## Acceptance Boundary` — Done when budgets enforce on the run-creation path
  with `warn`/`require-approval`/`block` actions, alerts surface, the existing
  `costBudgetDailyUsd` field is reconciled (not orphaned), and the local default
  path is unaffected when no budgets are set.

### Step 3: Append a reconciliation note to ADR 0029

Append ONE short subsection to the END of
`docs/product/architecture/decisions/0029-cost-governance-budgets-and-alerts.md`:

`## Addendum: Existing costBudgetDailyUsd Policy Field`

Two or three sentences only: note that a `costBudgetDailyUsd` field already exists
on policy (`policy.ts:70`) and is currently unenforced, that it was not accounted
for in the original decision, and that epic 2026.45 (story 2026.45.01) must
reconcile it into the budget model rather than create a parallel concept. Do NOT
rewrite any existing section of the ADR; only append this addendum.

### Step 4: Index and validate

Add ONE bullet to `docs/product/epics/README.md` under `## Active Epics`:
`- 2026.45 — Cost Governance Enforcement`.

**Verify**: `npm run check:docs` → exit 0.

## Test plan

No code tests (design/sequencing plan). Verification:

- The epic reconciles `costBudgetDailyUsd` in its first story, sequences the
  `budgets` table before enforcement, names a pre-run enforcement hook, and lists
  the three breach actions; ADR 0029 has the addendum.
- `npm run check:docs` passes.

## Done criteria

ALL must hold:

- [ ] `docs/product/epics/active/2026.45.00-epic-cost-governance-enforcement.md` exists with `## Goal`, `## Problem`, `## Scope`, `## Story Breakdown`, `## Sequencing And Dependencies`, `## Acceptance Boundary`.
- [ ] Story 2026.45.01 explicitly reconciles `costBudgetDailyUsd`, and the data-model story precedes the enforcement story.
- [ ] ADR 0029 has a new `## Addendum: Existing costBudgetDailyUsd Policy Field` subsection appended at the end, and no existing ADR section was rewritten (`git diff docs/product/architecture/decisions/0029-cost-governance-budgets-and-alerts.md` shows only an addition at the end).
- [ ] `docs/product/epics/README.md` lists `2026.45` under `## Active Epics`.
- [ ] `git diff --name-only` shows ONLY the four in-scope files (no `packages/`, no `apps/`).
- [ ] `npm run check:docs` exits 0.
- [ ] `plans/README.md` status row updated.

## STOP conditions

Stop and report back if:

- The drift check shows budget/cap/alert enforcement, a `budgets` table, or
  enforcement of `costBudgetDailyUsd` was already added since `0bd2fc8` — report
  it; re-scope to what remains.
- `grep -rn "costBudgetDailyUsd" packages/core/src` now shows a runtime
  enforcement call site — the field is no longer orphaned; adjust story 45.01.
- ADR 0029 is missing or already `Accepted` with the field reconciled — report and
  align.
- You feel you must write a migration, enforcement code, route, or console
  component to make the epic concrete — describe it as a story instead.

## Maintenance notes

- The reviewer's key check on the eventual implementation: enforcement must be on
  the run-*creation* path (before spend), and the `costBudgetDailyUsd` field must
  not survive as a second, divergent budget mechanism after 45.01.
- All spend figures are estimates from `ProviderTokenPricing`; a budget that
  silently blocks runs on a wrong price table is worse than no budget — surface the
  estimate basis in any blocking UI.
- Per-user enforcement is the one piece gated on plan 025 (server-bound
  membership); global/per-agent/per-workspace budgets do not need it.
- Deferred out of this plan: all enforcement code, the `budgets` migration, alert
  events, and console budget surfaces.
</content>
