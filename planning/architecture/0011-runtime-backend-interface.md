<!-- AUDIENCE: Internal/Technical -->

# ADR 0011: Runtime Backend Interface

## Status

Accepted.

## Context

Team Orchestrator needs pluggable execution. The default should be local machine process execution, containers should be first-class, and API/cloud backends should fit later.

Agents may use different implementation types, but the product should expose a consistent run model.

## Decision

Introduce a runtime backend abstraction for task runs.

The backend is responsible for preparing execution, starting the agent, streaming or recording events/logs, handling cancellation, and returning final run output.

Agent implementation type and runtime backend are distinct. For example, a LangGraph agent may run through a local process, Python module adapter, container command, or future HTTP/API backend.

## First-Class Backends

First-class target backends and adapters:

- `local-process`
- `container-command`
- `http-api`
- `js-module`
- `python-module`
- `langgraph`
- `team-orchestrator-dag`

The backend selected for a run must be recorded on the run.

Implementation priority:

1. `local-process`
2. `container-command`
3. `http-api`
4. module/framework adapters as needed by base agents
5. `team-orchestrator-dag` after missions and workflow templates are implemented

Local process is first because the product is local-first. It is not a local-only commitment; HTTP/API and hosted execution remain first-class future paths.

## Backend Contract

Conceptual interface:

```ts
interface RuntimeBackend {
  describe(): BackendDescriptor;
  validate(request: RuntimeValidateRequest): Promise<RuntimeValidateResult>;
  start(request: RuntimeStartRequest, sink: RuntimeEventSink): Promise<RuntimeRunHandle>;
  cancel(request: RuntimeCancelRequest): Promise<RuntimeCancelResult>;
}
```

The run handle should include:

- run identity
- process/container/API invocation identity when available
- status
- final output
- artifact references
- error or cancellation details

Backend requests must carry explicit execution boundaries:

- workspace root
- working directory
- environment allowlist or explicit environment map
- timeout/limit settings
- permissions/risk context
- artifact output directory or sink

## Local Process Default

The local process backend is the default because the product is local-first and should feel easy to inspect and debug.

Local process execution must still honor:

- working-directory boundaries
- environment controls
- timeout limits
- tool-call/loop limits where available
- cancellation

## Container Backend

Container execution is first-class for stronger isolation and reproducibility. It should support workspace mounting, environment scoping, timeout/cancel behavior, and artifact capture.

## API Backend

HTTP/API agents allow hosted or remote execution later without changing task/mission/run semantics.

## Event Sink

Backends emit events to a `RuntimeEventSink`. The service layer persists events. Backends should not write directly to the database.

## Cancellation

Cancellation is best-effort and idempotent.

Cancellation outcomes should distinguish:

- `cancelled`
- `not-running`
- `unsupported`
- `failed`

## Existing Backend Reuse

Existing execution and sandbox backend concepts should be harvested where useful, but the reset contract is task/agent/run-oriented and does not need to preserve the current `ExecutionBackend` shape.

## Consequences

Agent implementation type and runtime backend are related but not identical. A manifest may declare supported backends and implementation adapters.

Existing sandbox and execution backend work can be harvested but should be reframed around task runs and formal agents.

## Open Questions

- What is the minimal event protocol every backend must emit?
- Should backend selection be per agent, per task, per run, or all three?
- What is the first HTTP/API backend shape?
