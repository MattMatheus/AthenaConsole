<!-- AUDIENCE: Internal/Technical -->

# ADR 0029: Cost Governance - Budgets And Alerts

## Status

Proposed.

## Context

Team Orchestrator records usage and estimated cost, but does not govern spend.

Current behavior:

- `task-workbench.ts` writes usage rows after a run through `appState.usageLedger.upsert`.
- `usage-ledger.ts` stores run, target, task, agent, provider, model, user, workspace, tokens, optional `cost_usd`, source, and timestamps.
- `operations.ts` `computeCostSummary` reads the usage ledger for a month window and aggregates by agent, provider, model, user, workspace, and day.
- If a ledger row does not include `costUsd`, operations estimates spend from operator-maintained `ProviderTokenPricing`.
- There is no budget, cap, threshold alert, or spend-based run gating in `operations.ts`.

ADR 0013 states that risky actions need explicit approval and stuck agents need hard limits so they do not burn tokens or thrash through tools indefinitely. Cost governance is the missing spend-facing member of that safety family.

Budgets must be documented as controls over estimated spend, not provider invoices. Estimates can lag actual billing when provider pricing is stale, external billing includes non-token charges, or agents report usage incompletely.

## Decision

Team Orchestrator should add budget governance as a first-class enterprise safety control.

### Budget Scope Dimensions

Budgets should support these dimensions:

| Dimension | Minimum phase | Usage ledger filter |
| --- | --- | --- |
| Global | v1 | `windowStart`, `windowEnd` only |
| Agent | v1 | `agentId` |
| Provider | v1 | `provider` |
| Model | v1 | `provider` + `model` |
| Workspace | after ADR 0028 implementation | `workspaceId` |
| User | after ADR 0028 implementation | `userId` with server-bound identity |

Minimum viable implementation: global, per-agent, and per-provider monthly budgets. These do not require workspace membership to be correct. Workspace and user budgets should wait for ADR 0028 implementation so scope and identity are server-bound.

### Budget Period

Use calendar month for v1.

Rationale:

- `computeCostSummary` already uses a `YYYY-MM` month window.
- Calendar month is easier for admins to communicate and compare with provider bills.
- Rolling windows can follow after the monthly path is operational.

### Budget Actions

Budget breach actions should be explicit:

```ts
type BudgetBreachAction = "warn" | "require-approval" | "block";
```

- `warn`: create alert records and show readiness/console warnings, but allow runs.
- `require-approval`: require an approval before starting new matching runs after the budget is breached.
- `block`: refuse new matching runs until the budget period resets or an admin changes the budget.

Recommended defaults:

- Global: `require-approval` at 100 percent.
- Agent/provider/model: `warn` at 80 percent, `require-approval` at 100 percent.
- Workspace/user: `warn` at 80 percent, `block` at 100 percent only after ADR 0028 is implemented and admins can clearly see membership and ownership.

### Enforcement Hook Point

V1 should enforce budgets before a run starts.

The check belongs in the run readiness/run creation path before model-backed work is dispatched. This aligns with existing readiness gates and approval flows and avoids trying to interrupt in-flight agent execution.

The check should:

1. Resolve the run's target dimensions: agent, provider, model, workspace, user.
2. Load active budgets matching those dimensions for the current calendar month.
3. Query the usage ledger with each budget's scope filters and month window.
4. Estimate current spend and compare to alert/action thresholds.
5. Return readiness warnings, approval requirements, or blocking errors before the run starts.
6. Record a budget-check event with the budget ids, scope, current estimate, limit, threshold, and decision.

In-run interruption is deferred. It requires streaming usage telemetry and clearer semantics for partial outputs and cancellation.

### Alerts

Alerts are persistent governance records and run/events signals.

Recommended alert thresholds:

- 80 percent: warning.
- 100 percent: breach.

Alert behavior:

- Persist a budget alert record keyed by budget, period, threshold, and scope so the console can show active alerts without scraping events.
- Emit an event for audit and timeline visibility.
- Surface warnings in readiness, operations summary, and admin console views.
- Do not create duplicate alerts for the same budget/period/threshold unless state moves below and then above the threshold again.

### Data Model Sketch

Proposed `budgets` table:

```sql
create table budgets (
  id text primary key,
  name text not null,
  scope_type text not null,
  scope_id text,
  provider text,
  model text,
  period text not null default 'calendar_month',
  limit_usd real not null,
  warn_at_ratio real not null default 0.8,
  action text not null,
  status text not null default 'active',
  created_by text,
  workspace_id text,
  created_at text not null,
  updated_at text not null
);
```

Proposed `budget_alerts` table:

```sql
create table budget_alerts (
  id text primary key,
  budget_id text not null,
  period_start text not null,
  period_end text not null,
  threshold_ratio real not null,
  estimated_spend_usd real not null,
  limit_usd real not null,
  action text not null,
  status text not null,
  emitted_at text not null,
  acknowledged_by text,
  acknowledged_at text
);
```

## Reused Machinery

This design reuses:

- Usage ledger rows and `ListUsageLedgerOptions` filters.
- `ProviderTokenPricing` estimates and existing operations cost summary calculations.
- Run readiness gates for pre-run warnings and blocking.
- ADR 0013 approval machinery for `require-approval`.
- Event store and operations summary surfaces for audit and admin visibility.
- ADR 0028 workspace membership before workspace/user budget enforcement.

## Open Questions

- How should the console explain divergence between estimated spend and provider invoices?
- Should external provider billing totals override local estimates for global monthly budgets?
- What happens to in-flight runs when a budget crosses 100 percent mid-run?
- Should scheduled runs over budget be blocked, deferred, or converted into approval-required work?
- Who can override a blocked budget: global Admin only, workspace Admin, or both?

## Risks

- Estimated spend is not billed spend; stale pricing can over-block or under-block runs.
- Blocking runs may surprise operators unless readiness explains the budget and remediation path.
- Per-user budgets are unsafe until identity is server-bound and user ids cannot be self-asserted.
- Per-workspace budgets are unsafe until workspace membership and query scoping from ADR 0028 are implemented.
- Budget checks can add latency to run creation if ledger queries are not indexed by scope and period.

## Consequences

Cost governance becomes part of the enterprise readiness gate. Usage reporting remains useful on its own, but enterprise pilots should not rely on it as spend protection until budgets, alerts, approvals, and blocking behavior are implemented.
