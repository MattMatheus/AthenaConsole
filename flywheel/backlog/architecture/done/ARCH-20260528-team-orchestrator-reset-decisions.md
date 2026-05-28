---
kind: architecture_story
id: ARCH-20260528-team-orchestrator-reset-decisions
status: done
owner_role: Software Architect
source: planning
decision_owner: Software Architect
success_metric: Current reset ADRs are findable from Flywheel architecture history and product docs.
ready: true
---

# Architecture Story: Team Orchestrator Reset Decisions

## Metadata
- `id`: ARCH-20260528-team-orchestrator-reset-decisions
- `owner_role`: Software Architect
- `status`: done
- `source`: planning
- `decision_refs`: [ADR-0006, ADR-0007, ADR-0008, ADR-0009, ADR-0010, ADR-0011, ADR-0012, ADR-0013, ADR-0014]
- `decision_owner`: Software Architect
- `success_metric`: Current reset ADRs are findable from Flywheel architecture history and product docs.

## Decision Scope

Record the accepted Team Orchestrator product reset decisions in the Flywheel architecture lane.

## Problem Statement

The product reset ADRs existed in the old mixed `planning/` tree, which made them look like part of an improvised workflow system instead of durable decision records.

## Inputs

- Existing decisions: `docs/product/architecture/decisions/0006-team-orchestrator-direction-and-agent-model.md` through `docs/product/architecture/decisions/0014-scheduling-model.md`
- Existing architecture artifacts: `docs/product/architecture/decisions/`
- Constraints: Flywheel owns workflow lanes; product docs own durable reference material.

## Outputs Required

- Decision updates: none.
- Architecture artifacts: accepted ADRs moved to `docs/product/architecture/decisions/`.
- Risks and tradeoffs: the architecture lane records the decision history, while full ADR prose remains in product docs.

## Alternatives Considered

- Keep ADRs under `planning/`, rejected because that preserves the confusing pseudo-harness.
- Put raw ADR files directly in Flywheel architecture lanes, rejected because Flywheel lanes validate architecture work items rather than arbitrary ADR markdown.

## Operational Impact

Future ADR or architecture work should enter through `flywheel/backlog/architecture/intake`, move through Flywheel architecture lanes, and publish durable decisions into `docs/product/architecture/decisions/`.

## Acceptance Criteria

1. The accepted reset ADRs are no longer under `planning/`.
2. Flywheel has a done architecture item that records where the accepted decisions live.
3. New architecture work has an obvious Flywheel entry path.

## Review Focus

Confirm the split between workflow state and product decision records is clear.

## Next Step

Use Flywheel architecture intake for the next architecture decision.

## Intake Promotion Checklist

- [x] Decision scope is explicit and bounded.
- [x] Problem statement explains why the decision is needed now.
- [x] Inputs are listed and available.
- [x] Outputs are concrete and reviewable.
- [x] Alternatives and operational impact are explicit.
- [x] Follow-on implementation work is split out when needed.

## Architecture Handoff
- `decision_summary`: Team Orchestrator reset ADRs were preserved as product docs and represented in Flywheel architecture history.
- `alternatives_considered`: Keeping ADRs in planning or placing raw ADR markdown directly in Flywheel lanes.
- `operational_impact`: New architecture decision work should move through Flywheel architecture lanes, with durable accepted decisions published to product docs.
- `follow_on_work`: None.
