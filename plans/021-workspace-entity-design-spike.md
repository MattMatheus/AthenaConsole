# Plan 021: Design workspace lifecycle and server-bound workspace-scoped RBAC (spike)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **This is a design + spike plan.** The deliverable is a design ADR plus a
> code-grounded inventory. You will NOT add tables, change schemas, or alter
> runtime behavior. The only files you create are Markdown design docs. You MAY
> run read-only `grep`/`ls` to produce the inventory.
>
> **Drift check (run first)**:
> `git diff --stat 635289b..HEAD -- packages/core/src/control-plane/services/authorization.ts packages/core/src/control-plane/app-state/migrations.ts packages/core/src/control-plane/app-state/repositories.ts packages/core/src/api/middleware/auth.ts`
> If any of those changed since this plan was written, compare the "Current
> state" excerpts against live code before proceeding; on a mismatch, STOP.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: LOW (design only) — the implementation it scopes is MED/HIGH
- **Depends on**: ADR 0027 accepted
- **Category**: direction / security
- **Planned at**: commit `635289b`, 2026-06-13

## Why this matters

The enterprise push (`182e9ba`) already built the workspace *entity* and the
default-workspace migration — a `workspaces` table, a seeded `'default'`
workspace, `workspace_id` columns on 13 tables, and usage-ledger backfill. So
the data model for tenancy exists. But the multi-user story is **structurally
incomplete and has a security footgun**:

1. **No workspace lifecycle.** `WorkspaceRepository` exposes only `get` and
   `list` — there is no create/update/delete. The only workspace that can ever
   exist is the seeded `'default'`. Multi-workspace operation is impossible
   today despite all the scoping plumbing.
2. **Workspace scope is client-asserted, not server-bound.** The authorizer
   filters by `scope.workspaces`, but that list comes straight from the
   `x-athena-scope-workspaces` HTTP request header (`auth.ts:81`). There is no
   `workspace_members` table mapping an identity to a role on a workspace. A
   caller chooses their own workspace scope. This is a UX filter, not a tenancy
   boundary — fine for single-user, unsafe the moment the product is multi-user.
   (The prior improve run flagged the same self-asserted-scope pattern at
   `auth.ts:36` as "a design footgun if scopes are ever relied on for
   confinement" — multi-user is exactly that condition.)
3. **No referential integrity.** No `workspace_id` column has a foreign key to
   `workspaces(id)`, so rows can reference a workspace that does not exist.

The 2026-06-13 security sweep names the missing piece directly:

> Add workspace-scoped RBAC after the default workspace migration (ENTERPRISE-007).

The default-workspace migration it was waiting on is now done — so this is the
literal next step. This plan designs that step: workspace lifecycle plus
server-derived, membership-backed workspace-scoped RBAC, with a complete
code-grounded inventory so the implementation is a known quantity.

## Current state

What already exists (read these to confirm — do NOT modify):

- **Workspace entity + default migration** — `migrations.ts:632-693`, migration
  version 20 `add-default-workspace`:
  ```sql
  create table if not exists workspaces (
    id text primary key,
    name text not null,
    slug text not null unique,
    created_at text not null,
    updated_at text not null
  );
  insert into workspaces (id, name, slug, created_at, updated_at)
  values ('default', 'Default Workspace', 'default', '1970-01-01T00:00:00.000Z', '1970-01-01T00:00:00.000Z')
  on conflict(id) do nothing;
  alter table missions add column workspace_id text not null default 'default';
  -- ... 12 more tables get workspace_id NOT NULL default 'default' ...
  update usage_ledger set workspace_id = 'default' where workspace_id is null or workspace_id = '';
  -- ... workspace indexes ...
  ```
  The current max migration version is **20**. Note: no FK to `workspaces(id)`
  on any of those columns.

- **Workspace repository (read-only)** —
  `packages/core/src/control-plane/app-state/repositories.ts:228-255`,
  `class WorkspaceRepository` has only `get(id)` and `list()`. No create/update/
  delete. Wired into `AppStateDatabase` at `database.ts:45,94` as `workspaces`.

- **Scope filtering** —
  `packages/core/src/control-plane/services/authorization.ts:1374-1390`
  (`filterByWorkspaceScope`, `workspaceScopeIds`) filters lists by
  `item.workspaceId` against `context.scope.workspaces`. The scoped operation
  list is `authorization.ts:1323-1344` (`isWorkspaceScopedOperation`).

- **Scope source (the footgun)** — `packages/core/src/api/middleware/auth.ts:81`:
  ```ts
  const workspaces = parseScopeList(headers["x-athena-scope-workspaces"]);
  ```
  i.e. workspace scope is taken from a request header, not derived from
  server-side membership.

- **RBAC roles are global** — `AthenaRbacRole = "Viewer" | "Operator" | "Admin"`
  (`packages/core/src/shared/contracts/base.ts:20`); the identity→role map is
  global (`config.ts` `identityRoleMap`), with no per-workspace dimension.

Migration conventions (from `migrations.ts`): objects in an array with integer
`version` (monotonic; next is 21), kebab `name`, and `sql`; tables use
`create table if not exists`. ADR conventions: see ADR conventions and
`docs/product/architecture/decisions/0016-core-service-decomposition-plan.md:1-20`.
Next free ADR number after 0027 is **0028**.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Drift check | `git diff --stat 635289b..HEAD -- packages/core/src/control-plane` | empty or understood |
| Inventory: workspace_id touchpoints | `grep -rn "workspaceId\|workspace_id" packages/core/src --include=*.ts` | a list you paste into the design doc |
| Inventory: scoped operations | `grep -n "isWorkspaceScopedOperation" -A25 packages/core/src/control-plane/services/authorization.ts` | the scoped-operation list (1323-1344) |
| Confirm no workspace CRUD | `grep -rn "insert into workspaces\|update workspaces\|delete from workspaces" packages/core/src` | only the migration-20 seed insert |
| Doc-link check | `npm run check:docs` | exit 0 |

## Scope

**In scope** (the only files you create or modify):

- `docs/product/architecture/decisions/0028-workspace-lifecycle-and-scoped-rbac.md` (create)
- `docs/product/architecture/decisions/README.md` (add index bullet, `- Proposed`)
- `plans/README.md` (status row)

**Out of scope** (do NOT touch):

- `migrations.ts`, `repositories.ts`, `authorization.ts`, `auth.ts`, any contract
  or console file — no code. Design only; schema/code changes are a follow-up
  implementation epic gated on ADR 0027 + ADR 0028 acceptance.
- `connected_repositories.workspace_path` (`migrations.ts:407`) — that is a
  filesystem path, not the tenancy `workspace_id`; do not conflate or propose
  renaming it.

## Git workflow

- Branch: `advisor/021-workspace-lifecycle-scoped-rbac-design`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Produce the workspace-touchpoint inventory

Run the inventory commands and capture the results to embed in the design doc:

1. `grep -rn "workspaceId\|workspace_id" packages/core/src --include=*.ts`
   → every column, contract field, parser, and service reference.
2. `grep -n "isWorkspaceScopedOperation" -A25 packages/core/src/control-plane/services/authorization.ts`
   → the operations that are workspace-scoped today (1323-1344).
3. `grep -rn "filterByWorkspaceScope\|resolveMutationWorkspaceId\|resolveListWorkspaceId" packages/core/src --include=*.ts`
   → every call site relying on scope filtering.
4. Confirm which `workspace_id` columns lack a FK (all of them, per migration 20)
   and which list/get queries do NOT yet scope by workspace.

**Verify**: you have a concrete list (not prose) of every touchpoint.

### Step 2: Write the design ADR

Create `docs/product/architecture/decisions/0028-workspace-lifecycle-and-scoped-rbac.md`
with structure matching existing ADRs. Required sections:

- Header + `# ADR 0028: Workspace Lifecycle And Scoped RBAC`.
- `## Status` → `Proposed.`
- `## Context` — State what exists (cite migration 20, read-only
  `WorkspaceRepository`) and the three gaps (no lifecycle, client-asserted scope
  at `auth.ts:81`, no FK). Quote the ENTERPRISE-007 sweep line and note this ADR
  depends on ADR 0027.
- `## Decision` — Design:
  1. **Workspace lifecycle.** Extend `WorkspaceRepository` with create/update/
     delete (specify method signatures), plus the API routes and console surface
     needed to manage workspaces. Define delete semantics (block delete of
     `'default'`; what happens to rows in a deleted workspace — block, reassign,
     or cascade).
  2. **Server-bound membership & scoped RBAC.** Design a `workspace_members`
     table (identity, workspace_id, role) so a user's `scope.workspaces` and
     per-workspace role are **derived server-side from membership**, replacing
     trust in the `x-athena-scope-workspaces` header. Specify how the authorizer
     should resolve role *per workspace* rather than globally. Address backward
     compatibility: single-user/no-auth installs must keep working (e.g. when
     auth/authz is off, everything resolves to `'default'`).
  3. **Referential integrity.** Decide whether to add FKs from `workspace_id`
     columns to `workspaces(id)` (migration 21+), and validation on writes.
  4. **Query-level scoping.** Decide whether scoping should move from post-hoc
     `filterByWorkspaceScope` into the repository queries themselves, and list
     which list/get paths currently lack scoping (from Step 1).
- `## Affected Surfaces` — Paste the Step 1 inventory as a table: file, kind
  (table / contract / service / authz / route / console), and what changes.
- `## Migration Order` — A numbered sequence (members table → derive scope
  server-side → enforce → add FKs) so enforcement never precedes membership data.
- `## Risks` — Call out: the client-asserted-header footgun must be closed before
  any multi-user exposure; deleting a workspace with live data; the
  `workspace_path` vs `workspace_id` naming collision; backward compatibility for
  single-user installs.

### Step 3: Index and validate

Add a bullet to `docs/product/architecture/decisions/README.md` in the "## Reset
ADRs" list, matching the exact Markdown-link shape of the surrounding bullets
(copy an existing line and edit it): label `ADR 0028: Workspace Lifecycle And
Scoped RBAC`, target filename `0028-workspace-lifecycle-and-scoped-rbac.md`,
trailing status ` - Proposed`.

**Verify**: `npm run check:docs` → exit 0.

## Test plan

No code tests (design plan). Verification:

- The ADR contains workspace lifecycle method signatures, a `workspace_members`
  table design with server-derived scope, a referential-integrity decision, and
  the full affected-surfaces inventory produced from real greps in Step 1.
- `npm run check:docs` passes.

## Done criteria

ALL must hold:

- [ ] `docs/product/architecture/decisions/0028-workspace-lifecycle-and-scoped-rbac.md` exists, Status `Proposed.`, has `## Decision`, `## Affected Surfaces`, `## Migration Order`.
- [ ] The `## Decision` section addresses all three gaps (lifecycle, server-bound membership replacing the `x-athena-scope-workspaces` header trust, referential integrity) and references `auth.ts:81` and `WorkspaceRepository`.
- [ ] The `## Affected Surfaces` section lists every `workspace_id`/`workspaceId` touchpoint found by `grep` in Step 1 (the count in the doc matches the grep output count).
- [ ] `grep -c "0028" docs/product/architecture/decisions/README.md` ≥ 1.
- [ ] `git diff --name-only` shows ONLY the three in-scope files (no `packages/`, no `migrations.ts`).
- [ ] `npm run check:docs` exits 0.
- [ ] `plans/README.md` status row updated.

## STOP conditions

Stop and report back if:

- The drift check shows workspace CRUD, a `workspace_members` table, or
  server-derived scope was already added since `635289b` (the design may already
  be partly implemented — re-scope to what remains).
- `grep` shows `WorkspaceRepository` now has create/update/delete (lifecycle
  already shipped) — report it; the lifecycle portion of this plan is redundant.
- ADR 0027 does not exist — this plan references it; restore or recreate the
  enterprise direction ADR before proceeding.
- You feel you must edit `migrations.ts`, `repositories.ts`, `authorization.ts`,
  or `auth.ts` to make the design concrete — that is implementation, which is
  out of scope; describe it in the ADR instead.

## Maintenance notes

- This ADR is `Proposed` and **gated on ADR 0027**. ADR 0027 accepts the
  enterprise direction; this plan designs the workspace lifecycle and scoped
  RBAC work needed before multi-user exposure.
- The single most important review point: the implementer must make
  `scope.workspaces` **server-derived from membership** before any multi-user
  exposure. As long as it comes from the `x-athena-scope-workspaces` header,
  workspace scoping is a UX filter, not a security boundary.
- The implementer of any FK/enforcement migration must follow `## Migration
  Order` — membership data before enforcement — or existing rows fail validation.
- Deferred out of this plan: workspace CRUD code, the `workspace_members` table,
  authorizer changes, FK migrations, and the workspace-management console.
