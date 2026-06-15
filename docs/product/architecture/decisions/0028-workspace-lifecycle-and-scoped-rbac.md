<!-- AUDIENCE: Internal/Technical -->

# ADR 0028: Workspace Lifecycle And Scoped RBAC

## Status

Accepted.

## Context

ADR 0027 accepts the enterprise and multi-user direction. That makes workspace isolation a correctness requirement rather than a UI filter.

Current main has the first pieces of a workspace model:

- Migration 20 creates `workspaces`, seeds `default`, and adds `workspace_id` columns and indexes to missions, tasks, runs, run events, artifact metadata, schedules, schedule run history, connected repositories, model provider configs, connector credential bindings, eval suites, eval runs, eval results, and usage ledger records.
- `WorkspaceRepository` exposes `get(id)` and `list()`.
- Authorization has workspace-scoped operation checks and filters some list responses by `context.scope.workspaces`.

The model is incomplete for multi-user operation:

- There is no workspace lifecycle API or repository create/update/delete path.
- There is no `workspace_members` table or server-side mapping from identity to workspace role.
- `x-athena-scope-workspaces` is still parsed from request headers, so a caller can choose their workspace scope.
- Workspace-owned records do not have foreign keys to `workspaces(id)`.
- Some filtering happens after repository reads rather than in bounded workspace-scoped queries.

The 2026-06-13 security sweep names this directly as ENTERPRISE-007: add workspace-scoped RBAC after the default workspace migration.

## Decision

Team Orchestrator should make workspaces a first-class enterprise boundary with lifecycle, membership-backed RBAC, referential integrity, and repository-level scoping.

### Workspace Lifecycle

Extend `WorkspaceRepository` with lifecycle methods:

```ts
interface WorkspaceRepository {
  get(id: string): WorkspaceRecord | undefined;
  getBySlug(slug: string): WorkspaceRecord | undefined;
  list(options?: { limit?: number; offset?: number }): WorkspaceRecord[];
  create(input: { id: string; name: string; slug: string; createdAt: string; updatedAt: string }): WorkspaceRecord;
  update(id: string, input: { name?: string; slug?: string; updatedAt: string }): WorkspaceRecord;
  delete(id: string, options?: { reassignToWorkspaceId?: string }): void;
}
```

API and console surfaces should provide admin-only workspace list, create, rename, slug update, membership management, and delete/block-delete actions.

Delete semantics:

- The `default` workspace cannot be deleted.
- A workspace with live records cannot be deleted by default.
- Reassignment is allowed only through an explicit admin operation that records an audit event and names the target workspace.
- Cascading delete is not allowed for first implementation because it can erase run/audit evidence.

### Server-Bound Membership And Scoped RBAC

Add a `workspace_members` table:

```sql
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

Authorization must derive workspace scope server-side from the authenticated subject and membership rows. The request header `x-athena-scope-workspaces` may remain as an optional narrowing hint only after membership lookup, never as the source of authority.

Role resolution should be per workspace:

- Global role remains available for local/no-auth and instance-admin operation.
- Workspace role is resolved for workspace-scoped operations.
- If a user has a global Admin role, they may administer workspaces and memberships.
- If a user has no global role but has workspace membership, their allowed operations are bounded to that workspace and role.
- If auth/authz is off, single-operator installs continue to resolve to the `default` workspace.

### Referential Integrity

Add foreign keys from workspace-owned records to `workspaces(id)` in a migration after membership exists and backfill/validation have passed.

SQLite table rebuilds may be required for existing tables. The migration should be split by domain if needed to keep rollback and validation understandable. New workspace-owned tables must include foreign keys from the start.

Writes should validate the target workspace before insert/update even before the FK migration lands, so API errors are explicit and consistent.

### Query-Level Scoping

Move workspace scoping into repository queries for list/get paths that serve operator-facing records.

Post-hoc filtering in `filterByWorkspaceScope` can remain as a defense-in-depth wrapper, but should not be the primary isolation mechanism for multi-user operation. Repository methods should accept `workspaceId` or `workspaceIds` options where a subject can see more than one workspace.

## Affected Surfaces

| Surface | Kind | Required change |
| --- | --- | --- |
| `packages/core/src/api/middleware/auth.ts` | auth | Replace trusted `x-athena-scope-workspaces` parsing with server-derived membership scope; keep header only as optional narrowing after membership lookup. |
| `packages/core/src/control-plane/auth.ts` | contract | Extend auth context so workspace memberships and per-workspace roles can be represented. |
| `packages/core/src/control-plane/services/authorization.ts` | authz | Resolve role per workspace for workspace-scoped operations; keep post-hoc filters only as defense in depth. |
| `packages/core/src/control-plane/app-state/migrations.ts` | schema | Add `workspace_members`, lifecycle indexes, write validation support, and later FK/table rebuild migrations. |
| `packages/core/src/control-plane/app-state/repositories.ts` | repository | Add workspace CRUD and membership repository methods. |
| `packages/core/src/control-plane/app-state/domain-repositories/tasks.ts` | repository | Support query-level workspace filtering for list/get/update paths. |
| `packages/core/src/control-plane/app-state/domain-repositories/runs.ts` | repository | Scope run, event, and artifact reads by workspace where called from user-facing APIs. |
| `packages/core/src/control-plane/app-state/domain-repositories/repositories.ts` | repository | Replace in-memory workspace filtering with SQL predicates. |
| `packages/core/src/control-plane/app-state/domain-repositories/model-providers.ts` | repository | Replace in-memory workspace filtering with SQL predicates. |
| `packages/core/src/control-plane/app-state/repositories.ts` connector binding repository | repository | Replace in-memory workspace filtering with SQL predicates. |
| `packages/core/src/control-plane/app-state/domain-repositories/usage-ledger.ts` | repository | Preserve workspace filters and align with membership-derived access. |
| `packages/core/src/control-plane/services/model-providers.ts` | service | Validate workspace access before create/update/delete/test. |
| `packages/core/src/control-plane/services/repositories.ts` | service | Validate workspace access before create/update/delete/inspect. |
| `packages/core/src/control-plane/services/task-workbench.ts` | service | Validate workspace access before create/update/run/readiness/run-detail/artifact reads. |
| `packages/core/src/durable-memory/server-storage.ts` | storage | Align workspace ids in memory records/proposals/snapshots with workspace membership and server-side scope rules. |
| `apps/console/src` | console | Add admin workspace and membership surfaces; ensure filters come from server-visible memberships. |

Currently workspace-scoped authorization operations include model provider create/delete/get/test/update, repository create/delete/get/inspect, and task workbench create/get/update/run/cancel/readiness/run/artifact/evidence reads.

## Migration Order

1. Add `workspace_members` and membership repository methods.
2. Seed local/default membership for configured local admin identities when auth is enabled; no-auth local installs continue to use `default`.
3. Derive request workspace scope and per-workspace role from membership.
4. Treat `x-athena-scope-workspaces` as an optional narrowing hint, not authority.
5. Add workspace lifecycle API and console admin surfaces.
6. Move list/get scoping into repository queries.
7. Add write-time workspace existence validation.
8. Add foreign keys to workspace-owned tables through domain-sized migrations.
9. Enable enforce-mode checks for multi-user alpha.

## Risks

- Client-asserted workspace headers must be closed before any multi-user exposure.
- Workspace deletion with live run, artifact, memory, usage, or audit records can destroy evidence; block by default.
- `connected_repositories.workspace_path` is a filesystem path and must not be confused with tenancy `workspace_id`.
- Existing local/no-auth installs must continue to work without workspace setup.
- FKs on existing SQLite tables may require table rebuild migrations; split by domain and validate carefully.

## Consequences

Plans that depend on user/workspace cost governance can rely on a server-bound membership model once this ADR is accepted and implemented.

Until then, workspace scope is suitable for local/trusted-server UX filtering only. It must not be marketed or exposed as a tenant isolation boundary.
