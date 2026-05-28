---
kind: bug
id: BUG-20260528-product-direction-backlog-sync
status: intake
priority: P2
reported_by: Code Quality Audit
source_story: docs/product/audits/2026-05-28-code-quality-audit.md#m-2-product-direction-and-flywheel-queue-docs-are-stale-after-completed-work
impact_metric: Product direction and root backlog summaries no longer point at moved or completed active/ready work.
ready: false
---

# Bug: Product Direction And Backlog Summaries Are Stale

## Metadata
- `id`: BUG-20260528-product-direction-backlog-sync
- `priority`: P2
- `reported_by`: Code Quality Audit
- `source_story`: docs/product/audits/2026-05-28-code-quality-audit.md#m-2-product-direction-and-flywheel-queue-docs-are-stale-after-completed-work
- `status`: intake
- `decision_refs`: []
- `impact_metric`: Product direction and root backlog summaries no longer point at moved or completed active/ready work.

## Priority Definitions
- `P0`: release-blocking, data loss/corruption, or security-critical
- `P1`: major functional regression or blocked acceptance criteria
- `P2`: moderate defect with workaround
- `P3`: minor defect, polish issue, or low-impact inconsistency

## Summary
Product direction and the root Flywheel backlog summary still reference active/ready/intake work that has since moved to done, which makes PM planning less trustworthy.

## Expected Behavior
- Direction docs reflect completed 2026.17 workflow DAG stories and current empty engineering queues.
- Root backlog summary is generated or manually synced from lane READMEs.
- A consistency check catches references to non-existent or moved active/ready items.

## Actual Behavior
- `docs/product/direction/current-direction.md` points at a completed active story.
- `flywheel/backlog/README.md` lists old active, ready, and intake items.

## Reproduction Steps
1. Compare `docs/product/direction/current-direction.md` to `flywheel/backlog/engineering/done/README.md`.
2. Compare `flywheel/backlog/README.md` to the current lane READMEs.

## Evidence
- Audit finding M-2 in `docs/product/audits/2026-05-28-code-quality-audit.md`.

## Constraints
- Keep Flywheel lane state as the source of operational truth.
- Avoid reintroducing old planning paths that the repo guide says are obsolete.

## Risks
- Stale docs can send future agents toward completed work or non-existent queue files.

## Suggested Fix Direction
- Refresh current direction and root backlog summary.
- Add a docs consistency check for moved/non-existent active and ready references.

## Next Step
PM refinement should decide whether this is a quick docs bug or a tooling story for consistency checks.

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
