---
kind: story
id: STORY-20260528-operator-dashboard-polish
status: intake
owner_role: Product Manager
source: epic
success_metric: Dashboard reads as a practical Team Orchestrator operator home rather than a fleet/governance holdover.
release_scope: follow-up
ready: false
---

# Story: Operator Dashboard Polish

## Metadata
- `id`: STORY-20260528-operator-dashboard-polish
- `owner_role`: Product Manager
- `status`: intake
- `source`: epic
- `decision_refs`: [ADR-0006, ADR-0012]
- `epic`: docs/product/epics/refinement/2026.24.00-epic-console-product-surface-polish.md
- `success_metric`: Dashboard reads as a practical Team Orchestrator operator home rather than a fleet/governance holdover.
- `release_scope`: follow-up

## Problem Statement

The dashboard still uses fleet/governance framing and cost/provider widgets from earlier direction. That weakens the first impression after the new quickstart and onboarding work.

## Initial Scope

- In: dashboard lead copy, panel labels, metric labels, recent events framing, next-action layout, first-run guidance balance.
- Out: new backend dashboard endpoints unless PM refinement determines existing APIs cannot support the polish.

## Draft Acceptance Criteria

1. Dashboard copy centers local orchestration readiness, active work, recent activity, and next operator actions.
2. Fleet/governance wording is removed or reframed where it appears on the dashboard.
3. First-run guidance remains useful without dominating repeat usage.
4. Browser QA covers dashboard at desktop and mobile widths.

## Refinement Notes

PM should inspect current dashboard data sources before deciding whether this is copy/layout only or needs a small dashboard model adjustment.

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

## Transition History
- `2026-05-28T23:55:00Z`: planning intake created for operator dashboard polish
