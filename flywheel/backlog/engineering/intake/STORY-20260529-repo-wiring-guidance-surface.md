---
kind: story
id: STORY-20260529-repo-wiring-guidance-surface
status: intake
owner_role: Software Engineer
source: epic
success_metric: Operators can find clear guidance for wiring Team Orchestrator to a local repository.
release_scope: follow-up
ready: false
---

# Story: Repo Wiring Guidance Surface

## Metadata
- `id`: STORY-20260529-repo-wiring-guidance-surface
- `owner_role`: Software Engineer
- `status`: intake
- `source`: epic
- `decision_refs`: [ADR-0008, ADR-0011]
- `epic`: docs/product/epics/refinement/2026.25.00-epic-operator-workflow-clarity-repo-wiring.md
- `success_metric`: Operators can find clear guidance for wiring Team Orchestrator to a local repository.
- `release_scope`: follow-up

## Problem Statement

Operators need to know how to add a repo and wire local work into Team Orchestrator. Today that path is implicit in config, sample plugins, and runtime behavior rather than explained as a product workflow.

## Initial Scope

- In: console guidance surface, links from dashboard/Resource Controls/task or agent pages, docs alignment, validation commands, local config pointers.
- Out: remote repo clone, persistent workspace registry unless architecture explicitly chooses it, Git provider auth.

## Draft Acceptance Criteria

1. Console explains how to point Team Orchestrator at a local repository using current configuration/runtime expectations.
2. Guidance explains how plugin directories and repo paths relate.
3. Guidance includes validation steps for manifests and first real task/workflow run.
4. Operators can reach the guidance from natural first-run and repeat-use locations.
5. Browser QA covers the guidance at desktop and mobile widths.

## Validation

- `npm --workspace apps/console run typecheck`
- `npm --workspace apps/console run lint`
- Docs link/path smoke checks if README or getting-started docs change.
- Browser QA for affected routes.
- `./flywheel/tools/validate_workflow_state.sh`

## Refinement Notes

Refine after `ARCH-20260529-repo-wiring-operating-model`.

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
- `2026-05-29T01:30:00Z`: planning intake created for repo wiring guidance surface
