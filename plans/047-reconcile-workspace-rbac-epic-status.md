# Plan 047: Reconcile workspace RBAC epic status with implemented controls

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the next
> step. If anything in the "STOP conditions" section occurs, stop and report;
> do not improvise. When done, update the status row for this plan in
> `plans/README.md` unless a reviewer dispatched you and told you they maintain
> the index.
>
> **Drift check (run first)**:
> `git diff --stat c082a64..HEAD -- docs/product/epics/active/2026.44.00-epic-workspace-lifecycle-and-scoped-rbac.md docs/conventions.md README.md docs/user-guide docs/product/architecture`
>
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against live docs. If the active epic no longer says
> workspace CRUD/membership/server-derived scope are missing, stop and report
> that this plan is stale.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: docs
- **Planned at**: commit `c082a64`, 2026-06-17

## Why this matters

The active workspace/RBAC epic still describes core workspace controls as
unbuilt, while the README and documentation conventions say those controls are
implemented. This makes it hard for executors to distinguish real remaining
enterprise gates from stale warnings. The docs should consistently say:
workspace CRUD, membership, Admin RBAC, and membership-backed scope narrowing
exist; remaining gates include domain-specific workspace ownership gaps, cost
enforcement, and Postgres/server persistence readiness.

## Current state

Relevant files:

- `docs/product/epics/active/2026.44.00-epic-workspace-lifecycle-and-scoped-rbac.md`
  still says the implementation gap is open for workspace CRUD, membership, and
  server-derived scope.
- `docs/conventions.md` explicitly forbids describing those controls as unbuilt.
- `README.md` says those controls are implemented and lists separate remaining
  readiness gates.

Stale active epic language:

```md
// docs/product/epics/active/2026.44.00-epic-workspace-lifecycle-and-scoped-rbac.md:23-42
The implementation gap is still open:

- Workspace storage exists, but lifecycle CRUD does not...
- There is no `workspace_members` table...
- Workspace scope is client-asserted...

Until this epic lands, workspace scoping is a trusted-server UX filter rather
than a tenancy boundary and multi-user operation must not be exposed.
```

Current convention says the opposite:

```md
// docs/conventions.md:85-94
Do not describe workspace membership or server-derived workspace scope as unbuilt. Those controls are implemented in the current build.

As of the current build:

- Workspace scope is derived from authenticated subject membership for non-admin users.
- `x-athena-scope-workspaces` is an optional narrowing hint; requested workspaces outside membership scope are rejected.
- `workspace_members` exists in SQLite app-state and is exposed through workspace member API routes.
```

README status:

```md
// README.md:9-13
> **Status**: Partially production-ready for trusted-server use. Workspace CRUD,
> workspace membership, Admin RBAC, and membership-backed workspace scope
> narrowing are implemented. Remaining production-readiness gates include cost
> budget enforcement, Postgres/server persistence readiness, and the operational
> hardening documented in the user guide.
```

## Commands you will need

| Purpose | Command | Expected on success |
| --- | --- | --- |
| Docs check | `npm run check:docs` | exits 0 |
| Stale language grep | `rg -n "lifecycle CRUD does not|There is no `workspace_members`|Workspace scope is client-asserted|trusted-server UX filter" docs README.md` | no stale matches except historical archive text, if any |
| Diff guard | `git diff --check` | exits 0 |

## Scope

**In scope**:

- `docs/product/epics/active/2026.44.00-epic-workspace-lifecycle-and-scoped-rbac.md`
- Nearby docs that link to or summarize epic 2026.44, only if needed for
  consistency
- `plans/README.md`

**Out of scope**:

- Do not claim all workspace tenancy work is complete. Plans 043 and 044 document
  remaining durable-memory and workflow DAG workspace gaps.
- Do not change source code.
- Do not rewrite unrelated user-guide sections.
- Do not edit archived historical docs unless broken links force it.

## Git workflow

- Branch: `advisor/047-reconcile-workspace-rbac-epic-status`
- Commit message: `Reconcile workspace RBAC epic status`
- Do not push or open a PR unless the operator asks.

## Steps

### Step 1: Update epic 2026.44 current-state language

Rewrite the stale `## Problem` and status language in
`docs/product/epics/active/2026.44.00-epic-workspace-lifecycle-and-scoped-rbac.md`
so it reflects the current build:

- workspace CRUD exists;
- `workspace_members` exists;
- non-admin workspace scope is derived from server-side membership;
- `x-athena-scope-workspaces` is an optional narrowing hint, not the source of
  authority;
- remaining work is domain-specific hardening and referential/query-level
  completeness across workspace-owned surfaces.

Mention known remaining gaps without overstating:

- durable-memory authorization must be workspace-scoped by namespace
  (plan 043);
- workflow DAG runs need workspace ownership (plan 044);
- cost enforcement and Postgres readiness remain separate epics/gates.

**Verify**:

- `rg -n "lifecycle CRUD does not|There is no `workspace_members`|Workspace scope is client-asserted|trusted-server UX filter" docs/product/epics/active/2026.44.00-epic-workspace-lifecycle-and-scoped-rbac.md` returns no matches.

### Step 2: Align cross-links and status notes

Search docs for summaries of 2026.44. Update only stale active references that
contradict `docs/conventions.md`. Keep historical notes in archives if they are
clearly dated, but do not let active docs tell executors that implemented
controls are missing.

**Verify**:

- `rg -n "workspace membership.*unbuilt|server-derived workspace scope.*unbuilt|client-asserted workspace scope|workspace scoping is .*UX filter" docs README.md` returns no active-doc stale matches.

### Step 3: Run docs verification

Run the repo docs checker and whitespace guard.

**Verify**:

- `npm run check:docs` exits 0.
- `git diff --check` exits 0.

## Test plan

Docs-only plan. The test is `npm run check:docs` plus grep checks for stale
workspace/RBAC language.

## Done criteria

- [ ] Active epic 2026.44 reflects implemented workspace CRUD, membership, Admin
  RBAC, and server-derived workspace scope narrowing.
- [ ] Remaining workspace hardening gaps are named accurately and linked or
  referenced by plan number where useful.
- [ ] No active docs contradict `docs/conventions.md` on workspace membership or
  server-derived scope.
- [ ] `npm run check:docs` and `git diff --check` pass.
- [ ] `plans/README.md` status row updated.

## STOP conditions

Stop and report back if:

- Source inspection shows `workspace_members` or server-derived scope narrowing
  has been removed.
- The active epic has already been archived, superseded, or rewritten around a
  different product milestone.
- Updating this doc requires deciding product roadmap status beyond the factual
  current-state correction.

## Maintenance notes

When plans 043 and 044 land, update this epic again if it lists them as remaining
gates. Keep the distinction sharp: membership-backed scope exists, but every
workspace-owned domain still needs its own storage/query/authorization coverage.
