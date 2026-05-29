---
kind: story
id: STORY-20260529-repo-connection-console
status: done
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
- `status`: done
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

## Engineering Handoff

- `change_summary`: Reworked Resource Controls into a connected repository console surface with managed-clone and existing-path forms, connected repository query/mutation hooks, summary status tiles, selectable repository rows, branch/commit/dirty/path metadata, inspect actions, and updated local-only/private-auth boundary copy. Dashboard and navigation discovery continue to point operators into Resource Controls.
- `validation_evidence`: `npm --workspace apps/console run typecheck`; `npm --workspace apps/console run lint`; `git diff --check`; `./flywheel/tools/validate_workflow_state.sh`; local API/console smoke with `curl http://127.0.0.1:5173/api/v1/repositories`; headless Firefox screenshots at 1440px and 390px saved to `/tmp/athena-console-repo-resources-desktop.png`, `/tmp/athena-console-repo-resources-mobile.png`, `/tmp/athena-console-repo-resources-desktop-record.png`, and `/tmp/athena-console-repo-resources-mobile-record.png`.
- `qa_focus`: Verify the Resource Controls page exposes clone-by-URL and existing-path creation, shows connected repo status/branch/commit/dirty/path context, supports selecting and inspecting a repo, explains the local-only/private-auth boundary, and remains usable at desktop and mobile widths.
- `open_risks`: Headless Firefox screenshot capture occurs before React Query leaves the initial loading state, so API proxy behavior was separately confirmed with `curl`. Browser automation tooling with post-query waits was unavailable in this environment.

## QA Verdict

- `verdict`: pass
- `qa_timestamp`: 2026-05-29T03:43:52Z
- `evidence_quality`: moderate
- `validation_evidence`: `npm --workspace apps/console run typecheck`; `npm --workspace apps/console run lint`; `git diff --check`; `./flywheel/tools/validate_workflow_state.sh`; local API/console smoke with `curl http://127.0.0.1:5173/api/v1/repositories`; headless Firefox desktop/mobile screenshots for the Resource Controls page.
- `defects`: none
- `state_transition`: move to done
- `notes`: UI validates at compile/lint level and renders responsively in desktop/mobile screenshots without visible horizontal overflow. The API proxy and repository create/read flow were confirmed with direct HTTP smoke because the available headless screenshot command captured the React Query loading state before settled data.

## Transition History
- `2026-05-29T03:08:43Z`: PM refinement created ready engineering story
- `2026-05-29T03:36:16Z`: `ready` -> `active`; Engineering starts repo connection console
- `2026-05-29T03:42:51Z`: Engineering implementation completed; ready for QA.
- `2026-05-29T03:43:23Z`: `active` -> `qa`; Engineering handoff ready for QA
- `2026-05-29T03:43:52Z`: QA passed; ready for done.
- `2026-05-29T03:44:14Z`: `qa` -> `done`; QA passed for repo connection console
