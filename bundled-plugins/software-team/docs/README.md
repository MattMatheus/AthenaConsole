# Software Team Pack

This first-party bundled pack provides local deterministic software-team agents and model-backed AthenaAgent agents using the standard Team Orchestrator plugin model.

## Current Capabilities

- Repository summary.
- Documentation audit.
- Code review support.
- Test failure explanation.
- Changelog and release-note drafting.
- Release readiness review.
- AthenaAgent repository summary.
- AthenaAgent PR/diff review.
- AthenaAgent test failure triage.

## Capability Matrix

| Capability | Entry point | Mode | Fixture | Expected artifact | Readiness behavior |
| --- | --- | --- | --- | --- | --- |
| Repository onboarding | `bundled.software-team.repo-onboarding.workflow` | Deterministic local | `fixtures/repo-onboarding.inputs.json` | Repository summary and docs audit markdown | Runs without provider credentials; repository context is recommended. |
| Docs health check | `bundled.software-team.docs-health-check.workflow` | Deterministic local | `fixtures/docs-health-check.inputs.json` | `docsAudit` markdown | Runs without provider credentials and accepts optional memory context. |
| PR review support | `bundled.software-team.pr-review-support.workflow` | Deterministic local | `fixtures/pr-review-support.inputs.json` | `codeReview` markdown | Runs without provider credentials; produces draft-only review notes. |
| CI failure triage | `bundled.software-team.ci-failure-triage.workflow` | Deterministic local | `fixtures/ci-failure-triage.inputs.json` | `testFailureExplanation` markdown | Requires failure output; no external writes. |
| Release readiness | `bundled.software-team.release-readiness.workflow` | Deterministic local | `fixtures/release-readiness.inputs.json` | `changelogDraft`, `readinessNotes` markdown | Runs without provider credentials; release notes remain operator-reviewed. |
| AthenaAgent repository summary | `athena-agent.repo-summary` | Model-backed AthenaAgent | `fixtures/athena-agent-repo-summary.inputs.json` | `repoSummary` markdown | Blocks until an OpenAI-compatible provider is configured. |
| AthenaAgent PR/diff review | `athena-agent.pr-diff-review` | Model-backed AthenaAgent | `fixtures/athena-agent-pr-diff-review.inputs.json` | `prDiffReview` markdown | Blocks until an OpenAI-compatible provider is configured. |
| AthenaAgent test failure triage | `athena-agent.test-failure-triage` | Model-backed AthenaAgent | `fixtures/athena-agent-test-failure-triage.inputs.json` | `testFailureTriage` markdown | Blocks until an OpenAI-compatible provider is configured. |

## Deterministic Mode

Every bundled agent has a deterministic local runner for no-auth validation. The runner consumes task inputs, emits reviewable markdown, and does not call external services.

## Provider-Backed Enhancements

The deterministic `bundled.software-team.*.local` agents require no provider credentials and remain the default no-auth validation path.

The `athena-agent.*` agents are AthenaAgent-powered and require a configured OpenAI-compatible model provider:

- `athena-agent.repo-summary`
- `athena-agent.pr-diff-review`
- `athena-agent.test-failure-triage`

These agents run through `scripts/athena-agent-console-runner.mjs`, use strict Console result envelopes, and emit markdown artifacts. Provider readiness blocks execution until a provider is configured.

## Memory-Aware Enhancements

Selected agents declare optional durable-memory read or propose permissions under `software-team/*`. The deterministic runners also accept `memoryContext` inputs so memory-derived context stays visible in run inputs and generated artifacts. If durable memory is disabled or no memory context is supplied, the agents continue with no-memory behavior.

For the pilot read path, workflows can pass `memoryContextRequest` with a namespace, query, and optional limit. Console resolves approved durable-memory records before the run starts, validates the assigned agent's manifest read permissions, and injects the selected snippets as `memoryContext`. Runtime search/get requests are still supported for audit events, but they cannot feed results back into the issuing run. A direct durable-memory MCP tool is intentionally deferred until after the pilot.

## Safety Posture

The pack declares a read-only safety posture for external systems. Agents use scoped filesystem permissions, deny network access, deny credentials, and do not perform external writes. Memory proposals remain operator-reviewed.

## Naming Conventions

- Plugin id: `team-orchestrator.bundled.software-team`.
- Agent ids: `bundled.software-team.<capability>.local`.
- AthenaAgent agent ids: `athena-agent.<capability>`.
- Workflow ids: `bundled.software-team.<workflow>.workflow`.
- Fixture files: `fixtures/<workflow-or-agent>.inputs.json`.
- Runner scripts: `scripts/software-team-runner.mjs` with a mode argument matching the agent capability.
- AthenaAgent runner bridge: `scripts/athena-agent-console-runner.mjs`.
