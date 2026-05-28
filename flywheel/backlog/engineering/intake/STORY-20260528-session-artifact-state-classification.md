---
kind: story
id: STORY-20260528-session-artifact-state-classification
status: intake
owner_role: Software Engineer
source: epic
success_metric: Session, transcript, evidence, and artifact file state has explicit ownership and retention classification.
release_scope: follow-up
ready: false
---

# Story: Classify Session, Transcript, And Artifact State

## Metadata
- `id`: STORY-20260528-session-artifact-state-classification
- `owner_role`: Software Engineer
- `status`: intake
- `source`: epic
- `decision_refs`: [ADR-0010, ADR-0012]
- `epic`: docs/product/epics/refinement/2026.22.00-epic-state-ownership-and-sqlite-migration.md
- `success_metric`: Session, transcript, evidence, and artifact file state has explicit ownership and retention classification.
- `release_scope`: follow-up

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

PM refinement should decide whether this story is docs-only or includes a small automated ownership-map check.

## Engineering Handoff
- `change_summary`:
- `validation_evidence`:
- `qa_focus`:
- `open_risks`:

## QA Verdict
- `verdict`:
- `evidence_quality`:
- `defects`:
- `state_transition`:
