---
kind: architecture
id: ARCH-20260529-repo-wiring-operating-model
status: intake
owner_role: Architect
source: epic
success_metric: Operators and implementers share a clear model for how repositories are wired into local Team Orchestrator work.
release_scope: follow-up
ready: false
---

# Architecture: Repo Wiring Operating Model

## Metadata
- `id`: ARCH-20260529-repo-wiring-operating-model
- `owner_role`: Architect
- `status`: intake
- `source`: epic
- `decision_refs`: [ADR-0006, ADR-0008, ADR-0010, ADR-0011]
- `epic`: docs/product/epics/refinement/2026.25.00-epic-operator-workflow-clarity-repo-wiring.md
- `success_metric`: Operators and implementers share a clear model for how repositories are wired into local Team Orchestrator work.
- `release_scope`: follow-up

## Problem Statement

Operators need to know how to add or connect a repository so agents can operate on real local work. The product needs a clear model for repo/workspace paths, plugin directories, runtime workspace roots, and app-state ownership before UI guidance or controls are refined.

## Initial Scope

- In: repo/workspace terminology, local config responsibilities, plugin directory relationship to repos, runtime workspace root expectations, app-state versus filesystem ownership, what console should expose now.
- Out: remote cloning, GitHub OAuth, hosted sync, plugin marketplace, agent authoring.

## Draft Acceptance Criteria

1. Defines the current repo/workspace wiring model in operator terms.
2. Clarifies whether repo path selection is configuration-only, app-state, or future workspace resource.
3. Explains how plugin directories, manifest-backed agents, and runtime workspace roots relate.
4. Identifies the smallest UI/docs path that accurately explains repo wiring today.
5. Produces clear follow-up guidance for engineering stories.

## Validation

- Architecture review against ADR-0006, ADR-0008, ADR-0010, and ADR-0011.
- `./flywheel/tools/validate_workflow_state.sh`

## Refinement Notes

Refine before repo-wiring UI work.

## Architecture Handoff
- `decision_summary`:
- `implementation_guidance`:
- `validation_guidance`:
- `open_risks`:

## QA Verdict
- `verdict`:
- `evidence_quality`:
- `defects`:
- `state_transition`:

## Transition History
- `2026-05-29T01:30:00Z`: planning intake created for repo wiring operating model
