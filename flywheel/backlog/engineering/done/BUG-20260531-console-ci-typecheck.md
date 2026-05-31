---
kind: bug
id: BUG-20260531-console-ci-typecheck
status: done
priority: P1
reported_by: user
source_story: release-readiness
impact_metric: GitHub Actions local-server validation fails at console typecheck.
ready: true
---

# Bug: Console CI Typecheck Failure

## Metadata
- `id`: BUG-20260531-console-ci-typecheck
- `priority`: P1
- `reported_by`: user
- `source_story`: release-readiness
- `status`: done
- `decision_refs`: []
- `impact_metric`: GitHub Actions local-server validation fails at console typecheck.

## Priority Definitions
- `P0`: release-blocking, data loss/corruption, or security-critical
- `P1`: major functional regression or blocked acceptance criteria
- `P2`: moderate defect with workaround
- `P3`: minor defect, polish issue, or low-impact inconsistency

## Summary

The GitHub Actions `Local Server Validation` workflow fails during `npm --workspace @athena/console run typecheck` in clean CI checkouts.

## Expected Behavior

- Console typecheck passes in a clean checkout after `npm ci`.

## Actual Behavior

- CI cannot resolve `@athena/core/control-plane/api-contracts` from the console because the workflow has not built `@athena/core`.
- CI also reports an implicit `any` parameter in `SettingsPage.tsx`.

## Reproduction Steps

1. Push to `main`.
2. Open the `Local Server Validation` GitHub Actions run.
3. Inspect the `Typecheck console` step.

## Evidence

- Failed run `26717316372` reports `TS2307: Cannot find module '@athena/core/control-plane/api-contracts'`.
- The same run reports `TS7006: Parameter 'row' implicitly has an 'any' type`.

## Constraints

- Do not require building core before console typecheck unless the workflow is intentionally changed.
- Keep the console boundary independent from core internals when the type is a small API DTO.

## Risks

- Duplicating DTO types in the console can drift if the API contract changes.

## Suggested Fix Direction

- Define the cost-settings DTO shape at the console API boundary and annotate the settings row mapping.

## Next Step

- Patch console operation types and run CI-equivalent validation locally.

## Engineering Handoff
- `change_summary`: Removed the console's type-only dependency on `@athena/core/control-plane/api-contracts` by defining the small provider cost-settings DTO at the console operations API boundary. This lets `npm --workspace @athena/console run typecheck` pass in clean CI checkouts where `@athena/core` has not been built.
- `validation_evidence`: Confirmed failing GitHub Actions run `26717590740` failed at `Typecheck console`; local `npm --workspace @athena/console run typecheck` passed after the fix; `npm --workspace @athena/core run typecheck` passed; `npm --workspace @athena/core run check:schemas` passed; `npm --workspace @athena/pdk test` passed; `npm run smoke:product -- --help` passed; `./flywheel/tools/validate_workflow_state.sh --format json` passed; `git diff --check` passed.
- `qa_focus`: Confirm that the next GitHub Actions run reaches past the console typecheck step. Compose validation was not run locally because `docker` is not installed in this environment.
- `open_risks`: The DTO is duplicated at the console boundary; future API changes must keep the parser and type in sync.

## QA Verdict
- `verdict`: accept
- `evidence_quality`: Good. The exact failing local command now passes, and the rest of the CI-equivalent steps that can run in this environment passed. Docker compose validation could not be run locally because Docker is not installed, so the pushed GitHub Actions run remains the final confirmation for that step.
- `defects`: None found.
- `state_transition`: move to done.

## Transition History
- `2026-05-31T16:10:06Z`: `active` -> `qa`; engineering handoff ready
- `2026-05-31T16:10:35Z`: `qa` -> `done`; QA accepted CI typecheck fix
