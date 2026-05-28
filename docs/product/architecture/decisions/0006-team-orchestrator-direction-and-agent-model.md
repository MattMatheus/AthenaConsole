<!-- AUDIENCE: Internal/Technical -->

# ADR 0006: Team Orchestrator Direction and Formal Agent Model

## Status

Accepted for planning reset.

## Context

The project is shifting from an Athena-centered agent runtime and console toward a web-first agent orchestrator named Team Orchestrator.

The earlier planning corpus contains useful control-plane, runtime, observability, and governance work, but its product center has drifted toward enterprise fleet governance and prose-based persona orchestration. The next phase should prioritize a solo developer and product operator experience: define tasks, select formal agents, run them locally, inspect execution, and compose repeatable workflows over time.

## Decision

Team Orchestrator is the product direction. It is a web-first agent orchestrator for local-first, human-directed agent work.

The console is the primary product surface. API and CLI surfaces remain useful, but they should support the console-centered product rather than define the main user experience.

Agents are formal executable units, not primarily prose prompts or personas. Agent definitions are manifest-backed and implemented through a consistent lifecycle contract.

Athena fades from the dominant product abstraction. It may remain as an internal/default orchestrator role, planning agent, or legacy code name, but the product model should not require Athena as the user-facing center.

## Domain Model

- **Plugin**: Installable bundle containing agents, workflow templates, docs, tests, schemas, fixtures, and optional UI metadata.
- **Agent**: Formal executable unit with a manifest, lifecycle contract, capabilities, tools, permissions, runtime config, flexible outputs, and version identity.
- **Task**: User-visible unit of work assigned to one compatible agent.
- **Mission**: Collection of tasks with shared goal, context, and optional dependencies.
- **Run**: Execution attempt of a task or mission.
- **Artifact**: File or structured data produced by a run.
- **Event**: Structured timeline record emitted by agents, runtimes, or the system.
- **Workflow Template**: Reusable ordered task plan or task graph.
- **Schedule**: Trigger that starts a task, mission, or workflow template later or recurringly.

## Agent Contract

Team Orchestrator agents must implement a consistent lifecycle interface:

- `describe`
- `validate`
- `run`
- `cancel`
- later: `resume`

The manifest is the stable integration contract. Agent implementation may point to code, a command, a container, an HTTP endpoint, a framework wrapper, or a native Team Orchestrator workflow.

## Initial Implementation Types

The platform should support these implementation types as first-class targets:

- local command
- container command
- HTTP/API agent
- JS/TS module
- Python module
- LangGraph wrapper
- native Team Orchestrator DAG

CrewAI is not an initial target.

## Runtime and State

Execution is pluggable. The default backend is local machine process execution. Containers are a first-class backend. Hosted/cloud/API-based execution should fit later without redefining the domain model.

Runtime app state should move toward a database-backed model, with SQLite as the likely local-first default. Plugin manifests and agent packages remain filesystem-backed and indexable into app state.

## Orchestration Model

The product is human-directed first. Users create tasks manually, select or confirm compatible agents, and run tasks or missions from the console.

Natural-language mission planning and proposal-based task generation are later layers, not required for the initial reset.

Orchestration is sequential-first, but the data model should allow task dependencies so DAG execution can be introduced without a domain rewrite.

Agents may create follow-up tasks. Follow-up tasks should capture provenance and enter the product as pending/proposed work rather than silently driving unbounded autonomous loops.

## Safety Model

Approvals are required for risky actions, not for every follow-up task.

Loop and tool-call limits are core safety controls. An agent that is stuck should stop with inspectable evidence rather than thrash through tokens or tool calls indefinitely.

## Scheduling

Scheduling is important and should remain near-term, but it follows the agent/task/plugin foundation. The scheduling model should trigger tasks, missions, or workflow templates.

## Consequences

Planning artifacts centered on enterprise fleet governance, Athena-as-product, or prose-persona orchestration are legacy context unless explicitly reframed.

Existing control-plane work remains valuable where it supports local execution, runtime backends, artifacts, events, logs, evidence, permissions, scheduling, and inspectability.

The next planning pass should rebuild the roadmap around:

- formal agent manifests and lifecycle
- plugin loading
- database-backed app state
- console-first task creation and run inspection
- pluggable local/container execution
- mission/task composition
- event/artifact observability
- loop limits and risk-based approvals
