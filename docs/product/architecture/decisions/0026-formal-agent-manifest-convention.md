<!-- AUDIENCE: Internal/Technical -->

# ADR 0026: Formal Agent Manifest Convention For The Agentic Workbench Pilot

## Status

Accepted.

## Context

The Agentic Development Workbench pilot needs "formal agents" that can be authored, reviewed, run, inspected, governed, and reused. ADR 0007 already defines agent manifests as the product contract, and the bundled `software-team` plugin already demonstrates the current full manifest shape.

The pilot should not introduce a parallel manifest format for AthenaAgent-powered agents. It should specialize the existing manifest model so the first model-backed agents can run under Console without schema-breaking changes.

## Decision

A formal agent for the pilot is a normal Team Orchestrator `*.agent.yaml` manifest that follows a stricter authoring convention.

Minimum required convention:

- Identity: `agent.id`, `agent.name`, `agent.version`, and `agent.description`.
- Capabilities: one or more namespaced strings that describe what the agent can do.
- Inputs: typed task input contract under `agent.inputs`.
- Outputs: flexible or schema-backed output contract under `agent.outputs`, with artifact hints for every expected operator-visible artifact.
- Implementation: executable adapter under `agent.implementation`.
- Runtime: preferred backend, working directory, and model/provider requirements under `agent.runtime`.
- Permissions: network, filesystem, shell, credentials, containers when applicable, and durable-memory access under `agent.permissions`.
- Limits: runtime, tool, retry, output, and artifact bounds under `agent.limits` where supported.
- Observability: `agent.observability.mode`, and event hints when the runner can emit structured events.
- Compatibility: Team Orchestrator and plugin API compatibility.
- UI hints: icon, color, and input order when useful.

The existing manifest schema supports this convention. No schema-breaking change is required for the pilot.

## AthenaAgent-Powered Agents

AthenaAgent-powered agents should use the same manifest shape, with these additional pilot rules:

- Use `implementation.type: local-command` for the first bridge.
- Use `runtime.preferredBackend: local-process` for the Week 2/3 bridge unless a later deployment decision explicitly selects `container-command`.
- Declare `runtime.modelProvider` so Console readiness can block missing provider configuration before execution.
- Opt into strict result-envelope parsing once the Console strict parser lands, using the schema-compatible mechanism selected by the integration contract. Do not overload the current `outputs.mode` enum unless the schema is deliberately extended.
- Declare `observability.mode: inspectable` because the runner will emit structured event sidecar records.
- Keep filesystem permissions scoped to the target repository.
- Prefer read-only or propose-changes run modes for pilot software-team workflows.
- Declare durable-memory read/propose namespaces explicitly; default to no autonomous durable-memory writes.
- Keep `credentials: deny` unless a future capability has a reviewed credential-use case.

## Input Contract

The canonical runtime envelope stores task inputs at `envelope.task.inputs`.

Agent runners should consume that location directly or through the PDK helper `parseAgentEnvelopeInputs`. Legacy top-level `envelope.inputs` is not part of the Console contract.

## First Pilot Agent Shape

The first AthenaAgent-powered capability is `athena-agent.repo-summary`.

Expected manifest characteristics:

- Capabilities: `repo.summary`, `repo.inspect`, and `artifacts.produce`.
- Inputs: repository path or repository object, optional objective, optional focus, optional run mode, and optional memory context.
- Runtime: local-command wrapper invoking the AthenaAgent Console runner.
- Provider: OpenAI-compatible provider requirement resolved by Console.
- Permissions: scoped filesystem access, network only for model/provider egress as required by the runtime path, shell disabled or tightly bounded unless the runner needs it.
- Outputs: markdown summary plus a previewable repository-summary artifact.
- Observability: inspectable event sidecar.
- Limits: initially conservative runtime, output, artifact, and tool bounds.

## Consequences

The formal-agent convention remains compatible with the current plugin loader, manifest schema, catalog indexing, task input validation, readiness checks, and artifact expectations.

Agent authors get one convention for deterministic, model-backed, and later container-backed agents.

The AthenaAgent bridge can focus on runtime integration instead of schema design.

## References

- ADR 0007: Agent Manifest and Lifecycle Contract.
- `packages/core/schemas/team-orchestrator/manifests/v1/agent.schema.json`.
- `bundled-plugins/software-team/agents/*.agent.yaml`.
- `packages/pdk/src/agent.ts`.
- `AGENTIC_PLATFORM_6_WEEK_DETAILED_PLAN.md` Task 1.4.
