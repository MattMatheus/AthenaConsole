---
kind: story
id: STORY-20260528-a2a-observability-reframe
status: intake
owner_role: Product Manager
source: planning
success_metric: A2A observability is either reframed against current run/event models or explicitly deferred.
release_scope: deferred
ready: false
---

# Story: Reframe A2A Observability

## Metadata
- `id`: STORY-20260528-a2a-observability-reframe
- `owner_role`: Product Manager
- `status`: intake
- `source`: planning
- `decision_refs`: [ADR-0012]
- `success_metric`: A2A observability is either reframed against current run/event models or explicitly deferred.
- `release_scope`: deferred

## Problem Statement

Older A2A observability work predates the current Team Orchestrator model and should not drive implementation unless it maps cleanly to runs, events, artifacts, agents, plugins, and workflow state.

## Scope
- In: decide whether A2A observability has a near-term product role and define a reset-aligned first slice if it does.
- Out: resurrecting pre-reset A2A throughput/DLQ dashboards directly.

## Assumptions

- Current observability is run/event/artifact centered.

## Acceptance Criteria

1. Maps A2A concepts to current Team Orchestrator observability primitives or rejects the track for now.
2. Identifies missing ADRs if new concepts are needed.
3. Produces a bounded follow-up story only if the track is worth pursuing.

## Validation
- Required checks: Flywheel workflow validation after lane movement.
- Additional checks: none until implementation.

## Dependencies

- Event and artifact observability model.

## Risks

- High risk of reintroducing old product direction if not carefully reframed.

## Open Questions

- Is A2A an external integration concern, an internal event model concern, or out of scope for now?

## Next Step

PM refinement.

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
