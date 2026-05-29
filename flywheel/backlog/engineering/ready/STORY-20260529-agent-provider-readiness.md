---
kind: story
id: STORY-20260529-agent-provider-readiness
status: ready
owner_role: Software Engineer
source: epic
success_metric: Operators can see whether an agent or workflow has the provider configuration required to run.
release_scope: next
ready: true
---

# Story: Agent Provider Readiness

## Metadata
- `id`: STORY-20260529-agent-provider-readiness
- `owner_role`: Software Engineer
- `status`: ready
- `source`: epic
- `decision_refs`: [ADR-0007, ADR-0018]
- `epic`: docs/product/epics/refinement/2026.27.00-epic-model-provider-and-secrets-setup.md
- `success_metric`: Operators can see whether an agent or workflow has the provider configuration required to run.
- `release_scope`: next

## Problem Statement

Even after provider setup exists, operators need to know whether a selected agent/workflow can actually use a configured provider.

## Initial Scope

- In: manifest provider requirement conventions, readiness service, agent/workflow UI readiness copy, create-work missing-provider states.
- Out: full structured form rendering, SDK provider proxy.

## Acceptance Criteria

1. Agents/workflows can declare provider/model requirements or preferences in a documented manifest-compatible way.
2. Readiness checks report configured, missing, invalid, or untested provider status.
3. Agent catalog and workflow create paths show missing provider setup before run.
4. No raw provider secret values appear in readiness payloads or UI.
5. Mock provider remains available for local-only demos.

## Validation

- Core tests for provider readiness evaluation.
- `npm --workspace @athena/core run validate:manifests`
- `npm --workspace apps/console run typecheck`
- `npm --workspace apps/console run lint`
- Browser QA for missing and ready provider states.
- `./flywheel/tools/validate_workflow_state.sh`

## Refinement Notes

Keep provider requirements minimal and compatible with current manifest schema conventions.

## Transition History
- `2026-05-29T03:08:43Z`: PM refinement created ready engineering story
