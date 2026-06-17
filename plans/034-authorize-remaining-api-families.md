# Plan 034: Add authorization wrappers for remaining API families

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report; do not improvise. When done, update the status row for this plan in
> `plans/README.md` unless a reviewer dispatched you and told you they maintain
> the index.
>
> **Drift check (run first)**:
> `git diff --stat 54f2135..HEAD -- packages/core/src/control-plane/services.ts packages/core/src/control-plane/services/authorization.ts packages/core/src/control-plane/interfaces.ts packages/core/src/api/routes packages/core/tests/control-plane.authorization.test.ts packages/core/tests/api.auth-middleware.test.ts`
>
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding. If the raw
> service wiring has already been replaced by equivalent authorizers, stop and
> report that this plan is stale.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: none
- **Category**: security
- **Planned at**: commit `54f2135`, 2026-06-16

## Why this matters

The control plane has RBAC wrappers for core services, but several newer API
families are still returned as raw local services. That means a request can pass
through identity extraction and then list, create, instantiate, or execute work
without a service-level authorization check. Before Team Orchestrator is exposed
as a trusted-server or multi-user surface, every operator-facing service returned
from `createLocalControlPlaneServices` must have an explicit authorization gate.

## Current state

Relevant files:

- `packages/core/src/control-plane/services.ts` wires local service instances into
  the API-facing `ControlPlaneServices` object.
- `packages/core/src/control-plane/services/authorization.ts` contains the
  authorizer, operation union, soft-enforce protected operation list, and the
  existing `Authorized*Service` wrappers.
- `packages/core/src/api/routes/*` call services from the request context; routes
  do not perform their own RBAC checks.
- `packages/core/tests/control-plane.authorization.test.ts` is the main
  authorization regression suite.

Current raw-service wiring in `services.ts`:

```ts
// packages/core/src/control-plane/services.ts:293-330
return {
  runService,
  sessionService,
  directiveService,
  harnessProfileService: new LocalHarnessProfileService(stateStore, options.config),
  runTemplateService: new LocalRunTemplateService(stateStore, runService),
  workflowStatusService,
  workflowQueueStatusService,
  workflowDagExecutorService: new LocalWorkflowDagExecutorService(options.config),
  workflowTemplateCatalogService,
  ...
  capabilityService,
  readinessService,
  stateDiagnosticsService,
  agentCatalogService,
  missionWorkbenchService: new LocalMissionWorkbenchService(options.config),
  taskWorkbenchService: new AuthorizedTaskWorkbenchService(
    new LocalTaskWorkbenchService(options.config, { durableMemoryService, eventService }),
    authorizer
  ),
  connectedRepositoryService: new AuthorizedConnectedRepositoryService(...)
};
```

Routes call those raw services directly:

```ts
// packages/core/src/api/routes/mission-routes.ts:30-114
context.services.missionWorkbenchService.list(...)
context.services.missionWorkbenchService.create(...)
context.services.missionWorkbenchService.get(...)
context.services.missionWorkbenchService.update(...)
context.services.missionWorkbenchService.runMission(...)
context.services.missionWorkbenchService.createTask(...)
context.services.missionWorkbenchService.attachTask(...)

// packages/core/src/api/routes/workflow-template-catalog-routes.ts:16-26
context.services.workflowTemplateCatalogService.list(...)
context.services.workflowTemplateCatalogService.instantiate(...)

// packages/core/src/api/routes/workflow-routes.ts:34
context.services.workflowDagExecutorService.execute(...)

// packages/core/src/api/routes/harness-profile-routes.ts:12-18
context.services.harnessProfileService.list(...)
context.services.harnessProfileService.create(...)

// packages/core/src/api/routes/run-template-routes.ts:14-35
context.services.runTemplateService.list(...)
context.services.runTemplateService.create(...)
context.services.runTemplateService.run(...)

// packages/core/src/api/routes/agent-catalog-routes.ts:15-38
context.services.agentCatalogService.listPlugins(...)
context.services.agentCatalogService.listAgents(...)
context.services.agentCatalogService.listConnectorReadiness(...)
```

The authorization operation union does not include these API families today:

```ts
// packages/core/src/control-plane/services/authorization.ts:37-120
interface AuthorizationRequirement {
  operation:
    | "a2aObservability.get"
    | "a2aObservability.alertHistory.list"
    ...
    | "taskWorkbench.runTask"
    | "taskWorkbench.update"
    | "workflowQueue.status"
    | "workflowRun.status"
    | "work.drain"
    | "work.enqueue"
    | "work.status"
    | "workspaces.create"
    ...
}
```

Soft-enforce protection also omits these mutation/execution operations:

```ts
// packages/core/src/control-plane/services/authorization.ts:1454-1483
function isSoftEnforceProtectedOperation(operation: AuthorizationRequirement["operation"]): boolean {
  return (
    operation === "policy.put" ||
    operation === "durableMemory.proposal.approve" ||
    ...
    operation === "identity.audit" ||
    operation === "governance.audit.list"
  );
}
```

Follow the existing wrapper pattern. For example,
`AuthorizedTaskWorkbenchService` performs an `await this.authorizer.authorize(...)`
call before delegating to the raw service, and tests in
`packages/core/tests/control-plane.authorization.test.ts` assert viewer/operator
behavior for those wrappers.

## Commands you will need

| Purpose | Command | Expected on success |
| --- | --- | --- |
| Narrow typecheck | `npm --workspace @athena/core run typecheck` | exit 0, no TypeScript errors |
| Narrow auth tests | `npm --workspace @athena/core run test:unit -- control-plane.authorization` | exit 0, authorization tests pass |
| Core unit tests | `npm --workspace @athena/core run test:unit` | exit 0, all core unit tests pass |
| Manifest/schema guard | `npm --workspace @athena/core run validate:manifests && npm --workspace @athena/core run check:schemas` | exit 0 |
| Whitespace guard | `git diff --check` | exit 0 |

## Scope

**In scope**:

- `packages/core/src/control-plane/services/authorization.ts`
- `packages/core/src/control-plane/services.ts`
- `packages/core/src/control-plane/interfaces.ts` only if TypeScript requires
  small type imports or interface alignment for wrappers
- `packages/core/tests/control-plane.authorization.test.ts`
- `packages/core/tests/api.auth-middleware.test.ts` only if adding a route-level
  regression is simpler than service-level setup for one family

**Out of scope**:

- Do not implement `workspace_members` or change the meaning of
  `x-athena-scope-workspaces`; that is plan 035.
- Do not change API response shapes or route URLs.
- Do not refactor local service internals except where a wrapper needs to
  delegate through the existing interface.
- Do not replace mission/workflow internals with a new orchestration model.

## Git workflow

- Branch: `advisor/034-authorize-remaining-api-families`
- Commit when the plan is complete and verified. The repo history uses concise
  imperative messages; an acceptable message is
  `Add auth wrappers for remaining API families`.
- Do not push or open a PR unless the operator asks.

## Steps

### Step 1: Add operation names

In `packages/core/src/control-plane/services/authorization.ts`, extend
`AuthorizationRequirement["operation"]` with operation strings for all methods in
the raw API families:

- Harness profiles: `harnessProfiles.list`, `harnessProfiles.create`
- Run templates: `runTemplates.list`, `runTemplates.create`, `runTemplates.run`
- Workflow templates: `workflowTemplates.list`, `workflowTemplates.instantiate`
- Workflow DAG runs: `workflowRuns.execute`
- Mission workbench: `missionWorkbench.list`, `missionWorkbench.get`,
  `missionWorkbench.create`, `missionWorkbench.update`,
  `missionWorkbench.runMission`, `missionWorkbench.listTasks`,
  `missionWorkbench.listRuns`, `missionWorkbench.getRun`,
  `missionWorkbench.createTask`, `missionWorkbench.attachTask`
- Agent catalog: `agentCatalog.plugins.list`, `agentCatalog.agents.list`,
  `agentCatalog.connectorReadiness.list`

Use the same naming style as existing operations: service noun, dot, action.

Add the write/execute operations to `isSoftEnforceProtectedOperation`:

- `harnessProfiles.create`
- `runTemplates.create`
- `runTemplates.run`
- `workflowTemplates.instantiate`
- `workflowRuns.execute`
- `missionWorkbench.create`
- `missionWorkbench.update`
- `missionWorkbench.runMission`
- `missionWorkbench.createTask`
- `missionWorkbench.attachTask`

Also add read operations if the live `authz` soft-enforce policy already protects
comparable read surfaces in the same domain. Do not add agent catalog list
operations to soft-enforce unless product policy requires it; they are catalog
read operations.

**Verify**: `npm --workspace @athena/core run typecheck` should still fail only if
wrappers are not yet implemented; continue to step 2. If it fails for unrelated
syntax/type errors, fix those before continuing.

### Step 2: Implement wrapper classes

In `authorization.ts`, add wrappers that implement the same service interfaces as
their local counterparts:

- `AuthorizedHarnessProfileService`
- `AuthorizedRunTemplateService`
- `AuthorizedWorkflowTemplateCatalogService`
- `AuthorizedWorkflowDagExecutorService`
- `AuthorizedMissionWorkbenchService`
- `AuthorizedAgentCatalogService`

Each wrapper should accept `(delegate, authorizer)` in the constructor and call
`await this.authorizer.authorize({ operation, allowedRoles, metadata })` before
delegating.

Recommended role policy:

- Catalog/read/list/get/readiness operations: `["Viewer", "Operator", "Admin"]`
- Run, instantiate, execute, mission create/update/task attach/create:
  `["Operator", "Admin"]`
- `harnessProfiles.create`: `["Admin"]`, because harness profiles select runtime
  model/provider/sandbox posture and are closer to configuration than ordinary
  task creation.

For metadata, include stable identifiers already available at the call site:

- `workspaceId` when the request type carries it.
- `runId`, `missionId`, `templateId`, or `profileId` when present.
- `agentName` when an agent filter or agent identifier is present.

Mission and workflow services internally create/run tasks through raw local
services. Treat those calls as implementation details after the top-level user
operation has been authorized. Do not try to inject `AuthorizedTaskWorkbenchService`
into the local workflow executor in this plan unless that is already required by
the interface.

**Verify**:
`npm --workspace @athena/core run typecheck` exits 0 after wrappers compile, or
reports only wiring errors that step 3 will fix.

### Step 3: Wire wrappers in `createLocalControlPlaneServices`

In `packages/core/src/control-plane/services.ts`, import the new wrapper classes
and replace the raw returned services:

- Return `new AuthorizedHarnessProfileService(new LocalHarnessProfileService(...), authorizer)`
  instead of raw `LocalHarnessProfileService`.
- Return `new AuthorizedRunTemplateService(new LocalRunTemplateService(...), authorizer)`.
- Return `new AuthorizedWorkflowDagExecutorService(new LocalWorkflowDagExecutorService(...), authorizer)`.
- Return `new AuthorizedWorkflowTemplateCatalogService(workflowTemplateCatalogService, authorizer)`.
- Return `new AuthorizedAgentCatalogService(agentCatalogService, authorizer)`.
- Return `new AuthorizedMissionWorkbenchService(new LocalMissionWorkbenchService(...), authorizer)`.

Keep local services as constructor delegates where they are also used by readiness
or other internal services. Do not remove shared local service variables if
readiness depends on them.

**Verify**:

```sh
npm --workspace @athena/core run typecheck
```

Expected: exit 0.

### Step 4: Add authorization tests

Extend `packages/core/tests/control-plane.authorization.test.ts` using the
existing test setup and helper patterns in that file.

Minimum cases:

- Viewer can list/read:
  - harness profiles list
  - run templates list
  - workflow template catalog list
  - mission workbench list/get where seed setup makes that possible
  - agent catalog list plugins/list agents/readiness
- Viewer is denied:
  - `harnessProfileService.create`
  - `runTemplateService.create`
  - `runTemplateService.run`
  - `workflowTemplateCatalogService.instantiate`
  - `workflowDagExecutorService.execute`
  - `missionWorkbenchService.create`
  - `missionWorkbenchService.update`
  - `missionWorkbenchService.runMission`
  - `missionWorkbenchService.createTask`
  - `missionWorkbenchService.attachTask`
- Operator is allowed for run/instantiate/mission mutation operations where the
  existing local service setup can create valid records.
- Operator is denied for `harnessProfileService.create`; Admin is allowed.

If a service method needs fixtures that are expensive to build, write the test at
the wrapper level with a small fake delegate object that implements only the
called method. Follow existing wrapper test style; do not build a new test
framework.

**Verify**:

```sh
npm --workspace @athena/core run test:unit -- control-plane.authorization
```

Expected: exit 0 and the new tests pass.

### Step 5: Add a route-level smoke regression if needed

If service-level tests cannot prove that the API uses the authorized service for
one family, add one route-level regression in `packages/core/tests/api.auth-middleware.test.ts`.
Pick a low-fi endpoint with minimal setup, such as harness profile create or run
template create, and assert that a Viewer request receives an authorization
failure.

Skip this step if the service wiring plus `control-plane.authorization.test.ts`
already exercises `createLocalControlPlaneServices` and catches raw-service
returns.

**Verify**:

```sh
npm --workspace @athena/core run test:unit -- api.auth-middleware
```

Expected: exit 0 if the file was changed. If no route-level test was needed,
record that in the final handoff.

### Step 6: Full verification

Run:

```sh
npm --workspace @athena/core run typecheck
npm --workspace @athena/core run test:unit
npm --workspace @athena/core run validate:manifests
npm --workspace @athena/core run check:schemas
git diff --check
```

Expected: every command exits 0.

## Test plan

- Add focused tests to `packages/core/tests/control-plane.authorization.test.ts`
  covering read/list allowed roles and write/execute denied roles for all six
  newly wrapped service families.
- Prefer fake delegates for hard-to-seed wrapper behavior; prefer real
  `createLocalControlPlaneServices` setup where the existing suite already does
  so.
- Add at most one route-level smoke test in `api.auth-middleware.test.ts` if the
  service tests do not catch raw-service wiring regressions.

## Done criteria

All must hold:

- [ ] `createLocalControlPlaneServices` no longer returns raw local services for
      harness profiles, run templates, workflow DAG execution, workflow template
      catalog, agent catalog, or mission workbench.
- [ ] `authorization.ts` contains explicit operations and wrappers for each
      family in this plan.
- [ ] Viewer cannot create, mutate, run, instantiate, or execute through those
      families.
- [ ] Operator can perform ordinary run/mission/workflow mutation where policy
      says so; Admin is required for harness profile creation.
- [ ] `npm --workspace @athena/core run typecheck` exits 0.
- [ ] `npm --workspace @athena/core run test:unit` exits 0.
- [ ] `npm --workspace @athena/core run validate:manifests` exits 0.
- [ ] `npm --workspace @athena/core run check:schemas` exits 0.
- [ ] `git diff --check` exits 0.
- [ ] `plans/README.md` status row for plan 034 is updated.

## STOP conditions

Stop and report if:

- The raw-service wiring in `services.ts` no longer matches the current-state
  excerpt and equivalent wrappers already exist.
- A wrapper requires changing public API route shapes or shared contracts.
- A method cannot be authorized without adding a new workspace membership model;
  defer that part to plan 035 rather than inventing a partial membership design.
- Existing tests depend on Viewer being able to perform one of the protected
  mutation/execution actions.
- Any verification command fails twice after a reasonable fix attempt.

## Maintenance notes

Reviewers should check that every new API family added to
`ControlPlaneServices` is either intentionally internal-only or wrapped before it
is returned from `createLocalControlPlaneServices`. Once plan 035 lands,
workspace-scoped wrappers from this plan may need metadata enrichment so the
authorizer can resolve per-workspace role instead of global role only.
