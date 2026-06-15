<!-- AUDIENCE: Engineer/SDK -->

# SDK and Integration Guide

Team Orchestrator exposes two integration surfaces for engineers and integrators:

1. **Agent Developer Kit (ADK)** — the `@athena/pdk` package for authoring plugin-backed agents.
2. **HTTP Control-Plane API Reference** — the REST API for creating and managing tasks, missions, workflow templates, runs, agents, providers, repositories, workspaces, and usage records.

---

## 1. Agent Developer Kit (ADK)

`@athena/pdk` is the code-level Agent Developer Kit for Team Orchestrator plugin authors. Use it to build plugin-backed agents that parse task/run envelopes, validate declared inputs, produce structured output, and emit artifact metadata in the shape the runtime expects.

**Full guide**: [agent-developer-kit.md](agent-developer-kit.md)

The ADK guide covers:

- Plugin and agent manifest layout (`plugin.yaml`, `agents/*.agent.yaml`)
- The run envelope (`AgentTaskRunEnvelope`) and how to parse it
- Declaring inputs (`AgentInputContract`, `AgentInputField`, all field types)
- Writing a handler with `runAgentHandler` (envelope parse + input validation + handler invoke)
- Producing output and artifacts (`createAgentRunOutput`, `createAgentArtifact`, `serializeAgentRunOutput`)
- Validation and errors (`AgentSdkValidationError`, `issues[]` shape)
- Verification status (`AgentRunVerificationStatus`, `AgentRunVerificationFailure`)
- A complete worked example (plugin.yaml + agent manifest + runner + test)
- Capability packs (pack metadata, connector metadata, fixtures, validation)
- Build, test, and package commands

**Install**:

```bash
npm install @athena/pdk
```

**Quick reference**:

| Function | Purpose |
| --- | --- |
| `parseAgentTaskRunEnvelope(value)` | Parse and validate the task/run JSON envelope |
| `parseAgentInputs(contract, inputs)` | Validate an input map against a declared contract |
| `parseAgentEnvelopeInputs(envelope, contract)` | Shorthand: parse `envelope.task.inputs` against a contract |
| `runAgentHandler(handler, options)` | Parse envelope + resolve inputs + invoke handler |
| `createAgentRunOutput(output, options)` | Build the run output envelope |
| `createAgentArtifact(artifact)` | Build and validate a single artifact metadata record |
| `serializeAgentRunOutput(envelope)` | Serialize run output to a newline-terminated JSON string |

---

## 2. HTTP Control-Plane API Reference

The HTTP API is the REST interface for operators and integrators who need to create tasks, trigger runs, inspect results, manage agents and providers, and query usage records.

**Full guide**: `api/README.md` *(drafted in plan 032)*

Key endpoints (available now):

- `GET /api/v1/health` — service health
- `GET /api/v1/readiness` — readiness probe
- `GET /api/v1/agent-catalog/agents` — list available agents (filterable by capabilities)
- `GET /api/v1/agent-catalog/plugins` — list loaded plugins with catalog diagnostics
- `POST /api/v1/tasks` — create a task
- `POST /api/v1/tasks/:id/run` — trigger a run

---

## Quick Links

- Sample plugins: `../../sample-plugins/` — reference implementations for common patterns
- PDK source: `../../packages/pdk/` — source for `@athena/pdk`
- Manifest schemas: `../../packages/core/schemas/team-orchestrator/manifests/v1/`
