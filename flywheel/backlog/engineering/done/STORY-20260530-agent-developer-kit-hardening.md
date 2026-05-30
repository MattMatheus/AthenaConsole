---
kind: story
id: STORY-20260530-agent-developer-kit-hardening
status: done
owner_role: Senior Engineer
source: planning
success_metric: Agent authors can use the developer kit README and examples to write, test, and package a model-backed agent.
release_scope: required
ready: true
---

# Story: Agent Developer Kit Hardening

## Metadata
- `id`: STORY-20260530-agent-developer-kit-hardening
- `owner_role`: Senior Engineer
- `status`: done
- `source`: planning
- `decision_refs`: [0007, 0008, 0011, 0012, 0018]
- `success_metric`: Agent authors can use the developer kit README and examples to write, test, and package a model-backed agent.
- `release_scope`: required

## Problem Statement

`@athena/pdk` already contains useful agent helpers, output builders, and test harness primitives, but the product now needs a coherent Agent Developer Kit surface that explains current plugin-backed agents rather than older persona concepts.

## Scope
- In: ADK package surface review, README rewrite, manifest-to-runner example, typed task input example, artifact output example, agent handler test example or equivalent fixture, compatibility notes.
- Out: npm publishing, package rename, marketplace integration.

## Assumptions
- The package name can remain `@athena/pdk` until a separate migration decision is made.
- The user-facing term should be "Agent Developer Kit" for the current product model.

## Acceptance Criteria
1. The package README leads with agent authoring, not specialist/persona history.
2. Examples show a complete plugin-backed agent using manifest inputs and serialized run output.
3. Tests cover the documented agent helper path or a close fixture that exercises task envelope parsing, input validation, output serialization, and artifact metadata.
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
- Activate for engineering. Implement the README and test fixture updates, then move to QA with validation evidence.

## PM Refinement
- `what_changed`: Bounded the story to an agent-first ADK README update plus test coverage for the documented helper path.
- `why_it_matters`: Agent authors should see plugin-backed agent authoring before legacy specialist/persona concepts, while existing compatibility APIs remain documented honestly.
- `acceptance_criteria`: README is agent-first; examples cover manifest inputs, serialized run output, and artifacts; tests cover the documented helper path or a close fixture; compatibility boundaries are explicit; root docs still point at the ADK path.
- `risks_and_assumptions`: Package remains named `@athena/pdk`; persona/specialist helpers are compatibility APIs and should not be removed in this slice.
- `next_state_recommendation`: Move to engineering active.

## Engineering Handoff
- `change_summary`: Reworked `packages/pdk/README.md` into an Agent Developer Kit guide led by plugin-backed agent authoring. Added plugin and agent manifest snippets, a runner example that validates manifest-shaped inputs and serializes run output with artifact metadata, a handler-test example, explicit compatibility boundaries, and a compatibility-exports section for older specialist/persona helpers. Added an integrated PDK test fixture that exercises envelope parsing, input defaults, handler execution, run output serialization, and artifact metadata together. Synced current direction and Flywheel backlog summaries after activation.
- `validation_evidence`: `npm --workspace @athena/pdk run typecheck`; `npm --workspace @athena/pdk run test`; ADK docs markdown link/path review; `./flywheel/tools/validate_workflow_state.sh --format json`; `git diff --check`.
- `qa_focus`: Confirm the PDK README leads with agent authoring rather than persona/specialist history, the documented examples align with available exports and tests, compatibility boundaries are clear, and the repo docs map still links to the ADK package as the code-level authoring path.
- `open_risks`: The package name remains `@athena/pdk`, so docs intentionally explain that the product-facing term is Agent Developer Kit while preserving compatibility naming.

## QA Verdict
- `verdict`: Pass.
- `evidence_quality`: Required checks passed in QA: `npm --workspace @athena/pdk run typecheck`, `npm --workspace @athena/pdk run test`, ADK docs markdown link/path review, `./flywheel/tools/validate_workflow_state.sh --format json`, and `git diff --check`.
- `defects`: None found.
- `state_transition`: Ready for engineering done.

## Transition History
- `2026-05-30T22:30:04Z`: `intake` -> `active`; PM refined and activated ADK hardening
- `2026-05-30T22:32:25Z`: `active` -> `qa`; ADK hardening engineering handoff ready
- `2026-05-30T22:33:27Z`: `qa` -> `done`; QA passed ADK hardening
