---
kind: story
id: STORY-20260529-agent-catalog-operating-guidance
status: done
owner_role: Software Engineer
source: epic
success_metric: Operators understand that agents are installed through local plugins and manifests, not authored directly in the console.
release_scope: follow-up
ready: true
---

# Story: Agent Catalog Operating Guidance

## Metadata
- `id`: STORY-20260529-agent-catalog-operating-guidance
- `owner_role`: Software Engineer
- `status`: done
- `source`: epic
- `decision_refs`: [ADR-0007, ADR-0008, ADR-0017]
- `epic`: docs/product/epics/refinement/2026.25.00-epic-operator-workflow-clarity-repo-wiring.md
- `success_metric`: Operators understand that agents are installed through local plugins and manifests, not authored directly in the console.
- `release_scope`: follow-up

## Problem Statement

The agent catalog is accurate but not self-explanatory. Operators can see agents and plugins, but may not understand where agents come from, how to add more, or why there is no direct create-agent button.

## Initial Scope

- In: catalog copy, plugin/source status explanation, empty/error states, links to repo/plugin wiring guidance, agent detail next actions.
- Out: new backend APIs, plugin marketplace, console-native agent authoring.

## Acceptance Criteria

1. The Agents page explains that agents are installed from local plugin manifests and are not authored in the console.
2. The Agents page shows where to add more agents: configure plugin search paths, add plugin packages locally, and refresh/reindex the catalog.
3. Empty, loading, error, no-match, and invalid-plugin states explain the operator's next step without implying marketplace, clone, or create-agent behavior.
4. Agent detail pages explain plugin provenance and guide operators toward starting a task or workflow with the existing agent.
5. Copy aligns with ADR-0017 terminology for workspace, plugin path, agent, target repo, and run context.
6. Browser QA covers `/agents` and at least one agent detail route at desktop and mobile widths.

## Validation

- `npm --workspace apps/console run typecheck`
- `npm --workspace apps/console run lint`
- Browser QA for `/agents` and at least one agent detail/empty state path.
- `./flywheel/tools/validate_workflow_state.sh`

## Refinement Notes

PM refinement completed. Implement as UI copy and affordance changes only; do not add backend APIs, repository persistence, plugin marketplace behavior, or console-native agent authoring. Coordinate wording with ADR-0017 and keep the story focused on making the existing catalog operationally understandable.

Suggested implementation notes:

- Add an operator guidance band on `/agents` that states agents come from local plugin packages discovered through configured plugin paths.
- Improve the empty state to mention adding plugin packages to configured search paths and refreshing the catalog.
- Improve plugin validation messaging to tell operators to fix plugin manifests/source files on disk.
- Add agent-detail next actions for creating a task and checking workflow templates, with copy that says the selected agent is provided by its plugin.
- Avoid any "create agent", "install from marketplace", or "connect repository" CTAs in this story.

## Engineering Handoff
- `change_summary`: Added operator guidance to the Agents catalog explaining local plugin paths, manifest-backed agents, and run context; improved catalog error/empty/no-match and plugin validation next-step copy; added agent-detail next actions to start a task or open workflow templates; tightened responsive wrapping for the new guidance surfaces.
- `validation_evidence`: `npm --workspace apps/console run typecheck`; `npm --workspace apps/console run lint`; `git diff --check`; browser QA for `/agents` and `/agents/first-run.demo.local?version=0.1.0` at desktop width; mobile-width Chrome CDP QA at 390px confirmed no horizontal overflow on catalog or detail.
- `qa_focus`: Verify the catalog and detail pages make it clear that agents come from local plugin manifests and do not imply console-native agent creation. Check desktop and mobile layout for clipped guidance text or overlapping action links.
- `open_risks`: The story intentionally does not expose actual plugin path settings or repo wiring controls; follow-up stories should add repo-wiring guidance and create-work entry-point improvements.

## QA Verdict
- `verdict`: Pass. Agent catalog and detail copy now explain plugin-backed agents, local manifest provenance, and next actions without introducing create-agent or marketplace behavior.
- `evidence_quality`: Strong. Typecheck, lint, diff whitespace checks, in-app browser desktop QA, and 390px mobile CDP QA covered `/agents` and `/agents/first-run.demo.local?version=0.1.0`.
- `defects`: None open. Mobile QA initially found horizontal clipping in the new guidance band; responsive wrapping was fixed and rechecked with no horizontal overflow.
- `state_transition`: Move to done.

## Transition History
- `2026-05-29T01:30:00Z`: planning intake created for agent catalog operating guidance
- `2026-05-29T01:47:44Z`: PM refinement completed; ready for engineering
- `2026-05-29T01:48:00Z`: `intake` -> `active`; PM refined; engineering starts agent catalog operating guidance
- `2026-05-29T01:56:09Z`: engineering completed; ready for QA
- `2026-05-29T01:57:07Z`: QA passed with no open defects
- `2026-05-29T01:57:04Z`: `active` -> `qa`; Engineering handoff ready for QA
- `2026-05-29T01:57:39Z`: `qa` -> `done`; QA passed for agent catalog operating guidance
