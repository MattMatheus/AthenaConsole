---
kind: story
id: STORY-20260529-example-generic-research-agents
status: done
owner_role: Software Engineer
source: epic
success_metric: Developers have examples for generic agents such as article summarization and shopping/research planning.
release_scope: next
ready: true
---

# Story: Example Generic Research Agents

## Metadata
- `id`: STORY-20260529-example-generic-research-agents
- `owner_role`: Software Engineer
- `status`: done
- `source`: epic
- `decision_refs`: [ADR-0007, ADR-0008, ADR-0018]
- `epic`: docs/product/epics/refinement/2026.28.00-epic-agent-sdk-and-examples.md
- `success_metric`: Developers have examples for generic agents such as article summarization and shopping/research planning.
- `release_scope`: next

## Problem Statement

Operators want to build agents for personal knowledge and research tasks, not only code repositories.

## Initial Scope

- In: article summarizer example, shopping/research planning example, manifests, fixtures, docs, safe read-only behavior.
- Out: purchasing, form submission, browser automation, scraping credentials, unattended network-write actions.

## Acceptance Criteria

1. Article summarizer example accepts text or document/article input and emits a summary artifact.
2. Shopping/research planner example accepts objective, constraints, and preferences and emits a research plan/artifact.
3. Examples clearly mark external web access and purchasing as out of scope unless future permissions approve it.
4. Examples use SDK helpers and manifest-compatible input definitions.
5. Docs show how these examples generalize to custom agents.

## Validation

- SDK/example tests.
- `npm --workspace @athena/core run validate:manifests`
- Docs command smoke where practical.
- `git diff --check`
- `./flywheel/tools/validate_workflow_state.sh`

## Refinement Notes

Keep these examples safe and generic; they teach extension patterns more than product automation depth.

## Engineering Handoff

- `completed_at`: 2026-05-29T20:34:49Z
- `change_summary`: Added a checked-in `generic-research` sample plugin with PDK-backed local article summarizer and shopping/research planner agents, manifest-compatible input schemas, deterministic markdown artifact outputs, safety-boundary docs, and an API integration test.
- `files_changed`:
  - `sample-plugins/generic-research/plugin.yaml`
  - `sample-plugins/generic-research/agents/article-summarizer.agent.yaml`
  - `sample-plugins/generic-research/agents/article-summarizer-runner.mjs`
  - `sample-plugins/generic-research/agents/shopping-research-planner.agent.yaml`
  - `sample-plugins/generic-research/agents/shopping-research-planner-runner.mjs`
  - `sample-plugins/generic-research/schemas/article-input.schema.json`
  - `sample-plugins/generic-research/schemas/shopping-plan-input.schema.json`
  - `sample-plugins/generic-research/docs/README.md`
  - `packages/core/tests/control-plane.generic-research-sample.test.ts`
- `validation_evidence`: Manifest validation, PDK build, and focused sample-plugin API smoke passed.
  - `npm --workspace @athena/pdk run build`
  - `npm --workspace @athena/core run validate:manifests`
  - `npm --workspace @athena/core exec vitest run tests/control-plane.generic-research-sample.test.ts`
- `qa_focus`: Confirm both sample agents index through the plugin catalog, run without configured model providers, accept the refined input shapes, emit markdown artifact metadata, and keep external web access, purchasing, credentialed browsing, form submission, and network-write behavior out of scope.
- `open_risks`: The sample artifact content remains represented as structured run output plus memory-backed artifact metadata; persistent artifact-file materialization remains runtime/platform scope.

## QA Verdict

- `verdict`: pass
- `qa_timestamp`: 2026-05-29T20:35:32Z
- `evidence_quality`: Fresh QA covered PDK tests, core typecheck, manifest validation, deterministic API run smoke for both sample agents, article text input, article file input, markdown artifact metadata, and whitespace validation.
- `acceptance_coverage`:
  - AC1: `research.article.summarizer.local` accepts pasted `text` or `article.path` local file input and emits an article summary markdown artifact.
  - AC2: `research.shopping.planner.local` accepts objective, constraints, preferences, and decision deadline inputs and emits a research plan markdown artifact.
  - AC3: Plugin docs, manifests, output boundaries, and artifact metadata keep external web access, purchasing, credentialed browsing, form submission, and unattended network-write actions out of scope.
  - AC4: Both runners use `@athena/pdk` helpers and manifests reference compatible structured input definitions.
  - AC5: `sample-plugins/generic-research/docs/README.md` explains how the examples generalize to custom agents and includes validation commands.
- `validation_evidence`: `npm --workspace @athena/pdk run test`; `npm --workspace @athena/core run typecheck`; `npm --workspace @athena/core run validate:manifests`; `npm --workspace @athena/core exec vitest run tests/control-plane.generic-research-sample.test.ts`; `git diff --check`.
- `defects`: None found.
- `state_transition`: Move to `done`.

## Transition History
- `2026-05-29T03:08:43Z`: PM refinement created ready engineering story
- `2026-05-29T20:30:16Z`: `ready` -> `active`; Engineering starts example generic research agents
- `2026-05-29T20:34:49Z`: `active` -> `qa`; Engineering handoff for generic research example agents
- `2026-05-29T20:35:32Z`: `qa` -> `done`; QA passed for generic research example agents
