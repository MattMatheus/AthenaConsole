---
kind: story
id: STORY-20260529-repo-wiring-guidance-surface
status: done
owner_role: Software Engineer
source: epic
success_metric: Operators can find clear guidance for wiring Team Orchestrator to a local repository.
release_scope: follow-up
ready: true
---

# Story: Repo Wiring Guidance Surface

## Metadata
- `id`: STORY-20260529-repo-wiring-guidance-surface
- `owner_role`: Software Engineer
- `status`: done
- `source`: epic
- `decision_refs`: [ADR-0008, ADR-0011, ADR-0017]
- `epic`: docs/product/epics/refinement/2026.25.00-epic-operator-workflow-clarity-repo-wiring.md
- `success_metric`: Operators can find clear guidance for wiring Team Orchestrator to a local repository.
- `release_scope`: follow-up

## Problem Statement

Operators need to know how to add a repo and wire local work into Team Orchestrator. Today that path is implicit in config, sample plugins, and runtime behavior rather than explained as a product workflow.

## Initial Scope

- In: console guidance surface, links from dashboard/Resource Controls/task or agent pages, docs alignment, validation commands, local config pointers.
- Out: remote repo clone, persistent workspace registry unless architecture explicitly chooses it, Git provider auth.

## Acceptance Criteria

1. Resource Controls includes a repo wiring guidance surface that explains workspace root, plugin paths, target repo, and run context using ADR-0017 terminology.
2. Guidance explains the current Docker Compose bridge: `ATHENA_REPO_HOST_PATH`, `ATHENA_REPO_CONTAINER_PATH`, and the default `/workspace/target-repo` convention.
3. Guidance explains how plugin directories and repo paths relate without implying repository CRUD, remote clone, Git provider auth, or console-native agent authoring.
4. Guidance includes validation steps for plugin manifests/catalog refresh and a first real task or workflow run.
5. Operators can reach the guidance from Dashboard and Agents without disrupting the primary create-work path.
6. Browser QA covers Resource Controls and the new entry links at desktop and mobile widths.

## Validation

- `npm --workspace apps/console run typecheck`
- `npm --workspace apps/console run lint`
- Docs link/path smoke checks if README or getting-started docs change.
- Browser QA for affected routes.
- `./flywheel/tools/validate_workflow_state.sh`

## Refinement Notes

PM refinement completed after ADR-0017. Implement this as a console guidance surface and navigation/copy update only; do not add new backend APIs or persisted repository state.

Suggested implementation notes:

- Build the primary guidance on `/resources`, because Resource Controls already represents shared execution resources and is currently underused.
- Add concise entry links from Dashboard next actions and the Agents operating-model band.
- Include a short ordered checklist: choose local repo path, mount/configure it, confirm plugin paths, refresh catalog, start a task/workflow with repo context.
- Use current environment/config names exactly where useful: `ATHENA_REPO_HOST_PATH`, `ATHENA_REPO_CONTAINER_PATH`, `ATHENA_PLUGIN_PATHS`, `ATHENA_SYSTEM_PLUGIN_PATHS`.
- Keep the copy honest that target repo details are supplied through configuration or run inputs today, not saved as repository records.

## Engineering Handoff
- `change_summary`: Built a repo wiring guidance surface on Resource Controls, covering workspace, plugin path, target repo, run context, Docker Compose repo mount variables, plugin path variables, and a first real repo run checklist. Added entry links from Dashboard next actions and the Agents operating-model band.
- `validation_evidence`: `npm --workspace apps/console run typecheck`; `npm --workspace apps/console run lint`; `git diff --check`; `./flywheel/tools/validate_workflow_state.sh`; browser QA for `/resources`, Dashboard entry link, and Agents entry link; 390px Chrome CDP QA confirmed `/resources` and Dashboard have no horizontal overflow.
- `qa_focus`: Verify Resource Controls does not imply saved repository records, remote clone, Git provider auth, marketplace installation, or console-native agent authoring. Check that the Docker Compose variable names and `/workspace/target-repo` convention are visible and readable at desktop and mobile widths.
- `open_risks`: The guidance is static and cannot verify the operator's actual environment values yet. Follow-up create-work stories still need to prompt for repo context where agent or workflow inputs require it.

## QA Verdict
- `verdict`: Pass. Resource Controls now gives operators a clear repo wiring model and checklist while preserving the current no-persisted-repo boundary.
- `evidence_quality`: Strong. Typecheck, lint, diff whitespace, Flywheel validation, in-app browser desktop QA, entry-link QA, and 390px Chrome CDP responsive QA all passed.
- `defects`: None found.
- `state_transition`: Move to done.

## Transition History
- `2026-05-29T01:30:00Z`: planning intake created for repo wiring guidance surface
- `2026-05-29T01:59:45Z`: PM refinement completed; ready for engineering
- `2026-05-29T02:06:17Z`: engineering completed; ready for QA
- `2026-05-29T02:06:43Z`: `active` -> `qa`; Engineering handoff ready for QA
- `2026-05-29T02:06:43Z`: QA passed with no defects
- `2026-05-29T02:00:04Z`: `intake` -> `active`; PM refined; engineering starts repo wiring guidance surface
- `2026-05-29T02:06:32Z`: `active` -> `qa`; Engineering handoff ready for QA
- `2026-05-29T02:07:18Z`: `qa` -> `done`; QA passed for repo wiring guidance surface
