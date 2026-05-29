---
kind: story
id: STORY-20260529-repo-connection-console
status: ready
owner_role: Software Engineer
source: epic
success_metric: Operators can add, inspect, and select connected repositories from the console.
release_scope: next
ready: true
---

# Story: Repo Connection Console

## Metadata
- `id`: STORY-20260529-repo-connection-console
- `owner_role`: Software Engineer
- `status`: ready
- `source`: epic
- `decision_refs`: [ADR-0017, ADR-0018]
- `epic`: docs/product/epics/refinement/2026.26.00-epic-real-work-repo-connection.md
- `success_metric`: Operators can add, inspect, and select connected repositories from the console.
- `release_scope`: next

## Problem Statement

Repo connection should be visible as product functionality, not hidden in docs or environment variables.

## Initial Scope

- In: console page/section for connected repos, clone-by-URL form, existing-path form, repo list, health/status display, inspect/refresh action, empty states and docs links.
- Out: provider setup, run form integration, Git credentials, remote push.

## Acceptance Criteria

1. Operators can add a managed clone from a public Git URL.
2. Operators can add an existing local/server path.
3. Repo list shows status, current branch, head commit, dirty state, and path context.
4. Empty/error states explain local-only behavior and deferred private Git auth.
5. Dashboard or Resource Controls links make the repo connection flow discoverable.
6. Browser QA covers desktop and mobile widths without horizontal overflow.

## Validation

- `npm --workspace apps/console run typecheck`
- `npm --workspace apps/console run lint`
- Console tests if form model helpers are added.
- Browser QA for repo connection routes/states.
- `git diff --check`
- `./flywheel/tools/validate_workflow_state.sh`

## Refinement Notes

Reuse existing console style. Keep this operational and direct; avoid marketing-style framing.

## Transition History
- `2026-05-29T03:08:43Z`: PM refinement created ready engineering story
