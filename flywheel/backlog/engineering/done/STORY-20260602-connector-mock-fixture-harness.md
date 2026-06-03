---
kind: story
id: STORY-20260602-connector-mock-fixture-harness
status: done
owner_role: engineering
source: pm
success_metric: Connector agents can be tested in CI with mock fixtures and no live service calls.
release_scope: deferred
ready: false
---

# Story: Connector Mock Fixture Harness

## Metadata
- `id`: STORY-20260602-connector-mock-fixture-harness
- `owner_role`: engineering
- `status`: done
- `source`: pm
- `decision_refs`: [0008-plugin-package-format, 0012-event-artifact-observability-model]
- `success_metric`: Connector agents can be tested in CI with mock fixtures and no live service calls.
- `release_scope`: deferred

## Problem Statement
Service-specific connector packs need deterministic fixture tests before any live API behavior is trusted, but Team Orchestrator does not yet have a connector-oriented mock harness for requests, responses, rate-limit states, and approval-sensitive operations.

## Scope
- In: Define connector fixture format; add deterministic mock request/response runner conventions; support read, write-proposed, write-approved, rate-limit, and auth-missing cases; document how first-party connector packs should use it.
- Out: Live API contract testing, provider SDK integrations, full VCR recording, and marketplace certification.

## Assumptions
- Existing pack fixture validation can be extended for connector-specific fixtures.
- Fixture output should include artifacts or structured evidence useful for QA without leaking secrets.
- The harness should fail CI if a connector fixture attempts a live network call.

## Acceptance Criteria
1. Connector fixture conventions are documented and supported by validation or test tooling.
2. Fixtures can represent successful read, blocked external write, approved external write, missing auth, missing scope, and rate-limited scenarios.
3. CI-safe validation can run without credentials or live service calls.
4. At least one sample connector-style fixture demonstrates the full harness shape.

## Validation
- Required checks: connector fixture validation tests; `npm --workspace @athena/core run validate:pack-fixtures`; `npm --workspace @athena/core run typecheck`.
- Additional checks: manifest validation if fixture metadata references connector manifest declarations.

## Dependencies
- STORY-20260602-connector-manifest-extensions.
- STORY-20260602-connector-external-write-approvals.

## Risks
- Fixture format can become too service-specific before GitHub connector work proves it.
- Mock tests can give false confidence if they do not model approval and rate-limit failure modes.

## Open Questions
- Should connector fixtures live beside pack fixtures or under a dedicated connector test directory?
- Should the mock harness validate expected artifacts, expected events, or both?

## Next Step
- PM refined: extend the existing bundled pack fixture validator with connector fixture checks instead of introducing a separate validator.

## Engineering Handoff
- `change_summary`: Added bundled `connector-platform` fixture pack and extended `validate-pack-fixtures` to require connector fixture metadata, `liveNetwork: false`, and the core connector scenarios.
- `validation_evidence`: `npm --workspace @athena/core run validate:pack-fixtures` passed and reported `ok connector-platform`; focused connector tests passed.
- `qa_focus`: Confirm fixtures cover read success, blocked write, approved write, auth missing, scope missing, and rate-limited scenarios; confirm bundled connector fixtures cannot imply live network access.
- `open_risks`: The fixture format is intentionally generic until the GitHub connector pack proves service-specific needs.

## QA Verdict
- `verdict`: Pass. Acceptance criteria are met.
- `evidence_quality`: Strong. QA reviewed the bundled connector-platform pack, mock runner, connector fixture metadata, scenario coverage, and `validate-pack-fixtures` output.
- `defects`: None.
- `state_transition`: Move to `done`.

## Transition History
- `2026-06-03T02:45:01Z`: `intake` -> `ready`; PM refined connector platform story sequence
- `2026-06-03T02:53:08Z`: `ready` -> `active`; Activate mock fixture harness story
- `2026-06-03T02:53:08Z`: `active` -> `qa`; Engineering handoff ready with fixture validator evidence
- `2026-06-03T02:53:17Z`: `qa` -> `done`; QA passed connector mock fixture harness
