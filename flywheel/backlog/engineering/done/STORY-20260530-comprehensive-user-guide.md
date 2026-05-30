---
kind: story
id: STORY-20260530-comprehensive-user-guide
status: done
owner_role: Technical Writer
source: planning
success_metric: A motivated new user can learn, run, inspect, troubleshoot, and extend Team Orchestrator from documentation without reading source code.
release_scope: required
ready: false
---

# Story: Comprehensive User Guide

## Metadata
- `id`: STORY-20260530-comprehensive-user-guide
- `owner_role`: Technical Writer
- `status`: done
- `source`: planning
- `decision_refs`: [0006, 0007, 0008, 0009, 0010, 0011, 0012, 0013, 0014, 0015, 0016]
- `success_metric`: A motivated new user can learn, run, inspect, troubleshoot, and extend Team Orchestrator from documentation without reading source code.
- `release_scope`: required

## Problem Statement

The docs are now more accurate and findable, but the main user-facing path is still too compressed. A new operator can follow commands, but they do not get enough explanation of the system model, why each step matters, how concepts relate, what good output looks like, or how to recover when something fails.

## Scope
- In: comprehensive user-guide structure, narrative concept explanations, operator workflows, agent-author workflow, examples, troubleshooting, glossary, and entry-point links from `README.md`, `GETTING_STARTED.md`, and `docs/README.md`.
- Out: new product capabilities, hosted/cloud deployment expansion, marketing site, rewriting internal architecture history.

## Desired Guide Shape
- Start with a plain-language explanation of what Team Orchestrator is and when to use it.
- Explain the mental model: plugins provide agents and workflow templates; tasks and missions express work; runs execute work; events and artifacts make results inspectable; providers, repositories, and safety controls bound execution.
- Teach by example:
  - run the first-run demo,
  - inspect workflow run status and task-run artifacts,
  - connect or select a real repository,
  - configure a provider,
  - run a model-backed agent,
  - scaffold a plugin-backed agent,
  - validate and load that agent,
  - use the product readiness smoke command.
- Include troubleshooting for startup, readiness, provider, plugin, repo, workflow, artifact, and permission failures.
- Include a glossary and "where to go next" paths for operators, admins, contributors, and agent authors.

## Acceptance Criteria
1. A new comprehensive user-guide entry point exists and is linked from the root README, `GETTING_STARTED.md`, and docs map.
2. The guide includes detailed concept explanations for the core product model and avoids assuming codebase knowledge.
3. The guide includes concrete examples with commands, API snippets, expected outputs, and console paths for the first-run and real-work loops.
4. The guide includes an agent-author path that covers scaffolding, manifest concepts, validation, loading, running, and artifact output.
5. The guide includes troubleshooting and glossary sections for common user confusion.
6. Existing quickstart docs remain concise and point users to the comprehensive guide for deeper learning.
7. Link/path review and command/API example review pass.

## Validation
- `./flywheel/tools/validate_workflow_state.sh --format json`
- `git diff --check`
- Manual docs link/path review for `README.md`, `GETTING_STARTED.md`, `docs/README.md`, and the new guide.
- Manual command/API example review against current scripts, routes, and product-readiness smoke path.

## Risks
- The guide may become another index unless it explains concepts directly.
- Examples may drift if they are not tied to current smoke-tested flows.
- Too much internal architecture language could obscure the user path.

## Open Questions
- Should the comprehensive guide be a single first version or a folder with chapters from the start?
- Should screenshots be added in the first pass, or should the first story focus on text and runnable examples?
- Should user testing run before or immediately after the first guide pass?

## PM Refinement
- `what_changed`: Refined this into a first comprehensive guide implementation slice: create `docs/user-guide/README.md` as the durable user-facing learning path, link it from top-level entry points, and keep the existing quickstart concise.
- `why_it_matters`: The product is now capable enough for outside learning, but the docs still ask users to infer too much from terse commands and internal maps. The first guide should explain the system model, teach the main workflows, and make common failures recoverable.
- `acceptance_criteria`: The guide covers product purpose, core concepts, local startup, first-run demo, real repo work, provider-backed work, agent authoring/scaffolding, run/artifact inspection, product smoke, troubleshooting, glossary, and next paths; root README, `GETTING_STARTED.md`, and `docs/README.md` link to it; examples are reviewed against current commands/routes.
- `risks_and_assumptions`: Keep screenshots out of the first pass so the guide remains durable and can ship quickly; reuse smoke-tested commands where possible; do not implement product behavior as part of docs.
- `next_state_recommendation`: Move to engineering active.

## Engineering Handoff
- `change_summary`: Added `docs/user-guide/README.md` as a comprehensive user-facing learning path. The guide explains the product model, local startup, first-run demo, console surfaces, product smoke, real repo work, provider configuration, agent scaffolding, manifest basics, result inspection, troubleshooting, glossary, and next paths. Linked it from the root README, `GETTING_STARTED.md`, and docs map, and synchronized Flywheel/current direction with the active docs work.
- `validation_evidence`: `./flywheel/tools/validate_workflow_state.sh --format json`; `git diff --check`; local markdown link/path check across `README.md`, `GETTING_STARTED.md`, `docs/README.md`, and `docs/user-guide/README.md`; command/API reference review against existing smoke, workflow-template, task-run, scaffold, provider, and manifest-validation docs.
- `qa_focus`: Confirm the guide teaches rather than merely indexes, entry-point links are prominent, examples match current supported commands/routes, troubleshooting covers common setup failures, and the quickstart remains concise.
- `open_risks`: Screenshots and a multi-page chapter split remain future improvements; this first pass is text and runnable examples only.

## QA Verdict
- `verdict`: Pass.
- `evidence_quality`: Required checks passed in QA: `./flywheel/tools/validate_workflow_state.sh --format json`, `git diff --check`, local markdown link/path check for touched entry docs and the guide, guide content review against acceptance criteria, and command/API reference review against current docs and package scripts.
- `defects`: None found.
- `state_transition`: Ready for engineering done.

## Next Step
- PM refinement should choose the guide structure and split strategy, then activate the first docs implementation slice.

## Transition History
- `2026-05-30T23:13:28Z`: `intake` -> `active`; PM refined comprehensive user guide
- `2026-05-30T23:16:21Z`: `active` -> `qa`; comprehensive user guide handoff ready
- `2026-05-30T23:16:56Z`: `qa` -> `done`; QA passed comprehensive user guide
