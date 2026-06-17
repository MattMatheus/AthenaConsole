# Plan 045: Make workflow-template instantiation atomic

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the next
> step. If anything in the "STOP conditions" section occurs, stop and report;
> do not improvise. When done, update the status row for this plan in
> `plans/README.md` unless a reviewer dispatched you and told you they maintain
> the index.
>
> **Drift check (run first)**:
> `git diff --stat c082a64..HEAD -- packages/core/src/control-plane/services/workflow-template-catalog.ts packages/core/src/control-plane/services/task-workbench.ts packages/core/src/control-plane/services/workflow-state.ts packages/core/tests/control-plane.workflow-template-instantiation.test.ts`
>
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against live code. If template instantiation already
> wraps DAG run, mission, and task creation in one database transaction, stop and
> report that this plan is stale.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: none; if plan 044 is also running, coordinate edits in
  `workflow-template-catalog.ts`
- **Category**: bug
- **Planned at**: commit `c082a64`, 2026-06-17

## Why this matters

Workflow template instantiation creates a DAG run, a mission, and multiple tasks.
Those writes currently happen in separate service calls. If task creation fails
after the DAG run or mission has been written, the database can retain orphaned
partial workflow state that cannot be cleanly executed or retried.

## Current state

Relevant files:

- `packages/core/src/control-plane/services/workflow-template-catalog.ts` creates
  the DAG run, mission, then tasks in sequence.
- `packages/core/src/control-plane/services/task-workbench.ts` validates and
  creates individual tasks and can throw repository/validation errors.
- `packages/core/src/control-plane/services/workflow-state.ts` already uses
  `appState.db.transaction` for workflow state transitions.
- `packages/core/tests/control-plane.workflow-template-instantiation.test.ts`
  covers preflight failure before writes, but not mid-instantiation failure.

Non-atomic instantiation sequence:

```ts
// packages/core/src/control-plane/services/workflow-template-catalog.ts:135-167
const workflowDagRun = new LocalWorkflowStateService(appState).createRun({
  runId: `workflow-run-${missionId}`,
  workflowTemplateId: template.id,
  tasks: taskTemplates
});

const mission = appState.missions.create({
  id: missionId,
  status: allTasksReady ? "ready" : "draft",
  taskOrder
});

for (const taskTemplate of orderedTaskTemplates) {
  const task = await taskWorkbench.create({
    id: requireMappedTaskId(taskIdByTemplateId, taskTemplate.id),
    missionId: mission.id
  });
  tasks.push(task);
}
```

Task creation can throw after earlier writes:

```ts
// packages/core/src/control-plane/services/task-workbench.ts:367-390
async create(request: TaskWorkbenchTaskCreateRequest): Promise<TaskWorkbenchTask> {
  return this.withAppState((appState) => {
    validateReadyAssignment(request.status ?? "draft", request.assignedAgentId);
    validateCompatibleAssignment(appState, request.assignedAgentId, request.assignedAgentVersion, request.capabilityRequirements ?? []);
    try {
      const created = appState.tasks.create({ ... });
      return mapTaskRecord(created, appState);
    } catch (error) {
      throw normalizeTaskRepositoryError(error);
    }
  });
}
```

Workflow state transitions already use transactions:

```ts
// packages/core/src/control-plane/services/workflow-state.ts:60-97
startStep(runId: string, stepId: string, now: Date = new Date()): WorkflowDagRunSnapshot {
  return this.appState.db.transaction(() => {
    const snapshot = this.appState.workflowDagRuns.requireSnapshot(runId);
    ...
    return this.recomputeReadiness(runId, now);
  })();
}
```

Existing preflight test proves no writes before preflight failure, but does not
cover failure after DAG/mission creation:

```ts
// packages/core/tests/control-plane.workflow-template-instantiation.test.ts:290-314
await expect(service.instantiate("templates.connector.workflow", {...})).rejects.toMatchObject({
  code: "CONFIG_ERROR"
});
expect(appState.missions.get(`mission-${scenario.name}`)).toBeUndefined();
expect(appState.workflowDagRuns.get(`workflow-run-mission-${scenario.name}`)).toBeUndefined();
```

## Commands you will need

| Purpose | Command | Expected on success |
| --- | --- | --- |
| Core typecheck | `npm --workspace @athena/core run typecheck` | exits 0 |
| Workflow template tests | `npm --workspace @athena/core run test:unit -- --runInBand packages/core/tests/control-plane.workflow-template-instantiation.test.ts` | exits 0 |
| Core tests | `npm --workspace @athena/core run test:unit` | exits 0 |
| Diff guard | `git diff --check` | exits 0 |

If `--runInBand` is unsupported, use the repo-supported Vitest file filter and
still run the full core suite.

## Scope

**In scope**:

- `packages/core/src/control-plane/services/workflow-template-catalog.ts`
- `packages/core/src/control-plane/services/task-workbench.ts`
- `packages/core/tests/control-plane.workflow-template-instantiation.test.ts`
- Small helper exports from task-workbench if needed to create tasks inside an
  existing app-state transaction

**Out of scope**:

- Do not change workflow template manifest format.
- Do not change task id generation.
- Do not change workflow DAG execution semantics.
- Do not hide validation errors; preserve existing normalized error behavior.

## Git workflow

- Branch: `advisor/045-make-workflow-template-instantiation-atomic`
- Commit message: `Make workflow template instantiation atomic`
- Do not push or open a PR unless the operator asks.

## Steps

### Step 1: Extract a transaction-friendly task creation helper

`LocalTaskWorkbenchService.create` currently opens app state internally. Extract
the core synchronous creation logic into a helper that accepts an existing
`AppStateDatabase` and a `TaskWorkbenchTaskCreateRequest`, for example:

```ts
function createTaskInAppState(appState: AppStateDatabase, request: TaskWorkbenchTaskCreateRequest): TaskWorkbenchTask
```

The helper must preserve:

- `validateReadyAssignment`;
- `validateCompatibleAssignment`;
- `normalizeTaskInputsWithRunMode`;
- `normalizeTaskRepositoryError`;
- `mapTaskRecord`.

Then make `LocalTaskWorkbenchService.create` call this helper inside its current
`withAppState` wrapper.

**Verify**:

- `npm --workspace @athena/core run typecheck` exits 0.
- Existing task-workbench tests still pass as part of the full suite in Step 4.

### Step 2: Wrap workflow instantiation writes in one transaction

In `workflow-template-catalog.ts`, keep all preflight/read-only validation before
the write transaction. Then wrap the write sequence in
`appState.db.transaction(() => { ... })()`:

- create workflow DAG run;
- create mission;
- create every task using the transaction-friendly helper from Step 1;
- return the response data assembled from those created records.

Do not `await` inside the SQLite transaction callback. If a helper is async only
by interface but uses synchronous work internally, refactor it rather than
calling an unresolved Promise inside the transaction.

**Verify**:

- `rg -n "db.transaction" packages/core/src/control-plane/services/workflow-template-catalog.ts` shows the instantiation write block is transactional.
- `npm --workspace @athena/core run typecheck` exits 0.

### Step 3: Add a mid-instantiation rollback test

Add a test in `packages/core/tests/control-plane.workflow-template-instantiation.test.ts`
that forces failure during the task creation loop after the DAG run and mission
would have been created.

Use a deterministic failure. Acceptable options:

- create a workflow template whose second task id collides with pre-existing
  task state after the first task succeeds; or
- assign a later task to an incompatible agent so
  `validateCompatibleAssignment` fails after earlier writes.

Assert after the rejection:

- no mission with the requested mission id exists;
- no workflow DAG run with `workflow-run-${missionId}` exists;
- no tasks with the task id prefix exist;
- any pre-existing fixture task used to trigger the collision still exists.

**Verify**:

- `npm --workspace @athena/core run test:unit -- --runInBand packages/core/tests/control-plane.workflow-template-instantiation.test.ts` exits 0, or equivalent file-filter command exits 0.

### Step 4: Run full verification

Run core typecheck and tests.

**Verify**:

- `npm --workspace @athena/core run typecheck` exits 0.
- `npm --workspace @athena/core run test:unit` exits 0.
- `git diff --check` exits 0.

## Test plan

The new regression test must fail on the current non-atomic implementation and
pass after the transaction. It should specifically prove rollback for DAG run,
mission, and all newly attempted tasks.

## Done criteria

- [ ] Workflow template instantiation writes DAG run, mission, and tasks inside
  one SQLite transaction.
- [ ] Task creation behavior and error normalization are preserved.
- [ ] A mid-instantiation failure test proves no partial workflow state remains.
- [ ] Core typecheck and unit tests pass.
- [ ] `plans/README.md` status row updated.

## STOP conditions

Stop and report back if:

- The transaction would need to include async I/O outside SQLite.
- Existing task creation helpers cannot be reused without changing public
  behavior.
- A workflow template is intentionally allowed to leave partial state for manual
  repair.
- Plan 044 has already refactored the same instantiation block and the live code
  no longer matches this plan.

## Maintenance notes

Future workflow-template write paths should follow the same pattern: validate
first, then perform all app-state writes in one transaction. Reviewers should
look for accidental `await` calls inside transaction callbacks.
