# Plan 018: SPIKE — enforce loop/tool-call safety limits

> **Executor instructions**: This is a SPIKE/DESIGN plan. Your primary deliverable
> is a written design proposal, not a behavior change. Do the investigation, write
> the proposal, and only make the small, clearly-bounded code change in Step 4 IF
> its precondition holds. If anything in "STOP conditions" occurs, stop and report.
> When done, update the status row for this plan in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 182e9ba..HEAD -- packages/core/src/control-plane/services/task-workbench.ts`

## Why this matters

ADR 0013 (`docs/product/architecture/decisions/0013-safety-approval-and-loop-limit-model.md`)
treats loop and tool-call limits as **mandatory** safety controls. The code resolves
and surfaces `maxToolCalls` and `maxRepeatedActions` (defaults 80 and 3) and emits
them in the `run.safety.limits` event — but **nothing ever enforces them**. The run
envelope carries no tool-call/repeated-action counts, so there is no signal to
enforce against. The product's differentiator is safe, inspectable agents; today two
of the five declared safety limits are non-functional. This spike defines how to
make them real, because the fix is a contract change across the runtime/PDK, not a
local edit — and must not be improvised.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED (contract change touching runtime + PDK; spike de-risks it)
- **Depends on**: none
- **Category**: safety / direction (design spike)
- **Planned at**: commit `182e9ba`, 2026-06-13

## Current state (the facts to anchor the proposal)

- Resolved limits include the two unenforced ones — `task-workbench.ts:114`:
  ```ts
  const DEFAULT_TASK_RUN_LIMITS = { maxRuntimeSeconds: 900, maxToolCalls: 80, maxRepeatedActions: 3, maxRetries: 2, maxFollowUpTasks: 5 } as const;
  ```
- The enforced stop type can't even represent a tool-call stop — `task-workbench.ts:231`:
  ```ts
  interface TaskRunSafetyStop {
    limitType: "maxRuntimeSeconds" | "maxOutputBytes" | "maxArtifacts";  // no maxToolCalls / maxRepeatedActions
    ...
  }
  ```
- `validateEnvelopeLimits` (`task-workbench.ts:1512`) checks only `maxOutputBytes`
  and `maxArtifacts`; runtime is enforced separately in `waitForExit` (`:2380`).
- The envelope carries NO per-action counts — `task-workbench.ts:251`:
  ```ts
  interface AgentRunEnvelope {
    output: unknown;
    artifacts: AgentRunArtifact[];
    memoryRequests: RuntimeMemoryRequest[];
    verificationStatus?: RunVerificationStatus;
    verificationFailures?: VerificationPolicyFailure[];
    // <-- no toolCallCount / repeatedActionCount
  }
  ```
- A grep confirms no enforcement consumer exists:
  `grep -rn "maxToolCalls\|maxRepeatedActions" packages/core/src` shows only
  defaults, resolution, and the surfaced event — never a stop.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Find runtime telemetry | `grep -rn "toolCall\|tool_call\|action\|stepCount\|contextCompactions" packages/core/src/runtime packages/core/src/shared/contracts` | shows what the runtime DOES emit |
| Typecheck core | `npm --workspace @athena/core run typecheck` | exit 0 (if Step 4 is done) |
| Tests | `npm --workspace @athena/core run test:unit -- task-workbench` | all pass (if Step 4 is done) |

## Scope

**In scope**:
- `docs/product/architecture/spikes/loop-tool-call-limit-enforcement.md` (new design proposal) — create the `spikes/` folder if absent.
- OPTIONAL, only if Step 4's precondition holds: a minimal, test-backed enforcement
  addition in `packages/core/src/control-plane/services/task-workbench.ts` and its test.

**Out of scope** (do NOT do in this plan):
- Inventing runtime telemetry that does not exist.
- Changing the PDK or agent runtimes (the proposal describes these changes; it does not make them).
- The retry/backoff work (plans 004/009).

## Git workflow

- Branch: `advisor/018-spike-enforce-safety-limits`
- Commit the proposal; commit any Step-4 code separately.
- Do NOT push or open a PR unless instructed.

## Steps

### Step 1: Establish what the runtime already reports

Run the telemetry grep above and read `packages/core/src/runtime/index.ts` and
`packages/core/src/shared/contracts/run.ts`. Determine precisely whether any agent
runtime currently produces a tool-call count or a repeated-action signal (note:
`contextCompactions` exists in `run.ts:38` — confirm whether a tool-call analogue
does). Record the finding.

### Step 2: Define the enforcement contract

In the proposal, specify:
- The exact envelope extension needed (e.g. `toolCallCount?: number; repeatedActionCount?: number` on `AgentRunEnvelope`), and where the count originates (which runtime/PDK surface must populate it).
- The enforcement point: extend `TaskRunSafetyStop.limitType` with `"maxToolCalls" | "maxRepeatedActions"` and add the checks to `validateEnvelopeLimits`.
- Behavior when the signal is ABSENT (e.g. for runtimes that don't report counts): enforce when present, no-op when absent, and surface a readiness/diagnostic note so operators know the control is inactive for that runtime. State this explicitly — silent non-enforcement is the current bug.

### Step 3: Write the proposal

Write `docs/product/architecture/spikes/loop-tool-call-limit-enforcement.md` with:
current state (cite the lines above), the gap vs ADR 0013, 2–3 options with
trade-offs (e.g. envelope-reported counts vs runtime-side enforcement vs a sandbox
interceptor), a recommended approach, the full list of contract changes (envelope +
PDK + each runtime), test strategy, and open questions. Cross-link ADR 0013.

**Verify**: `npm run check:docs` → exit 0 (links resolve).

### Step 4 (OPTIONAL — only if Step 1 found that counts ARE available in the envelope today)

If, and only if, the runtime already populates per-action counts reachable in the
envelope, implement the minimal enforcement:
- Add `"maxToolCalls" | "maxRepeatedActions"` to `TaskRunSafetyStop.limitType`.
- Add the two checks in `validateEnvelopeLimits` mirroring the existing
  `maxOutputBytes`/`maxArtifacts` checks (compare the envelope-reported count to
  `safety.limits.maxToolCalls` / `maxRepeatedActions`, return a `TaskRunSafetyStop`).
- Add tests mirroring the existing safety-stop tests in `task-workbench.test.ts`.

If counts are NOT available today (the expected case), DO NOT implement — the
proposal is the deliverable; report that enforcement requires the contract change
described in the proposal.

**Verify (only if Step 4 done)**: `npm --workspace @athena/core run typecheck` exit 0; `npm --workspace @athena/core run test:unit -- task-workbench` all pass.

## Test plan

- Spike deliverable: the design proposal exists with all required sections and resolving links.
- If Step 4 is executed: stop-on-limit tests for `maxToolCalls`/`maxRepeatedActions`
  modeled on the existing runtime/output/artifact stop tests.

## Done criteria

ALL must hold:

- [ ] `docs/product/architecture/spikes/loop-tool-call-limit-enforcement.md` exists with: current state (cited), ADR-0013 gap, options + trade-offs, recommendation, contract-change list, open questions
- [ ] The proposal states the absent-signal behavior explicitly (enforce-when-present + operator-visible inactive note)
- [ ] `npm run check:docs` exits 0
- [ ] If Step 4 was applicable and done: typecheck + task-workbench tests pass and new stop tests exist
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report (deliver the proposal, do not code) if:

- Step 1 shows the runtime does not emit per-action counts (then enforcement needs the contract change — that is the proposal's recommendation, not this plan's code).
- Implementing enforcement would require editing the PDK or a runtime (out of scope — describe it in the proposal).

## Maintenance notes

- This is the design half; a follow-up implementation epic (envelope + PDK + runtime
  changes) executes the recommendation. Reference ADR 0013 in that epic.
- Reviewer (of the proposal) should sanity-check that the recommended enforcement
  point cannot be bypassed by a runtime that simply omits the count.
