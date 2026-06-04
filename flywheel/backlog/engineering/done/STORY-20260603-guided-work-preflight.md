---
kind: story
id: STORY-20260603-guided-work-preflight
status: done
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
- `status`: done
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
- Capability-led task and workflow setup pages now have selected backing primitives and human-readable capability labels.
- This slice should summarize existing state; it should not add new readiness APIs or approval behavior.

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
- `ARCH-20260603-product-intuition-ia` complete; ADR: `docs/product/architecture/decisions/0025-product-intuition-and-start-work-ia.md`.
- `STORY-20260603-capability-led-work-creation` complete.

## Risks
- Preflight can become dense if it tries to show every diagnostic at once.

## Open Questions
- Should approved-write mode require a separate confirmation before task creation, execution, or both? Defer backend/approval behavior; this slice only makes the safety posture explicit.

## Next Step
- Move to engineering active.

## Engineering Handoff
- `change_summary`: Added guided preflight summaries to task and workflow setup pages. Each summary combines backing primitive, repository context, provider state, safety posture, and required-input readiness. Safety copy now frames read-only as no automatic file mutations, propose-changes as reviewable proposals, and approved-write as requiring approval support.
- `validation_evidence`: `npm --workspace @athena/console run typecheck` passed; `npm --workspace @athena/console run test` passed with 18 files / 64 tests; `npm --workspace @athena/console run lint` passed; `git diff --check` passed; browser smoke verified task and workflow preflight panels render with backing primitive, repository, provider, safety, and required inputs.
- `qa_focus`: Confirm the preflight is useful without becoming too dense; verify missing repo and unresolved agent/template/provider states are actionable enough; verify read-only/propose/approved-write language feels like safety choices rather than runtime jargon.
- `open_risks`: Browser smoke used the console dev server without API, so full-stack smoke should verify provider/repo/input statuses update from real API data and selected agent/template manifests.

## QA Verdict
- `verdict`: pass
- `evidence_quality`: Good for the scoped preflight UI story. Console typecheck, full console test suite, lint, diff whitespace check, Flywheel validation, and browser smoke passed. Browser smoke verified task and workflow preflight panels with backing primitive, repository, provider, safety, and required-input summaries.
- `defects`: None filed. Residual risk: full-stack smoke should verify statuses update with live agent, template, provider, repository, and input data.
- `state_transition`: move to done

## Transition History
- `2026-06-04T01:58:05Z`: `intake` -> `active`; capability-led destination flow complete
- `2026-06-04T02:00:38Z`: `active` -> `qa`; implementation complete and validation passed
- `2026-06-04T02:01:08Z`: `qa` -> `done`; QA pass for guided work preflight
