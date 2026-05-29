---
kind: story
id: STORY-20260529-fresh-server-real-work-walkthrough
status: ready
owner_role: Software Engineer
source: epic
success_metric: A fresh local server can be brought up, configured, and used for one useful repo run by following documented steps.
release_scope: next
ready: true
---

# Story: Fresh Server Real-Work Walkthrough

## Metadata
- `id`: STORY-20260529-fresh-server-real-work-walkthrough
- `owner_role`: Software Engineer
- `status`: ready
- `source`: epic
- `decision_refs`: [ADR-0018]
- `epic`: docs/product/epics/refinement/2026.30.00-epic-local-server-deployment-readiness.md
- `success_metric`: A fresh local server can be brought up, configured, and used for one useful repo run by following documented steps.
- `release_scope`: next

## Problem Statement

The arc needs an end-to-end proof that the product can do real work on a durable local server.

## Initial Scope

- In: docs walkthrough from fresh server checkout to compose up, provider setup, repo connection, example agent load, useful run, artifact inspection, backup/restore notes.
- Out: public internet deployment, team auth, cloud provisioning.

## Acceptance Criteria

1. Walkthrough starts from a clean local-server target and names prerequisites.
2. Walkthrough configures persistent volumes and secrets safely.
3. Walkthrough connects a repo and provider or documented mock alternative.
4. Walkthrough runs a useful example agent and inspects artifacts.
5. Walkthrough includes basic stop/backup/restore notes.

## Validation

- Docs command/path smoke.
- Compose smoke if feasible in local environment.
- Browser QA for referenced console paths if changed.
- `git diff --check`
- `./flywheel/tools/validate_workflow_state.sh`

## Refinement Notes

This should be last in the arc, once the product can prove the loop honestly.

## Transition History
- `2026-05-29T03:08:43Z`: PM refinement created ready engineering story
