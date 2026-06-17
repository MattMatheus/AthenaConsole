# Plan 037: Reconcile enterprise preview docs with implemented workspace membership

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the next
> step. If anything in the "STOP conditions" section occurs, stop and report;
> do not improvise. When done, update the status row for this plan in
> `plans/README.md` unless a reviewer dispatched you and told you they maintain
> the index.
>
> **Drift check (run first)**:
> `git diff --stat c082a64..HEAD -- README.md docs/conventions.md docs/user-guide docs/sdk/api/workspaces.md docs/sdk/api/README.md packages/core/src/api/middleware/auth.ts packages/core/src/control-plane/app-state/migrations.ts packages/core/src/api/routes/workspace-routes.ts packages/core/src/control-plane/services/workspaces.ts`
>
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code. If the docs have already been
> updated to describe membership-backed workspace scope and no longer claim that
> `workspace_members` is missing, stop and report that this plan is stale.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none
- **Category**: docs
- **Planned at**: commit `c082a64`, 2026-06-17

## Why this matters

The enterprise/multiplayer docs still describe the pre-implementation state:
workspace scope is client-asserted, there is no membership model, and
cross-workspace reads are not blocked. The code has since added
`workspace_members`, workspace-member API routes, and middleware that rejects
requested workspace scopes outside the caller's membership. Keeping the old
banner makes operators think the product is less safe than it is, and it sends
future agents toward already-completed work instead of the remaining hardening
gates.

## Current state

Relevant files:

- `README.md` carries the top-level preview banner.
- `docs/conventions.md` defines the banner authors are told to copy.
- `docs/user-guide/03-workspaces-and-multiplayer.md` is the admin-facing
  workspace status page.
- `docs/sdk/api/workspaces.md` is the HTTP reference for workspace APIs.
- `docs/sdk/api/README.md` describes scope headers.
- `packages/core/src/api/middleware/auth.ts` is the source of truth for
  request scope resolution.
- `packages/core/src/control-plane/app-state/migrations.ts` is the source of
  truth for app-state schema.
- `packages/core/src/api/routes/workspace-routes.ts` is the source of truth for
  exposed workspace routes.

Stale docs currently say:

```md
<!-- README.md:9-15 -->
> Preview - not yet enforced in the current build.
> This describes the target behavior. As of this build, workspace/multi-user
> isolation is not enforced: workspace scope is client-asserted
> (`x-athena-scope-workspaces` header), there is no membership model, and
> cross-workspace reads are not blocked at the data layer.
```

```md
<!-- docs/user-guide/03-workspaces-and-multiplayer.md:67-75 -->
The following capabilities are designed but not yet built (epic 2026.44,
stories .02-.04):

Target: a `workspace_members` table that records which users belong to which
workspaces. As of this build, no such table exists.

Target: the server determines which workspaces a request is authorized to
access based on the caller's identity and membership records ... As of this
build, the `x-athena-scope-workspaces` header is the only scope signal.
```

The implemented code says otherwise:

```ts
// packages/core/src/api/middleware/auth.ts:47-54
const memberships = await resolveMemberships(resolved, options);
return {
  ...resolved,
  workspaceMemberships: memberships,
  scope: parseScopeHeaders(req.headers, {
    adminGlobal: resolved.role === "Admin",
    memberships
  })
};
```

```ts
// packages/core/src/api/middleware/auth.ts:127-143
function resolveWorkspaceScope(
  requestedWorkspaces: string[],
  options: { adminGlobal: boolean; memberships: WorkspaceMembership[] }
): string[] {
  if (options.adminGlobal) {
    return requestedWorkspaces;
  }
  const allowed = [...new Set(options.memberships.map((membership) => membership.workspaceId))];
  if (requestedWorkspaces.length === 0) {
    return allowed;
  }
  const unauthorized = requestedWorkspaces.find((workspaceId) => !allowedSet.has(workspaceId));
  if (unauthorized) {
    throw new AthenaError("AUTHZ_DENIED", `Forbidden: workspace '${unauthorized}' is outside allowed membership scope.`);
  }
  return requestedWorkspaces;
}
```

```sql
-- packages/core/src/control-plane/app-state/migrations.ts:695-709
create table if not exists workspace_members (
  workspace_id text not null references workspaces(id),
  subject text not null,
  role text not null check (role in ('Viewer', 'Operator', 'Admin')),
  created_at text not null,
  updated_at text not null,
  primary key (workspace_id, subject)
);
```

```ts
// packages/core/src/api/routes/workspace-routes.ts:10-17
{ method: "GET", path: "/api/v1/workspaces", handler: handleListWorkspacesRoute },
{ method: "POST", path: "/api/v1/workspaces", handler: handleCreateWorkspaceRoute },
{ method: "GET", path: "/api/v1/workspaces/:id/members", handler: handleListWorkspaceMembersRoute },
{ method: "PUT", path: "/api/v1/workspaces/:id/members/:subject", handler: handleUpsertWorkspaceMemberRoute },
{ method: "DELETE", path: "/api/v1/workspaces/:id/members/:subject", handler: handleRemoveWorkspaceMemberRoute },
```

Repo documentation conventions:

- `docs/conventions.md` requires an audience tag as the first line for docs.
- Use "Team Orchestrator" in prose. `Athena` is allowed only for package names,
  CLI commands, env vars, headers, and implementation history.
- Run `npm run check:docs` after doc edits.

## Commands you will need

| Purpose | Command | Expected on success |
| --- | --- | --- |
| Find stale preview claims | `rg -n "client-asserted|no membership model|no such table|only scope signal|not yet enforced|stories \\.02" README.md docs/conventions.md docs/user-guide docs/sdk/api` | no stale claims about missing membership/server-derived scope remain |
| Docs link check | `npm run check:docs` | exits 0; reports no broken links |
| Whitespace guard | `git diff --check` | exits 0 |

## Scope

**In scope**:

- `README.md`
- `docs/conventions.md`
- `docs/user-guide/02-install-and-deploy.md`
- `docs/user-guide/03-workspaces-and-multiplayer.md`
- `docs/user-guide/04-roles-and-rbac.md`
- `docs/user-guide/07-cost-governance.md`
- `docs/user-guide/10-glossary.md`
- `docs/sdk/api/README.md`
- `docs/sdk/api/tasks-and-runs.md`
- `docs/sdk/api/workspaces.md`
- `docs/sdk/api/model-providers.md`
- `docs/sdk/api/repositories.md`
- Any other doc found by the stale-claims command above.

**Out of scope**:

- Do not change TypeScript source code or tests.
- Do not claim production-grade multi-user operation is fully complete if
  cost governance, Postgres readiness, or referential-integrity hardening still
  have active follow-up work.
- Do not delete ADRs. ADRs are historical records; add a note only if a current
  index page is misleading.

## Git workflow

- Branch: `advisor/037-reconcile-enterprise-preview-docs`
- Commit message style is concise imperative; use
  `docs: reconcile workspace membership status`.
- Do not push or open a PR unless the operator asks.

## Steps

### Step 1: Replace the preview-banner standard

Edit `docs/conventions.md` so it no longer instructs authors to copy a banner
that says there is no membership model. Replace it with a current "partial
enterprise readiness" standard:

- Built: workspace CRUD, workspace members, membership-backed narrowing of
  `x-athena-scope-workspaces` for non-admin subjects.
- Still preview or readiness-gated: production-grade multi-user exposure,
  cost-governance enforcement, Postgres/server persistence profile,
  and any workspace-owned tables that still lack referential integrity.

**Verify**: `rg -n "no membership model|no such table|only scope signal" docs/conventions.md` returns no matches.

### Step 2: Update operator/admin docs

Update `README.md` and the relevant user-guide pages so they describe current
behavior:

- The scope header is an optional narrowing hint.
- Non-admin subjects can only narrow to workspaces backed by membership rows.
- Admin subjects retain global workspace administration.
- Any remaining warning should be about the real remaining gate, not the
  completed membership/scope work.

Use `docs/user-guide/03-workspaces-and-multiplayer.md` as the main narrative
page and make other pages link to it rather than repeating long stale warnings.

**Verify**: `rg -n "client-asserted|no membership model|no such table|only scope signal" README.md docs/user-guide` returns no matches.

### Step 3: Update SDK workspace/scope docs

Update `docs/sdk/api/README.md` and `docs/sdk/api/workspaces.md`:

- Rename "Scope headers (client-asserted)" to wording like "Scope headers
  (membership-narrowing)".
- Add the three membership endpoints from `workspace-routes.ts`.
- Document that unauthorized workspace IDs in `x-athena-scope-workspaces`
  produce `AUTHZ_DENIED`.
- Keep examples using `x-athena-identity` and `Authorization` headers.

**Verify**: `rg -n "client-asserted|no role check|no membership model|stories \\.02" docs/sdk/api/README.md docs/sdk/api/workspaces.md` returns no stale workspace-scope claims.

### Step 4: Run documentation verification

Run the repo doc checker and whitespace guard.

**Verify**:

- `npm run check:docs` exits 0.
- `git diff --check` exits 0.

## Test plan

This is a docs-only plan. No unit tests are required. The regression guard is
the stale-claims search plus `npm run check:docs`.

## Done criteria

- [x] No current docs say `workspace_members` is missing.
- [x] No current docs say workspace scope is solely client-asserted.
- [x] `docs/sdk/api/workspaces.md` documents member list/upsert/delete routes.
- [x] Remaining preview warnings name only remaining unbuilt gates.
- [x] `npm run check:docs` exits 0.
- [x] `git diff --check` exits 0.
- [x] `plans/README.md` status row updated.

## STOP conditions

Stop and report back if:

- The code no longer contains the membership-backed behavior shown above.
- You discover workspace-owned record filtering is materially incomplete and
  the docs need a security judgment beyond wording cleanup.
- `npm run check:docs` fails twice after fixing obvious broken links.

## Maintenance notes

When future enterprise gates land, update `docs/conventions.md` first, then
fan that language into user and SDK docs. Avoid embedding precise implementation
status in many pages; centralize it in the workspace/multiplayer guide and link
to it.
