# Plan 007: Add a per-run concurrency guard to the DAG executor

> **Executor instructions**: Follow this plan step by step. Run every verification
> command and confirm the expected result before moving on. If anything in "STOP
> conditions" occurs, stop and report — do not improvise. When done, update the
> status row for this plan in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 182e9ba..HEAD -- packages/core/src/control-plane/services/workflow-dag-executor.ts packages/core/src/api/routes/workflow-routes.ts`
> If the executor changed, compare the "Current state" excerpts before proceeding; on a mismatch, STOP.

## Why this matters

`LocalWorkflowDagExecutorService.execute(runId)` runs a `while` loop that `await`s
`taskWorkbench.runTask(...)` and then recomputes readiness — with **no guard
against a second `execute`/`resume` for the same `runId` running concurrently**.
The `await` is a yield point: two overlapping calls (a double-clicked "execute", a
schedule-triggered run overlapping a manual one, or an execute racing a resume)
can both `selectNextReadyStep`, pick the **same** ready step, and both spawn a task
run for it — duplicate child processes, duplicate artifacts, attempt-counter races,
and a run that can hang in `running` or fail spuriously. The HTTP route
(`handleExecuteWorkflowRunRoute`) calls `execute` with no coordination. This plan
serializes execution per `runId` within the process.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED (changes concurrency behavior; coalescing must not alter single-call semantics)
- **Depends on**: plans/006-transactional-step-transitions.md
- **Category**: bug (concurrency / duplicate execution)
- **Planned at**: commit `182e9ba`, 2026-06-13

## Current state

`packages/core/src/control-plane/services/workflow-dag-executor.ts`:

```ts
// :44
async execute(runId: string): Promise<WorkflowDagExecutionResult> {
  return this.withAppStateAsync(async (appState) => {
    const executedStepIds: string[] = [];
    const workflowState = new LocalWorkflowStateService(appState);
    let snapshot = workflowState.recomputeReadiness(runId);
    while (snapshot.run.status !== "failed" && snapshot.run.status !== "completed" && snapshot.run.status !== "resumable") {
      const step = selectNextReadyStep(snapshot);
      if (!step) break;
      ...
      const taskRun = await taskWorkbench.runTask(task.id);   // <-- yield point; no per-run lock
      ...
    }
    return { runId, status: snapshot.run.status, executedStepIds, snapshot };
  });
}

// :99
async resume(runId: string): Promise<WorkflowDagExecutionResult> {
  return this.withAppStateAsync(async (appState) => {
    const workflowState = new LocalWorkflowStateService(appState);
    workflowState.recoverStaleRunningSteps(runId);
    const resumable = workflowState.resumeFromFirstFailedStep(runId);
    resetProjectedTasksForPendingSteps(appState, resumable);
    return this.execute(runId);     // <-- calls public execute()
  });
}
```

The route, `packages/core/src/api/routes/workflow-routes.ts`:

```ts
async function handleExecuteWorkflowRunRoute(context, params) {
  writeSuccess(context.res, "executeWorkflowRun", 200,
    await context.services.workflowDagExecutorService.execute(decodeRouteParam(params, "runId")));
}
```

`workflowDagExecutorService` is a **singleton** on `context.services`, so an
instance-level in-memory map of in-flight runs is sufficient to serialize within
the process. (The product is local-first / single-process; cross-process
serialization is out of scope — see Maintenance notes.)

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Typecheck core | `npm --workspace @athena/core run typecheck` | exit 0 |
| Executor tests | `npm --workspace @athena/core run test:unit -- workflow-dag-executor` | all pass |
| All core tests | `npm --workspace @athena/core run test:unit` | all pass |

## Scope

**In scope**:
- `packages/core/src/control-plane/services/workflow-dag-executor.ts` (add the per-run guard)
- `packages/core/tests/control-plane.workflow-dag-executor.test.ts` (add a concurrency test)

**Out of scope** (do NOT touch):
- `workflow-routes.ts` — the guard lives in the service, the route is unchanged.
- `taskWorkbench.runTask` and `LocalWorkflowStateService` internals.
- Cross-process / distributed locking (`distributed-lock`) — not needed for single-process local-first.

## Git workflow

- Branch: `advisor/007-dag-executor-concurrency-guard`
- Commit in logical units; short imperative messages.
- Do NOT push or open a PR unless instructed. Land plan 006 first.

## Steps

### Step 1: Add an in-flight map and a guard helper

Add an instance field and a coalescing guard to `LocalWorkflowDagExecutorService`:

```ts
private readonly inFlightRuns = new Map<string, Promise<WorkflowDagExecutionResult>>();

private async withRunGuard(
  runId: string,
  run: () => Promise<WorkflowDagExecutionResult>
): Promise<WorkflowDagExecutionResult> {
  const existing = this.inFlightRuns.get(runId);
  if (existing) {
    return existing;   // a concurrent call for the same run joins the in-flight execution
  }
  const promise = (async () => run())().finally(() => {
    this.inFlightRuns.delete(runId);
  });
  this.inFlightRuns.set(runId, promise);
  return promise;
}
```

Coalescing (returning the in-flight promise) means a double-click returns the same
result instead of starting a second execution — safe and simple.

### Step 2: Split execute/resume into guarded public + unguarded internal

- Rename the current `execute` body to a private `executeInternal(runId)` (same body).
- Make the public `execute` delegate through the guard:
  ```ts
  async execute(runId: string): Promise<WorkflowDagExecutionResult> {
    return this.withRunGuard(runId, () => this.executeInternal(runId));
  }
  ```
- Rename the current `resume` body to a private `resumeInternal(runId)`, and change
  its final line from `return this.execute(runId);` to `return this.executeInternal(runId);`
  (so resume does not re-enter the guard and deadlock against itself).
- Make the public `resume` delegate through the guard:
  ```ts
  async resume(runId: string): Promise<WorkflowDagExecutionResult> {
    return this.withRunGuard(runId, () => this.resumeInternal(runId));
  }
  ```

This guarantees: only one of {execute, resume} for a given `runId` runs at a time
in this process; concurrent callers share its result.

**Verify**: `npm --workspace @athena/core run typecheck` → exit 0.

### Step 3: Confirm existing behavior

**Verify**: `npm --workspace @athena/core run test:unit -- workflow-dag-executor` → all pass (single-call semantics unchanged).

### Step 4: Add a concurrency test

Add a test that fires two `execute(runId)` calls for the SAME run concurrently
(`await Promise.all([svc.execute(id), svc.execute(id)])`) and asserts each step ran
**exactly once** — i.e. the number of task runs created equals the number of steps,
not double. Model construction after the existing executor tests in that file. If
the test harness uses an injected in-memory `appState`, both calls share it, which
exercises the guard. Assert the two results are consistent (same final status).

**Verify**: `npm --workspace @athena/core run test:unit -- workflow-dag-executor` → all pass, including the new concurrency test. Confirm the test FAILS without the guard (temporarily revert Step 2 locally to confirm, then restore) — note this in your report.

## Test plan

- New concurrency test: two simultaneous `execute` calls for one run → each step executes once; results consistent.
- Existing executor tests confirm single-call retry/resume/exhaustion behavior is unchanged.
- Verification: `npm --workspace @athena/core run test:unit` → all pass.

## Done criteria

ALL must hold:

- [ ] `execute` and `resume` route through `withRunGuard`; `resumeInternal` calls `executeInternal` (not the public `execute`)
- [ ] Concurrent `execute(runId)` for the same run executes each step exactly once (new test)
- [ ] `npm --workspace @athena/core run typecheck` exits 0
- [ ] `npm --workspace @athena/core run test:unit` exits 0
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report if:

- `workflowDagExecutorService` turns out to be constructed per-request rather than as a singleton (then an instance map won't serialize across requests — report this; the guard must move to shared state or a distributed lock).
- The executor `execute`/`resume` bodies no longer match the excerpts (drift).
- Plan 006 has not landed (transitions are not yet atomic) — serializing on top of non-atomic transitions still leaves a partial-state risk; land 006 first.

## Maintenance notes

- This guards a **single process**. If the product ever runs multiple API/worker processes against the same state DB, replace the in-memory map with the repo's `distributed-lock` keyed on `workflow-dag:${runId}` (the executor already imports app-state; the lock interface is exported from `control-plane/distributed-lock`).
- Reviewer should verify the `.finally` cleanup always runs (no path leaves a stale entry in `inFlightRuns`) and that coalescing does not mask a legitimately-separate second run requested after the first completed.
