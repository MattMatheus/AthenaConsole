---
kind: architecture_story
id: ARCH-20260603-product-intuition-ia
status: done
owner_role: product-architect
source: planning
decision_owner: product-architect
success_metric: Primary and advanced product surfaces are explicitly classified before implementation begins.
ready: false
---

# Architecture Story: Product Intuition IA

## Metadata
- `id`: ARCH-20260603-product-intuition-ia
- `owner_role`: product-architect
- `status`: done
- `source`: planning
- `decision_refs`: []
- `decision_owner`: product-architect
- `success_metric`: Primary and advanced product surfaces are explicitly classified before implementation begins.

## Decision Scope
- Decide the operator-facing information architecture for the product intuition repair epic.
- Classify current surfaces as primary, secondary, advanced, or deprecated-from-navigation.
- Define naming rules for outcome-led surfaces versus implementation primitives.

## Problem Statement
- Team Orchestrator's architecture is coherent, but too many implementation nouns have become first-class operator choices.
- Before adding more connector surface area, the console needs a clear hierarchy that starts from user intent and preserves inspectability after work starts.

## Inputs
- Existing decisions:
  - `docs/product/direction/current-direction.md`
  - `docs/product/epics/active/2026.42.00-epic-product-intuition-and-start-work-flow.md`
- Existing architecture artifacts:
  - Current console navigation and route structure.
  - Bundled software-team and GitHub pack metadata.
  - User guide and getting-started flows.
- Constraints:
  - Do not remove plugin-backed agents, task/workflow execution, safety, memory, artifacts, or approvals.
  - Keep deep links stable where practical.
  - Advanced users still need raw surfaces.

## Outputs Required
- Decision updates:
  - Product IA decision note or ADR: `docs/product/architecture/decisions/0025-product-intuition-and-start-work-ia.md`
- Architecture artifacts:
  - Surface classification table.
  - Proposed route/nav grouping.
  - Naming guidance for "Capability", "Work", "Run", "Review", and advanced primitives.
- Risks and tradeoffs:
  - Safety visibility.
  - Existing user disruption.
  - Metadata requirements for capability-led work.

## Alternatives Considered
- Keep current navigation and add more onboarding copy.
- Rename only, without changing flow.
- Add a Start Work page while keeping all existing surfaces primary.
- Rebuild the IA around outcome-led primary surfaces and advanced implementation surfaces.

## Operational Impact
- Follow-on stories will modify console navigation, dashboard, work creation, docs, and possibly route aliases.
- No backend domain model removal is expected.

## Acceptance Criteria
1. Current top-level product nouns are classified as primary, secondary, advanced, or hidden-from-primary-navigation.
2. The decision explains how users start first-run demo work and real repo work without choosing between task/workflow/mission/run-template first.
3. Follow-on implementation stories can proceed without re-litigating IA.

## Review Focus
- Does the proposed IA reduce first-use decision count?
- Does it preserve safety and inspectability?
- Does it avoid hiding necessary author/admin functions?

## Next Step
- Promote to architecture active and produce the IA decision before implementing Start Work.

## Intake Promotion Checklist
- [x] Decision scope is explicit and bounded.
- [x] Problem statement explains why the decision is needed now.
- [x] Inputs are listed and available.
- [x] Outputs are concrete and reviewable.
- [x] Alternatives and operational impact are explicit.
- [x] Follow-on implementation work is split out when needed.

## Architecture Handoff
- `decision_summary`: Accepted an intent-led IA centered on Start Work, Work History, Capabilities, Resources, and Review. Agents, tasks, missions, workflows, run templates, policy, audit, raw inputs, and diagnostics remain intact but move toward secondary, advanced, or detail surfaces.
- `alternatives_considered`: Keeping current navigation with more copy; renaming agents to capabilities only; adding Start Work while keeping primitives primary; removing domain primitives. The accepted path keeps the architecture but changes exposure hierarchy.
- `operational_impact`: Follow-on work should add an outcome-led Start Work surface, preselect backing agents/workflows from capability cards, add guided preflight, contain advanced surfaces, and update docs. Direct primitive routes should remain reachable where practical.
- `follow_on_work`: `STORY-20260603-start-work-entry-point`, `STORY-20260603-capability-led-work-creation`, `STORY-20260603-guided-work-preflight`, `STORY-20260603-advanced-surface-containment`, `STORY-20260603-intent-led-docs-alignment`.

## Transition History
- `2026-06-04T01:41:27Z`: `intake` -> `active`; needed before start-work implementation
- `2026-06-04T01:42:16Z`: `active` -> `qa`; IA decision written in ADR 0025
- `2026-06-04T01:42:33Z`: `qa` -> `done`; ADR 0025 accepted and handoff complete
