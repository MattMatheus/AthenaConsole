<!-- AUDIENCE: Internal/Technical -->

# ADR 0007: Agent Manifest and Lifecycle Contract

## Status

Accepted.

## Context

Team Orchestrator is moving away from prose personas as the primary abstraction. The product needs formal agents that can be discovered, validated, executed, inspected, versioned, and eventually shared through plugins.

Agents may be implemented through local commands, containers, HTTP APIs, JS/TS modules, Python modules, LangGraph wrappers, or native Team Orchestrator DAGs. The manifest must be stable enough to support all of these without making the runtime understand every implementation detail.

## Decision

Agents are manifest-backed executable units with a required lifecycle contract.

An agent manifest defines:

- identity: `id`, `name`, `version`, optional description
- capabilities
- input contract
- flexible output/artifact hints
- implementation type
- runtime backend preferences
- permissions
- safety limits
- observability level
- compatibility metadata

Manifests are authored as YAML and validated through JSON Schema.

Every agent implementation must support the same lifecycle surface:

- `describe`
- `validate`
- `run`
- `cancel`
- later: `resume`

The lifecycle interface is the runtime contract. The manifest is the installation, discovery, compatibility, and UI contract.

## Manifest Shape

Exact schema names are provisional, but the first version should be YAML-authored and look conceptually like:

```yaml
agent:
  id: news.digest
  name: News Digest
  version: 1.0.0
  capabilities:
    - news.aggregate
    - text.summarize
  inputs:
    topic:
      type: string
      required: true
  outputs:
    mode: flexible
    artifacts:
      - key: digest
        format: markdown
  implementation:
    type: local-command
    command: npm
    args: ["run", "agent:news-digest"]
  permissions:
    network: allow
    filesystem: scoped
  limits:
    maxToolCalls: 40
    maxRuntimeSeconds: 600
  observability:
    mode: black-box
```

## Lifecycle Semantics

`describe` returns manifest-derived metadata plus implementation-reported runtime capabilities.

`validate` checks task inputs, runtime availability, permissions, and required dependencies before a run starts.

`run` executes one task and emits events, logs, artifacts, and a final output envelope.

`cancel` requests best-effort cancellation and must be idempotent.

`resume` is deferred. It should only be added once run state and retry/resume semantics are settled.

For implementation types such as local commands, containers, HTTP APIs, modules, LangGraph wrappers, and native DAGs, runtime adapters provide this lifecycle surface. Agent authors should not have to implement a TypeScript interface directly unless they are authoring a native adapter/module.

## Input and Output Contracts

All agent inputs must be declared in the manifest. The console and runtime use declared inputs to render forms, validate tasks, and detect incompatible assignments.

Outputs remain flexible in the first version. Agents should still declare optional artifact hints so the console can set expectations and render common outputs well.

## Capabilities

Capabilities are namespaced strings in the first version, such as:

- `text.summarize`
- `news.aggregate`
- `code.modify`
- `audio.transcribe`

Namespaced strings are human-readable, easy to compare, and sufficient for initial compatibility checks. Structured capability objects can be added later if matching rules become more complex.

## Version References

Agent identity and version are separate fields. References may pin an agent version using `agentId@version`, such as:

- `news.digest@1.0.0`

Unpinned references may resolve to the latest enabled compatible version according to future resolution rules.

## Observability Modes

Agents can be:

- `black-box`: Team Orchestrator sees outer status, logs, artifacts, and outputs.
- `inspectable`: Team Orchestrator receives structured internal steps, tool calls, graph transitions, or framework events.

Framework-backed agents such as LangGraph should expose inspectable internals when practical. When hooks are not available, they remain valid black-box agents.

The first version uses only `black-box` and `inspectable`. More granular feature flags such as `supportsToolCalls`, `supportsStepEvents`, and `supportsStreamingLogs` can be added later.

## Consequences

The old persona prompt model becomes legacy compatibility material.

The UI can build agent catalogs, compatibility checks, input forms, run views, and safety warnings from manifests.

Implementation-specific adapters can evolve independently as long as they satisfy the lifecycle contract.

## Open Questions

- How strict should semantic version compatibility be between plugin, agent, and Team Orchestrator runtime versions?
- What is the minimal required output envelope for `run`?
