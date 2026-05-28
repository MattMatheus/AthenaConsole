---
kind: story
id: STORY-20260528-runtime-isolation-policy-packs
status: done
owner_role: Product Manager
source: planning
success_metric: Runtime isolation and policy-pack work is scoped against current backend and approval models.
release_scope: deferred
ready: false
---

# Story: Refine Runtime Isolation Policy Packs

## Metadata
- `id`: STORY-20260528-runtime-isolation-policy-packs
- `owner_role`: Product Manager
- `status`: done
- `source`: planning
- `decision_refs`: [ADR-0011, ADR-0013]
- `success_metric`: Runtime isolation and policy-pack work is scoped against current backend and approval models.
- `release_scope`: deferred

## Problem Statement

Runtime safety needs to grow beyond defaults, but the old sandbox/Kubernetes-heavy planning should not be promoted without reframing against local-first Team Orchestrator.

## Scope
- In: define a local-first policy-pack track for runtime limits, approvals, and backend constraints.
- Out: production cluster governance or Kyverno-first policy work unless explicitly re-justified.

## Assumptions

- Local process, container-command, and HTTP/API backends are the current execution surfaces.

## Acceptance Criteria

1. Defines the first useful policy-pack concept for current runtime backends.
2. Identifies any architecture decisions needed.
3. Produces a bounded implementation story or architecture intake item.

## Refinement Outcome

Runtime policy packs are reset-aligned when treated as named local product presets for backend allowlists, effective limits, approval requirements, and backend boundary expectations.

The first useful policy-pack concept is a built-in resolver, not persisted policy resources or cluster governance. V1 packs should be deterministic, inspectable, and composed conservatively with agent manifests:

- backend must be allowed by both the pack and the agent implementation,
- effective limits use the stricter value when pack and manifest values both apply,
- approval requirements are the union of pack-required and manifest-required risk classes.

Initial built-in packs:

- `standard-local`: preserves current task workbench behavior.
- `cautious-local`: allows local/container execution with tighter local-machine guardrails.
- `container-isolated`: requires `container-command` and records that the run was intentionally constrained to container execution.

No new ADR is required for this first slice. ADR 0011 covers runtime backend boundaries and ADR 0013 covers safety limits and approval semantics.

## Validation
- Required checks: Flywheel workflow validation after lane movement.
- Additional checks: none until implementation.

## Dependencies

- Runtime backend interface and safety approval model.

## Risks

- Could drift back into cloud/fleet governance if not scoped tightly.

## Open Questions

- Which policies are product-level defaults versus plugin/agent manifest declarations?

## Next Step

Implement `flywheel/backlog/engineering/ready/STORY-20260528-runtime-policy-pack-resolver.md` when this deferred track is promoted.

## Engineering Handoff
- `change_summary`: Added a runtime policy-pack refinement epic, updated current direction to reference the refined track, and created a ready implementation story for a built-in policy pack resolver.
- `validation_evidence`: Inspected ADR 0011, ADR 0013, current task workbench backend/safety resolution, approval-required event behavior, and runtime limit enforcement; ran Flywheel workflow validation.
- `qa_focus`: Confirm the ready story is scoped to built-in resolver behavior and does not expand into persisted policy resources, console authoring, or cluster governance.
- `open_risks`: `container-isolated` is a product constraint over the current `container-command` backend and should not claim stronger isolation than the backend enforces.

## QA Verdict
- `verdict`: pass
- `evidence_quality`: sufficient for PM refinement; the track is reset-aligned against ADR 0011 and ADR 0013, explicitly avoids cluster governance, and produced a bounded ready implementation story with acceptance criteria and validation expectations.
- `defects`: none
- `state_transition`: move to `done`

## Transition History
- `2026-05-28T03:47:30Z`: `intake` -> `active` by `Codex`; PM refinement started
- `2026-05-28T03:48:46Z`: `active` -> `qa` by `Codex`; PM refinement handoff ready
- `2026-05-28T03:49:04Z`: `qa` -> `done` by `Codex`; QA accepted PM refinement
