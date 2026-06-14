# Plan 004: Extract one shared workflow retry-policy parser

> **Executor instructions**: Follow this plan step by step. Run every verification
> command and confirm the expected result before moving on. If anything in "STOP
> conditions" occurs, stop and report — do not improvise. When done, update the
> status row for this plan in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 182e9ba..HEAD -- packages/core/src/control-plane/services/workflow-dag-executor.ts packages/core/src/control-plane/services/workflow-queue-status.ts`
> If either file changed, compare the "Current state" excerpts before proceeding; on a mismatch, STOP.

## Why this matters

`retryPolicyFromTask` is implemented twice and the copies have **drifted**, so the
operator-facing queue view and the actual executor disagree about whether a failed
step will be retried:

- The **executor** copy (`workflow-dag-executor.ts:183`) is strict: it requires
  `Number.isInteger(maxAttempts)`, a valid `backoff`, and rejects an empty
  `retryableFailurePhases` after filtering. If the policy is invalid it returns
  `undefined` and the step is **not** retried.
- The **queue-status** copy (`workflow-queue-status.ts:192`) is loose: it omits the
  integer check, omits `backoff` entirely, and does not reject empty phases.

Result: a task with, e.g., `maxAttempts: 2.5` or an empty phase list is advertised
as `retryable` (with a `maxAttempts`) in the queue view, while the executor never
retries it — a misleading "this will retry" readout for a permanently stuck step.
One shared parser makes the two surfaces agree by construction.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug (state-machine readout divergence)
- **Planned at**: commit `182e9ba`, 2026-06-13

## Current state

Both files independently declare the same `RetryFailurePhase` type and a
`WorkflowTaskRetryPolicy` interface — **but the executor's interface includes a
`backoff` field and the queue-status one does not.**

Executor (correct/strict), `workflow-dag-executor.ts:22` and `:183`:

```ts
interface WorkflowTaskRetryPolicy {
  maxAttempts: number;
  backoff: "none" | "fixed" | "linear" | "exponential";
  retryableFailurePhases: RetryFailurePhase[];
  idempotency: "read-only" | "idempotent" | "non-idempotent";
  externalWriteRetry: "forbid" | "require-approval" | "allow";
}

function retryPolicyFromTask(task: TaskRecord): WorkflowTaskRetryPolicy | undefined {
  if (!isRecord(task.provenance) || !isRecord(task.provenance.retryPolicy)) return undefined;
  const policy = task.provenance.retryPolicy;
  if (
    typeof policy.maxAttempts !== "number" ||
    !Number.isInteger(policy.maxAttempts) ||
    !isRetryBackoff(policy.backoff) ||
    !Array.isArray(policy.retryableFailurePhases) ||
    !isRetryIdempotency(policy.idempotency) ||
    !isExternalWriteRetry(policy.externalWriteRetry)
  ) return undefined;
  const retryableFailurePhases = policy.retryableFailurePhases.filter(isRetryFailurePhase);
  if (retryableFailurePhases.length === 0) return undefined;
  return { maxAttempts: policy.maxAttempts, backoff: policy.backoff, retryableFailurePhases, idempotency: policy.idempotency, externalWriteRetry: policy.externalWriteRetry };
}
```

Queue-status (loose/drifted), `workflow-queue-status.ts:25` and `:192` — note no `backoff`, no integer check, no empty-phase rejection.

**IMPORTANT — do NOT consolidate `classifyRetryFailurePhase`.** Each file has its
own version with a **different signature and logic**:
- executor: `classifyRetryFailurePhase(failure, taskRun)` — also checks `taskRun.verificationStatus`.
- queue-status: `classifyRetryFailurePhase(failure)` — checks `detail.status === 429` only.

These are intentionally different consumers; leave both in place. Only the
**policy parser, its type, and the small type-guards it calls** are being unified.

Queue-status only reads `maxAttempts`, `retryableFailurePhases`, `idempotency`,
and `externalWriteRetry` from the parsed policy (see `isRetryableStep` at
`workflow-queue-status.ts:180` and `baseItem` at `:137`), so receiving an extra
`backoff` field is harmless.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Typecheck core | `npm --workspace @athena/core run typecheck` | exit 0 |
| Workflow tests | `npm --workspace @athena/core run test:unit -- workflow` | all pass |
| All core tests | `npm --workspace @athena/core run test:unit` | all pass |

## Scope

**In scope**:
- `packages/core/src/control-plane/services/workflow-retry-policy.ts` (new shared module)
- `packages/core/src/control-plane/services/workflow-dag-executor.ts` (import shared parser; remove local copy)
- `packages/core/src/control-plane/services/workflow-queue-status.ts` (import shared parser; remove local copy + local type)
- `packages/core/tests/control-plane.workflow-retry-policy.test.ts` (new unit test for the parser)

**Out of scope** (do NOT touch):
- `classifyRetryFailurePhase` in either file — different per consumer, keep both.
- `evaluateRetryDecision`, `isRetryableStep`, the execute loop behavior — this plan only unifies parsing, it does not change retry semantics or add backoff application (that is plan 009).

## Git workflow

- Branch: `advisor/004-shared-retry-policy-parser`
- Commit per logical unit (create module; switch executor; switch queue-status); short imperative messages.
- Do NOT push or open a PR unless instructed.

## Steps

### Step 1: Create the shared module

Create `packages/core/src/control-plane/services/workflow-retry-policy.ts` exporting the strict (executor) behavior:

- `export type RetryFailurePhase = "runtime-start" | "execution" | "provider" | "verification" | "artifact-export" | "connector-rate-limit";`
- `export interface WorkflowTaskRetryPolicy { ... }` — the FULL shape **including `backoff`** (copy the executor's interface from `workflow-dag-executor.ts:22`).
- `export function parseWorkflowTaskRetryPolicy(task: TaskRecord): WorkflowTaskRetryPolicy | undefined` — copy the executor's strict `retryPolicyFromTask` body verbatim (the excerpt above).
- Move the type-guards the parser needs into this module and export the ones other files use: `isRetryBackoff`, `isRetryFailurePhase`, `isRetryIdempotency`, `isExternalWriteRetry`, and a local `isRecord`. Copy their implementations from `workflow-dag-executor.ts` (search that file for each `function is...`). Keep behavior identical.

Import `TaskRecord` from `../app-state/index.js` (matching the existing import in both files).

**Verify**: `npm --workspace @athena/core run typecheck` → exit 0.

### Step 2: Switch the executor to the shared parser

In `workflow-dag-executor.ts`:
- `import { parseWorkflowTaskRetryPolicy, type WorkflowTaskRetryPolicy, type RetryFailurePhase, isRetryFailurePhase /* + any guards still used elsewhere in this file */ } from "./workflow-retry-policy.js";`
- Delete the local `RetryFailurePhase` type, the local `WorkflowTaskRetryPolicy` interface, the local `retryPolicyFromTask`, and any of the moved type-guards that are now imported.
- Replace call sites of `retryPolicyFromTask(...)` with `parseWorkflowTaskRetryPolicy(...)`.
- Keep `classifyRetryFailurePhase` (executor version) and `evaluateRetryDecision` exactly as they are.

**Verify**: `npm --workspace @athena/core run typecheck` → exit 0.

### Step 3: Switch queue-status to the shared parser

In `workflow-queue-status.ts`:
- `import { parseWorkflowTaskRetryPolicy } from "./workflow-retry-policy.js";` (plus any guards it still needs locally).
- Delete the local `RetryFailurePhase` type (if no longer referenced after using the shared one — keep it if `classifyRetryFailurePhase` here still references it; in that case import the type from the shared module instead), the local `WorkflowTaskRetryPolicy` interface, and the local `retryPolicyFromTask`.
- Replace `retryPolicyFromTask(...)` calls (`:137`, `:181`) with `parseWorkflowTaskRetryPolicy(...)`.
- Leave `classifyRetryFailurePhase` (queue-status version) untouched.

**Verify**: `npm --workspace @athena/core run typecheck` → exit 0.

### Step 4: Run the workflow suites

**Verify**: `npm --workspace @athena/core run test:unit -- workflow` → all pass. If a queue-status test previously asserted a step was `retryable` under an invalid policy (non-integer maxAttempts, empty phases, or missing backoff), it will now correctly NOT be retryable — that is the bug fix; update the assertion and note it in your report.

## Test plan

- New: `packages/core/tests/control-plane.workflow-retry-policy.test.ts`, modeled on an existing parser-style test in `packages/core/tests/` (e.g. open `control-plane.workflow-dag-executor.test.ts` for construction patterns). Cover:
  - valid full policy → parsed (all fields, including `backoff`).
  - `maxAttempts: 2.5` (non-integer) → `undefined`.
  - `retryableFailurePhases: []` (or all-invalid entries) → `undefined`.
  - missing/invalid `backoff` → `undefined`.
  - missing `provenance.retryPolicy` → `undefined`.
- Verification: `npm --workspace @athena/core run test:unit` → all pass, including the new file.

## Done criteria

ALL must hold:

- [ ] `parseWorkflowTaskRetryPolicy` exists in `services/workflow-retry-policy.ts` and is the only retry-policy parser
- [ ] `grep -rn "function retryPolicyFromTask" packages/core/src/` returns no matches
- [ ] Both `workflow-dag-executor.ts` and `workflow-queue-status.ts` import the shared parser
- [ ] `classifyRetryFailurePhase` still exists in BOTH files, unchanged
- [ ] `npm --workspace @athena/core run typecheck` exits 0
- [ ] `npm --workspace @athena/core run test:unit` exits 0; new parser tests pass
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report if:

- The two `retryPolicyFromTask` bodies no longer match the excerpts (drift).
- Consolidating reveals that queue-status actually depends on the loose behavior in a non-test code path (it should not — confirm via `typeof`/usage).
- The type-guards differ between the two files (they should be equivalent; if not, report the difference before unifying).

## Maintenance notes

- This is the prerequisite for plan 009 (apply backoff): plan 009 consumes `policy.backoff` from this single parser.
- Reviewer should confirm no third copy of the parser exists and that queue-status now reflects executor retry eligibility exactly.
- If the retry-policy manifest schema changes, update only `workflow-retry-policy.ts`.
