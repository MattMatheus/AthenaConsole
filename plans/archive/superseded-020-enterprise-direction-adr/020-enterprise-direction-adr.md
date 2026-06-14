# Plan 020: Reconcile the enterprise/multi-user pivot with a directional ADR

> **Superseded by documentation cleanup.** ADR 0027 now exists and is accepted at
> `docs/product/architecture/decisions/0027-enterprise-multi-user-direction.md`.
> Do not execute this plan as written. Use plans 021-023 as the remaining
> enterprise follow-up discussion set.

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **This is a documentation / decision-framing plan.** You will NOT change any
> source code, schema, or product behavior. You write Markdown only.
>
> **Drift check (run first)**:
> `git diff --stat 635289b..HEAD -- docs/product/direction docs/product/architecture/decisions AGENTS.md`
> If any of those files changed since this plan was written, compare the
> "Current state" excerpts against the live files before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW (docs only) — but the *decision* it surfaces is high-impact
- **Depends on**: none
- **Category**: direction
- **Planned at**: commit `635289b`, 2026-06-13
- **Superseded by**: ADR 0027 accepted during documentation cleanup

## Why this matters

Team Orchestrator's canonical identity and roadmap docs say the product is a
**local-first, single-user agent orchestrator** and explicitly name hosted
multi-tenant operation and "enterprise fleet governance" as **non-goals**. But
the two most recent commits (`15d82a5` "first enterprise push", `182e9ba`
"enterprise push") shipped substantial enterprise/multi-user machinery: a
role-based authorization service with four enforcement modes, per-record
`workspace_id` scoping, a usage/cost ledger with per-user and per-workspace
spend reporting, Kubernetes-lease distributed locking, worker heartbeats, and a
Postgres migration design. A security sweep dated the same day as this plan
talks about work needed "Before Multi-User Alpha."

The code has pivoted; the docs have not. Nothing records *whether this pivot is
intentional*, and no ADR governs it. This is the highest-leverage thing to fix
because:

- Every contributor and every AI agent is told by `AGENTS.md` and
  `current-direction.md` that the product is single-user/local-first, so they
  will make decisions that fight the actual codebase.
- The enterprise capabilities are half-built (e.g. a `workspaces` table and
  default-workspace migration shipped, but there is no workspace lifecycle and
  workspace scope is still client-asserted from a request header), and without a
  decision there is no basis for sequencing or scoping the remaining work (plans
  021, 022, 023 all depend on this decision).

This plan does **not** make the strategic call for the maintainer. It produces a
**Proposed** ADR that states the divergence plainly, lays out the two coherent
paths with a recommendation, and reconciles the contradictory doc claims into an
honest "direction under active review" state until the maintainer accepts a path.

## Current state

The contradiction, with exact citations the ADR must quote:

- `docs/product/direction/IDENTITY.md:24` (under "## Positioning"):
  > The product is an agent orchestrator, not an enterprise fleet governance plane.
- `docs/product/roadmap/flight-path.md` "## Non-Goals"-equivalent — see the
  "Future Horizon Non-Goals" list in `docs/product/roadmap/future-horizon.md:161-167`:
  > - Do not make SQLite the durable product memory source of truth across machines.
  > - ...
  And `README.md:145`:
  > This project is designed for local-first development. Production deployment,
  > cloud persistence, and hosted multi-tenant operation are outside the current
  > core scope unless explicitly introduced by future architecture decisions.
  Note the escape clause: "unless explicitly introduced by future architecture
  decisions." This ADR is exactly that mechanism.
- `AGENTS.md:33-36` (under "## Current Direction") still tells every agent:
  > - SQLite is the local app-state store for v1.
  > - Local execution is preferred, with pluggable backends so cloud/API execution can be added later.

The enterprise machinery that already exists in code (cite these as evidence the
pivot is real and substantial — do NOT modify them):

- `packages/core/src/control-plane/services/authorization.ts` — ~1441-line RBAC
  authorization service. Roles are `Viewer | Operator | Admin`
  (`packages/core/src/shared/contracts/base.ts:20`). Enforcement modes are
  `off | observe | soft-enforce | enforce` (`packages/core/src/shared/config.ts:12`).
  Workspace-scoped operation checks live at `authorization.ts:1323-1390`.
- `packages/core/src/control-plane/app-state/domain-repositories/usage-ledger.ts`
  plus migration `add-usage-ledger` (`migrations.ts:580-622`) — per-run cost rows
  with `user_id`, `workspace_id`, `cost_usd`, token counts.
- Migration `add-default-workspace` (`migrations.ts:632-693`) — a `workspaces`
  table, a seeded `'default'` workspace, and `workspace_id` columns on 13 tables:
  a tenancy data model in a product whose docs forbid multi-tenancy.
- `packages/core/src/control-plane/services/operations.ts` — `computeCostSummary`
  (line ~253) aggregates spend by agent/provider/model/user/workspace.
- `packages/core/src/control-plane/distributed-lock/k8s-lease.ts` and the
  `worker_heartbeats` table (`migrations.ts`) — multi-node coordination.
- `docs/product/architecture/postgres-migration-design.md` — design to move
  app-state off single-file SQLite.
- `docs/product/security/security-critical-gap-sweep-2026-06-13.md:1-22` — sweep
  framed around "Must Fix Before Multi-User Alpha".

ADR conventions you must follow:

- ADRs live in `docs/product/architecture/decisions/NNNN-slug.md`.
- They open with `<!-- AUDIENCE: Internal/Technical -->` then `# ADR NNNN: Title`.
- Section order observed in existing ADRs (see
  `docs/product/architecture/decisions/0016-core-service-decomposition-plan.md:1-20`
  as the structural exemplar): `## Status`, `## Context`, `## Decision`, then
  decision-specific sections.
- `## Status` is a single word/phrase: `Accepted.` for accepted ADRs. **Use
  `Proposed.` for this one** — the maintainer accepts it later.
- The index file `docs/product/architecture/decisions/README.md` lists every ADR
  as a Markdown-link bullet: a dash, the bracketed label `[ADR NNNN: Title]`,
  then the target filename `NNNN-slug.md` in parentheses, then ` - Accepted`.
  **Copy the exact shape from the existing bullets in that file** rather than
  retyping it. The latest listed is ADR 0026; **ADR 0025 is missing from the
  index** (pre-existing gap — do not try to fix that here). Next free number is
  **0027**.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Drift check | `git diff --stat 635289b..HEAD -- docs/product/direction docs/product/architecture/decisions AGENTS.md` | empty or only changes you understand |
| Doc-link check | `npm run check:docs` | exit 0, "No broken links" (or equivalent) |
| Confirm ADR number free | `ls docs/product/architecture/decisions/ \| grep 0027` | no match before you create it |

## Scope

**In scope** (the only files you create or modify):

- `docs/product/architecture/decisions/0027-enterprise-multi-user-direction.md` (create)
- `docs/product/architecture/decisions/README.md` (add the index bullet)
- `docs/product/direction/current-direction.md` (add ONE short "Direction under
  review" note that links to the new ADR — do not rewrite the doc)
- `AGENTS.md` (add ONE short pointer under "## Current Direction" noting that an
  enterprise/multi-user direction is under review in ADR 0027 — do not delete the
  existing single-user statements)
- `plans/README.md` (status row)

**Out of scope** (do NOT touch, even though they look related):

- `docs/product/direction/IDENTITY.md` — do NOT flip the "not an enterprise
  fleet governance plane" line. The whole point is that the maintainer decides;
  silently rewriting identity pre-empts the decision.
- `docs/product/roadmap/flight-path.md` and `future-horizon.md` — do not rewrite
  the roadmap arcs. The ADR may *recommend* a new arc, but adding it is follow-up
  work after acceptance.
- Any file under `packages/`, `apps/`, or `bundled-plugins/` — zero code changes.
- The `flywheel/` backlog — do not create Flywheel items; this plan precedes
  Flywheel intake.

## Git workflow

- Branch: `advisor/020-enterprise-direction-adr`
- Commit message style matches the repo (short imperative; see `git log --oneline`).
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Create the Proposed ADR

Create `docs/product/architecture/decisions/0027-enterprise-multi-user-direction.md`.
Required structure and content:

- Header: `<!-- AUDIENCE: Internal/Technical -->` then
  `# ADR 0027: Enterprise And Multi-User Direction`.
- `## Status` → `Proposed.`
- `## Context` — State the divergence factually. Quote the three doc claims from
  "Current state" (IDENTITY.md:24, README.md:145, AGENTS.md single-user lines)
  and list the enterprise machinery already in code with `file:line` references
  from "Current state". Make clear the code already implements a direction the
  docs forbid, and that README.md:145's "unless explicitly introduced by future
  architecture decisions" clause is the sanctioned mechanism this ADR uses.
- `## Decision Required` — Frame the binary the maintainer must resolve:
  - **Path A — Commit to multi-user / enterprise.** The product gains a third
    roadmap arc (governance: workspaces, RBAC enforcement, cost governance,
    Postgres/multi-node durability). IDENTITY.md and the roadmap are updated to
    reflect a "local-first by default, multi-user capable when configured"
    posture. Plans 021/022/023 proceed.
    - Trade-offs to record: larger security/ops surface, multi-tenant data
      isolation becomes a correctness requirement, positioning shifts from
      "personal workbench" toward "team platform".
  - **Path B — Stay local-first; contain the enterprise machinery.** The RBAC,
    workspace scoping, cost ledger, and distributed-lock code are kept but
    explicitly gated as opt-in "trusted-server mode" features, clearly labeled
    as not the core product. IDENTITY.md's stance stands. Plans 021/022/023
    become "containment/labeling" work rather than expansion.
    - Trade-offs to record: half-built enterprise features (e.g. workspace
      scoping with no workspace entity) either get finished as opt-in or removed;
      carrying dormant enterprise code has a maintenance cost.
- `## Recommendation` — Recommend a path and say why in 3-6 sentences, grounded
  in the evidence. (Recommended framing: the code investment already made plus
  the dated "Multi-User Alpha" sweep suggest Path A is where the work is heading;
  but recommend that the maintainer confirm explicitly, because Path A changes
  the product's positioning and security obligations materially.) Make clear this
  is a recommendation, not a decision — the ADR stays `Proposed` until accepted.
- `## Consequences` — Note that ADR 0027's acceptance gates plans 021 (workspace
  entity), 022 (cost governance), and 023 (Postgres-readiness), and that until it
  is accepted those plans should not start building.

**Verify**: `ls docs/product/architecture/decisions/0027-enterprise-multi-user-direction.md` → file exists.

### Step 2: Add the ADR to the index

In `docs/product/architecture/decisions/README.md`, add a bullet to the
"## Reset ADRs" list, immediately after the ADR 0026 line. Match the exact
Markdown-link shape of the surrounding bullets (copy an existing line and edit
it): label `ADR 0027: Enterprise And Multi-User Direction`, target filename
`0027-enterprise-multi-user-direction.md`, trailing status ` - Proposed`. Use
`- Proposed`, not `- Accepted`, to match its status.

**Verify**: `grep -n "0027" docs/product/architecture/decisions/README.md` → one match.

### Step 3: Add non-destructive "under review" pointers

In `docs/product/direction/current-direction.md`, add a short note (2-3
sentences) near the top of "## Canonical Direction" stating that an
enterprise/multi-user direction is under active review and linking to
`../architecture/decisions/0027-enterprise-multi-user-direction.md`. Do not
delete or rewrite existing direction statements.

In `AGENTS.md`, under "## Current Direction", add one bullet:
`- An enterprise/multi-user direction is under review; see ADR 0027 before assuming single-user/local-only scope.`
Do not delete the existing single-user bullets.

**Verify**: `grep -rn "0027" docs/product/direction/current-direction.md AGENTS.md` → at least two matches total.

### Step 4: Validate doc links

**Verify**: `npm run check:docs` → exit 0, no broken links. (The relative links
you added must resolve. If a link is reported broken, fix the relative path; the
ADR is referenced from `current-direction.md` as
`../architecture/decisions/0027-enterprise-multi-user-direction.md`.)

## Test plan

No code tests (docs-only plan). Verification is:

- `npm run check:docs` passes (all new relative links resolve).
- The ADR contains both Path A and Path B with explicit trade-offs and a
  recommendation, and its Status is `Proposed.`.

## Done criteria

ALL must hold:

- [ ] `docs/product/architecture/decisions/0027-enterprise-multi-user-direction.md` exists, Status `Proposed.`, contains `## Decision Required`, `## Recommendation`, and quotes IDENTITY.md:24.
- [ ] `grep -c "0027" docs/product/architecture/decisions/README.md` ≥ 1.
- [ ] `grep -rc "0027" docs/product/direction/current-direction.md AGENTS.md` shows pointers added in both files.
- [ ] `git diff --name-only` shows ONLY files in the In-scope list (no `packages/`, `apps/`, `IDENTITY.md`, `flight-path.md`, or `future-horizon.md`).
- [ ] `npm run check:docs` exits 0.
- [ ] `plans/README.md` status row updated.

## STOP conditions

Stop and report back (do not improvise) if:

- The drift check shows IDENTITY.md, the roadmap docs, or the authorization /
  usage-ledger code already changed since commit `635289b` in a way that resolves
  or alters the divergence (the premise of this plan may be stale).
- You find an existing ADR (any number) that already records an
  enterprise/multi-user decision — if so, this plan is redundant; report it.
- You feel you must edit `IDENTITY.md`, the roadmap, or any code to make the plan
  coherent — that is a sign the scope is being exceeded; stop and report.
- `npm run check:docs` fails twice after fixing the obvious link path.

## Maintenance notes

For the human/agent who owns this after the change lands:

- This ADR is **Proposed**. The maintainer must accept Path A or Path B before
  plans 021/022/023 start. Whoever accepts it should flip the Status to
  `Accepted.` with the chosen path, update the README index bullet from
  `- Proposed` to `- Accepted`, and *then* do the follow-up doc work (rewrite
  IDENTITY.md / roadmap) that this plan deliberately avoided.
- A reviewer should check the ADR states the divergence honestly and does not
  quietly decide the direction.
- Deferred out of this plan (intentionally): rewriting IDENTITY.md and the
  roadmap, creating Flywheel arc items, and any code containment/expansion — all
  of which depend on which path is accepted.
