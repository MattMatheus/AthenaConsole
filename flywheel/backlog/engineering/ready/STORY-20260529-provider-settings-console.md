---
kind: story
id: STORY-20260529-provider-settings-console
status: ready
owner_role: Software Engineer
source: epic
success_metric: Operators can configure and test a model provider from the console without exposing API keys.
release_scope: next
ready: true
---

# Story: Provider Settings Console

## Metadata
- `id`: STORY-20260529-provider-settings-console
- `owner_role`: Software Engineer
- `status`: ready
- `source`: epic
- `decision_refs`: [ADR-0018]
- `epic`: docs/product/epics/refinement/2026.27.00-epic-model-provider-and-secrets-setup.md
- `success_metric`: Operators can configure and test a model provider from the console without exposing API keys.
- `release_scope`: next

## Problem Statement

The console does not currently show operators how to connect an AI model provider or verify readiness.

## Initial Scope

- In: provider settings UI, OpenAI-compatible form, secret reference selector/input, test connection action, redacted status display, missing-provider guidance.
- Out: agent provider readiness integration, external key vault, unsupported subscription reuse.

## Acceptance Criteria

1. Console can create/edit/delete OpenAI-compatible provider configs.
2. Console can reference env or local-file secrets without displaying raw values after save.
3. Test connection reports success/failure without logging or rendering secret values.
4. Provider settings explain that Codex subscription reuse is research-only unless supported integration exists.
5. Settings page remains clear on desktop and mobile.

## Validation

- `npm --workspace apps/console run typecheck`
- `npm --workspace apps/console run lint`
- Console tests for form redaction if helpers are added.
- Browser QA for provider settings create/edit/test states.
- `./flywheel/tools/validate_workflow_state.sh`

## Refinement Notes

The existing settings/cost provider surface may be reused only if it remains clear that this config is runtime model provider setup, not billing metadata.

## Transition History
- `2026-05-29T03:08:43Z`: PM refinement created ready engineering story
