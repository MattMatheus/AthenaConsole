---
kind: story
id: STORY-20260528-session-artifact-state-classification
status: done
owner_role: Software Engineer
source: epic
success_metric: Session, transcript, evidence, and artifact file state has explicit ownership and retention classification.
release_scope: follow-up
ready: true
---

# Story: Classify Session, Transcript, And Artifact State

## Metadata
- `id`: STORY-20260528-session-artifact-state-classification
- `owner_role`: Software Engineer
- `status`: done
- `source`: epic
- `decision_refs`: [ADR-0010, ADR-0012]
- `epic`: docs/product/epics/refinement/2026.22.00-epic-state-ownership-and-sqlite-migration.md
- `success_metric`: Session, transcript, evidence, and artifact file state has explicit ownership and retention classification.
- `release_scope`: follow-up
- `pm_refinement`: Keep this as a bounded docs-plus-test story. Do not migrate raw payloads; add an ownership diagnostics guard so future state-store additions must be classified.

## Problem Statement

Some file-backed state is intentional artifact storage, while other file-backed state is deprecated control-plane data. Session transcripts, run evidence, and specialist artifacts need explicit classification before migration pressure reaches them.

## Scope

- In: classify session/transcript/evidence/artifact state, add docs/tests that prevent new domains from bypassing the ownership map, identify any SQLite index needs.
- Out: moving raw artifact payloads into SQLite, redesigning session transcript storage, adding retention UI.

## Acceptance Criteria

1. Session, transcript, run evidence, specialist artifact, and artifact metadata ownership is documented.
2. The story identifies whether each domain is intentional file artifact, SQLite index, deprecated file-backed state to remove, or migration candidate.
3. Docs or tests make it harder for new file-backed control-plane state to appear without classification.
4. No raw artifact payload migration is performed unless explicitly scoped later.

## Validation

- Required checks: docs consistency review; focused tests if an ownership-map check is added; `./flywheel/tools/validate_workflow_state.sh`.

## Dependencies

- Requires `ARCH-20260528-state-ownership-map`.

## Risks

- Treating artifact payloads as app-state rows could increase DB size and reduce filesystem inspectability.

## Next Step

Engineering should document retention/indexing boundaries and add a focused ownership diagnostics check that fails when file-backed domains are introduced without an explicit classification.

## Engineering Handoff
- `change_summary`: Expanded the state ownership map with explicit classification definitions, retention/indexing boundaries, and concrete session/transcript/evidence/specialist artifact ownership. Added a focused diagnostics test that asserts every current file-backed runtime payload/support domain has an explicit category and that no migration-candidate diagnostics remain after the completed SQLite migrations.
- `validation_evidence`: `npm --workspace @athena/core run typecheck` passed; `npm --workspace @athena/core run test:unit -- control-plane.state-ownership.test.ts api.server.test.ts` passed; `./flywheel/tools/validate_workflow_state.sh` passed; `git diff --check` passed. Docs consistency reviewed against `docs/product/architecture/state-ownership-map.md`, `docs/product/direction/current-direction.md`, and the state ownership epic.
- `qa_focus`: Confirm the ownership map clearly distinguishes SQLite app-state, SQLite indexes, intentional file artifacts, support files, and deprecated file-backed state; confirm the new diagnostics test would force classification updates when state-store diagnostic entries change.
- `open_risks`: The `persona-runs` root remains a legacy artifact compatibility location for specialist artifacts; cleanup is intentionally not in scope for this story.

## QA Verdict
- `verdict`: pass
- `evidence_quality`: Strong for the scoped docs-plus-test story. QA reran core typecheck, focused ownership/API tests, workflow-state validation, and whitespace checks.
- `defects`: None found.
- `state_transition`: Move to engineering done.

## Transition History
- `2026-05-28T21:18:54Z`: `intake` -> `active`; activate next state ownership classification story
- `2026-05-28T21:20:30Z`: `active` -> `qa`; engineering handoff ready for session and artifact state classification
- `2026-05-28T21:21:12Z`: `qa` -> `done`; QA passed for session and artifact state classification
