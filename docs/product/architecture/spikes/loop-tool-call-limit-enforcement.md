<!-- AUDIENCE: Internal/Technical -->

# Spike: Loop And Tool-Call Limit Enforcement

## Status

Proposed.

## Context

[ADR 0013: Safety, Approval, and Loop Limit Model](../decisions/0013-safety-approval-and-loop-limit-model.md) makes loop and tool-call limits mandatory safety controls. It requires runs to stop with `stopped-by-limit` when a limit is reached and calls out repeated-action detection where Team Orchestrator can observe tool or action calls.

The current task-run path resolves and surfaces the limits, but only some are enforceable:

- `packages/core/src/control-plane/services/task-workbench.ts` defines default limits for `maxRuntimeSeconds`, `maxToolCalls`, `maxRepeatedActions`, `maxRetries`, and `maxFollowUpTasks`.
- `TaskRunSafetyStop.limitType` can represent only `maxRuntimeSeconds`, `maxOutputBytes`, and `maxArtifacts`.
- `validateEnvelopeLimits` checks only output bytes and artifact count.
- Runtime duration is enforced separately when waiting for the child process to exit.
- `AgentRunEnvelope` contains `output`, `artifacts`, `memoryRequests`, and verification fields, but no `toolCallCount`, `repeatedActionCount`, or action trace.
- The runtime contract exposes reliability metadata such as `contextCompactions`, but no analogous tool-call count.

Investigation found transcript-level tool-call IDs in runtime history normalization, but no aggregate count that reaches the task-run envelope. Because the task workbench cannot observe black-box local-process, container-command, or HTTP agent internals today, it cannot enforce `maxToolCalls` or `maxRepeatedActions` without a contract change.

## Gap

The operator sees `run.safety.limits` with `maxToolCalls` and `maxRepeatedActions`, which implies active enforcement. Today those controls are inactive for task runs unless a backend happens to self-limit internally, and that inactive state is not operator-visible.

This is weaker than ADR 0013 in two ways:

- The workbench cannot stop a run by `maxToolCalls` or `maxRepeatedActions`.
- Operators have no readiness or diagnostic signal that the declared control is missing runtime telemetry.

## Options

### Option 1: Envelope-Reported Counts

Extend the task-run result envelope so each runtime reports aggregate counters:

```ts
interface AgentRunEnvelope {
  output: unknown;
  artifacts: AgentRunArtifact[];
  memoryRequests: RuntimeMemoryRequest[];
  verificationStatus?: RunVerificationStatus;
  verificationFailures?: VerificationPolicyFailure[];
  toolCallCount?: number;
  repeatedActionCount?: number;
}
```

The PDK and every runtime wrapper would populate these fields when the agent framework can observe tool/action calls. `validateEnvelopeLimits` would enforce counts when present.

Trade-offs:

- Simple enforcement point in the existing workbench safety path.
- Works across local-process, container-command, and HTTP backends once each adapter reports the fields.
- Cannot stop a runaway agent before it exits unless the runtime also enforces internally or streams progress.
- Requires an explicit inactive-control diagnostic when fields are absent.

### Option 2: Runtime-Side Enforcement

Move `maxToolCalls` and `maxRepeatedActions` into the runtime/PDK execution loop and require each runtime to stop itself before returning.

Trade-offs:

- Can stop earlier than envelope-only enforcement.
- Best fit for runtimes with first-class tool orchestration.
- Harder to guarantee consistently across black-box agents and custom HTTP agents.
- The workbench still needs a returned stop reason so run records and events stay consistent.

### Option 3: Tool/Action Interceptor

Route all tool calls through a Team Orchestrator interceptor that increments counters, detects repeated identical actions, classifies risk, and denies calls after limits.

Trade-offs:

- Strongest and hardest-to-bypass enforcement for first-party tools.
- Creates the clearest future home for approval/risk classification.
- Requires larger runtime and PDK architecture work.
- Does not cover black-box agents that execute tools outside the interceptor.

## Recommendation

Use a two-stage implementation:

1. Add envelope-reported counts and workbench enforcement first.
2. Add runtime-side or interceptor enforcement for runtimes that can stream or broker tool calls.

The first stage makes the existing safety declaration truthful when telemetry exists and makes inactive controls visible when it does not. The second stage improves stop latency and bypass resistance for richer runtimes.

## Required Contract Changes

Envelope and workbench:

- Extend `AgentRunEnvelope` with `toolCallCount?: number` and `repeatedActionCount?: number`.
- Extend `TaskRunSafetyStop.limitType` with `"maxToolCalls" | "maxRepeatedActions"`.
- Add `validateEnvelopeLimits` checks that compare present counts with `safety.limits.maxToolCalls` and `safety.limits.maxRepeatedActions`.
- Emit the same stopped-by-limit path used by runtime/output/artifact limits.

PDK:

- Document the new envelope fields in the agent result contract.
- Provide helper APIs for recording tool/action calls so agents do not hand-roll counting.
- Define repeated-action identity, likely `{ toolName, normalizedInput }` or `{ actionType, normalizedTarget, normalizedInput }`.

Local-process runtime:

- For PDK-based local agents, populate the envelope counters from the PDK helper.
- For non-PDK black-box commands, omit the fields and emit an inactive-control diagnostic.

Container-command runtime:

- Mirror local-process behavior.
- Prefer runtime-side enforcement once the container entrypoint uses the PDK helper.

HTTP API runtime:

- Accept the new fields in HTTP agent responses.
- Add response validation errors for malformed counts.
- Treat absent fields as unsupported telemetry, not as zero calls.

Operator diagnostics:

- When counts are absent, do not enforce the missing count.
- Surface an operator-visible readiness/diagnostic note that `maxToolCalls` and/or `maxRepeatedActions` are inactive for that runtime/agent because telemetry was not reported.
- Include the inactive-control note in run safety events or run readiness metadata so non-enforcement is never silent.

## Absent-Signal Behavior

The workbench should enforce when a count is present and skip only the missing signal when it is absent. Absence must never be interpreted as `0`.

For example:

- `toolCallCount: 81` with `maxToolCalls: 80` stops the run.
- `toolCallCount` absent leaves that specific limit unenforced.
- The run records a diagnostic such as `maxToolCalls inactive: runtime did not report toolCallCount`.
- Other limits, including runtime duration, output bytes, artifacts, retries, and follow-up task caps, continue to enforce normally.

This makes the transition compatible with existing agents while removing the current silent non-enforcement.

## Test Strategy

Contract tests:

- Validate that envelopes accept optional `toolCallCount` and `repeatedActionCount`.
- Reject negative, non-integer, or non-number counts when schema validation exists for the backend.

Workbench tests:

- Stop on `toolCallCount > maxToolCalls`.
- Stop on `repeatedActionCount > maxRepeatedActions`.
- Do not stop when counts are equal to thresholds.
- Do not stop when counts are absent, but record the inactive-control diagnostic.
- Preserve existing runtime, output-byte, artifact, retry, and follow-up behavior.

Runtime/PDK tests:

- PDK helper increments tool-call count.
- PDK helper detects repeated normalized actions.
- Local/container PDK agents populate the envelope fields.
- HTTP responses with valid fields enforce in the workbench.
- HTTP responses without fields show inactive diagnostics.

Integration tests:

- A fixture agent that reports excessive calls stops with `stopped-by-limit`.
- A fixture agent that omits count telemetry completes or fails according to existing behavior while surfacing inactive-control diagnostics.

## Open Questions

- What exact normalized identity defines a repeated action for shell commands, HTTP connector calls, file writes, and model-tool calls?
- Should the threshold be `>` or `>=`? Existing output/artifact limits use `>`, so this proposal recommends `>` for consistency.
- Should inactive-control diagnostics be events, readiness gates, run detail metadata, or all three?
- Which runtimes can enforce mid-run rather than after envelope return?
- Should global maximums cap manifest-provided `maxToolCalls` and `maxRepeatedActions` separately from policy-pack maximums?

## Follow-Up Implementation Slice

Create a follow-up epic that updates the envelope contract, PDK helper, runtime adapters, workbench enforcement, diagnostics, and tests together. Do not add workbench-only enforcement until at least one runtime path can report trustworthy counts.
