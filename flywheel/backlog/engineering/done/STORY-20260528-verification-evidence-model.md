---
kind: story
id: STORY-20260528-verification-evidence-model
status: done
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
- `status`: done
- `source`: planning
- `decision_refs`: [ADR-0009, ADR-0012, ADR-0013]
- `success_metric`: Output quality gates are framed against current runs, events, and artifacts before implementation.
- `release_scope`: deferred

## Problem Statement

Team Orchestrator needs a way to distinguish "agent completed" from "agent produced acceptable, inspectable evidence" without reviving the old pre-reset evidence track wholesale.

## Scope
- In: define the first reset-aligned evidence/verification slice.
- Out: broad policy engine, compliance framework, operator verdict resources, new verification policy kinds, or pre-reset evidence model resurrection.

## Assumptions

- Runs, events, artifacts, and operator verdicts are the current product model.
- Existing run evidence persistence and `require-evidence` harness policies are real baseline, not future work.

## Acceptance Criteria

1. Defines evidence concepts against current run/event/artifact models.
2. Identifies whether a new ADR is required.
3. Produces a bounded first engineering story if implementation is ready.

## Refinement Outcome

Evidence is run-scoped proof attached during execution. It can be emitted by a runtime backend, inspectable agent, or verifier and should remain inspectable through the same event/artifact surfaces as other run outputs.

Verification is policy evaluation over run evidence. For v1, the existing `require-evidence` harness policy is the first and only policy kind. It checks for non-empty evidence with a required label and optional type.

Operator verdicts are deferred human review records. They may later consume verification summaries and evidence, but they are not required for the first implementation slice.

The existing codebase already includes:

- run evidence persistence under `.athena/run-evidence/`
- `RunEvidenceRecord` with run id, label, type, content, artifact reference, size, and timestamp
- harness `verificationPolicies`
- run result `verificationStatus` and `verificationFailures`
- runtime evidence attachment hooks

No new ADR is required for the first slice. ADR 0012 already frames evidence as artifact/output validation, and ADR 0013 requires stopped/limited runs to preserve inspectable evidence.

## Validation
- Required checks: Flywheel workflow validation after lane movement.
- Additional checks: evidence that existing run evidence and verification policy support was found in source and tests.

## Dependencies

- Current event and artifact observability model.

## Risks

- Could become too abstract without a concrete operator workflow.
- Console run inspection should make verification understandable before adding policy authoring or operator verdict workflows.

## Open Questions

- Should evidence records themselves be listed separately from artifact metadata in run inspection, or should v1 only show verification status/failures?

## Next Step

Implement `flywheel/backlog/engineering/ready/STORY-20260528-run-verification-inspection.md` when this deferred track is promoted.

## Engineering Handoff
- `change_summary`: Added a refined verification/evidence epic, clarified evidence/verification/operator-verdict boundaries, updated current direction, and created the first ready implementation story for console run verification inspection.
- `validation_evidence`: Inspected ADR 0012, ADR 0013, existing run evidence contracts, run service verification evaluation, and state-store evidence support; ran Flywheel workflow validation.
- `qa_focus`: Confirm the ready story is bounded to surfacing existing verification status/failures and does not expand into policy authoring or verdict resources.
- `open_risks`: Aggregate mission/workflow verification and operator verdicts remain deferred.

## QA Verdict
- `verdict`: pass
- `evidence_quality`: sufficient for PM refinement; acceptance criteria are documented in the story, refined epic, current direction, and ready follow-on implementation story.
- `defects`: none
- `state_transition`: move to `done`

## Transition History
- `2026-05-28T03:29:35Z`: `intake` -> `active` by `Codex`; PM refinement started
- `2026-05-28T03:30:58Z`: `active` -> `qa` by `Codex`; PM refinement handoff ready
- `2026-05-28T03:31:14Z`: `qa` -> `done` by `Codex`; QA accepted PM refinement
