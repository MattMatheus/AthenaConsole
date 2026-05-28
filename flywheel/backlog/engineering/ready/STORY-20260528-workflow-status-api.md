---
kind: story
id: STORY-20260528-workflow-status-api
status: ready
owner_role: Software Architect
source: pm
success_metric: Workflow run state is exposed through a graph-friendly status API without leaking storage internals.
release_scope: required
ready: true
---

# Story: Add Visualizer-Friendly Workflow Status API

## Metadata
- `id`: STORY-20260528-workflow-status-api
- `owner_role`: Software Architect
- `status`: ready
- `source`: pm
- `decision_refs`: [ADR-0009, ADR-0011, ADR-0012, EPIC-2026.17]
- `success_metric`: Workflow run state is exposed through a graph-friendly status API without leaking storage internals.
- `release_scope`: required

## Problem Statement

After durable workflow state exists, operators and future UI surfaces need a stable way to inspect workflow runs as dependency graphs instead of storage rows.

## Scope
- In: read-only workflow status API/service shape for workflow run state, steps, dependencies, events, recovery context, and failure context.
- Out: visual editor, frontend graph visualization, parallel executor, hosted scheduler changes.

## Assumptions

- `STORY-20260528-workflow-state-store-resumption.md` has created durable workflow run and step state.
- Existing run/event/artifact repositories remain the source for operational history.

## Acceptance Criteria

1. Exposes workflow run status, step status, dependencies, and readiness in a graph-friendly shape.
2. Includes failure and recovery context for each step.
3. Supports console polling without exposing internal storage table details.
4. Preserves existing mission run and workflow-template instantiation behavior.
5. Includes focused service/API tests.

## Validation
- Required checks: `npm --workspace @athena/core run typecheck`, focused workflow status tests, `git diff --check`.
- Additional checks: existing workflow-template instantiation tests where touched.

## Dependencies

- `flywheel/backlog/engineering/active/STORY-20260528-workflow-state-store-resumption.md`
- `docs/product/epics/refinement/2026.17.00-epic-workflow-dag-engine.md`

## Risks

- API shape may accidentally leak repository internals if not explicitly mapped.
- Status polling could become expensive without bounded query patterns.

## Open Questions

- Should this be service-only first, or include HTTP routes in the same slice?

## Next Step

Promote after workflow state storage and resumption logic completes.

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
