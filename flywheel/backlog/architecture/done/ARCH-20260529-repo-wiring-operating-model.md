---
kind: architecture
id: ARCH-20260529-repo-wiring-operating-model
status: done
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
- `status`: done
- `source`: epic
- `decision_refs`: [ADR-0006, ADR-0008, ADR-0010, ADR-0011, ADR-0017]
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
- ADR-0017 accepted for repo wiring operating model.
- `./flywheel/tools/validate_workflow_state.sh`

## Refinement Notes

Refine before repo-wiring UI work.

## Architecture Handoff
- `decision_summary`: ADR-0017 defines repo wiring as operator configuration plus task/workflow run context for now, not a first-class persisted app-state resource. The app workspace root owns state and relative config; plugin paths provide manifest-backed agents and workflow templates; target repos are local paths exposed through compose mounts, environment, plugin conventions, or run inputs.
- `implementation_guidance`: Surface workspace root, plugin paths, loaded plugin/agent status, and Docker Compose repo mount guidance in operator UI/docs. Keep agents plugin-backed and avoid console agent-authoring flows. Prompt for target repo context in create-work flows when the selected agent or template requires it. Do not add repository CRUD, clone/OAuth flows, or a repository table in this epic.
- `validation_guidance`: Browser-QA the relevant console copy and empty states against the operator model terms in ADR-0017. Verify docs mention `ATHENA_REPO_HOST_PATH`, `ATHENA_REPO_CONTAINER_PATH`, plugin search paths, and the default target repo convention. Continue running Flywheel validation after each lane move.
- `open_risks`: Operators may expect a saved repository picker; plugin authors may use inconsistent repo-path input names; local-process and container-command runtime wiring differ and need precise copy.
- `alternatives_considered`: First-class repository persistence, repository CRUD UI, remote clone/OAuth flows, and console agent authoring were considered but deferred because the current runtime can operate with configuration plus run context and the epic is about operator clarity.
- `operational_impact`: Operators will wire local repos through documented environment/configuration and provide repo context when starting work. Existing app-state ownership, plugin discovery, and runtime execution boundaries remain unchanged.
- `follow_on_work`: Refine and implement agent catalog operating guidance, repo wiring guidance surfaces, create-work entry points, and first-run-to-real-repo bridge stories against ADR-0017.

## QA Verdict
- `verdict`: Pass. ADR-0017 satisfies the acceptance criteria and matches the current config, plugin discovery, app-state ownership, Docker Compose mount variables, and bounded plugin runtime behavior.
- `evidence_quality`: Architecture QA reviewed `config.ts`, local plugin loader behavior, task workbench runtime resolution, Docker Compose local env/mounts, ADR-0010, ADR-0011, and Flywheel validation.
- `defects`: None found.
- `state_transition`: Move to done.

## Transition History
- `2026-05-29T01:30:00Z`: planning intake created for repo wiring operating model
- `2026-05-29T01:38:30Z`: `intake` -> `active`; Architecture starts repo wiring operating model
- `2026-05-29T01:40:15Z`: architecture handoff completed with ADR-0017
- `2026-05-29T01:42:12Z`: `active` -> `qa`; Architecture handoff ready for QA
- `2026-05-29T01:42:25Z`: QA passed with no defects
- `2026-05-29T01:43:03Z`: `qa` -> `done`; QA passed for repo wiring operating model
