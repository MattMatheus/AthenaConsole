# Plan 009: Apply workflow retry backoff between attempts

> **Executor instructions**: Follow this plan step by step. Run every verification
> command and confirm the expected result before moving on. If anything in "STOP
> conditions" occurs, stop and report — do not improvise. When done, update the
> status row for this plan in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 182e9ba..HEAD -- packages/core/src/control-plane/services/workflow-dag-executor.ts packages/core/src/control-plane/services/workflow-retry-policy.ts`

## Why this matters

The workflow retry policy exposes a four-mode `backoff` field
(`"none" | "fixed" | "linear" | "exponential"`) that is parsed, validated, stored,
and surfaced — but **never applied**. There is no timer/delay anywhere in the
executor, so all retries fire immediately. For a `connector-rate-limit` failure (a
first-class retryable phase, classified from HTTP 429), immediate back-to-back
retries actively hammer the rate-limited endpoint. Configuring `exponential` today
is a no-op. This plan makes the declared backoff real, with an injectable timer so
tests stay fast.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED (introduces real delays; tests must inject a fake timer to avoid slowness/flakiness)
- **Depends on**: plans/004-shared-retry-policy-parser.md
- **Category**: bug (no-op configuration / unsafe immediate retry)
- **Planned at**: commit `182e9ba`, 2026-06-13

## Current state

`packages/core/src/control-plane/services/workflow-dag-executor.ts` — on a
retryable failure the loop re-runs immediately:

```ts
// inside execute(), after a non-completed taskRun and a retry decision:
if (!retryDecision.retry) {
  break;
}
const resumable = workflowState.resumeFromFirstFailedStep(runId);
resetProjectedTasksForPendingSteps(appState, resumable);
snapshot = workflowState.recomputeReadiness(runId);
continue;   // <-- immediate retry, no delay
```

The policy carries `backoff` (after plan 004, via
`parseWorkflowTaskRetryPolicy(task)` from `services/workflow-retry-policy.ts`, whose
`WorkflowTaskRetryPolicy` includes `backoff`). The executor options type is:

```ts
// :9
export interface LocalWorkflowDagExecutorOptions {
  appState?: AppStateDatabase;
}
```

There is no `sleep`/timer abstraction yet.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Typecheck core | `npm --workspace @athena/core run typecheck` | exit 0 |
| Executor tests | `npm --workspace @athena/core run test:unit -- workflow-dag-executor` | all pass |
| All core tests | `npm --workspace @athena/core run test:unit` | all pass |

## Scope

**In scope**:
- `packages/core/src/control-plane/services/workflow-dag-executor.ts` (inject timer; compute + await backoff)
- `packages/core/src/control-plane/services/workflow-retry-policy.ts` (export a `computeRetryBackoffMs` helper) — OR put the helper in the executor file; prefer the retry-policy module so it is unit-testable alongside the parser.
- `packages/core/tests/control-plane.workflow-dag-executor.test.ts` (assert backoff delay applied)
- `packages/core/tests/control-plane.workflow-retry-policy.test.ts` (unit-test the math) — if created by plan 004; otherwise add a small test file.

**Out of scope** (do NOT touch):
- The retry *decision* logic (`evaluateRetryDecision`) — only the delay between attempts is added.
- The concurrency guard (plan 007).
- `classifyRetryFailurePhase`.

## Git workflow

- Branch: `advisor/009-apply-retry-backoff`
- Commit in logical units; short imperative messages.
- Do NOT push or open a PR unless instructed. Land plan 004 first.

## Steps

### Step 1: Add the backoff math helper

In `services/workflow-retry-policy.ts` add and export:

```ts
const DEFAULT_RETRY_BASE_DELAY_MS = 1000;
const MAX_RETRY_DELAY_MS = 60_000;

export function computeRetryBackoffMs(
  backoff: WorkflowTaskRetryPolicy["backoff"],
  attempt: number,           // the attempt number that just failed (1-based)
  baseMs: number = DEFAULT_RETRY_BASE_DELAY_MS
): number {
  const n = Math.max(1, Math.trunc(attempt));
  let ms: number;
  switch (backoff) {
    case "none": ms = 0; break;
    case "fixed": ms = baseMs; break;
    case "linear": ms = baseMs * n; break;
    case "exponential": ms = baseMs * 2 ** (n - 1); break;
    default: ms = 0;
  }
  return Math.min(ms, MAX_RETRY_DELAY_MS);
}
```

**Verify**: `npm --workspace @athena/core run typecheck` → exit 0.

### Step 2: Inject a timer into the executor

Extend the options and add a default:

```ts
export interface LocalWorkflowDagExecutorOptions {
  appState?: AppStateDatabase;
  sleep?: (ms: number) => Promise<void>;
}
```

In the class, resolve a `sleep` function once (constructor or a private getter):

```ts
private readonly sleep: (ms: number) => Promise<void> =
  this.options.sleep ?? ((ms) => (ms > 0 ? new Promise((resolve) => setTimeout(resolve, ms)) : Promise.resolve()));
```

### Step 3: Apply the delay before each retry

In the execute loop, after deciding to retry and before `continue`, compute and
await the backoff using the policy's `backoff` and the failed step's attempt count:

```ts
const policy = parseWorkflowTaskRetryPolicy(task);   // from plan 004
const resumable = workflowState.resumeFromFirstFailedStep(runId);
resetProjectedTasksForPendingSteps(appState, resumable);
if (policy) {
  await this.sleep(computeRetryBackoffMs(policy.backoff, failedStep.attempt));
}
snapshot = workflowState.recomputeReadiness(runId);
continue;
```

Use the already-available `failedStep` (the loop computes `const failedStep = snapshot.steps.find(...) ?? step;`). Import `parseWorkflowTaskRetryPolicy` and `computeRetryBackoffMs` from `./workflow-retry-policy.js`.

**Verify**: `npm --workspace @athena/core run typecheck` → exit 0.

### Step 4: Tests

- Unit-test `computeRetryBackoffMs`: `none`→0, `fixed`→base, `linear`→base×attempt, `exponential`→base×2^(attempt-1), and the cap.
- Executor test: construct the service with an injected `sleep` spy that records the ms it was called with and resolves immediately. Drive a run that retries with an `exponential` policy and assert `sleep` was called with growing delays (and NOT called for `backoff: "none"`). Model on the existing retry tests in `control-plane.workflow-dag-executor.test.ts`.

**Verify**: `npm --workspace @athena/core run test:unit -- workflow` → all pass; existing retry tests still fast (they must inject `sleep` or rely on `none`).

## Test plan

- `computeRetryBackoffMs` unit tests (all modes + cap).
- Executor backoff test with an injected fake timer asserting increasing delays for `exponential` and zero for `none`.
- Verification: `npm --workspace @athena/core run test:unit` → all pass.

## Done criteria

ALL must hold:

- [ ] `computeRetryBackoffMs` exists and is unit-tested
- [ ] The executor awaits `this.sleep(computeRetryBackoffMs(...))` before each retry
- [ ] Executor accepts an injectable `sleep` (default real `setTimeout`)
- [ ] A test asserts increasing delays for `exponential` via an injected timer
- [ ] `npm --workspace @athena/core run typecheck` exits 0
- [ ] `npm --workspace @athena/core run test:unit` exits 0 and does not become noticeably slower
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report if:

- Plan 004 has not landed (no shared `parseWorkflowTaskRetryPolicy` / `backoff` on the policy type).
- Existing retry tests do not inject a timer and would now sleep for real (they would slow the suite) — report which tests need the injected `sleep`.
- The execute loop no longer matches the excerpt (drift).

## Maintenance notes

- The base/max delay constants are conservative defaults; if a manifest field for base delay is added later, thread it through `computeRetryBackoffMs`.
- Reviewer should confirm no real `setTimeout` runs in the test suite (all executor tests inject `sleep`).
- This pairs naturally with any future connector work — exponential backoff on 429s is the main motivation.
