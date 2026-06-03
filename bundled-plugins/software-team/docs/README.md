# Software Team Pack

This first-party bundled pack provides local software-team agents and workflows using the standard Team Orchestrator plugin model.

## Current Capabilities

- Repository summary.
- Documentation audit.
- Code review support.
- Test failure explanation.
- Changelog and release-note drafting.
- Release readiness review.

## Deterministic Mode

Every bundled agent has a deterministic local runner for no-auth validation. The runner consumes task inputs, emits reviewable markdown, and does not call external services.

## Provider-Backed Enhancements

The pack is designed so provider-backed analysis can improve narrative quality later without changing agent or workflow IDs. Provider credentials are not required for the current deterministic fixtures.

## Memory-Aware Enhancements

Selected agents declare optional durable-memory read or propose permissions under `software-team/*`. The deterministic runners also accept `memoryContext` inputs so memory-derived context stays visible in run inputs and generated artifacts. If durable memory is disabled or no memory context is supplied, the agents continue with no-memory behavior.

## Safety Posture

The pack declares a read-only safety posture for external systems. Agents use scoped filesystem permissions, deny network access, deny credentials, and do not perform external writes. Memory proposals remain operator-reviewed.

## Naming Conventions

- Plugin id: `team-orchestrator.bundled.software-team`.
- Agent ids: `bundled.software-team.<capability>.local`.
- Workflow ids: `bundled.software-team.<workflow>.workflow`.
- Fixture files: `fixtures/<workflow-or-agent>.inputs.json`.
- Runner scripts: `scripts/software-team-runner.mjs` with a mode argument matching the agent capability.
