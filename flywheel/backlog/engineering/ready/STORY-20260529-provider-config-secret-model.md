---
kind: story
id: STORY-20260529-provider-config-secret-model
status: ready
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
- `status`: ready
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

## Transition History
- `2026-05-29T03:08:43Z`: PM refinement created ready engineering story
