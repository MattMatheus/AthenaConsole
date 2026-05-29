---
kind: story
id: STORY-20260529-agent-catalog-operating-guidance
status: intake
owner_role: Software Engineer
source: epic
success_metric: Operators understand that agents are installed through local plugins and manifests, not authored directly in the console.
release_scope: follow-up
ready: false
---

# Story: Agent Catalog Operating Guidance

## Metadata
- `id`: STORY-20260529-agent-catalog-operating-guidance
- `owner_role`: Software Engineer
- `status`: intake
- `source`: epic
- `decision_refs`: [ADR-0007, ADR-0008]
- `epic`: docs/product/epics/refinement/2026.25.00-epic-operator-workflow-clarity-repo-wiring.md
- `success_metric`: Operators understand that agents are installed through local plugins and manifests, not authored directly in the console.
- `release_scope`: follow-up

## Problem Statement

The agent catalog is accurate but not self-explanatory. Operators can see agents and plugins, but may not understand where agents come from, how to add more, or why there is no direct create-agent button.

## Initial Scope

- In: catalog copy, plugin/source status explanation, empty/error states, links to repo/plugin wiring guidance, agent detail next actions.
- Out: new backend APIs, plugin marketplace, console-native agent authoring.

## Draft Acceptance Criteria

1. Agents page explains local plugins/manifests as the source of agents.
2. Empty and invalid-plugin states explain how to add or fix agents.
3. Agent detail pages guide operators toward creating tasks or workflows with existing agents.
4. Copy does not imply direct console authoring of agents.
5. Browser QA covers Agents and Agent Detail at desktop and mobile widths.

## Validation

- `npm --workspace apps/console run typecheck`
- `npm --workspace apps/console run lint`
- Browser QA for `/agents` and at least one agent detail/empty state path.
- `./flywheel/tools/validate_workflow_state.sh`

## Refinement Notes

Can proceed after PM refinement; coordinate wording with repo wiring operating model.

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
- `2026-05-29T01:30:00Z`: planning intake created for agent catalog operating guidance
