---
kind: story
id: STORY-20260528-legacy-a2a-surface-labeling
status: ready
owner_role: Engineer
source: pm
success_metric: Operators can tell that existing A2A/DLQ console surfaces are legacy compatibility surfaces, not primary Team Orchestrator workflows.
release_scope: deferred
ready: true
---

# Story: Label Legacy A2A Surfaces

## Metadata
- `id`: STORY-20260528-legacy-a2a-surface-labeling
- `owner_role`: Engineer
- `status`: ready
- `source`: pm
- `decision_refs`: [ADR-0012, docs/product/epics/refinement/2026.21.00-epic-a2a-observability-reframe.md]
- `success_metric`: Operators can tell that existing A2A/DLQ console surfaces are legacy compatibility surfaces, not primary Team Orchestrator workflows.
- `release_scope`: deferred

## Problem Statement

The console still exposes a `DLQ Console` tied to legacy A2A routes. Without context, it implies A2A message-bus operations are part of the current Team Orchestrator product center, which conflicts with the reset direction.

## Scope
- In: update console navigation/page copy for the visible DLQ/A2A surface to label it as legacy compatibility, preserve existing DLQ list/requeue/discard behavior, and add focused console validation if copy helpers exist.
- Out: removing A2A routes, adding A2A graph/throughput UI, changing RBAC, altering DLQ mutation behavior, or building workflow DAG lineage.

## Assumptions

- Existing A2A API compatibility remains useful enough not to remove in this story.
- Current primary observability remains run/event/artifact inspection.
- Route path `/dlq` can remain stable.

## Acceptance Criteria

1. Console navigation no longer presents the surface as a generic primary `DLQ Console`; it clearly indicates legacy A2A compatibility.
2. The DLQ page heading and lead copy explain that the surface is for legacy A2A deliveries.
3. Existing DLQ list, inspect, requeue, and discard behaviors remain unchanged.
4. No new A2A observability capabilities are introduced.
5. Console validation runs successfully.

## Validation
- Required checks: `npm --workspace @athena/console run typecheck`, `npm --workspace @athena/console run lint`, `npm --workspace @athena/console run test`, `git diff --check`, Flywheel workflow validation.
- Additional checks: browser QA if layout or visible copy changes need visual confirmation.

## Dependencies

- Existing console DLQ page.
- Existing A2A DLQ API client.

## Risks

- The legacy label may be a temporary compromise; a later cleanup may remove or hide the surface entirely.

## Open Questions

- Should the API route itself eventually move under a legacy namespace or be removed?

## Next Step

Engineering implementation.

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
