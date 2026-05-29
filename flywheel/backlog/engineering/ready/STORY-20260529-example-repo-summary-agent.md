---
kind: story
id: STORY-20260529-example-repo-summary-agent
status: ready
owner_role: Software Engineer
source: epic
success_metric: Operators can run a useful read-only repo summarizer agent against a connected repository.
release_scope: next
ready: true
---

# Story: Example Repo Summary Agent

## Metadata
- `id`: STORY-20260529-example-repo-summary-agent
- `owner_role`: Software Engineer
- `status`: ready
- `source`: epic
- `decision_refs`: [ADR-0007, ADR-0008, ADR-0018]
- `epic`: docs/product/epics/refinement/2026.28.00-epic-agent-sdk-and-examples.md
- `success_metric`: Operators can run a useful read-only repo summarizer agent against a connected repository.
- `release_scope`: next

## Problem Statement

The product needs a non-demo agent that proves connected repo context can produce useful output.

## Initial Scope

- In: example plugin using SDK, repo summary agent manifest, read-only repo inspection, markdown summary artifact, tests/fixtures, docs.
- Out: file edits, model-required behavior unless provider readiness is already available, remote push.

## Acceptance Criteria

1. Example plugin provides a repo summarizer agent that accepts structured `inputs.repo`.
2. Agent inspects repo files read-only and emits a markdown summary artifact.
3. Agent runs with mock/local deterministic behavior when no real provider is configured.
4. Plugin manifests validate and appear in the agent catalog.
5. Docs explain how to run it against a connected repo.

## Validation

- `npm --workspace @athena/core run validate:manifests`
- Example plugin tests or smoke command.
- Core/console smoke if catalog indexing changes.
- Browser QA showing agent appears in catalog.
- `./flywheel/tools/validate_workflow_state.sh`

## Refinement Notes

This is the first “actually does something” proof. Keep it read-only and dependable.

## Transition History
- `2026-05-29T03:08:43Z`: PM refinement created ready engineering story
