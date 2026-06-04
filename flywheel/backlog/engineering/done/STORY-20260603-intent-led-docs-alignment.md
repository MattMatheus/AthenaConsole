---
kind: story
id: STORY-20260603-intent-led-docs-alignment
status: done
owner_role: technical-writer
source: planning
success_metric: First-run and real-work docs explain outcome-led usage before the full domain model.
release_scope: deferred
ready: false
---

# Story: Intent-Led Docs Alignment

## Metadata
- `id`: STORY-20260603-intent-led-docs-alignment
- `owner_role`: technical-writer
- `status`: done
- `source`: planning
- `decision_refs`: [ARCH-20260603-product-intuition-ia]
- `success_metric`: First-run and real-work docs explain outcome-led usage before the full domain model.
- `release_scope`: deferred

## Problem Statement
- Current docs explain the product by introducing plugins, agents, tasks, missions, workflow templates, runs, events, artifacts, providers, repositories, and safety controls before a user has completed a useful outcome.

## Scope
- In:
  - Rewrite first-run docs around outcomes and the Start Work path.
  - Move the full domain model later in the user guide.
  - Update terminology to match the accepted IA.
  - Keep author/developer docs precise about manifests and plugins.
- Out:
  - Removing technical reference docs.
  - Changing architecture records unless the IA decision requires it.

## Assumptions
- Product IA and UI changes are now implemented for Start Work, capability-led setup, preflight, and advanced surface containment.
- This slice should update operator docs; author/developer reference can remain precise about plugins and manifests.

## Acceptance Criteria
1. Getting Started starts from readiness, Start Work, demo outcome, and inspection.
2. Real repo work docs start from selecting a capability and resource context.
3. The full domain model remains documented but is no longer prerequisite reading.

## Validation
- Required checks:
  - Documentation review.
  - Link/path check where available.
- Additional checks:
  - Manual read-through against the implemented first-run path.

## Dependencies
- `ARCH-20260603-product-intuition-ia` complete; ADR: `docs/product/architecture/decisions/0025-product-intuition-and-start-work-ia.md`.
- Start Work, capability-led creation, guided preflight, and advanced surface containment stories complete.

## Risks
- Docs can drift if rewritten before UI labels settle.

## Open Questions
- Should the user guide split operator and author tracks more aggressively? Keep one guide for now, but make the first path operator-led and move the full domain model later.

## Next Step
- Move to engineering active.

## Engineering Handoff
- `change_summary`: Reframed Getting Started and the user guide around readiness, Start Work, capability selection, preflight review, running work, and inspecting Work History before introducing the full product model. Updated real-repo guidance to start from capabilities and resource context while preserving direct advanced links for tasks, workflows, missions, and run templates.
- `validation_evidence`: Manual read-through against the implemented first-run path; terminology scan for stale primitive-first labels; `npm --workspace @athena/console run typecheck`; `npm --workspace @athena/console run test -- navigationModel routeModel`; `git diff --check`.
- `qa_focus`: Confirm the docs teach the outcome-led operator path first, still preserve the full domain model as reference material, and use labels consistent with the accepted IA.
- `open_risks`: Docs can drift as UI labels continue to settle; author/developer references intentionally remain precise about plugins and manifests.

## QA Verdict
- `verdict`: pass
- `evidence_quality`: Good for a documentation story: workflow-state validation passed, docs were scanned for stale primitive-first labels, typecheck passed, navigation/route tests passed, and whitespace checks passed.
- `defects`: None found.
- `state_transition`: Move to done.

## Transition History
- `2026-06-04T02:12:40Z`: `intake` -> `active`; product-intuition UI stories complete
- `2026-06-04T02:15:47Z`: `active` -> `qa`; docs alignment complete and validation passed
- `2026-06-04T02:16:11Z`: `qa` -> `done`; QA pass for intent-led docs alignment
