---
kind: story
id: STORY-20260603-capability-led-work-creation
status: intake
owner_role: frontend-engineer
source: planning
success_metric: A selected capability preselects the underlying agent or workflow without requiring users to understand the primitive first.
release_scope: deferred
ready: false
---

# Story: Capability-Led Work Creation

## Metadata
- `id`: STORY-20260603-capability-led-work-creation
- `owner_role`: frontend-engineer
- `status`: intake
- `source`: planning
- `decision_refs`: [ARCH-20260603-product-intuition-ia]
- `success_metric`: A selected capability preselects the underlying agent or workflow without requiring users to understand the primitive first.
- `release_scope`: deferred

## Problem Statement
- Current task and workflow setup screens ask users to understand agents, capabilities, requirements, manifests, raw inputs, and workflow templates.
- A user who chooses "Summarize repo" or "Draft release notes" should land in a setup path with the correct underlying primitive already selected.

## Scope
- In:
  - Add URL/state support for preselecting a capability-backed agent or workflow template.
  - Reduce visible choices after capability selection.
  - Show the underlying primitive as inspectable detail, not the initial decision.
- Out:
  - Removing task/workflow pages.
  - Changing manifest schemas.

## Assumptions
- Existing agent and workflow query APIs can resolve selected ids/versions.

## Acceptance Criteria
1. Capability selection can preselect a task agent or workflow template.
2. Users can continue with required context without manually reselecting the primitive.
3. The UI still exposes which agent/workflow will run before execution.

## Validation
- Required checks:
  - Console typecheck.
  - Focused form model/route tests.
- Additional checks:
  - Manual smoke with a task-backed capability and a workflow-backed capability.

## Dependencies
- `ARCH-20260603-product-intuition-ia`.
- `STORY-20260603-start-work-entry-point`.

## Risks
- Capability metadata may need normalization if agent and workflow cards differ too much.

## Open Questions
- Should capability identity be plugin-provided metadata or derived from agents/workflows initially?

## Next Step
- Refine after Start Work shape is accepted.

## Engineering Handoff
- `change_summary`:
- `validation_evidence`:
- `qa_focus`:
- `open_risks`:

## QA Verdict
- `verdict`:
- `evidence_quality`:
- `defects`:
- `state_transition`:
