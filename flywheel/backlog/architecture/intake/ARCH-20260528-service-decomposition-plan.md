---
kind: architecture_story
id: ARCH-20260528-service-decomposition-plan
status: intake
owner_role: Software Architect
source: planning
decision_owner: Software Architect
success_metric: Large core service files have a bounded decomposition plan with first extraction candidates and validation scope.
ready: false
---

# Architecture Story: Core Service Decomposition Plan

## Metadata
- `id`: ARCH-20260528-service-decomposition-plan
- `owner_role`: Software Architect
- `status`: intake
- `source`: planning
- `decision_refs`: []
- `decision_owner`: Software Architect
- `success_metric`: Large core service files have a bounded decomposition plan with first extraction candidates and validation scope.

## Decision Scope
Plan low-risk decomposition for the largest core service and repository files without changing behavior.

## Problem Statement
Several core files mix orchestration, persistence adaptation, validation, policy resolution, execution, and presentation mapping. Their size increases review risk and slows future product changes.

## Inputs
- Existing decisions: Team Orchestrator reset ADRs as needed.
- Existing architecture artifacts: code audit M-3 and current service layout.
- Constraints: no behavior change expected for extraction stories; keep first slices small and test-backed.

## Outputs Required
- Decision updates: decomposition plan or ownership note.
- Architecture artifacts: first extraction candidates, target module boundaries, validation matrix.
- Risks and tradeoffs: churn, import cycles, test fragility, and ownership boundaries.

## Alternatives Considered
- Leave files as-is until feature work forces changes.
- Split by aggregate/repository class.
- Split by service responsibility such as storage, evaluation, execution, mapping, and history.

## Operational Impact
Follow-on implementation stories should reduce review risk without changing runtime behavior.

## Acceptance Criteria
1. Top oversized files are ranked by change risk and extraction value.
2. First extraction candidate is bounded to a no-behavior-change story.
3. Validation expectations are listed per extracted module.
4. Optional import-boundary rules are deferred until one extraction proves the pattern.

## Review Focus
Confirm the plan reduces future change risk without creating premature abstractions.

## Next Step
Architect should refine this after security and canonical orchestration state work are queued.

## Intake Promotion Checklist
- [ ] Decision scope is explicit and bounded.
- [ ] Problem statement explains why the decision is needed now.
- [ ] Inputs are listed and available.
- [ ] Outputs are concrete and reviewable.
- [ ] Alternatives and operational impact are explicit.
- [ ] Follow-on implementation work is split out when needed.

## Architecture Handoff
- `decision_summary`:
- `alternatives_considered`:
- `operational_impact`:
- `follow_on_work`:
