---
kind: story
id: STORY-20260528-sample-plugin-workflow-demo
status: intake
owner_role: Software Engineer
source: epic
success_metric: A local sample plugin/workflow demonstrates the canonical run loop and produces inspectable status/artifacts.
release_scope: follow-up
ready: false
---

# Story: Sample Plugin Workflow Demo

## Metadata
- `id`: STORY-20260528-sample-plugin-workflow-demo
- `owner_role`: Software Engineer
- `status`: intake
- `source`: epic
- `decision_refs`: [ADR-0008, ADR-0012, ADR-0015]
- `epic`: docs/product/epics/refinement/2026.23.00-epic-operator-readiness-first-run.md
- `success_metric`: A local sample plugin/workflow demonstrates the canonical run loop and produces inspectable status/artifacts.
- `release_scope`: follow-up

## Problem Statement

The product has strong primitives, but there is no single maintained sample path that proves the first-run operator loop from plugin discovery through workflow DAG status inspection.

## Scope

- In: sample plugin/agent/workflow template assets, canonical DAG run path, focused integration tests, minimal docs hooks.
- Out: broad sample library, hosted demos, new runtime backend behavior.

## Acceptance Criteria

1. A sample plugin/agent/workflow template is available in local development.
2. The sample can instantiate/run through the canonical workflow DAG path.
3. Resulting run status, events, and artifacts are inspectable from current APIs.
4. Tests prevent the sample path from drifting from the implemented runtime.

## Validation

- Required checks: core typecheck; focused plugin/workflow-template/catalog tests; canonical workflow DAG status API test; `./flywheel/tools/validate_workflow_state.sh`.

## Dependencies

- Recommended after `STORY-20260528-first-run-health-readiness`.

## Risks

- Sample assets can become stale if they are not covered by automated validation.

## Next Step

PM refinement should choose the sample scenario and confirm whether it should use existing specialist assets or a dedicated demo plugin.

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
