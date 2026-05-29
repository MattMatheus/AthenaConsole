---
kind: story
id: STORY-20260529-provider-settings-console
status: done
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
- `status`: done
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

## Engineering Handoff

- `completed_at`: 2026-05-29T19:40:36Z
- `change_summary`: Added a runtime model provider setup surface to Settings with OpenAI-compatible create/edit/delete/test flows, env/local-file secret reference input, redacted provider status display, Codex subscription guidance, and responsive layout support.
- `validation_evidence`: console typecheck, console lint, focused model-provider form tests, browser QA, whitespace check, and workflow validation passed.
  - `npm --workspace apps/console run typecheck`
  - `npm --workspace apps/console run lint`
  - `npm --workspace apps/console run test -- src/features/model-providers/formModel.test.ts`
  - Browser QA at `http://127.0.0.1:5173/settings`: created a missing-env provider, verified test failure message, confirmed no `sk-` raw-key pattern rendered, verified Codex subscription guidance, checked mobile 390px layout, and deleted the temporary QA provider.
  - `git diff --check`
  - `./flywheel/tools/validate_workflow_state.sh`
- `qa_focus`: Verify runtime provider setup is visually distinct from usage pricing, secret values are never requested or rendered, create/edit/delete/test flows map to `/api/v1/model-providers`, and mobile layout stays readable.
- `open_risks`: Test connection still validates configured secret references only; live model API probing remains backend scope from the provider runtime integration path.

## QA Verdict

- `verdict`: passed
- `qa_timestamp`: 2026-05-29T19:41:12Z
- `evidence_quality`: Fresh local QA pass covered console typecheck, lint, focused form tests, browser create/test/mobile flow, whitespace validation, and Flywheel workflow validation.
- `validation_evidence`: `npm --workspace apps/console run typecheck`; `npm --workspace apps/console run lint`; `npm --workspace apps/console run test -- src/features/model-providers/formModel.test.ts`; browser QA at `http://127.0.0.1:5173/settings`; `git diff --check`; `./flywheel/tools/validate_workflow_state.sh`.
- `defects`: None found.
- `state_transition`: Move to `done`.
- `notes`: Browser QA verified missing-env test feedback, redacted reference display, no raw-key pattern rendering, Codex subscription guidance, and readable 390px mobile layout. Temporary QA provider record was removed after verification.

## Transition History
- `2026-05-29T03:08:43Z`: PM refinement created ready engineering story
- `2026-05-29T19:34:53Z`: `ready` -> `active`; Engineering starts provider settings console
- `2026-05-29T19:40:51Z`: `active` -> `qa`; Engineering handoff ready for QA
- `2026-05-29T19:41:44Z`: `qa` -> `done`; QA passed for provider settings console
