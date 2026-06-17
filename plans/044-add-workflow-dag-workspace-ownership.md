# Plan 044: Add workspace ownership to workflow DAG runs

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the next
> step. If anything in the "STOP conditions" section occurs, stop and report;
> do not improvise. When done, update the status row for this plan in
> `plans/README.md` unless a reviewer dispatched you and told you they maintain
> the index.
>
> **Drift check (run first)**:
> `git diff --stat c082a64..HEAD -- packages/core/src/control-plane/app-state/migrations.ts packages/core/src/control-plane/app-state/workflow-state-repository.ts packages/core/src/control-plane/services/workflow-template-catalog.ts packages/core/src/control-plane/services/workflow-status.ts packages/core/src/control-plane/services/workflow-queue-status.ts packages/core/src/control-plane/services/authorization.ts packages/core/tests`
>
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against live code. If workflow DAG runs already have
> `workspace_id` and workspace-scoped authorization, stop and report that this
> plan is stale.

## Status

- **Priority**: P1
- **Effort**: L
- **Risk**: HIGH
- **Depends on**: none
- **Category**: security/migration
- **Planned at**: commit `c082a64`, 2026-06-17

## Why this matters

Workflow template instantiation creates tasks in a workspace, but the workflow
DAG run itself is not workspace-owned. Status, queue, execute, and resume paths
authorize by role and run id rather than workspace membership. In a shared
trusted-server deployment, this can leak workflow status and allow operators to
act on workflow runs outside their workspace.

## Current state

Relevant files:

- `packages/core/src/control-plane/app-state/migrations.ts` creates workflow DAG
  tables without `workspace_id`.
- `packages/core/src/control-plane/app-state/workflow-state-repository.ts`
  models, creates, selects, and lists DAG runs without workspace fields.
- `packages/core/src/control-plane/services/workflow-template-catalog.ts` passes
  `workspaceId` to created tasks, but not to the DAG run.
- `packages/core/src/control-plane/services/workflow-status.ts` loads status by
  run id only.
- `packages/core/src/control-plane/services/workflow-queue-status.ts` lists all
  DAG runs.
- `packages/core/src/control-plane/services/authorization.ts` authorizes workflow
  status/queue/execute by role and run id only.

Current schema omits workspace ownership:

```ts
// packages/core/src/control-plane/app-state/migrations.ts:275-289
create table if not exists workflow_dag_runs (
  id text primary key,
  workflow_template_id text not null,
  workflow_template_version text,
  plugin_id text,
  plugin_version text,
  status text not null,
  step_order_json text not null default '[]',
  dependencies_json text not null default '{}',
  failure_json text,
  created_at text not null,
  updated_at text not null,
  started_at text,
  finished_at text
);
```

Migration 20 adds workspace ownership to neighboring tables, but not workflow
DAG tables:

```ts
// packages/core/src/control-plane/app-state/migrations.ts:648-660
alter table missions add column workspace_id text not null default 'default';
alter table tasks add column workspace_id text not null default 'default';
alter table runs add column workspace_id text not null default 'default';
alter table run_events add column workspace_id text not null default 'default';
alter table artifact_metadata add column workspace_id text not null default 'default';
alter table schedules add column workspace_id text not null default 'default';
alter table schedule_run_history add column workspace_id text not null default 'default';
alter table connected_repositories add column workspace_id text not null default 'default';
alter table model_provider_configs add column workspace_id text not null default 'default';
alter table connector_credential_bindings add column workspace_id text not null default 'default';
alter table eval_suites add column workspace_id text not null default 'default';
alter table eval_runs add column workspace_id text not null default 'default';
alter table eval_results add column workspace_id text not null default 'default';
```

Repository records and create/list options lack workspace fields:

```ts
// packages/core/src/control-plane/app-state/workflow-state-repository.ts:63-77,124-138
export interface WorkflowDagRunRecord {
  id: string;
  workflowTemplateId: string;
  status: WorkflowDagRunStatus;
}

export interface CreateWorkflowDagRunInput {
  id?: string;
  workflowTemplateId: string;
  stepOrder: string[];
  dependencies: Record<string, string[]>;
}

export interface ListWorkflowDagRunsOptions {
  status?: WorkflowDagRunStatus;
  limit?: number;
}
```

Template instantiation has workspace context but does not store it on the DAG
run:

```ts
// packages/core/src/control-plane/services/workflow-template-catalog.ts:135-142,193-194
const workflowDagRun = new LocalWorkflowStateService(appState).createRun({
  runId: `workflow-run-${missionId}`,
  workflowTemplateId: template.id,
  tasks: taskTemplates
});

...(request.workspaceId ? { workspaceId: request.workspaceId } : {}),
```

Authorization does not pass workspace id for workflow status or execution:

```ts
// packages/core/src/control-plane/services/authorization.ts:618-624,703-709
await this.authorizer.assertAllowed({
  operation: "workflowRun.status",
  requiredRoles: ["Operator", "Admin"],
  runId
});
```

## Commands you will need

| Purpose | Command | Expected on success |
| --- | --- | --- |
| Core typecheck | `npm --workspace @athena/core run typecheck` | exits 0 |
| App-state tests | `npm --workspace @athena/core run test:unit -- --runInBand packages/core/tests/control-plane.app-state-contract.test.ts` | exits 0 |
| Workflow tests | `npm --workspace @athena/core run test:unit -- --runInBand packages/core/tests/control-plane.workflow-template-instantiation.test.ts` | exits 0 |
| Authorization tests | `npm --workspace @athena/core run test:unit -- --runInBand packages/core/tests/control-plane.authorization.test.ts` | exits 0 |
| Core tests | `npm --workspace @athena/core run test:unit` | exits 0 |
| Diff guard | `git diff --check` | exits 0 |

If the test wrapper rejects `--runInBand`, use the supported file-filter syntax
for this repo and still run the full core suite.

## Scope

**In scope**:

- `packages/core/src/control-plane/app-state/migrations.ts`
- `packages/core/src/control-plane/app-state/workflow-state-repository.ts`
- `packages/core/src/control-plane/services/workflow-state.ts`
- `packages/core/src/control-plane/services/workflow-template-catalog.ts`
- `packages/core/src/control-plane/services/workflow-status.ts`
- `packages/core/src/control-plane/services/workflow-queue-status.ts`
- `packages/core/src/control-plane/services/workflow-dag-executor.ts`
- `packages/core/src/control-plane/services/authorization.ts`
- Targeted core tests for migrations, workflow status/queue/execution, and
  authorization

**Out of scope**:

- Do not redesign workflow DAG step semantics.
- Do not change workflow template manifest format.
- Do not change task workspace semantics except to keep DAG run and task
  workspace ownership aligned.
- Do not introduce Postgres-specific code in this SQLite migration plan.

## Git workflow

- Branch: `advisor/044-add-workflow-dag-workspace-ownership`
- Commit message: `Scope workflow DAG runs by workspace`
- Do not push or open a PR unless the operator asks.

## Steps

### Step 1: Add `workspace_id` to workflow DAG run storage

Update fresh schema creation in migration 6 so new databases create
`workflow_dag_runs.workspace_id text not null default 'default'`.

Add a new migration version after 21, for example
`add-workflow-dag-run-workspace`, that:

- adds `workflow_dag_runs.workspace_id text not null default 'default'`;
- backfills existing rows to `default`;
- creates an index such as `idx_workflow_dag_runs_workspace_status_updated` on
  `(workspace_id, status, updated_at desc)`.

If SQLite cannot add the column because it already exists in a fresh database,
use the repo's existing migration helper pattern if one exists; otherwise keep
the new migration compatible with databases that have applied migration 6 but
not the fresh-schema edit.

**Verify**:

- Add or update app-state migration tests proving fresh and migrated databases
  have `workflow_dag_runs.workspace_id`.
- `npm --workspace @athena/core run test:unit -- --runInBand packages/core/tests/control-plane.app-state-contract.test.ts` exits 0, or equivalent file-filter command exits 0.

### Step 2: Thread workspace id through the workflow repository

In `workflow-state-repository.ts`:

- add `workspaceId: string` to `WorkflowDagRunRecord`;
- add optional `workspaceId?: string` to `CreateWorkflowDagRunInput`, defaulting
  to `"default"` at insertion;
- add `workspaceId?: string` and `workspaceIds?: string[]` to
  `ListWorkflowDagRunsOptions`;
- include `workspace_id` in insert/select/map SQL;
- make list return no rows for `workspaceIds: []`;
- add query-level workspace filtering for list operations.

**Verify**:

- `rg -n "workspaceId|workspace_id" packages/core/src/control-plane/app-state/workflow-state-repository.ts` shows create/select/list/map coverage.
- `npm --workspace @athena/core run typecheck` exits 0.

### Step 3: Store workspace ownership at workflow creation

Update workflow run creation paths so new DAG runs receive the same workspace as
the instantiated workflow's tasks. In `workflow-template-catalog.ts`, pass the
resolved `request.workspaceId` or `"default"` into `LocalWorkflowStateService`
when creating the run.

Update `LocalWorkflowStateService.createRun` and any call sites to accept and
forward `workspaceId`.

**Verify**:

- Add or update a workflow-template instantiation test asserting the created DAG
  run record has the requested workspace id.
- `npm --workspace @athena/core run test:unit -- --runInBand packages/core/tests/control-plane.workflow-template-instantiation.test.ts` exits 0, or equivalent file-filter command exits 0.

### Step 4: Scope status, queue, execute, and resume

Update service and authorization paths:

- `LocalWorkflowStatusService.getStatus` should load the DAG run and expose or
  return enough metadata for the authorized wrapper to check workspace before
  returning status.
- `LocalWorkflowQueueStatusService.getStatus` should list only workflow DAG runs
  in the caller's allowed workspaces when the caller is not global Admin. Follow
  existing list narrowing patterns in task/model-provider services.
- `AuthorizedWorkflowStatusService.getStatus`, `AuthorizedWorkflowQueueStatusService.getStatus`,
  and `AuthorizedWorkflowDagExecutorService.execute/resume` must pass the DAG
  run's `workspaceId` into `ServiceAuthorizer`.

Do not rely on only `runId`; `ServiceAuthorizer` cannot map run ids to
workspace membership by itself.

**Verify**:

- Authorization tests prove a `workspace-alpha` Operator can see/execute alpha
  workflow runs and is denied beta workflow runs.
- Queue status tests prove a `workspace-alpha` Viewer/Operator sees only alpha
  workflow queue items.
- `npm --workspace @athena/core run test:unit -- --runInBand packages/core/tests/control-plane.authorization.test.ts` exits 0, or equivalent file-filter command exits 0.

### Step 5: Run full verification

Run the broader core gates.

**Verify**:

- `npm --workspace @athena/core run typecheck` exits 0.
- `npm --workspace @athena/core run test:unit` exits 0.
- `git diff --check` exits 0.

## Test plan

Add tests for:

- migration/fresh schema includes `workflow_dag_runs.workspace_id`;
- workflow template instantiation stores requested workspace id on DAG run;
- workflow status denies cross-workspace access;
- workflow queue status narrows to allowed workspaces;
- execute/resume denies cross-workspace runs.

Use existing authorization test helpers and workflow-template fixtures.

## Done criteria

- [ ] Workflow DAG runs have persisted workspace ownership.
- [ ] Existing databases receive a migration and fresh databases create the same
  schema.
- [ ] Status, queue, execute, and resume paths enforce workspace membership.
- [ ] Workflow queue results are query-scoped, not just post-filtered after
  exposing all runs.
- [ ] Core typecheck and unit tests pass.
- [ ] `plans/README.md` status row updated.

## STOP conditions

Stop and report back if:

- Existing workflow DAG runs cannot be safely backfilled to `default`.
- A workflow DAG run can intentionally span multiple workspaces.
- Authorization requires changing public API response shapes.
- The migration conflicts with a concurrently added migration version.

## Maintenance notes

Any future workflow-owned table should include workspace ownership at creation
time, not infer it from linked tasks after the fact. Reviewers should check both
fresh-schema and migrated-schema paths.
