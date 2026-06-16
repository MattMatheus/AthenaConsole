# Plan 025: Promote ADR 0028 into the 2026.44 workspace-lifecycle + scoped-RBAC implementation epic (spike)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **This is a design + sequencing plan.** The deliverable is an implementation
> **epic** document (a story breakdown that makes ADR 0028 buildable) plus an
> ADR-acceptance recommendation. You will NOT write production code, schemas,
> migrations, routes, or console surfaces. The only files you create/modify are
> Markdown. You MAY run read-only `grep`/`ls`.
>
> **Drift check (run first)**:
> `git diff --stat 0bd2fc8..HEAD -- docs/product/architecture/decisions/0028-workspace-lifecycle-and-scoped-rbac.md packages/core/src/control-plane/app-state/repositories.ts packages/core/src/control-plane/services/authorization.ts packages/core/src/api/middleware/auth.ts`
> If any changed since this plan was written, compare the "Current state"
> excerpts against live code before proceeding; on a mismatch, STOP.

## Status

- **Priority**: P1
- **Effort**: M (design/sequencing only) — the implementation it scopes is L
- **Risk**: LOW (design only) — the implementation it scopes is MED/HIGH
- **Depends on**: ADR 0027 (Accepted) and ADR 0028 (Proposed) — this plan
  recommends accepting ADR 0028 and builds its epic.
- **Category**: direction / security
- **Planned at**: commit `0bd2fc8`, 2026-06-13

## Why this matters

The enterprise direction (ADR 0027, **Accepted**) is parked at a design-to-build
gate. The workspace-lifecycle + scoped-RBAC **design** is already complete: ADR
0028 (`Proposed`) was produced by plan 021 and specifies workspace lifecycle, a
server-bound `workspace_members` model that replaces client-asserted scope,
referential integrity, and query-level scoping. But there is **no implementation
epic** breaking that design into buildable, sequenced stories, and the Flywheel
backlog is empty — so the work cannot start without re-deriving the sequence each
time.

This is the single highest-leverage *next* decision for the enterprise arc: it
gates multi-user exposure, per-user cost enforcement (plan 026), and the deferred
knowledge-work connectors. The security boundary is concrete and still open —
workspace scope is taken from a request header
(`packages/core/src/api/middleware/auth.ts`), not derived from server-side
membership — so until this lands, workspace scoping is a UX filter, not a tenancy
boundary, and multi-user operation must not be exposed.

This plan converts ADR 0028's design into a `2026.44` implementation epic with an
ordered story breakdown and acceptance boundaries, and records a recommendation on
ADR 0028's status. It does **not** write any of the implementation.

## Current state

Read these to confirm — do NOT modify any of them in this plan:

- **The design already exists** —
  `docs/product/architecture/decisions/0028-workspace-lifecycle-and-scoped-rbac.md`
  (Status `Proposed.`). Read it fully: it is the source design this epic
  sequences. It defines (per plan 021) workspace lifecycle CRUD, a
  `workspace_members` table for server-derived scope, a referential-integrity
  decision, and query-level scoping. Your epic must stay consistent with it and
  cite it as the source ADR.

- **What's built vs. missing today** (the facts the epic's stories target):
  - Workspace entity + seeded `'default'` workspace exist (migration version 20,
    `packages/core/src/control-plane/app-state/migrations.ts:636`). `workspace_id`
    columns exist on many tables but **no FK** to `workspaces(id)`.
  - `WorkspaceRepository`
    (`packages/core/src/control-plane/app-state/repositories.ts`, the
    `class WorkspaceRepository`) is **read-only** — `get` and `list` only, no
    create/update/delete. Confirm:
    `grep -n "class WorkspaceRepository" -A40 packages/core/src/control-plane/app-state/repositories.ts`.
  - Workspace scope is **client-asserted**:
    `packages/core/src/api/middleware/auth.ts` parses
    `x-athena-scope-workspaces` from request headers. Confirm:
    `grep -n "x-athena-scope-workspaces\|scope-workspaces" packages/core/src/api/middleware/auth.ts`.
  - Scope filtering is post-hoc:
    `packages/core/src/control-plane/services/authorization.ts`
    (`filterByWorkspaceScope`, `isWorkspaceScopedOperation`). Confirm:
    `grep -n "filterByWorkspaceScope\|isWorkspaceScopedOperation" packages/core/src/control-plane/services/authorization.ts`.
  - There is **no** `workspace_members` table. Confirm:
    `grep -rn "workspace_members" packages/core/src` → no matches.

- **Epic format to follow** — model the new file structurally on
  `docs/product/epics/active/2026.44.00-epic-workspace-lifecycle-and-scoped-rbac.md` or
  `docs/product/epics/active/2026.43.00-epic-knowledge-work-connector-pack.md`.
  Epics open with `<!-- AUDIENCE: Internal/Technical -->`, then
  `# Epic NNNN.NN: Title`, `## Status`, `## Goal`, `## Problem`, `## Scope`
  (In scope / Out of scope), then `## Story Breakdown` with subsections
  `### NNNN.NN.NN <Story Title>` each containing a `Purpose:` list and (where
  used) a `Flywheel story:` reference. The roadmap reserves **2026.44** for this
  work (`docs/product/roadmap/flight-path.md` "### 2026.44 Workspace Lifecycle
  And Scoped RBAC").

- **Epics index** — `docs/product/epics/README.md` has an `## Active Epics`
  bulleted list to add this epic to.

- **Promotion rule the epic must satisfy** —
  `docs/product/direction/current-direction.md` "## Promotion Rule": a story
  needs a source ADR/epic, acceptance criteria, and validation expectations.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Drift check | `git diff --stat 0bd2fc8..HEAD -- docs/product/architecture/decisions/0028-workspace-lifecycle-and-scoped-rbac.md` | empty or understood |
| Confirm workspace repo still read-only | `grep -n "class WorkspaceRepository" -A40 packages/core/src/control-plane/app-state/repositories.ts` | only `get`/`list`, no create/update/delete |
| Confirm no members table yet | `grep -rn "workspace_members" packages/core/src` | no matches |
| Confirm client-asserted scope | `grep -n "scope-workspaces" packages/core/src/api/middleware/auth.ts` | the header parse line |
| Doc-link check | `npm run check:docs` | exit 0 |

## Scope

**In scope** (the only files you create or modify):

- `docs/product/epics/active/2026.44.00-epic-workspace-lifecycle-and-scoped-rbac.md` (create)
- `docs/product/epics/README.md` (add ONE bullet under `## Active Epics`)
- `plans/README.md` (status row)

**Out of scope** (do NOT touch):

- Any `packages/` or `apps/` file — no code, no migrations, no routes, no console.
  The epic *describes* the build; it does not perform it.
- `0028-...rbac.md` — do NOT change ADR 0028's content. You may RECOMMEND its
  acceptance in the epic's `## Status`/notes, but the actual `Proposed → Accepted`
  status flip is an operator decision; do not edit the ADR file.
- `connected_repositories.workspace_path` (a filesystem path, not the tenancy
  `workspace_id`) — do not conflate them in the epic.

## Git workflow

- Branch: `advisor/025-workspace-rbac-implementation-epic`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Re-read ADR 0028 and confirm the build gaps

Read `0028-workspace-lifecycle-and-scoped-rbac.md` in full, then run the
confirmation greps from "Current state" to verify the four gaps the epic must
close still exist: (a) no workspace CRUD, (b) no `workspace_members` table /
server-derived scope, (c) no FK / referential integrity, (d) post-hoc rather than
query-level scoping.

**Verify**: you can state, in one line each, the current state of all four gaps
with a `file:line` anchor.

### Step 2: Write the implementation epic

Create
`docs/product/epics/active/2026.44.00-epic-workspace-lifecycle-and-scoped-rbac.md`.
Required sections:

- `<!-- AUDIENCE: Internal/Technical -->` then
  `# Epic 2026.44: Workspace Lifecycle And Scoped RBAC`.
- `## Status` → `Ready (pending ADR 0028 acceptance).` Add one line recommending
  the operator accept ADR 0028 before story 2026.44.01 starts, since the epic
  implements it.
- `## Goal` — One paragraph: make workspace a real tenancy boundary with
  server-derived membership and enforceable per-workspace RBAC, without breaking
  the single-user/local default path.
- `## Problem` — Summarize the four gaps from Step 1 with `file:line` anchors and
  the security consequence (client-asserted scope is a UX filter, not a boundary).
  Cite ADR 0027 (accepted direction) and ADR 0028 (the design).
- `## Scope` — In scope / Out of scope. Out of scope must include: hosted SaaS,
  external IdP integration beyond what ADR 0028 specifies, and any connector work
  (gated separately).
- `## Story Breakdown` — An **ordered** sequence of stories, each
  `### 2026.44.0N <Title>` with a `Purpose:` list and `Acceptance:` list. The
  order MUST ensure data exists before enforcement (never enforce scope before
  membership exists). Recommended sequence — adapt to ADR 0028's specifics:
  1. **2026.44.01 Workspace lifecycle CRUD** — extend `WorkspaceRepository` with
     create/update/delete (block deleting `'default'`), API routes, and a
     workspace-management console surface. Acceptance: multiple workspaces can be
     created/listed/deleted; `'default'` is protected.
  2. **2026.44.02 Workspace membership model** — add a `workspace_members` table
     (identity, workspace_id, per-workspace role) and repository. Acceptance: a
     user can be assigned a role on a workspace; membership is queryable.
  3. **2026.44.03 Server-derived scope** — resolve `scope.workspaces` and
     per-workspace role from membership server-side, replacing trust in the
     `x-athena-scope-workspaces` header. Acceptance: the header no longer
     determines confinement; with auth off, everything resolves to `'default'`
     (single-user path preserved). This is the security-critical story.
  4. **2026.44.04 Query-level scoping + referential integrity** — move scoping
     into repository queries where ADR 0028 calls for it, and add FKs from
     `workspace_id` columns to `workspaces(id)` (with the migration ordering from
     ADR 0028). Acceptance: cross-workspace reads are impossible at the query
     layer; orphan `workspace_id` rows cannot be written.
  5. **2026.44.05 Multi-user alpha readiness gate** — a checklist/readiness check
     confirming membership-derived scope, per-workspace RBAC, and isolation are in
     place before any multi-user exposure. Acceptance: a documented gate the
     operator must pass before enabling multi-user.
  Each story's `Acceptance:` must name the validation command(s) from this repo
  (`npm --workspace @athena/core run typecheck`,
  `npm --workspace @athena/core run test:unit`,
  `npm --workspace @athena/core run validate:manifests`,
  console `npm --workspace @athena/console run test`).
- `## Sequencing And Dependencies` — State explicitly: 44.03 must follow 44.02
  (no server-derived scope without membership data); 44.04 FKs must follow the
  backfill ordering in ADR 0028; multi-user exposure (44.05) gates everything
  downstream. Note that plan 026 (cost governance) per-user enforcement
  soft-depends on 44.02/44.03.
- `## Acceptance Boundary` — The epic is done when workspace scope is
  server-derived, per-workspace RBAC is enforced, referential integrity holds, and
  the single-user local path still works unchanged.

### Step 3: Index and validate

Add ONE bullet to `docs/product/epics/README.md` under `## Active Epics`:
`- 2026.44 — Workspace Lifecycle And Scoped RBAC`. Match the surrounding bullet
shape.

**Verify**: `npm run check:docs` → exit 0.

## Test plan

No code tests (design/sequencing plan). Verification:

- The epic has an ordered `## Story Breakdown` where membership (44.02) precedes
  server-derived scope (44.03), each story has `Purpose:` + `Acceptance:` with a
  named validation command, and the epic cites ADR 0027 and ADR 0028.
- `npm run check:docs` passes.

## Done criteria

ALL must hold:

- [ ] `docs/product/epics/active/2026.44.00-epic-workspace-lifecycle-and-scoped-rbac.md` exists with `## Goal`, `## Problem`, `## Scope`, `## Story Breakdown`, `## Sequencing And Dependencies`, `## Acceptance Boundary`.
- [ ] The story breakdown is ordered so a membership-model story precedes the server-derived-scope story, and the server-derived-scope story explicitly replaces the `x-athena-scope-workspaces` header trust.
- [ ] The epic cites ADR 0027 and ADR 0028 and recommends accepting ADR 0028 before implementation starts.
- [ ] `docs/product/epics/README.md` lists `2026.44` under `## Active Epics` (`grep -c "2026.44" docs/product/epics/README.md` ≥ 1).
- [ ] `git diff --name-only` shows ONLY the in-scope files (no `packages/`, no `apps/`, no ADR file).
- [ ] `npm run check:docs` exits 0.
- [ ] `plans/README.md` status row updated.

## STOP conditions

Stop and report back if:

- The drift check shows workspace CRUD, a `workspace_members` table, or
  server-derived scope was already added since `0bd2fc8` (the implementation may
  have started — re-scope the epic to what remains).
- ADR 0028 no longer exists or its status is already `Accepted`/`Superseded` —
  report it and align the epic's `## Status` recommendation accordingly.
- `grep -rn "workspace_members" packages/core/src` returns matches (membership
  already implemented) — report it; story 44.02 is then partly done.
- You feel you must write a migration, repository method, route, or console
  component to make the epic concrete — that is implementation, out of scope;
  describe it as a story instead.

## Maintenance notes

- The most important review point: story 2026.44.03 (server-derived scope) is the
  security-critical one. A reviewer of the eventual implementation must confirm
  `scope.workspaces` is derived from `workspace_members`, not from the
  `x-athena-scope-workspaces` header, before any multi-user exposure.
- The single-user/local default path must keep working with auth/authz off
  (everything resolves to `'default'`); call this out in every relevant story's
  acceptance so the executor of the implementation does not break it.
- This epic gates plan 026 (per-user cost enforcement) and the deferred
  knowledge-work connector arc (2026.43). Keep that dependency visible.
- Deferred out of this plan: all implementation. This plan only produces the
  buildable epic; the operator should accept ADR 0028, then route the stories
  through Flywheel per the repo's promotion rule before execution.
</content>
