---
kind: story
id: STORY-20260603-guided-work-preflight
status: intake
owner_role: frontend-engineer
source: planning
success_metric: Users review repo, provider, safety, and required inputs in one preflight before execution.
release_scope: deferred
ready: false
---

# Story: Guided Work Preflight

## Metadata
- `id`: STORY-20260603-guided-work-preflight
- `owner_role`: frontend-engineer
- `status`: intake
- `source`: planning
- `decision_refs`: [ARCH-20260603-product-intuition-ia]
- `success_metric`: Users review repo, provider, safety, and required inputs in one preflight before execution.
- `release_scope`: deferred

## Problem Statement
- Repo context, provider readiness, run mode, safety posture, and manifest inputs are currently scattered through task/workflow setup.
- A guided preflight should make readiness and safety obvious without making users assemble the control-plane record by hand.

## Scope
- In:
  - Design and implement a preflight summary for selected work.
  - Combine required inputs, repo context, provider readiness, and run mode/safety posture.
  - Make blockers and warnings actionable.
- Out:
  - New approval backend behavior.
  - New provider configuration model.

## Assumptions
- Existing readiness and run-readiness APIs provide enough data for the first version.

## Acceptance Criteria
1. Before execution, users can see what will run, where it will run, required credentials/provider state, and write/safety posture.
2. Blocking readiness issues are surfaced in the same flow as required inputs.
3. Read-only/propose/approved-write modes are framed as safety choices, not raw runtime jargon.

## Validation
- Required checks:
  - Console typecheck.
  - Focused tests for preflight model logic.
- Additional checks:
  - Manual smoke with missing provider, missing repo, and ready read-only work.

## Dependencies
- `ARCH-20260603-product-intuition-ia`.
- `STORY-20260603-capability-led-work-creation`.

## Risks
- Preflight can become dense if it tries to show every diagnostic at once.

## Open Questions
- Should approved-write mode require a separate confirmation before task creation, execution, or both?

## Next Step
- Refine after capability-led creation is designed.

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
