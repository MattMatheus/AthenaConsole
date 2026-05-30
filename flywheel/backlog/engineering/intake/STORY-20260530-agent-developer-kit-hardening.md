---
kind: story
id: STORY-20260530-agent-developer-kit-hardening
status: intake
owner_role: Senior Engineer
source: planning
success_metric: Agent authors can use the developer kit README and examples to write, test, and package a model-backed agent.
release_scope: required
ready: false
---

# Story: Agent Developer Kit Hardening

## Metadata
- `id`: STORY-20260530-agent-developer-kit-hardening
- `owner_role`: Senior Engineer
- `status`: intake
- `source`: planning
- `decision_refs`: [0007, 0008, 0011, 0012, 0018]
- `success_metric`: Agent authors can use the developer kit README and examples to write, test, and package a model-backed agent.
- `release_scope`: required

## Problem Statement

`@athena/pdk` already contains useful agent helpers, output builders, and test harness primitives, but the product now needs a coherent Agent Developer Kit surface that explains current plugin-backed agents rather than older persona concepts.

## Scope
- In: ADK package surface review, README rewrite, manifest-to-runner examples, typed task input examples, artifact output examples, test harness examples, compatibility notes.
- Out: npm publishing, package rename, marketplace integration.

## Assumptions
- The package name can remain `@athena/pdk` until a separate migration decision is made.
- The user-facing term should be "Agent Developer Kit" for the current product model.

## Acceptance Criteria
1. The package README leads with agent authoring, not specialist/persona history.
2. Examples show a complete plugin-backed agent using manifest inputs and serialized run output.
3. Tests cover the documented example or a close fixture.
4. Compatibility boundaries explain what the kit does and does not validate.
5. Root docs link to the kit as the supported code-level authoring path.

## Validation
- Required checks: `npm --workspace @athena/pdk run typecheck`, `npm --workspace @athena/pdk run test`, docs example review, `git diff --check`.
- Additional checks: run a sample plugin using ADK helpers through the task workbench.

## Dependencies
- Documentation information architecture.

## Risks
- Mixing persona and agent terminology could confuse new authors.
- Renaming package exports without a migration plan could break existing examples.

## Open Questions
- Should persona helpers move behind an advanced/internal section or into a separate package later?

## Next Step
- Refine after the docs map chooses the agent-author entry point.
