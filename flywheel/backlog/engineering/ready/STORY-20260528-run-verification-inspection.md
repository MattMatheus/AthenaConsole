---
kind: story
id: STORY-20260528-run-verification-inspection
status: ready
owner_role: Engineer
source: pm
success_metric: Operators can see whether a run passed evidence verification and why it failed from the run inspection page.
release_scope: deferred
ready: true
---

# Story: Surface Run Verification In Inspection

## Metadata
- `id`: STORY-20260528-run-verification-inspection
- `owner_role`: Engineer
- `status`: ready
- `source`: pm
- `decision_refs`: [ADR-0012, ADR-0013, docs/product/epics/refinement/2026.19.00-epic-verification-evidence-model.md]
- `success_metric`: Operators can see whether a run passed evidence verification and why it failed from the run inspection page.
- `release_scope`: deferred

## Problem Statement

Run results can already carry `verificationStatus` and `verificationFailures`, but the console run inspection surface does not make that evidence-verification outcome visible to operators.

## Scope
- In: extend run detail API/console contracts if needed, add console model helpers for verification status/failure display, and render verification summary in `TaskRunDetailPage`.
- Out: new verification policy kinds, policy authoring UI, operator verdict resources, mission/workflow aggregate verification, or changes to runtime evidence persistence.

## Assumptions

- Existing `RunResult` verification fields are the source of truth.
- Evidence records remain run-scoped.
- `require-evidence` is the only v1 verification policy kind.

## Acceptance Criteria

1. Run inspection shows verification status when present: passed, verification-failed, or not evaluated.
2. Verification failures show policy id, kind, message, and useful details such as missing evidence label/type.
3. The UI distinguishes verification failure from runtime failure so a completed run with missing evidence is understandable.
4. Console tests cover verification formatting/status helpers.
5. Existing run detail behavior remains compatible for runs without verification fields.

## Validation
- Required checks: console typecheck/test/build plus Flywheel workflow validation.
- Additional checks: browser QA against seeded run detail data with passing and failing verification states.

## Dependencies

- Existing run evidence persistence and `require-evidence` policy evaluation.
- Existing task run inspection page.

## Risks

- If API run detail does not currently return verification fields, the story may need a narrow core contract update.

## Open Questions

- Should evidence records themselves be listed separately from artifact metadata in run inspection, or should v1 only show verification status/failures?

## Next Step

Engineering implementation.

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
