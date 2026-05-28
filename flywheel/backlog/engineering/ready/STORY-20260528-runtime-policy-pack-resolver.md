---
kind: story
id: STORY-20260528-runtime-policy-pack-resolver
status: ready
owner_role: Engineer
source: pm
success_metric: Task runs resolve named runtime policy packs into deterministic backend, limit, and approval guardrails.
release_scope: deferred
ready: true
---

# Story: Add Runtime Policy Pack Resolver

## Metadata
- `id`: STORY-20260528-runtime-policy-pack-resolver
- `owner_role`: Engineer
- `status`: ready
- `source`: pm
- `decision_refs`: [ADR-0011, ADR-0013, docs/product/epics/refinement/2026.20.00-epic-runtime-policy-packs.md]
- `success_metric`: Task runs resolve named runtime policy packs into deterministic backend, limit, and approval guardrails.
- `release_scope`: deferred

## Problem Statement

Runtime limits and approval requirements are currently resolved directly from agent manifests and defaults. Operators need reusable policy-pack presets before runtime isolation can grow safely, but the first slice should stay local-first and contract-focused.

## Scope
- In: add built-in runtime policy pack definitions, resolve an optional pack id during task run setup, compose pack guardrails with existing manifest limits/approval declarations, reject runs whose selected backend is not pack-allowed, and emit an inspectable run event with the resolved pack/effective safety settings.
- Out: persisted custom policy packs, console pack authoring, organization policy, Kubernetes/Kyverno integration, hosted backend governance, or changing run scheduling semantics.

## Assumptions

- `standard-local` preserves current behavior and can be the implicit default.
- Agent manifests remain the source of implementation/backend declarations.
- Pack and manifest approvals compose by union.
- Pack maximums should not loosen manifest limits.

## Acceptance Criteria

1. Task run safety resolution supports built-in `standard-local`, `cautious-local`, and `container-isolated` packs.
2. Runs without a pack declaration remain compatible with current default behavior.
3. A run whose resolved backend is not allowed by its policy pack fails before execution with a clear `CONFIG_ERROR`.
4. Effective limits use the stricter value when both manifest and pack values apply.
5. Effective approval requirements include both pack-required and manifest-required risk classes without duplicates.
6. A run event records the selected policy pack and effective safety settings before execution starts.
7. Core tests cover default compatibility, backend rejection, limit composition, and approval union behavior.

## Validation
- Required checks: `npm --workspace @athena/core run typecheck`, targeted task workbench tests, `git diff --check`, Flywheel workflow validation.
- Additional checks: manifest validation if manifest contract/schema examples change.

## Dependencies

- Current task workbench safety resolution.
- ADR 0011 runtime backend interface.
- ADR 0013 safety approval and loop limit model.

## Risks

- Pack naming could become product UI too early if the resolver is overexposed.
- Container-isolated semantics should not imply stronger isolation than the existing `container-command` backend actually enforces.

## Open Questions

- Should future task/run-template level pack selection override agent defaults, or only narrow them?

## Next Step

Engineering implementation.

## Engineering Handoff
- `change_summary`:
- `validation_evidence`:
- `qa_focus`:
- `open_risks`:

## QA Verdict
- `verdict`:
- `evidence_quality`:
- `defects`:
- `state_transition`:
