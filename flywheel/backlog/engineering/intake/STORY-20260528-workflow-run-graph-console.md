---
kind: story
id: STORY-20260528-workflow-run-graph-console
status: intake
owner_role: Software Engineer
source: epic
success_metric: Operators can inspect real workflow-template DAG runs from the console.
release_scope: follow-up
ready: false
---

# Story: Add Console Workflow Run Graph Inspection

## Metadata
- `id`: STORY-20260528-workflow-run-graph-console
- `owner_role`: Software Engineer
- `status`: intake
- `source`: epic
- `decision_refs`: [ADR-0015, ADR-0012]
- `epic`: docs/product/epics/refinement/2026.17.00-epic-workflow-dag-engine.md
- `success_metric`: Operators can inspect real workflow-template DAG runs from the console.
- `release_scope`: follow-up

## Problem Statement

The API can expose graph-friendly workflow status, but operators need a console path from workflow-template instantiation and schedule history into real DAG run inspection.

## Scope

- In: console links to workflow DAG run status, graph/list inspection view, polling/terminal state handling, failure/recovery display, focused UI/API tests.
- Out: visual workflow editor, drag/drop graph authoring, hosted scheduler UI.

## Acceptance Criteria

1. Instantiation and schedule history surfaces expose navigation to the workflow DAG run.
2. Console displays DAG steps, dependencies, readiness, status, failures, and recovery metadata.
3. Polling respects the status API recommended interval and stops on terminal states.
4. Existing mission/task details remain available and are not obscured by the graph view.
5. Empty/loading/error states are clear.
6. Console validation covers at least one real workflow-template DAG run.

## Validation

- Required checks: relevant console package typecheck/test scripts after inspecting package scripts; core API tests if response use changes.
- Additional checks: browser or Playwright verification if the local console can be run in this environment.

## Dependencies

- Recommended after `STORY-20260528-workflow-dag-step-task-run-linking`.
- Stronger after `STORY-20260528-workflow-template-schedule-dag-execution`.

## Risks

- UI may overfit seeded graph data; tests should use real workflow-template run responses.
- Layout needs to remain useful for both small sequential templates and branched DAGs.

## Next Step

PM refinement should confirm whether the first UI is a graph, a dependency-aware table, or a hybrid view.

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
