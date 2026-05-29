---
kind: story
id: STORY-20260529-provider-config-secret-model
status: done
owner_role: Software Engineer
source: epic
success_metric: Operators can persist model provider metadata and secret references without exposing raw secret values through app-state APIs.
release_scope: next
ready: true
---

# Story: Provider Config And Secret Reference Model

## Metadata
- `id`: STORY-20260529-provider-config-secret-model
- `owner_role`: Software Engineer
- `status`: done
- `source`: epic
- `decision_refs`: [ADR-0010, ADR-0018]
- `epic`: docs/product/epics/refinement/2026.27.00-epic-model-provider-and-secrets-setup.md
- `success_metric`: Operators can persist model provider metadata and secret references without exposing raw secret values through app-state APIs.
- `release_scope`: next

## Problem Statement

Agents need model providers, but provider setup is environment-driven and raw API keys must not become ordinary app-state data.

## Initial Scope

- In: provider config table/repository, secret reference type, env and local-file secret reference resolution, redacted API responses, test-connection service boundary.
- Out: provider settings UI, external key vault integration, Codex subscription integration.

## Acceptance Criteria

1. Provider configs can be created/listed/read/updated/deleted with redacted secret metadata.
2. Secret references support `env` and `local-file` kinds.
3. Raw secret values are never returned from API responses or stored in normal provider config rows.
4. Provider runtime can resolve configured provider metadata and secret references for OpenAI-compatible providers.
5. Missing secret, invalid file, and unsupported provider errors are explicit and redacted.
6. Tests cover redaction and secret reference resolution.

## Validation

- `npm --workspace @athena/core run typecheck`
- Core tests for provider config, redaction, and secret resolution.
- API schema/contract validation if applicable.
- `git diff --check`
- `./flywheel/tools/validate_workflow_state.sh`

## Refinement Notes

Keep this narrow: OpenAI-compatible first, with existing env provider behavior mapped where practical.

## Engineering Handoff

- `completed_at`: 2026-05-29T18:05:41Z
- `change_summary`: Added persisted OpenAI-compatible model provider configs with redacted env/local-file secret references, runtime-only secret resolution, API CRUD/test routes, OpenAPI schemas, and focused repository/service/API coverage.
- `validation_evidence`: typecheck, focused provider/API/repository tests, schema check, manifest validation, whitespace check, and workflow validation passed.
  - `npm --workspace @athena/core run typecheck`
  - `npm --workspace @athena/core run typecheck`
  - `npm --workspace @athena/core exec -- vitest run tests/control-plane.domain-repositories.test.ts tests/control-plane.model-providers.test.ts tests/api.model-providers.test.ts tests/api.route-registration.test.ts tests/api.schemas.test.ts`
  - `npm --workspace @athena/core run check:schemas`
  - `npm --workspace @athena/core run validate:manifests`
  - `git diff --check`
  - `./flywheel/tools/validate_workflow_state.sh`
- `qa_focus`: Confirm raw API key values are not persisted in provider config rows or returned by service/API responses; verify missing env and local-file references stay explicit but redacted; verify generated API schema includes provider CRUD/test contracts.
- `open_risks`: Test connection currently validates secret resolvability only; it does not make a live provider API call until the operator settings UI/runtime invocation story wires the provider into agent execution.

## QA Verdict

- `verdict`: passed
- `qa_timestamp`: 2026-05-29T18:06:46Z
- `evidence_quality`: Fresh local QA pass covered typecheck, focused repository/service/API tests, schema generation check, manifest validation, whitespace validation, and Flywheel workflow validation.
- `validation_evidence`: `npm --workspace @athena/core run typecheck`; `npm --workspace @athena/core exec -- vitest run tests/control-plane.domain-repositories.test.ts tests/control-plane.model-providers.test.ts tests/api.model-providers.test.ts tests/api.route-registration.test.ts tests/api.schemas.test.ts`; `npm --workspace @athena/core run check:schemas`; `npm --workspace @athena/core run validate:manifests`; `git diff --check`; `./flywheel/tools/validate_workflow_state.sh`.
- `defects`: None found.
- `state_transition`: Move to `done`.
- `notes`: Secret values stay out of normal provider config rows and API/service responses; runtime resolution is scoped to the internal provider runtime boundary.

## Transition History
- `2026-05-29T03:08:43Z`: PM refinement created ready engineering story
- `2026-05-29T17:57:38Z`: `ready` -> `active`; Engineering starts provider config secret model
- `2026-05-29T18:05:53Z`: `active` -> `qa`; Engineering handoff ready for QA
- `2026-05-29T18:07:01Z`: `qa` -> `done`; QA passed for provider config secret model
