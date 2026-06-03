---
kind: story
id: STORY-20260602-connector-readiness-diagnostics
status: done
owner_role: engineering
source: pm
success_metric: Operators can see why a connector pack is ready, missing credentials, missing scopes, rate-limited, degraded, or blocked.
release_scope: deferred
ready: false
---

# Story: Connector Readiness Diagnostics

## Metadata
- `id`: STORY-20260602-connector-readiness-diagnostics
- `owner_role`: engineering
- `status`: done
- `source`: pm
- `decision_refs`: [0008-plugin-package-format, 0012-event-artifact-observability-model]
- `success_metric`: Operators can see why a connector pack is ready, missing credentials, missing scopes, rate-limited, degraded, or blocked.
- `release_scope`: deferred

## Problem Statement
Operators need a clear, non-secret readiness view before running connector agents so they can understand missing credentials, missing scopes, rate limits, degraded service state, and approval blockers.

## Scope
- In: Add connector readiness model and diagnostics projection; expose bounded status through API or existing readiness surfaces; add console display if a suitable surface already exists; test non-secret diagnostic output.
- Out: Live remote health checks, service-specific API probing, background sync diagnostics, and alerting.

## Assumptions
- Readiness can initially be computed from manifest metadata, credential binding state, scope declarations, and mock rate-limit status.
- Diagnostics must be actionable but should avoid exposing exact secret names or sensitive service object identifiers.
- Console display can reuse existing readiness or catalog patterns where practical.

## Acceptance Criteria
1. Connector readiness reports distinguish configured, missing credentials, missing scopes, rate-limited, degraded, and blocked states.
2. Readiness output includes actionable non-secret reasons and next-step hints.
3. Connector pack catalog or readiness surfaces display connector readiness without requiring a live service call.
4. Tests cover readiness state computation and redaction of sensitive fields.

## Validation
- Required checks: focused readiness model tests; `npm --workspace @athena/core run typecheck`.
- Additional checks: console tests and `npm --workspace @athena/console run typecheck` if UI surfaces are changed.

## Dependencies
- STORY-20260602-connector-manifest-extensions.
- STORY-20260602-connector-credential-binding.

## Risks
- Diagnostics can imply live service health when only local readiness has been checked.
- Overly detailed diagnostics can leak sensitive workspace or service metadata.

## Open Questions
- Should rate-limited and degraded states be local simulated states for this epic or reserved for service-specific packs?
- Which existing console surface should own connector readiness: plugin catalog, readiness page, or agent detail?

## Next Step
- PM refined: the minimum display surface is the existing agent catalog plugin summary; no new console page is added for this epic.

## Engineering Handoff
- `change_summary`: Added connector readiness evaluation for configured, missing credential, missing scope, rate-limited, degraded, and blocked states; projected readiness through agent catalog plugin metadata with non-secret reasons and next steps.
- `validation_evidence`: `npm --workspace @athena/core run test:unit -- control-plane.manifests.test.ts control-plane.connectors.test.ts control-plane.agent-catalog.test.ts control-plane.app-state.test.ts` passed with 24 tests; `npm --workspace @athena/core run typecheck` passed.
- `qa_focus`: Confirm readiness states are distinguishable; confirm catalog output does not expose secret values; confirm no live service call is required.
- `open_risks`: Rate-limited and degraded states are local diagnostic inputs for now, not live provider probes.

## QA Verdict
- `verdict`: Pass. Acceptance criteria are met.
- `evidence_quality`: Strong. QA reviewed connector readiness tests and agent catalog projection coverage for configured, missing credential, missing scope, rate-limited, degraded, and blocked states.
- `defects`: None.
- `state_transition`: Move to `done`.

## Transition History
- `2026-06-03T02:44:58Z`: `intake` -> `ready`; PM refined connector platform story sequence
- `2026-06-03T02:52:56Z`: `ready` -> `active`; Activate readiness diagnostics story
- `2026-06-03T02:52:56Z`: `active` -> `qa`; Engineering handoff ready with readiness catalog evidence
- `2026-06-03T02:53:08Z`: `qa` -> `done`; QA passed connector readiness diagnostics
