---
kind: architecture_story
id: ARCH-20260528-service-decomposition-plan
status: done
owner_role: Software Architect
source: planning
decision_owner: Software Architect
success_metric: Large core service files have a bounded decomposition plan with first extraction candidates and validation scope.
ready: true
---

# Architecture Story: Core Service Decomposition Plan

## Metadata
- `id`: ARCH-20260528-service-decomposition-plan
- `owner_role`: Software Architect
- `status`: done
- `source`: planning
- `decision_refs`: [ADR-0016]
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
5. The plan explicitly defers implementation until security and canonical state work are not blocked by the decomposition effort.

## Review Focus
Confirm the plan reduces future change risk without creating premature abstractions.

## Next Step
Move to architecture done after review.

## Intake Promotion Checklist
- [x] Decision scope is explicit and bounded.
- [x] Problem statement explains why the decision is needed now.
- [x] Inputs are listed and available.
- [x] Outputs are concrete and reviewable.
- [x] Alternatives and operational impact are explicit.
- [x] Follow-on implementation work is split out when needed.

## Architecture Handoff
- `decision_summary`: Accepted ADR 0016, which ranks the oversized hand-maintained core files, excludes generated schema files from the first refactor target, and chooses a no-behavior-change split of app-state domain repositories as the first proof extraction.
- `alternatives_considered`: Leaving files as-is; splitting by aggregate/repository class; splitting service files by responsibility first. The accepted first move is aggregate/repository splitting because it has clearer boundaries and lower regression risk than task-workbench or policy-service extraction.
- `operational_impact`: Follow-on work should reduce review risk without runtime behavior changes. Import-boundary rules remain deferred until one extraction proves the module shape. Validation must focus on existing repository/service behavior and typecheck rather than new product behavior.
- `follow_on_work`: Added `flywheel/backlog/engineering/intake/STORY-20260528-split-app-state-domain-repositories.md` as the first decomposition implementation candidate. Existing `flywheel/backlog/engineering/intake/STORY-20260528-workflow-template-dag-run-envelope.md` remains higher product-state priority unless PM chooses to run the mechanical refactor first.

## Architecture Review
- `verdict`: Pass.
- `evidence_quality`: ADR 0016 ranks oversized hand-maintained core files, selects a first no-behavior-change extraction, documents target module boundaries, defers import-boundary rules, and includes a validation matrix for each extraction target.
- `defects`: None found.
- `state_transition`: Ready for architecture done.

## Transition History
- `2026-05-28T16:23:43Z`: `intake` -> `active` by `Codex`; PM refined and queued after canonical state model
- `2026-05-28T17:36:27Z`: `active` -> `qa` by `Codex`; Architecture handoff complete for ADR 0016
- `2026-05-28T17:37:10Z`: `qa` -> `done` by `Codex`; Architecture review passed
