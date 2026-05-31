---
kind: story
id: STORY-20260531-release-readiness-cleanup
status: done
owner_role: SRE
source: direct
success_metric: Release 2026.1 has a documented scope, readiness checklist, validation path, and post-release capability direction.
release_scope: required
ready: true
---

# Story: Release Readiness Cleanup

## Metadata
- `id`: STORY-20260531-release-readiness-cleanup
- `owner_role`: SRE
- `status`: done
- `source`: direct
- `decision_refs`: []
- `success_metric`: Release 2026.1 has a documented scope, readiness checklist, validation path, and post-release capability direction.
- `release_scope`: required

## Problem Statement

Team Orchestrator has completed the core product proving loop and first-real-work confidence work, but the repo does not yet have a current release-readiness artifact that names the first date-based release, defines the validation gate, and separates release cleanup from future feature work.

## Scope

- In: release label guidance, release readiness checklist, release notes draft, validation commands, known non-blockers, and next-arc direction toward built-in capabilities.
- Out: new runtime features, new built-in agents, package publishing automation, hosted/cloud release process, and production support policy.

## Assumptions

- The first release label should use the date-based product train `2026.1`.
- Internal package and sample plugin versions can remain `0.1.0` until there is a package publishing decision.
- Release readiness can be documented before cutting a Git tag.

## Acceptance Criteria

1. A current release readiness document exists for `2026.1`.
2. The docs map and README point readers to the release readiness artifact.
3. The artifact records required checks, manual smoke expectations, known non-blockers, and release-tag guidance.
4. The next product direction explicitly pauses net-new product features in favor of built-in agents and pre-built task capabilities.

## Validation

- Required checks: `./flywheel/tools/validate_workflow_state.sh --format json`, `git diff --check`.
- Additional checks: targeted docs grep for stale release/readiness drift.

## Dependencies

- Completed first-real-work confidence track.

## Risks

- A release label can imply support maturity beyond the current local-first scope if the artifact is vague.
- Package semver and product release labels can become confusing if the distinction is not explicit.

## Open Questions

- Should the release tag be cut as `release-2026.1` or `v2026.1.0` after final validation?

## Next Step

- Add the release readiness artifact and update docs entry points.

## Engineering Handoff
- `change_summary`: Added a `2026.1` release-readiness artifact and release docs index, linked release readiness from the public docs map and README, recorded the product/package version split, selected `release-2026.1` as the recommended tag shape, documented release validation/manual smoke gates, and updated current direction/roadmap to make release readiness the active move before the next built-in capabilities arc. Also cleaned up the remaining current-facing `packages/core` package description from ProjectAthena to Team Orchestrator.
- `validation_evidence`: `./flywheel/tools/validate_workflow_state.sh --format json`; `git diff --check`; `npm run smoke:product -- --help`; `npm --workspace @athena/core run validate:manifests`; `npm --workspace @athena/core run typecheck`; `npm --workspace @athena/pdk test`; targeted `rg` for stale current-facing release/onboarding/status strings returned no matches.
- `qa_focus`: Confirm the release artifact is clear that `2026.1` is a product release label, package versions remain separate, the full product smoke/manual browser smoke are pre-tag gates, and the next arc is built-in capabilities rather than more product surface.
- `open_risks`: Live `npm run smoke:product` was not executed because the local API was not running at `127.0.0.1:8787`; it remains a documented release-tag checklist item.

## QA Verdict
- `verdict`: accept
- `evidence_quality`: Good for release-readiness cleanup. The artifact defines the `2026.1` release label, validation gate, manual smoke path, known non-blockers, and next-arc capability direction. It also explicitly records that full product smoke is pending because the local API is not running.
- `defects`: None found.
- `state_transition`: move to done.

## Transition History
- `2026-05-31T16:04:57Z`: `active` -> `qa`; engineering handoff ready
- `2026-05-31T16:05:23Z`: `qa` -> `done`; QA accepted release readiness cleanup
