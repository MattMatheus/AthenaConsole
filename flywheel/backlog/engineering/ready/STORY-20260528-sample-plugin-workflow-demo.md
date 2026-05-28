---
kind: story
id: STORY-20260528-sample-plugin-workflow-demo
status: ready
owner_role: Software Engineer
source: epic
success_metric: A local sample plugin/workflow demonstrates the canonical run loop and produces inspectable status/artifacts.
release_scope: follow-up
ready: true
---

# Story: Sample Plugin Workflow Demo

## Metadata
- `id`: STORY-20260528-sample-plugin-workflow-demo
- `owner_role`: Software Engineer
- `status`: ready
- `source`: epic
- `decision_refs`: [ADR-0008, ADR-0012, ADR-0015]
- `epic`: docs/product/epics/refinement/2026.23.00-epic-operator-readiness-first-run.md
- `success_metric`: A local sample plugin/workflow demonstrates the canonical run loop and produces inspectable status/artifacts.
- `release_scope`: follow-up
- `pm_refinement`: Use a dedicated local demo plugin/workflow asset rather than repurposing specialist fixtures. The sample should prove the canonical workflow DAG loop and remain covered by automated tests.

## Problem Statement

The product has strong primitives, but there is no single maintained sample path that proves the first-run operator loop from plugin discovery through workflow DAG status inspection.

## Scope

- In: dedicated sample plugin/agent/workflow template assets, canonical DAG run path, status/event/artifact inspection path, focused integration tests, minimal docs hooks.
- Out: broad sample library, hosted demos, new runtime backend behavior, console onboarding copy.

## Acceptance Criteria

1. A dedicated sample plugin/agent/workflow template is available in local development and discoverable through the existing plugin/template catalog path.
2. The sample can instantiate and run through the canonical workflow DAG executor path without using removed legacy workflow APIs.
3. Resulting run status, events, and artifacts are inspectable from current APIs.
4. The sample leaves deterministic, non-secret demo evidence suitable for quickstart documentation.
5. Tests prevent the sample path from drifting from the implemented runtime.

## Validation

- Required checks: core typecheck; focused plugin/workflow-template/catalog tests; canonical workflow DAG status/API test; artifact/event inspection test or assertion; `./flywheel/tools/validate_workflow_state.sh`.

## Dependencies

- Recommended after `STORY-20260528-first-run-health-readiness`.

## Risks

- Sample assets can become stale if they are not covered by automated validation.

## Next Step

Engineering should implement a small dedicated demo plugin/workflow scenario that exercises one successful dependency path and produces inspectable event/artifact evidence.

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

## Transition History
- `2026-05-28T22:38:02Z`: `intake` -> `ready`; PM refinement complete for sample demo
