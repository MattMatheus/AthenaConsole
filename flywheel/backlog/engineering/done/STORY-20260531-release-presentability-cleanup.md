---
kind: story
id: STORY-20260531-release-presentability-cleanup
status: done
owner_role: SRE
source: direct
success_metric: Current-facing release surfaces avoid stale branding, generated artifacts, and CI deprecation warnings.
release_scope: required
ready: true
---

# Story: Release Presentability Cleanup

## Metadata
- `id`: STORY-20260531-release-presentability-cleanup
- `owner_role`: SRE
- `status`: done
- `source`: direct
- `decision_refs`: []
- `success_metric`: Current-facing release surfaces avoid stale branding, generated artifacts, and CI deprecation warnings.
- `release_scope`: required

## Problem Statement

Before the first `2026.1` release, the repo and local development app should feel clean and presentable. A release hygiene scan found a few current-facing rough edges: CI action deprecation warnings, a tracked generated Vite config artifact, and current-facing docs/API metadata that still use older ProjectAthena phrasing.

## Scope

- In: CI action major updates, stale current-facing naming cleanup, generated artifact cleanup, docs map polish, and local ignored artifact cleanup.
- Out: product feature changes, broad legacy archive rewrites, package version changes, and historical record editing.

## Assumptions

- `actions/checkout@v6` and `actions/setup-node@v6` are the current official GitHub action major versions and use Node 24-backed action runtimes.
- Product release label remains `2026.1`; npm/package semver remains separate.
- Historical/archive references can stay as history.

## Acceptance Criteria

1. CI no longer uses Node 20-backed `actions/checkout@v4` or `actions/setup-node@v4`.
2. Current-facing ProjectAthena labels in API/package/core docs are renamed to Team Orchestrator where they are not historical compatibility context.
3. Tracked generated console artifacts are removed from version control when source files own the behavior.
4. Main docs map emphasizes current release/operator/contributor paths rather than legacy persona compatibility.
5. Local ignored `.DS_Store` and generated console build artifacts are cleaned up.

## Validation

- Required checks: `npm --workspace @athena/core run typecheck`, `npm --workspace @athena/core run check:schemas`, `npm --workspace @athena/console run typecheck`, `npm --workspace @athena/pdk test`, `npm run smoke:product -- --help`, `./flywheel/tools/validate_workflow_state.sh --format json`, `git diff --check`.
- Additional checks: targeted `rg` for current-facing stale names and tracked generated files.

## Dependencies

- CI typecheck fix is already done.

## Risks

- Action major updates can expose CI environment assumptions; confirm with GitHub Actions after push.
- Some legacy compatibility wording is intentional and should not be erased from historical docs.

## Open Questions

- None.

## Next Step

- Apply low-risk release polish and validate locally.

## Engineering Handoff
- `change_summary`: Updated local-server validation to `actions/checkout@v6` and `actions/setup-node@v6` to remove the Node 20 action-runtime warning, removed tracked generated `apps/console/vite.config.js` and ignored future generated copies, cleaned current-facing ProjectAthena labels in core API metadata/package docs, moved persona compatibility out of the main contributor docs path, refreshed older package notes to Team Orchestrator language, and removed local ignored `.DS_Store` plus console `dist/` build output.
- `validation_evidence`: `npm --workspace @athena/core run typecheck`; `npm --workspace @athena/core run check:schemas`; `npm --workspace @athena/console run typecheck`; `npm --workspace @athena/pdk test`; `npm run smoke:product -- --help`; `npm --workspace @athena/core run validate:manifests`; `npm --workspace @athena/console run build`; `./flywheel/tools/validate_workflow_state.sh --format json`; `git diff --check`; targeted `rg` found only deliberate historical notes for `ProjectAthena`; tracked generated/OS file audit returned no matches.
- `qa_focus`: Confirm CI passes with the updated official action majors, verify the generated Vite config is no longer tracked, and confirm current docs/readme surfaces no longer foreground legacy persona compatibility.
- `open_risks`: `docker compose ... config` was not run locally because Docker is unavailable in this environment; GitHub Actions must confirm it after push.

## QA Verdict
- `verdict`: accept
- `evidence_quality`: Good. Current-facing release polish is narrow, validation passed, generated file cleanup is explicit, and remaining Docker compose validation is delegated to GitHub Actions because Docker is unavailable locally.
- `defects`: None found.
- `state_transition`: move to done.

## Transition History
- `2026-05-31T16:24:28Z`: `active` -> `qa`; engineering handoff ready
- `2026-05-31T16:24:54Z`: `qa` -> `done`; QA accepted release presentability cleanup
