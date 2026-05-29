---
kind: story
id: STORY-20260529-example-generic-research-agents
status: ready
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
- `status`: ready
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

## Transition History
- `2026-05-29T03:08:43Z`: PM refinement created ready engineering story
