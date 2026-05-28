---
kind: story
id: STORY-20260528-run-verification-inspection
status: done
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
- `status`: done
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
- `change_summary`: Added optional run verification persistence to app-state runs, exposed `verificationStatus` and `verificationFailures` through task workbench contracts/API schemas, preserved verification fields from task run envelopes, parsed them in the console client, and rendered a dedicated Verification panel on task run inspection.
- `validation_evidence`: `npm --workspace @athena/core run typecheck`; `npm --workspace @athena/core run test:unit -- control-plane.task-workbench api.task-workbench control-plane.api-contracts`; `npm --workspace @athena/core run validate:manifests`; `npm --workspace @athena/console run typecheck`; `npm --workspace @athena/console run lint`; `npm --workspace @athena/console run test`; `npm --workspace @athena/console run build`; `git diff --check`; `./flywheel/tools/validate_workflow_state.sh --format json`.
- `qa_focus`: Verify a completed run with `verificationStatus: verification-failed` is visually distinct from runtime failure, lists policy id/kind/message/details, and runs without verification fields still show not evaluated.
- `open_risks`: The v1 detail view surfaces verification result/failures only; it does not yet list underlying evidence records or aggregate mission/workflow verification.

## QA Verdict
- `verdict`: Pass.
- `evidence_quality`: Automated coverage validates core persistence/API mapping and console verification formatting helpers. Browser QA used a seeded completed run with `verificationStatus: verification-failed` and confirmed the Verification panel displays the failed badge, policy id, `require-evidence` kind, message, and `label`/`evidenceType` details while no runtime Terminal State appears.
- `defects`: None found.
- `state_transition`: Move to done.

## Transition History
- `2026-05-28T03:35:24Z`: `ready` -> `active` by `Codex`; Engineering started
- `2026-05-28T03:43:39Z`: `active` -> `qa` by `Codex`; Engineering handoff complete
- `2026-05-28T03:43:51Z`: `qa` -> `done` by `Codex`; QA passed
