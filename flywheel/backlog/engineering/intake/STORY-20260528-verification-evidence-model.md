---
kind: story
id: STORY-20260528-verification-evidence-model
status: intake
owner_role: Product Manager
source: planning
success_metric: Output quality gates are framed against current runs, events, and artifacts before implementation.
release_scope: deferred
ready: false
---

# Story: Refine Verification Evidence Model

## Metadata
- `id`: STORY-20260528-verification-evidence-model
- `owner_role`: Product Manager
- `status`: intake
- `source`: planning
- `decision_refs`: [ADR-0009, ADR-0012, ADR-0013]
- `success_metric`: Output quality gates are framed against current runs, events, and artifacts before implementation.
- `release_scope`: deferred

## Problem Statement

Team Orchestrator needs a way to distinguish "agent completed" from "agent produced acceptable, inspectable evidence" without reviving the old pre-reset evidence track wholesale.

## Scope
- In: define the first reset-aligned evidence/verification slice.
- Out: broad policy engine, compliance framework, or pre-reset evidence model resurrection.

## Assumptions

- Runs, events, artifacts, and operator verdicts are the current product model.

## Acceptance Criteria

1. Defines evidence concepts against current run/event/artifact models.
2. Identifies whether a new ADR is required.
3. Produces a bounded first engineering story if implementation is ready.

## Validation
- Required checks: Flywheel workflow validation after lane movement.
- Additional checks: none until implementation.

## Dependencies

- Current event and artifact observability model.

## Risks

- Could become too abstract without a concrete operator workflow.

## Open Questions

- Should evidence be operator-authored, agent-attached, verifier-generated, or all three?

## Next Step

PM and architecture refinement.

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
