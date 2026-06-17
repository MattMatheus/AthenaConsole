# Plan 035: Derive workspace scope from server-side membership

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report; do not improvise. When done, update the status row for this plan in
> `plans/README.md` unless a reviewer dispatched you and told you they maintain
> the index.
>
> **Drift check (run first)**:
> `git diff --stat 54f2135..HEAD -- README.md docs/product/architecture/decisions/0028-workspace-lifecycle-and-scoped-rbac.md packages/core/src/control-plane/auth.ts packages/core/src/api/middleware/auth.ts packages/core/src/api/server.ts packages/core/src/control-plane/services/authorization.ts packages/core/src/control-plane/services/workspaces.ts packages/core/src/control-plane/app-state packages/core/src/shared/contracts/workspaces.ts packages/core/src/api/request-parsers/workspaces.ts packages/core/src/api/routes/workspace-routes.ts packages/core/tests`
>
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding. If a
> complete server-side workspace membership model already exists, stop and
> report that this plan is stale.

## Status

- **Priority**: P1
- **Effort**: L
- **Risk**: HIGH
- **Depends on**: none; recommended after plan 034
- **Category**: security
- **Planned at**: commit `54f2135`, 2026-06-16

## Why this matters

The docs correctly warn that workspace isolation is not enforced today:
workspace scope is accepted from request headers, there is no membership table,
and cross-workspace reads are not a tenancy boundary. That is acceptable only for
local/trusted operators using workspace filters as UX. To make the Team
Orchestrator trusted-server direction safe, the server must derive allowed
workspaces and workspace roles from authenticated subject membership, then treat
the request header as a narrowing hint at most.

## Current state

Relevant files:

- `README.md` carries the current safety banner for workspace/multi-user
  exposure.
- `docs/product/architecture/decisions/0028-workspace-lifecycle-and-scoped-rbac.md`
  is the accepted design for workspace lifecycle and scoped RBAC.
- `packages/core/src/api/middleware/auth.ts` parses identity, role, and scope
  headers into the request auth context.
- `packages/core/src/control-plane/auth.ts` defines the auth context and
  `ScopeSet`.
- `packages/core/src/control-plane/services/authorization.ts` resolves roles and
  filters records by `ScopeSet`.
- `packages/core/src/control-plane/services/workspaces.ts` currently implements
  workspace CRUD only.
- `packages/core/src/control-plane/app-state/*` contains SQLite migrations and
  repositories.

The product-level warning is explicit:

```md
<!-- README.md:9-15 -->
> Preview - not yet enforced in the current build.
> This describes the target behavior. As of this build, workspace/multi-user
> isolation is not enforced: workspace scope is client-asserted
> (`x-athena-scope-workspaces` header), there is no membership model, and
> cross-workspace reads are not blocked at the data layer. Tracking: epic
> 2026.44 stories .02-.04. Do not expose a shared/multi-user deployment to
> untrusted users until these land.
```

The middleware currently trusts scope headers:

```ts
// packages/core/src/api/middleware/auth.ts:77-89
function parseScopeHeaders(headers: IncomingMessage["headers"], adminGlobal: boolean): ScopeSet {
  const agents = parseScopeList(headers["x-athena-scope-agents"]);
  const sessionIds = parseScopeList(headers["x-athena-scope-sessions"]);
  const runIds = parseScopeList(headers["x-athena-scope-runs"]);
  const workspaces = parseScopeList(headers["x-athena-scope-workspaces"]);
  const globalHeader = parseScopeGlobal(headers["x-athena-scope-global"]);
  return {
    global: adminGlobal || globalHeader,
    agents,
    sessionIds,
    runIds,
    workspaces
  };
}
```

ADR 0028 defines the target membership model:

```sql
-- docs/product/architecture/decisions/0028-workspace-lifecycle-and-scoped-rbac.md:59-73
create table workspace_members (
  workspace_id text not null references workspaces(id),
  subject text not null,
  role text not null check (role in ('Viewer', 'Operator', 'Admin')),
  created_at text not null,
  updated_at text not null,
  primary key (workspace_id, subject)
);

create index workspace_members_subject_idx
  on workspace_members(subject, workspace_id);
```

The same ADR states the authorization rule:

```md
<!-- docs/product/architecture/decisions/0028-workspace-lifecycle-and-scoped-rbac.md:75-83 -->
Authorization must derive workspace scope server-side from the authenticated
subject and membership rows. The request header `x-athena-scope-workspaces` may
remain as an optional narrowing hint only after membership lookup, never as the
source of authority.

Role resolution should be per workspace:
- Global role remains available for local/no-auth and instance-admin operation.
- Workspace role is resolved for workspace-scoped operations.
- If a user has a global Admin role, they may administer workspaces and memberships.
- If a user has no global role but has workspace membership, their allowed
  operations are bounded to that workspace and role.
- If auth/authz is off, single-operator installs continue to resolve to the
  `default` workspace.
```

`createApiServer` currently constructs services before auth middleware, which is
useful for injecting a membership resolver:

```ts
// packages/core/src/api/server.ts:89-93
export function createApiServer(options: ApiServerOptions): ApiServerHandle {
  initializeApplicationInsights(options.config);
  const services = options.services ?? createLocalControlPlaneServices({ config: options.config });
  const authMiddleware = createIdentityExtractionMiddleware(options.config);
  const host = options.host ?? "127.0.0.1";
  const port = options.port ?? 8787;
```

Workspace CRUD exists, but membership CRUD/resolution does not:

```ts
// packages/core/src/control-plane/services/workspaces.ts:17-31
export class LocalWorkspaceService implements WorkspaceService {
  constructor(private readonly config: AthenaConfig) {}

  async list(): Promise<WorkspaceListResult> {
    return this.withAppState((appState) => {
      const workspaces = appState.workspaces.list().map(mapWorkspaceRecord);
      return {
        workspaces,
        total: workspaces.length
      };
    });
  }

  async get(id: string): Promise<Workspace> {
```

## Commands you will need

| Purpose | Command | Expected on success |
| --- | --- | --- |
| Core typecheck | `npm --workspace @athena/core run typecheck` | exit 0, no TypeScript errors |
| Core tests | `npm --workspace @athena/core run test:unit` | exit 0, all core tests pass |
| Auth-focused tests | `npm --workspace @athena/core run test:unit -- auth` | exit 0; use only if vitest filter matches local test names |
| Manifest/schema guard | `npm --workspace @athena/core run validate:manifests && npm --workspace @athena/core run check:schemas` | exit 0 |
| Whitespace guard | `git diff --check` | exit 0 |

## Scope

**In scope**:

- `packages/core/src/control-plane/app-state/migrations.ts`
- `packages/core/src/control-plane/app-state/repositories.ts`
- `packages/core/src/control-plane/app-state/domain-repositories/*` only where
  needed for first-pass query-level workspace predicates on operator-facing
  records
- `packages/core/src/control-plane/auth.ts`
- `packages/core/src/api/middleware/auth.ts`
- `packages/core/src/api/server.ts`
- `packages/core/src/control-plane/services/authorization.ts`
- `packages/core/src/control-plane/services/workspaces.ts`
- `packages/core/src/api/request-parsers/workspaces.ts`
- `packages/core/src/api/routes/workspace-routes.ts`
- `packages/core/src/shared/contracts/workspaces.ts`
- `packages/core/tests/*.test.ts` for app-state migration/repository,
  middleware, authorization, and workspace route regressions

**Out of scope**:

- Do not add Postgres support or change the SQLite backend abstraction.
- Do not rebuild every workspace-owned table to add foreign keys in this plan.
  Add `workspace_members` now and perform explicit write/read validation; table
  rebuild/FK migrations can follow once membership-derived scope is proven.
- Do not build a full console membership UI unless an existing API test requires
  a contract adjustment. Server safety is the objective.
- Do not change public task/run/mission response shapes except to add documented
  workspace membership endpoints if needed.

## Git workflow

- Branch: `advisor/035-server-derived-workspace-scope`
- Commit when the plan is complete and verified. An acceptable message is
  `Derive workspace scope from membership`.
- Do not push or open a PR unless the operator asks.

## Steps

### Step 1: Add app-state membership storage

Add a SQLite migration for `workspace_members` matching ADR 0028:

- `workspace_id text not null references workspaces(id)`
- `subject text not null`
- `role text not null check (role in ('Viewer', 'Operator', 'Admin'))`
- `created_at text not null`
- `updated_at text not null`
- primary key `(workspace_id, subject)`
- index `workspace_members_subject_idx on workspace_members(subject, workspace_id)`

Add repository methods in the same style as the existing `workspaces`
repository. Required operations:

- `listMembers(workspaceId)`
- `getMember(workspaceId, subject)`
- `listMembershipsForSubject(subject)`
- `upsertMember({ workspaceId, subject, role })`
- `removeMember(workspaceId, subject)`

Normalize subjects the same way identity headers are normalized today. If the
repo has no subject normalization helper, create one small helper in the auth or
workspace service layer and reuse it consistently.

Seed local/default behavior:

- When auth/authz is disabled, preserve existing local behavior by returning the
  default workspace as globally accessible to the single operator.
- When auth/authz is enabled and a subject has a global Admin role, do not
  require explicit membership to administer workspaces.
- If config exposes configured admin identities, seed or derive default
  membership only for those identities. Do not grant all authenticated subjects
  default Admin.

**Verify**:

```sh
npm --workspace @athena/core run typecheck
npm --workspace @athena/core run test:unit -- app-state
```

Expected: typecheck exits 0; app-state tests pass. If there is no `app-state`
filter match, run the specific migration/repository test file you added.

### Step 2: Extend workspace service/contracts for membership management

Extend workspace contracts and routes to expose membership management for Admins:

- `GET /api/v1/workspaces/:id/members`
- `PUT /api/v1/workspaces/:id/members/:subject`
- `DELETE /api/v1/workspaces/:id/members/:subject`

Match existing route/request-parser conventions in
`packages/core/src/api/routes/workspace-routes.ts` and
`packages/core/src/api/request-parsers/workspaces.ts`. Use role values
`Viewer`, `Operator`, `Admin` exactly, matching `AthenaRbacRole`.

Authorize membership management as Admin-only. Global Admin can manage any
workspace. A workspace Admin may manage membership only for that workspace if the
authorizer already supports per-workspace roles by the time this step is wired;
otherwise start with global Admin only and document the narrower workspace Admin
support in the maintenance notes.

**Verify**:

```sh
npm --workspace @athena/core run typecheck
npm --workspace @athena/core run test:unit -- workspaces
```

Expected: exit 0; workspace tests include create/list/update/delete plus new
membership cases.

### Step 3: Derive request workspace scope on the server

Change `createIdentityExtractionMiddleware` so workspace scope is not trusted
from the client.

Recommended shape:

- Add an options parameter to `createIdentityExtractionMiddleware(config, options)`
  with a `resolveWorkspaceMemberships(subject)` function or equivalent.
- In `createApiServer`, pass a resolver built from the local services or app-state
  repository. Services are created before middleware at `api/server.ts:91`, so
  the resolver can come from `services.workspaceService` if that interface exposes
  it.
- Parse `x-athena-scope-workspaces` as a requested narrowing hint only.
- Resolve allowed memberships for the authenticated subject server-side.
- Set `ScopeSet.workspaces` to the intersection of requested header values and
  server-derived memberships.
- If a request names a workspace in `x-athena-scope-workspaces` that the subject
  is not a member of, reject the request with an authorization error instead of
  silently widening or narrowing.
- Stop honoring `x-athena-scope-global` for non-admin subjects. Client input must
  not make `scope.global` true. Global scope should come from resolved Admin
  posture or auth disabled/local mode.

Keep the existing agent/session/run scope header behavior unless it depends on
workspace membership. This plan is about workspace scope.

**Verify**:

```sh
npm --workspace @athena/core run typecheck
npm --workspace @athena/core run test:unit -- api.auth-middleware
```

Expected: exit 0; tests prove a non-admin subject cannot self-assert another
workspace through `x-athena-scope-workspaces` or `x-athena-scope-global`.

### Step 4: Resolve authorization role per workspace

Extend the auth context in `packages/core/src/control-plane/auth.ts` so it can
represent workspace memberships and roles. Then update
`packages/core/src/control-plane/services/authorization.ts`:

- For non-workspace-scoped operations, preserve existing global role behavior.
- For operations with `metadata.workspaceId`, allow if either:
  - the subject has a global role satisfying `allowedRoles`, or
  - the subject has a membership role for that workspace satisfying
    `allowedRoles`.
- For list operations without one workspace id, filter records to the
  server-derived workspace set. Do not widen based on headers.
- Keep `authz.mode = "off"` local behavior working.

Use the existing role hierarchy and error type conventions. Do not create a
second role enum.

**Verify**:

```sh
npm --workspace @athena/core run test:unit -- control-plane.authorization
```

Expected: exit 0; tests include per-workspace Viewer/Operator/Admin role
resolution.

### Step 5: Add first-pass query-level scoping for high-risk reads

ADR 0028 says post-hoc `filterByWorkspaceScope` should become defense in depth,
not the primary isolation mechanism. In this plan, add query-level workspace
predicates for the highest-risk operator-facing list/get paths that already carry
workspace IDs:

- task workbench list/get/update/run/readiness/run-detail/artifact/evidence reads
- connected repositories list/get/inspect
- model provider list/get/test/update/delete
- run/event/artifact reads where reachable from task or mission workbench APIs

Do this by extending existing repository methods with `workspaceId` or
`workspaceIds` options. Preserve existing public service method signatures where
possible; pass scope options internally from the authorized service layer.

If touching all listed domains becomes too broad, complete task workbench,
repositories, and model providers first, then stop and report the remaining
run/event/artifact scoping as a follow-up. Do not claim multi-user isolation is
complete if any user-facing read path remains only client-filtered.

**Verify**:

```sh
npm --workspace @athena/core run typecheck
npm --workspace @athena/core run test:unit
```

Expected: exit 0; tests include cross-workspace denial/list filtering for each
domain changed.

### Step 6: Preserve local and admin behavior

Add regression tests for compatibility:

- Auth/authz off: existing local calls without membership setup still work
  against the default workspace.
- Global Admin: can list all workspaces, manage members, and perform operations
  across workspaces.
- Subject with memberships in workspace A and B can narrow to A through
  `x-athena-scope-workspaces`.
- Subject with membership in A receives denial when narrowing to B.
- Subject with workspace Viewer cannot run/create/update workspace work.
- Subject with workspace Operator can run/create/update workspace work but cannot
  manage workspace membership unless you intentionally support workspace Admin
  management in step 2.

**Verify**:

```sh
npm --workspace @athena/core run test:unit -- api.auth-middleware
npm --workspace @athena/core run test:unit -- control-plane.authorization
```

Expected: exit 0.

### Step 7: Full verification and docs alignment

Run:

```sh
npm --workspace @athena/core run typecheck
npm --workspace @athena/core run test:unit
npm --workspace @athena/core run validate:manifests
npm --workspace @athena/core run check:schemas
git diff --check
```

Expected: every command exits 0.

After the code is verified, update only the README warning if the acceptance
boundary truly changed. If membership-derived scope is implemented but FK/table
rebuild migrations are still deferred, keep a narrowed warning that says
membership-derived scope exists but full data-layer referential integrity is
still pending. Do not remove the warning entirely unless cross-workspace reads
are blocked at the data layer for all user-facing workspace-owned records.

## Test plan

Add tests in the existing core test suite:

- Migration/repository tests for `workspace_members`, including uniqueness,
  role validation, subject lookup, and delete.
- Workspace route tests for Admin membership list/upsert/delete and non-Admin
  denial.
- Auth middleware tests proving workspace headers narrow only after membership
  lookup and cannot widen access.
- Authorization tests proving per-workspace role resolution for Viewer,
  Operator, Admin, global Admin, and auth-off local mode.
- Repository/service tests proving cross-workspace reads and writes are denied
  or filtered for task workbench, connected repositories, model providers, and
  any run/artifact path changed.

## Done criteria

All must hold:

- [ ] `workspace_members` exists in app-state migrations and repository tests.
- [ ] `x-athena-scope-workspaces` is no longer the source of authority; it only
      narrows server-derived memberships.
- [ ] `x-athena-scope-global` cannot make a non-admin request global.
- [ ] Authorization can resolve role per workspace for workspace-scoped
      operations.
- [ ] Non-member cross-workspace access is denied or filtered in the high-risk
      user-facing domains listed in step 5.
- [ ] Auth/authz off local mode still works without membership setup.
- [ ] Global Admin behavior is preserved.
- [ ] `npm --workspace @athena/core run typecheck` exits 0.
- [ ] `npm --workspace @athena/core run test:unit` exits 0.
- [ ] `npm --workspace @athena/core run validate:manifests` exits 0.
- [ ] `npm --workspace @athena/core run check:schemas` exits 0.
- [ ] `git diff --check` exits 0.
- [ ] `plans/README.md` status row for plan 035 is updated.

## STOP conditions

Stop and report if:

- The live auth context or middleware already implements server-derived
  workspace membership and this plan is stale.
- Implementing server-derived scope requires a broad public API response-shape
  redesign.
- Existing config has no reliable subject identity when auth is enabled; do not
  invent anonymous multi-user membership semantics.
- Query-level scoping requires rewriting unrelated repository layers beyond the
  high-risk domains in step 5.
- Any migration would drop or rewrite existing workspace-owned audit/run/artifact
  evidence.
- Any verification command fails twice after a reasonable fix attempt.

## Maintenance notes

This plan deliberately does not finish every ADR 0028 data-integrity item. After
it lands, the next security hardening step is FK/table-rebuild migrations for all
workspace-owned records and a final removal of preview warnings only when
cross-workspace reads are blocked at the data layer. Reviewers should scrutinize
silent widening: any missing membership lookup should fail closed, not fall back
to client-provided workspace scope.
