---
kind: story
id: STORY-20260602-connector-external-write-approvals
status: done
owner_role: engineering
source: pm
success_metric: Connector operations classified as external writes cannot execute without explicit approval evidence.
release_scope: deferred
ready: false
---

# Story: Connector External Write Approvals

## Metadata
- `id`: STORY-20260602-connector-external-write-approvals
- `owner_role`: engineering
- `status`: done
- `source`: pm
- `decision_refs`: [0013-safety-approval-and-loop-limit-model]
- `success_metric`: Connector operations classified as external writes cannot execute without explicit approval evidence.
- `release_scope`: deferred

## Problem Statement
Connector packs introduce side effects outside Team Orchestrator, so write actions such as posting comments, creating issues, updating docs, or sending messages must be blocked unless an operator explicitly approves the specific action.

## Scope
- In: Connect manifest operation classes to runtime approval requirements; define approval evidence for external writes; add blocked-run behavior and audit-friendly messages; cover read-only versus write cases in tests.
- Out: Service-specific write implementations, broad production approval policy engines, and background automation approvals.

## Assumptions
- Existing approval and safety models can be extended rather than replaced.
- External write classification should be conservative when metadata is missing or ambiguous.
- Read-only connector operations may still require credentials and scopes but should not require write approval.

## Acceptance Criteria
1. Runtime planning or execution surfaces can identify connector operations classified as external writes.
2. External write operations are blocked without explicit approval evidence.
3. Approved external write operations record enough non-secret context for audit and run inspection.
4. Read-only connector operations do not trigger the external-write approval gate solely because they use credentials.
5. Tests cover blocked write, approved write, and read-only operation behavior.

## Validation
- Required checks: focused approval-gate tests; `npm --workspace @athena/core run typecheck`.
- Additional checks: run/artifact inspection tests if approval evidence is exposed in run detail.

## Dependencies
- STORY-20260602-connector-manifest-extensions.
- STORY-20260602-connector-credential-binding.

## Risks
- Approval checks could be bypassed if operation classification is optional at runtime.
- Audit messages could leak sensitive target identifiers if not bounded.

## Open Questions
- What is the exact approval record shape for an external write action?
- Should unknown connector operation classes fail closed as external writes?

## Next Step
- PM refined: unknown connector operations fail closed as external writes; explicit approval evidence is required before external-write operations are treated as unblocked.

## Engineering Handoff
- `change_summary`: Added connector external-write approval evaluation helpers, redacted audit context construction, schema enforcement that external-write operations declare approval, and tests for read-only, blocked write, approved write, and unknown-operation fail-closed behavior.
- `validation_evidence`: `npm --workspace @athena/core run test:unit -- control-plane.manifests.test.ts control-plane.connectors.test.ts control-plane.agent-catalog.test.ts control-plane.app-state.test.ts` passed with 24 tests; `npm --workspace @athena/core run validate:pack-fixtures` passed.
- `qa_focus`: Confirm read operations do not require write approval; confirm writes block without approval evidence; confirm unknown operations fail closed.
- `open_risks`: This story provides platform policy helpers and manifest enforcement, not live service mutation execution.

## QA Verdict
- `verdict`: Pass. Acceptance criteria are met.
- `evidence_quality`: Strong. QA reviewed schema enforcement and connector approval tests for read-only, blocked write, approved write, and unknown-operation fail-closed behavior.
- `defects`: None.
- `state_transition`: Move to `done`.

## Transition History
- `2026-06-03T02:44:58Z`: `intake` -> `ready`; PM refined connector platform story sequence
- `2026-06-03T02:52:46Z`: `ready` -> `active`; Activate external write approval story
- `2026-06-03T02:52:46Z`: `active` -> `qa`; Engineering handoff ready with approval policy evidence
- `2026-06-03T02:52:56Z`: `qa` -> `done`; QA passed external write approval validation
