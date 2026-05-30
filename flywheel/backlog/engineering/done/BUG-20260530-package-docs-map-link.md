---
kind: bug
id: BUG-20260530-package-docs-map-link
status: done
priority: P1
reported_by: QA Engineer
source_story: STORY-20260530-docs-information-architecture
impact_metric: Package-level docs link to a missing docs map path instead of the canonical repo documentation index.
ready: true
---

# Bug: Package Docs Map Link Resolves To Missing Path

## Metadata
- `id`: BUG-20260530-package-docs-map-link
- `priority`: P1
- `reported_by`: QA Engineer
- `source_story`: STORY-20260530-docs-information-architecture
- `status`: done
- `decision_refs`: []
- `impact_metric`: Package-level docs link to a missing docs map path instead of the canonical repo documentation index.

## Priority Definitions
- `P0`: release-blocking, data loss/corruption, or security-critical
- `P1`: major functional regression or blocked acceptance criteria
- `P2`: moderate defect with workaround
- `P3`: minor defect, polish issue, or low-impact inconsistency

## Summary
The package-level docs index is meant to redirect readers to the repo-level canonical documentation map, but the relative link points at `packages/docs/README.md`, which does not exist.

## Expected Behavior
- `packages/core/docs/README.md` links to the repo-level `docs/README.md`.
- A markdown link/path review over first-stop docs passes.

## Actual Behavior
- The link text points to `../../docs/README.md`.
- From `packages/core/docs/README.md`, that resolves to `packages/docs/README.md`.

## Reproduction Steps
1. From the repo root, resolve markdown links in `packages/core/docs/README.md`.
2. Observe that `../../docs/README.md` does not resolve to the repo-level docs map.

## Evidence
- Link/path review output: `packages/core/docs/README.md` link `../../docs/README.md` resolves to `packages/docs/README.md`.

## Constraints
- Keep `docs/README.md` as the canonical documentation map.
- Keep package-level docs framed as package-adjacent references.

## Risks
- New agent authors or contributors entering through package docs can hit a missing docs-map link and lose the canonical user path.

## Suggested Fix Direction
- Change the package docs link target to `../../../docs/README.md`.
- Re-run the docs link/path review and `git diff --check`.

## Next Step
- Fix the relative link and return the source story to QA.

## Engineering Handoff
- `change_summary`: Corrected `packages/core/docs/README.md` so its repo documentation map link resolves to `docs/README.md` from the package docs directory.
- `validation_evidence`: First-stop markdown link/path review passed; `./flywheel/tools/validate_workflow_state.sh --format json` passed; `git diff --check` passed.
- `qa_focus`: Confirm the package docs map link resolves to the repo-level canonical docs map.
- `open_risks`: None for this link fix.

## QA Verdict
- `verdict`: Pass.
- `evidence_quality`: The link/path review that originally found the defect now passes over the package docs index and other current first-stop docs.
- `defects`: None remaining.
- `state_transition`: Ready for engineering done.

## Transition History
- `2026-05-30T22:17:13Z`: `intake` -> `active`; link defect accepted for immediate fix
- `2026-05-30T22:17:16Z`: `active` -> `qa`; link defect fix ready for QA
- `2026-05-30T22:17:19Z`: `qa` -> `done`; QA verified package docs map link resolves
