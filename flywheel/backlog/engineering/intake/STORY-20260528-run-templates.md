---
kind: story
id: STORY-20260528-run-templates
status: intake
owner_role: Product Manager
source: planning
success_metric: Repeatable operator-triggered jobs are defined as a bounded post-DAG workflow track.
release_scope: deferred
ready: false
---

# Story: Refine Run Templates Track

## Metadata
- `id`: STORY-20260528-run-templates
- `owner_role`: Product Manager
- `status`: intake
- `source`: planning
- `decision_refs`: [ADR-0008, ADR-0009, ADR-0011]
- `success_metric`: Repeatable operator-triggered jobs are defined as a bounded post-DAG workflow track.
- `release_scope`: deferred

## Problem Statement

Operators will need reusable manual run definitions that can be triggered repeatedly without rebuilding a task or workflow each time.

## Scope
- In: refine the product shape for run templates, source decisions, acceptance criteria, and first implementation slice.
- Out: immediate implementation before PM refinement.

## Assumptions

- Workflow-template DAG execution remains the nearer-term track.

## Acceptance Criteria

1. Defines the difference between workflow templates, schedules, and run templates.
2. Identifies the first implementation story and validation expectations.
3. Links accepted ADRs or creates an architecture intake item if decisions are missing.

## Validation
- Required checks: Flywheel workflow validation after lane movement.
- Additional checks: none until implementation.

## Dependencies

- Current workflow DAG engine track.

## Risks

- Could duplicate workflow-template concepts if the distinction is not explicit.

## Open Questions

- Is a run template a task preset, a workflow preset, or a wrapper over both?

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
