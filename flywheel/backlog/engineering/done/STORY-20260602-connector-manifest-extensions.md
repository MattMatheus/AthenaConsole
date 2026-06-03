---
kind: story
id: STORY-20260602-connector-manifest-extensions
status: done
owner_role: engineering
source: pm
success_metric: Connector packs can declare service identity, auth posture, scopes, rate limits, and operation classes in validated manifests.
release_scope: deferred
ready: false
---

# Story: Connector Manifest Extensions

## Metadata
- `id`: STORY-20260602-connector-manifest-extensions
- `owner_role`: engineering
- `status`: done
- `source`: pm
- `decision_refs`: [0008-plugin-package-format, 0013-safety-approval-and-loop-limit-model]
- `success_metric`: Connector packs can declare service identity, auth posture, scopes, rate limits, and operation classes in validated manifests.
- `release_scope`: deferred

## Problem Statement
Connector packs need a constrained manifest contract before service-specific packs can safely describe credentials, external services, scopes, rate limits, and read/write operation behavior.

## Scope
- In: Extend plugin or agent manifest schema with connector metadata; define auth type, credential requirement, declared scope, rate limit, retry, and operation class conventions; add fixtures and validation coverage.
- Out: Live service integrations, OAuth implementation, secret storage, marketplace installation, and connector runtime execution.

## Assumptions
- Connector metadata should build on the existing plugin manifest path and first-party pack metadata.
- Operation classes should be explicit enough to support later approval gating.
- User-authored non-connector plugins must remain valid without connector metadata.

## Acceptance Criteria
1. Connector metadata shape is documented and validated for at least one connector-capable pack fixture.
2. Invalid auth types, malformed scope declarations, invalid operation classes, or impossible rate-limit declarations are rejected by manifest validation.
3. Non-connector plugins and existing first-party capability packs remain valid without connector metadata.
4. The metadata distinguishes read-only operations from external writes in a way later stories can consume.

## Validation
- Required checks: `npm --workspace @athena/core run validate:manifests`; focused manifest/schema tests.
- Additional checks: `npm --workspace @athena/core run typecheck`; docs review for connector terminology consistency.

## Dependencies
- Epic 2026.38 Capability Pack Foundation.
- Epic 2026.40 Connector Pack Platform.

## Risks
- Connector metadata could become an oversized OAuth abstraction before the first real connector proves it.
- Vague operation classes could make external write approvals unreliable later.

## Open Questions
- Should connector metadata live under `plugin.connector`, `plugin.pack.connector`, or agent-level declarations?
- What is the smallest auth posture set for first services: none, api_token, oauth, and local_secret?

## Next Step
- PM refined: connector metadata lives under `plugin.connector`; agents may reference connector operations under `agent.runtime.connectorOperations`; auth types are `none`, `api-token`, `oauth`, and `local-secret`; operation classes are `read` and `external-write`.

## Engineering Handoff
- `change_summary`: Added connector manifest schema support for service identity, auth posture, credential binding requirement, scopes, rate limits, retry conventions, and read/external-write operation classes. Added agent-level connector operation references and a bundled connector-platform fixture pack.
- `validation_evidence`: `npm --workspace @athena/core run test:unit -- control-plane.manifests.test.ts control-plane.connectors.test.ts control-plane.agent-catalog.test.ts control-plane.app-state.test.ts` passed with 24 tests; `npm --workspace @athena/core run validate:manifests` passed; `npm --workspace @athena/core run validate:pack-fixtures` passed; `npm --workspace @athena/core run typecheck` passed.
- `qa_focus`: Verify non-connector plugins remain valid; verify malformed connector auth/operation metadata is rejected; confirm external-write operations must declare approval.
- `open_risks`: The connector taxonomy is intentionally small and may need widening after the first service-specific pack proves concrete OAuth/provider requirements.

## QA Verdict
- `verdict`: Pass. Acceptance criteria are met.
- `evidence_quality`: Strong. QA reviewed schema/test/fixture changes and reran focused manifest, connector, catalog, app-state, manifest validation, fixture validation, and typecheck evidence.
- `defects`: None.
- `state_transition`: Move to `done`.

## Transition History
- `2026-06-03T02:44:58Z`: `intake` -> `ready`; PM refined connector platform story sequence
- `2026-06-03T02:45:01Z`: `ready` -> `active`; Activate first connector platform dependency
- `2026-06-03T02:52:26Z`: `active` -> `qa`; Engineering handoff ready with connector manifest validation evidence
- `2026-06-03T02:52:36Z`: `qa` -> `done`; QA passed connector manifest validation
