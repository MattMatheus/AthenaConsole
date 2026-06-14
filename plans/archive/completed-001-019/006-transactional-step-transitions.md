# Plan 006: Wrap workflow step transitions in transactions

> **Executor instructions**: Follow this plan step by step. Run every verification
> command and confirm the expected result before moving on. If anything in "STOP
> conditions" occurs, stop and report — do not improvise. When done, update the
> status row for this plan in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 182e9ba..HEAD -- packages/core/src/control-plane/services/workflow-state.ts`
> If it changed, compare the "Current state" excerpts before proceeding; on a mismatch, STOP.

## Why this matters

Each workflow DAG step transition in `LocalWorkflowStateService` performs 3–5
**separate** SQLite writes (`updateRun`, `updateStep`, `startAttempt`/`finishAttempt`,
`appendEvent`) with no enclosing transaction. If any write throws partway (a
constraint error, disk error, or an interleaved write — see plan 007), the run is
left in an impossible half-state: e.g. a step marked `running` with no attempt row,
or a run marked `failed` while its step row still says `running`. Recovery logic
then reads a state that should not exist. The repository layer already proves the
pattern — `WorkflowDagRunRepository.create` wraps its multi-write in
`this.db.transaction(...)` (`workflow-state-repository.ts:358`). This plan applies
the same atomicity to the transition methods. It is also a prerequisite for the
concurrency guard in plan 007.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW (wrapping existing synchronous writes; behavior preserved on the success path)
- **Depends on**: none
- **Category**: bug (partial-state on failure)
- **Planned at**: commit `182e9ba`, 2026-06-13

## Current state

`packages/core/src/control-plane/services/workflow-state.ts` — `startStep` (the
pattern; the others are analogous):

```ts
// workflow-state.ts:60
startStep(runId: string, stepId: string, now: Date = new Date()): WorkflowDagRunSnapshot {
  const snapshot = this.appState.workflowDagRuns.requireSnapshot(runId);
  const step = requireStep(snapshot, stepId);
  const timestamp = now.toISOString();
  const attempt = step.attempt + 1;
  this.appState.workflowDagRuns.updateRun(runId, { status: "running", startedAt: snapshot.run.startedAt ?? timestamp, finishedAt: null, now });
  this.appState.workflowDagRuns.updateStep(runId, stepId, { status: "running", attempt, ready: false, startedAt: timestamp, finishedAt: null, failure: undefined, now });
  this.appState.workflowDagRuns.startAttempt({ runId, stepId, attempt, startedAt: timestamp, now });
  this.appState.workflowDagRuns.appendEvent({ runId, stepId, type: "workflow.step.started", message: `Workflow step ${stepId} started.`, payload: { attempt }, timestamp });
  return this.recomputeReadiness(runId, now);
}
```

Other multi-write transition methods in the same file: `completeStep` (`:98`),
`failStep` (`:129`), and `recoverStaleRunningSteps` (`:210`). `resumeFromFirstFailedStep`
and `cancelStep` (if present) similarly perform multiple writes — apply the same
wrapper to any method that issues 2+ `workflowDagRuns` writes.

**The DB handle is available**: `AppStateDatabase` exposes `readonly db: Database.Database`
(`app-state/database.ts:42`), and `this.appState` is the field on `LocalWorkflowStateService`.
better-sqlite3's `db.transaction(fn)` returns a function that runs `fn` atomically
and supports nesting via savepoints (so calling these methods from within another
transaction is safe). All writes here are synchronous, so they fit a single transaction.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Typecheck core | `npm --workspace @athena/core run typecheck` | exit 0 |
| Workflow tests | `npm --workspace @athena/core run test:unit -- workflow` | all pass |
| All core tests | `npm --workspace @athena/core run test:unit` | all pass |

## Scope

**In scope**:
- `packages/core/src/control-plane/services/workflow-state.ts` (wrap transition methods)
- `packages/core/tests/control-plane.workflow-state.test.ts` (add an atomicity/rollback test) — if that file does not exist, add the test to the closest existing workflow-state test file (find with `ls packages/core/tests | grep -i workflow`).

**Out of scope** (do NOT touch):
- The `WorkflowDagRunRepository` methods themselves (`updateRun`, `updateStep`, etc.) — they stay as individual operations; only the service composes them transactionally.
- `recomputeReadiness` logic — you may include its call inside the transaction (it is synchronous) but do not change what it computes.
- The execute loop in `workflow-dag-executor.ts` (that is plans 007/009).

## Git workflow

- Branch: `advisor/006-transactional-step-transitions`
- Commit per method or one commit for all; short imperative message.
- Do NOT push or open a PR unless instructed.

## Steps

### Step 1: Wrap each transition method body in a transaction

For `startStep`, `completeStep`, `failStep`, `recoverStaleRunningSteps` (and any
other method issuing 2+ `workflowDagRuns` writes), wrap the body so all writes
and the trailing `recomputeReadiness`/`finalizeRun` run inside one transaction and
the snapshot is returned from it. Pattern for `startStep`:

```ts
startStep(runId: string, stepId: string, now: Date = new Date()): WorkflowDagRunSnapshot {
  return this.appState.db.transaction(() => {
    const snapshot = this.appState.workflowDagRuns.requireSnapshot(runId);
    const step = requireStep(snapshot, stepId);
    const timestamp = now.toISOString();
    const attempt = step.attempt + 1;
    this.appState.workflowDagRuns.updateRun(runId, { /* unchanged */ });
    this.appState.workflowDagRuns.updateStep(runId, stepId, { /* unchanged */ });
    this.appState.workflowDagRuns.startAttempt({ /* unchanged */ });
    this.appState.workflowDagRuns.appendEvent({ /* unchanged */ });
    return this.recomputeReadiness(runId, now);
  })();
}
```

Keep every argument and computation exactly as-is — the only change is the
`this.appState.db.transaction(() => { ... })()` wrapper around the body and
returning the snapshot from inside it. Do the same for the other methods (for
`completeStep`, the trailing `this.finalizeRun(this.recomputeReadiness(...))` goes
inside the transaction too).

**Verify**: `npm --workspace @athena/core run typecheck` → exit 0.

### Step 2: Confirm existing workflow behavior is unchanged

**Verify**: `npm --workspace @athena/core run test:unit -- workflow` → all pass (success-path behavior is identical; only failure atomicity changed).

### Step 3: Add a rollback test

Add a test proving a mid-transition failure leaves NO partial state. Suggested
approach (model construction after an existing test in the workflow-state test
file): start a step, then induce a throw on the last write of a transition (e.g.
by passing an input that makes `appendEvent` or `finishAttempt` throw, or by
spying/stubbing one repository method to throw), and assert that after the throw
the step/run row is unchanged from before the call (no `running` status without an
attempt row, etc.). If inducing a precise mid-write throw is impractical in the
test harness, instead assert the positive invariant: after `startStep`, the step
status, attempt count, and the attempt row are mutually consistent — and document
in your report that a true rollback test needs a fault-injection hook.

**Verify**: `npm --workspace @athena/core run test:unit` → all pass, including the new test.

## Test plan

- New test in the workflow-state test file covering atomicity (see Step 3).
- Existing workflow suites confirm the success path is unchanged.
- Verification: `npm --workspace @athena/core run test:unit` → all pass.

## Done criteria

ALL must hold:

- [ ] `startStep`, `completeStep`, `failStep`, `recoverStaleRunningSteps` (and any other multi-write transition method) run inside `this.appState.db.transaction(...)`
- [ ] `npm --workspace @athena/core run typecheck` exits 0
- [ ] `npm --workspace @athena/core run test:unit` exits 0; new atomicity test present
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report if:

- A transition method contains an `await` (it should be fully synchronous; better-sqlite3 transactions cannot wrap async). If one exists, the design must change — report it.
- The method bodies no longer match the excerpts (drift).
- Wrapping changes any success-path test result in a way you cannot explain.

## Maintenance notes

- Plan 007 (concurrency guard) builds on this — with atomic transitions, a serialized executor cannot observe a half-applied transition.
- Reviewer should confirm `recomputeReadiness`/`finalizeRun` are inside the transaction where they follow a transition, so readiness reflects the committed state.
- Any new transition method added later should follow the same wrap-in-`db.transaction` rule.
