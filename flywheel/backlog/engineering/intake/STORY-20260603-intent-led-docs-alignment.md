---
kind: story
id: STORY-20260603-intent-led-docs-alignment
status: intake
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
- `status`: intake
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
- Product IA and UI changes will settle before final docs wording.

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
- `ARCH-20260603-product-intuition-ia`.
- Implementation stories for Start Work and navigation.

## Risks
- Docs can drift if rewritten before UI labels settle.

## Open Questions
- Should the user guide split operator and author tracks more aggressively?

## Next Step
- Refine after initial UI implementation.

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
