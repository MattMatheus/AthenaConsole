# Agent Developer Kit

`@athena/pdk` is the code-level Agent Developer Kit for Team Orchestrator plugin authors. Use it to build plugin-backed agents that parse task/run envelopes, validate declared inputs, produce structured output, and emit artifact metadata in the shape the runtime expects.

**Canonical guide**: [docs/sdk/agent-developer-kit.md](../../docs/sdk/agent-developer-kit.md) — covers manifests, envelope parsing, input validation, output and artifact builders, error handling, capability packs, and a complete worked example.

## Install

```bash
npm install @athena/pdk
```

## What It Provides

- Task/run envelope parsing with `parseAgentTaskRunEnvelope`.
- Manifest-shaped input validation with `parseAgentInputs` and `parseAgentEnvelopeInputs`.
- Typed agent handler execution with `runAgentHandler`.
- Run output and artifact builders with `createAgentRunOutput` and `createAgentArtifact`.
- Output serialization with `serializeAgentRunOutput`.
- Structured validation errors with per-field issues via `AgentSdkValidationError`.

## Validate Changes

```bash
npm --workspace @athena/pdk run typecheck
npm --workspace @athena/pdk run test
```
