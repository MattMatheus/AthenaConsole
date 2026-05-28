---
kind: story
id: STORY-20260528-a2a-observability-reframe
status: done
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
- `status`: done
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

## Refinement Outcome

A2A observability is deferred as a standalone product track. The old message-bus/DLQ/throughput model does not map cleanly to the current Team Orchestrator product center, which is task, mission, workflow, run, event, and artifact oriented.

Mapping:

- A2A message: future external integration event or workflow handoff event, not a core primitive today.
- DLQ item: legacy queue failure; reset-aligned equivalents are run/task failure, schedule history, or future integration delivery failure.
- Flow graph: possible future run lineage or workflow DAG visualization.
- Throughput: operational telemetry, not a primary operator workflow today.
- Stall alert: possible future workflow/schedule/run health signal if backed by current run state.

No new ADR is required for deferral. A new ADR would be required before A2A becomes an external integration boundary or internal orchestration primitive again.

The bounded follow-up is to label the existing visible console A2A/DLQ surface as legacy compatibility so it does not imply A2A is the current primary workflow.

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

Implement `flywheel/backlog/engineering/ready/STORY-20260528-legacy-a2a-surface-labeling.md` when this deferred track is promoted.

## Engineering Handoff
- `change_summary`: Added a reset-aligned A2A observability reframe epic, updated current direction to mark A2A observability deferred as a standalone track, and created a ready implementation story to label existing visible A2A/DLQ console surfaces as legacy compatibility.
- `validation_evidence`: Inspected ADR 0012, current product direction, existing A2A observability/flow/DLQ services, API routes, console DLQ page, and console A2A client helpers; ran Flywheel workflow validation.
- `qa_focus`: Confirm the ready follow-up labels existing visible surfaces without adding A2A throughput/graph/DLQ capabilities or removing compatibility routes.
- `open_risks`: Legacy A2A routes remain in the product until a later cleanup or external-integration ADR decides whether to keep, rename, or remove them.

## QA Verdict
- `verdict`: pass
- `evidence_quality`: sufficient for PM refinement; the track is explicitly deferred as standalone A2A observability, mapped against ADR 0012/current run-event-artifact primitives, and produces one bounded compatibility-labeling story without adding new A2A capabilities.
- `defects`: none
- `state_transition`: move to `done`

## Transition History
- `2026-05-28T15:31:22Z`: `intake` -> `active` by `Codex`; PM refinement started
- `2026-05-28T15:32:52Z`: `active` -> `qa` by `Codex`; PM refinement handoff ready
- `2026-05-28T15:33:02Z`: `qa` -> `done` by `Codex`; QA accepted PM refinement
