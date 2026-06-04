---
kind: story
id: STORY-20260603-capability-led-work-creation
status: done
owner_role: frontend-engineer
source: planning
success_metric: A selected capability preselects the underlying agent or workflow without requiring users to understand the primitive first.
release_scope: deferred
ready: false
---

# Story: Capability-Led Work Creation

## Metadata
- `id`: STORY-20260603-capability-led-work-creation
- `owner_role`: frontend-engineer
- `status`: done
- `source`: planning
- `decision_refs`: [ARCH-20260603-product-intuition-ia]
- `success_metric`: A selected capability preselects the underlying agent or workflow without requiring users to understand the primitive first.
- `release_scope`: deferred

## Problem Statement
- Current task and workflow setup screens ask users to understand agents, capabilities, requirements, manifests, raw inputs, and workflow templates.
- A user who chooses "Summarize repo" or "Draft release notes" should land in a setup path with the correct underlying primitive already selected.

## Scope
- In:
  - Add URL/state support for preselecting a capability-backed agent or workflow template.
  - Reduce visible choices after capability selection.
  - Show the underlying primitive as inspectable detail, not the initial decision.
- Out:
  - Removing task/workflow pages.
  - Changing manifest schemas.

## Assumptions
- Existing agent and workflow query APIs can resolve selected ids/versions.
- Start Work already passes task `agentId`/`version` or workflow `templateId` query parameters.
- This slice should improve the destination setup experience without adding a new backend capability registry.

## Acceptance Criteria
1. Capability selection can preselect a task agent or workflow template.
2. Users can continue with required context without manually reselecting the primitive.
3. The UI still exposes which agent/workflow will run before execution.

## Validation
- Required checks:
  - Console typecheck.
  - Focused form model/route tests.
- Additional checks:
  - Manual smoke with a task-backed capability and a workflow-backed capability.

## Dependencies
- `ARCH-20260603-product-intuition-ia` complete; ADR: `docs/product/architecture/decisions/0025-product-intuition-and-start-work-ia.md`.
- `STORY-20260603-start-work-entry-point` complete.

## Risks
- Capability metadata may need normalization if agent and workflow cards differ too much.

## Open Questions
- Should capability identity be plugin-provided metadata or derived from agents/workflows initially? Derive from the current Start Work query parameters for this slice; revisit in a later capability metadata story if needed.

## Next Step
- Move to engineering active.

## Engineering Handoff
- `change_summary`: Start Work links now pass a human-readable `capability` label alongside backing `agentId`/`version` or `templateId`; task setup shows a selected-capability panel when launched with an agent and hides the unrelated existing-task list and requirements filter; workflow setup shows a selected-capability panel when launched with a template, hides catalog/filter chrome by default, and allows explicit browsing of other workflows.
- `validation_evidence`: `npm --workspace @athena/console run typecheck` passed; `npm --workspace @athena/console run test` passed with 18 files / 64 tests; `npm --workspace @athena/console run lint` passed; browser smoke verified task-backed capability navigation to `/tasks?...&capability=Summarize%20a%20repository`, selected capability text, backing agent id/version, workflow-backed navigation to `/workflows?...&capability=Run%20the%20first-run%20demo`, selected capability text, and Browse other workflows control.
- `qa_focus`: Verify capability-launched task and workflow setup pages feel focused and still expose backing primitives before execution; verify direct `/tasks` and `/workflows` routes still show normal browsing/catalog surfaces; verify Start Work links remain accurate.
- `open_risks`: Browser smoke ran with only the console dev server, so API-backed agent/template resolution could not be fully exercised; full-stack smoke should recheck that preselected agents/templates load into the forms once API is running.

## QA Verdict
- `verdict`: pass
- `evidence_quality`: Good for the scoped destination-flow change. Console typecheck, full console test suite, lint, diff whitespace check, Flywheel validation, and browser smoke passed. Browser smoke verified selected capability panels and backing primitive context for both task-backed and workflow-backed Start Work cards.
- `defects`: None filed. Residual risk: full API-backed agent/template resolution should be rechecked with the API running because the browser smoke used the console dev server only.
- `state_transition`: move to done

## Transition History
- `2026-06-04T01:49:37Z`: `intake` -> `active`; Start Work complete and destination preselection ready to implement
- `2026-06-04T01:51:53Z`: `active` -> `qa`; implementation complete and validation passed
- `2026-06-04T01:52:31Z`: `qa` -> `done`; QA pass for capability-led work creation
