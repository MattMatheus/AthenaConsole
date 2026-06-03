---
kind: story
id: STORY-20260602-connector-credential-binding
status: done
owner_role: engineering
source: pm
success_metric: Operators can bind connector credentials by reference without exposing secret values in manifests, tasks, runs, or artifacts.
release_scope: deferred
ready: false
---

# Story: Connector Credential Binding

## Metadata
- `id`: STORY-20260602-connector-credential-binding
- `owner_role`: engineering
- `status`: done
- `source`: pm
- `decision_refs`: [0008-plugin-package-format, 0013-safety-approval-and-loop-limit-model]
- `success_metric`: Operators can bind connector credentials by reference without exposing secret values in manifests, tasks, runs, or artifacts.
- `release_scope`: deferred

## Problem Statement
Connector packs cannot be safely useful until credentials are bound through stable references instead of being embedded in plugin manifests, workflow inputs, task text, or run artifacts.

## Scope
- In: Define and implement the connector credential reference model; persist non-secret binding metadata; expose readiness-safe binding status; add tests that secret values are not serialized through connector surfaces.
- Out: Full OAuth browser flows, production secret vault integrations, service-specific credential validation, and external network calls.

## Assumptions
- Existing provider settings and secret handling patterns can inform the connector credential model.
- The first implementation can support local operator-provided token or secret references without generalizing every provider.
- Diagnostics should expose missing or bound states, not raw credential material.

## Acceptance Criteria
1. Connector packs can declare required credential bindings and resolve a binding reference for readiness checks.
2. Secret values are not written into manifests, task payloads, run records, artifacts, diagnostics, or fixture outputs.
3. Missing, unbound, and bound credential states are represented distinctly for later console display.
4. Tests cover successful binding metadata, missing binding metadata, and redaction behavior.

## Validation
- Required checks: focused core tests for credential binding and redaction; `npm --workspace @athena/core run typecheck`.
- Additional checks: `npm --workspace @athena/core run validate:manifests`; console/API tests if binding state is exposed through existing readiness surfaces.

## Dependencies
- STORY-20260602-connector-manifest-extensions.

## Risks
- Secret references can accidentally become secret values if serialized carelessly.
- Credential binding UX can overreach into full account management too early.

## Open Questions
- Should binding state live in the existing app-state store or a dedicated connector settings table?
- Should this story include console controls or only the core/API primitive for a later UX story?

## Next Step
- PM refined: this story is core/API primitive work only; console credential controls are deferred until a service-specific connector needs them.

## Engineering Handoff
- `change_summary`: Added a connector credential binding app-state table and repository for non-secret binding metadata, plus helper functions for upsert/get and readiness-safe scope resolution.
- `validation_evidence`: `npm --workspace @athena/core run test:unit -- control-plane.manifests.test.ts control-plane.connectors.test.ts control-plane.agent-catalog.test.ts control-plane.app-state.test.ts` passed with 24 tests; `npm --workspace @athena/core run typecheck` passed.
- `qa_focus`: Confirm binding records persist only references/display/scopes/status, not secret values; confirm missing, bound, and invalid states feed readiness.
- `open_risks`: No full OAuth flow or vault integration is included; those remain intentionally deferred.

## QA Verdict
- `verdict`: Pass. Acceptance criteria are met.
- `evidence_quality`: Strong. QA reviewed the app-state repository/migration and connector tests for non-secret binding metadata, scope resolution, and readiness-safe missing/bound behavior.
- `defects`: None.
- `state_transition`: Move to `done`.

## Transition History
- `2026-06-03T02:44:58Z`: `intake` -> `ready`; PM refined connector platform story sequence
- `2026-06-03T02:52:36Z`: `ready` -> `active`; Activate next connector platform dependency
- `2026-06-03T02:52:36Z`: `active` -> `qa`; Engineering handoff ready with credential binding evidence
- `2026-06-03T02:52:46Z`: `qa` -> `done`; QA passed credential binding validation
