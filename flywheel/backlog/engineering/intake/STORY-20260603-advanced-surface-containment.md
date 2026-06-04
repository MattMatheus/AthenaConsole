---
kind: story
id: STORY-20260603-advanced-surface-containment
status: intake
owner_role: frontend-engineer
source: planning
success_metric: Low-level primitives remain accessible but no longer dominate the primary operator path.
release_scope: deferred
ready: false
---

# Story: Advanced Surface Containment

## Metadata
- `id`: STORY-20260603-advanced-surface-containment
- `owner_role`: frontend-engineer
- `status`: intake
- `source`: planning
- `decision_refs`: [ARCH-20260603-product-intuition-ia]
- `success_metric`: Low-level primitives remain accessible but no longer dominate the primary operator path.
- `release_scope`: deferred

## Problem Statement
- Agents, workflows, missions, run templates, policies, audit, and diagnostics all need to exist, but they should not all compete as primary next actions for a new operator.

## Scope
- In:
  - Update navigation grouping based on the IA decision.
  - Preserve routes and deep links where practical.
  - Keep author/admin/diagnostic surfaces findable under advanced or configure sections.
- Out:
  - Removing data models or API routes.
  - Changing backend authorization semantics.

## Assumptions
- Navigation changes can be made without breaking route compatibility.

## Acceptance Criteria
1. Primary navigation emphasizes Start Work, Work History, Capabilities, Resources, and Review or the accepted equivalents.
2. Low-level implementation surfaces are grouped under advanced/configuration.
3. Existing direct URLs still resolve or redirect intentionally.

## Validation
- Required checks:
  - Console typecheck.
  - Route model tests.
- Additional checks:
  - Manual browser smoke for primary and advanced nav.

## Dependencies
- `ARCH-20260603-product-intuition-ia`.

## Risks
- Existing users may need clear route labels to find advanced functionality.

## Open Questions
- Which surfaces should remain visible for agent authors by default?

## Next Step
- Refine after IA decision.

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
