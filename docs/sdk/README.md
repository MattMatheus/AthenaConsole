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

**Full reference**: [api/README.md](api/README.md)

Key endpoints:

| Endpoint | Description |
| --- | --- |
| `GET /api/v1/health` | Liveness probe |
| `GET /api/v1/readiness` | Readiness probe |
| `GET /api/v1/capabilities` | Server capability flags |
| `GET /api/v1/agent-catalog/agents` | List agents (filterable by capability) |
| `GET /api/v1/agent-catalog/plugins` | List plugins with catalog diagnostics |
| `POST /api/v1/tasks` | Create a task |
| `PUT /api/v1/tasks/:id` | Update a task |
| `POST /api/v1/tasks/:id/run` | Trigger a task run |
| `GET /api/v1/task-runs/:runId` | Get task run status |
| `POST /api/v1/runs` | Create a low-level run |
| `POST /api/v1/run-control/by-run/:runId/cancel` | Cancel a run by run ID |
| `GET /api/v1/sessions` | List run history |
| `GET /api/v1/events/stream` | Stream system events (SSE) |

**Auth**: `Authorization: Bearer $ATHENA_AUTH_API_TOKEN` + identity header (see [api/README.md](api/README.md)).

**API families** (17 pages): [Core/Health](api/core-health.md) · [Agent Catalog](api/agent-catalog.md) · [Tasks and Runs](api/tasks-and-runs.md) · [Missions](api/missions.md) · [Workflows](api/workflows-and-templates.md) · [Sessions](api/sessions.md) · [Run Templates, Harness Profiles, Directives](api/run-templates-harness-directives.md) · [Runs](api/runs.md) · [Work Queue and Memory](api/work-and-memory.md) · [Failed Work](api/failed-work.md) · [Schedules and Policy](api/schedules-and-policy.md) · [Operations and Events](api/operations-events.md) · [Model Providers](api/model-providers.md) · [Repositories](api/repositories.md) · [Durable Memory](api/durable-memory.md) · [Identity and RBAC](api/identity-rbac.md) · [Workspaces](api/workspaces.md)

---

## Quick Links

- Sample plugins: `../../sample-plugins/` — reference implementations for common patterns
- PDK source: `../../packages/pdk/` — source for `@athena/pdk`
- Manifest schemas: `../../packages/core/schemas/team-orchestrator/manifests/v1/`
