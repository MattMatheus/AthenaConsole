# Plan 043: Enforce workspace scope in durable-memory authorization

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the next
> step. If anything in the "STOP conditions" section occurs, stop and report;
> do not improvise. When done, update the status row for this plan in
> `plans/README.md` unless a reviewer dispatched you and told you they maintain
> the index.
>
> **Drift check (run first)**:
> `git diff --stat c082a64..HEAD -- packages/core/src/control-plane/services/authorization.ts packages/core/src/control-plane/services/durable-memory.ts packages/core/src/shared/contracts/durable-memory.ts packages/core/src/durable-memory/server-storage.ts packages/core/tests/control-plane.authorization.test.ts packages/core/tests/durable-memory.server-storage.test.ts`
>
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against live code. If durable-memory authorization
> already passes namespace-derived workspace ids into `ServiceAuthorizer`, stop
> and report that this plan is stale.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: HIGH
- **Depends on**: none
- **Category**: security
- **Planned at**: commit `c082a64`, 2026-06-17

## Why this matters

Durable memory records, proposals, and snapshots are namespace-scoped, and the
storage layer already derives workspace ids from those namespaces. The
authorization wrapper, however, checks only global role for durable-memory
operations, so a non-admin subject with access to one workspace can read or
mutate another workspace's durable memory if it can name the namespace or id.
This breaks the membership-backed workspace boundary.

## Current state

Relevant files:

- `packages/core/src/shared/contracts/durable-memory.ts` defines namespace-bearing
  durable-memory requests.
- `packages/core/src/durable-memory/server-storage.ts` persists
  `workspace_id`/`target_workspace_id` derived from namespaces.
- `packages/core/src/control-plane/services/authorization.ts` wraps
  `DurableMemoryService`, but does not pass any `workspaceId` to
  `ServiceAuthorizer`.
- `packages/core/tests/control-plane.authorization.test.ts` covers durable-memory
  coarse role checks, but not cross-workspace membership denial.

Namespace-bearing request contracts:

```ts
// packages/core/src/shared/contracts/durable-memory.ts:175-245
export interface DurableMemoryListRequest {
  namespace: DurableMemoryNamespaceRef;
}
export interface DurableMemorySearchRequest {
  namespace: DurableMemoryNamespaceRef;
}
export interface DurableMemoryWriteRequest {
  namespace: DurableMemoryNamespaceRef;
}
export interface DurableMemoryProposalCreateRequest {
  targetNamespace: DurableMemoryNamespaceRef;
}
export interface DurableMemorySnapshotCreateRequest {
  namespace: DurableMemoryNamespaceRef;
}
export interface DurableMemorySnapshotRestoreRequest {
  targetNamespace: DurableMemoryNamespaceRef;
}
```

Storage already derives workspace ids from namespace parents:

```ts
// packages/core/src/durable-memory/server-storage.ts:899-912
function toNamespaceStorageParts(namespace: DurableMemoryNamespaceRef): { ancestorKeys: string[]; workspaceId: string } {
  const ancestorKeys: string[] = [];
  let workspaceId = namespace.scope === "workspace" ? namespace.id : "default";
  let parent = namespace.parent;
  while (parent) {
    ancestorKeys.push(namespaceKey(parent));
    if (workspaceId === "default" && parent.scope === "workspace") {
      workspaceId = parent.id;
    }
    parent = parent.parent;
  }
  return { ancestorKeys, workspaceId };
}
```

Authorization only checks role today:

```ts
// packages/core/src/control-plane/services/authorization.ts:1351-1380
async write(request: Parameters<DurableMemoryService["write"]>[0]) {
  await this.authorizer.assertAllowed({
    operation: "durableMemory.write",
    requiredRoles: ["Operator", "Admin"]
  });
  return this.delegate.write(request);
}
```

`ServiceAuthorizer` applies per-workspace membership roles only when the
requirement has `workspaceId`:

```ts
// packages/core/src/control-plane/services/authorization.ts:239-252
if (!context.scope.global && requirement.workspaceId && context.workspaceMemberships !== undefined) {
  const membership = context.workspaceMemberships.find((entry) => entry.workspaceId === requirement.workspaceId);
  return membership ? roleSatisfies(membership.role, requirement.requiredRoles) : false;
}
```

Existing storage tests prove workspace ids are available:

```ts
// packages/core/tests/durable-memory.server-storage.test.ts:74-110
it("derives storage workspace ids from namespaces for records, proposals, and snapshots", () => {
  expect(db.prepare("select workspace_id from durable_memory_records where id = ?").get("memory-workspace")).toEqual({
    workspace_id: "workspace-1"
  });
});
```

## Commands you will need

| Purpose | Command | Expected on success |
| --- | --- | --- |
| Core typecheck | `npm --workspace @athena/core run typecheck` | exits 0 |
| Target auth tests | `npm --workspace @athena/core run test:unit -- --runInBand packages/core/tests/control-plane.authorization.test.ts` | exits 0 |
| Durable memory tests | `npm --workspace @athena/core run test:unit -- --runInBand packages/core/tests/durable-memory.server-storage.test.ts` | exits 0 |
| Core tests | `npm --workspace @athena/core run test:unit` | exits 0 |
| Diff guard | `git diff --check` | exits 0 |

If this repo's Vitest wrapper rejects `--runInBand`, use the existing package
test command's supported file filter instead. Keep the full `test:unit` gate.

## Scope

**In scope**:

- `packages/core/src/control-plane/services/authorization.ts`
- `packages/core/tests/control-plane.authorization.test.ts`
- A small exported helper for deriving workspace id from
  `DurableMemoryNamespaceRef`, if needed
- Durable-memory tests only if helper behavior is moved or exported

**Out of scope**:

- Do not redesign durable-memory namespace semantics.
- Do not change durable-memory storage schema.
- Do not add new API routes.
- Do not relax role requirements for any durable-memory operation.

## Git workflow

- Branch: `advisor/043-scope-durable-memory-authorization`
- Commit message: `Scope durable memory authorization by workspace`
- Do not push or open a PR unless the operator asks.

## Steps

### Step 1: Add a reusable namespace-to-workspace helper

Create or expose a helper that mirrors durable-memory storage's namespace
workspace derivation:

- namespace `{ scope: "workspace", id: "workspace-a" }` maps to
  `workspace-a`;
- namespace with a parent chain containing `{ scope: "workspace" }` maps to
  the first workspace parent;
- namespace with no workspace scope or parent maps to `default`.

Prefer one shared implementation over duplicating logic between storage and
authorization. If moving the helper from `server-storage.ts`, keep it internal
to durable-memory modules and avoid widening public API unnecessarily.

**Verify**:

- Add focused tests for direct workspace namespace, parent workspace namespace,
  and no workspace namespace.
- `npm --workspace @athena/core run typecheck` exits 0.

### Step 2: Pass workspace ids in `AuthorizedDurableMemoryService`

In `packages/core/src/control-plane/services/authorization.ts`, update every
durable-memory operation with a namespace or target namespace to include
`workspaceId` in the authorization requirement:

- `write`, `list`, `search`, `archive`, `delete`: derive from
  `request.namespace`;
- `createProposal`: derive from `request.targetNamespace`;
- `createSnapshot`: derive from `request.namespace`;
- `restoreSnapshot`: derive from `request.targetNamespace`;
- `listProposals`, `listSnapshots`: derive from `request.namespace`.

For operations that only carry an id (`get`, `approveProposal`, `rejectProposal`,
`archiveProposal`), do not guess from the request. Use one of these safe
patterns:

- add delegate lookup methods that load the existing record/proposal/snapshot
  first, derive its namespace workspace, authorize, then perform the action; or
- add service-layer methods that return enough metadata for the wrapper to
  authorize before returning/mutating.

Do not leave id-only operations protected only by global role if the underlying
record/proposal is workspace-owned.

**Verify**:

- `rg -n "operation: \"durableMemory" packages/core/src/control-plane/services/authorization.ts` shows each durable-memory authorization block either has a `workspaceId` or is `durableMemory.health`.
- `npm --workspace @athena/core run typecheck` exits 0.

### Step 3: Add cross-workspace authorization tests

In `packages/core/tests/control-plane.authorization.test.ts`, add tests modeled
after the existing workspace-scoped task and model-provider tests. Seed or create
durable-memory records/proposals/snapshots in `workspace-alpha` and
`workspace-beta`.

Cover at least:

- a subject with Viewer membership in `workspace-alpha` can list/search/get
  alpha memory;
- the same subject is denied listing/searching/getting beta memory;
- an Operator in `workspace-alpha` can write/create proposals for alpha memory;
- the same Operator is denied write/proposal/snapshot operations for beta memory;
- proposal approval/rejection/archive is denied when the proposal targets a
  workspace outside the subject's membership.

Use the existing helpers such as `withMembershipRole`, `withMembershipRoles`, and
`withAuthScope` rather than inventing new auth setup.

**Verify**:

- `npm --workspace @athena/core run test:unit -- --runInBand packages/core/tests/control-plane.authorization.test.ts` exits 0, or the equivalent supported file-filter command exits 0.

### Step 4: Run the durable-memory and core gates

Run the storage tests and the broader core test suite.

**Verify**:

- `npm --workspace @athena/core run test:unit -- --runInBand packages/core/tests/durable-memory.server-storage.test.ts` exits 0, or the equivalent supported file-filter command exits 0.
- `npm --workspace @athena/core run test:unit` exits 0.
- `git diff --check` exits 0.

## Test plan

Add authorization tests for both namespace-request operations and id-only
operations. The regression case is: a non-admin subject with membership in
`workspace-alpha` must not read, mutate, approve, reject, archive, snapshot, or
restore durable memory owned by `workspace-beta`.

## Done criteria

- [ ] Every durable-memory operation except health is authorized against the
  namespace-derived workspace of the affected record/proposal/snapshot.
- [ ] Cross-workspace durable-memory read and write attempts are denied.
- [ ] Existing durable-memory namespace isolation tests still pass.
- [ ] Core typecheck and unit tests pass.
- [ ] `plans/README.md` status row updated.

## STOP conditions

Stop and report back if:

- The code cannot determine the workspace for an id-only durable-memory operation
  before returning or mutating the object.
- Existing durable-memory records can have inconsistent namespace JSON and
  workspace columns, requiring a data-repair migration.
- Adding workspace authorization requires changing durable-memory public
  contract shapes.

## Maintenance notes

Future durable-memory operations must require a namespace or load the target
object before authorization. Reviewers should scrutinize id-only operations most
closely because they are easiest to leave role-only.
