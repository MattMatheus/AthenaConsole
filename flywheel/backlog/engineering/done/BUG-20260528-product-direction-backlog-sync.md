---
kind: bug
id: BUG-20260528-product-direction-backlog-sync
status: done
priority: P2
reported_by: Code Quality Audit
source_story: docs/product/audits/2026-05-28-code-quality-audit.md#m-2-product-direction-and-flywheel-queue-docs-are-stale-after-completed-work
impact_metric: Product direction and root backlog summaries no longer point at moved or completed active/ready work.
ready: true
---

# Bug: Product Direction And Backlog Summaries Are Stale

## Metadata
- `id`: BUG-20260528-product-direction-backlog-sync
- `priority`: P2
- `reported_by`: Code Quality Audit
- `source_story`: docs/product/audits/2026-05-28-code-quality-audit.md#m-2-product-direction-and-flywheel-queue-docs-are-stale-after-completed-work
- `status`: done
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
- Add a docs consistency check for moved/non-existent active and ready references, scoped to references in current direction and root backlog summary.

## Next Step
Continue with the next active backlog item.

## Engineering Handoff
- `change_summary`: Refreshed `docs/product/direction/current-direction.md` and `AGENTS.md` for ADR 0015, completed DAG/status/stale-run work, current active priorities, and the DAG run envelope intake. Extended `validate_workflow_state.py` to catch stale active/ready/intake references in current direction and root backlog summary, and to verify the root backlog Now/Next/Later sections match Flywheel lane contents.
- `validation_evidence`: `./flywheel/tools/validate_workflow_state.sh`; `python3 flywheel/tools/lib/validate_workflow_state.py --format json`; `python3 -m py_compile flywheel/tools/lib/validate_workflow_state.py`; `./flywheel/tools/flywheel_doctor.sh`; `git diff --check`.
- `qa_focus`: Confirm direction docs no longer point to moved/completed active work, root backlog summary matches lane READMEs, and the validator fails future stale references rather than relying on manual memory.
- `open_risks`: Root backlog summary is still manually maintained, but validation now fails when it drifts from lane contents.

## QA Verdict
- `verdict`: Pass.
- `evidence_quality`: Direction and root backlog references were reviewed in the post-QA lane state. Workflow validation now passes and includes checks for stale current-direction/root-backlog active, ready, and intake references plus root backlog Now/Next/Later lane synchronization.
- `defects`: None found.
- `state_transition`: Ready for engineering done.

## Transition History
- `2026-05-28T16:23:39Z`: `intake` -> `active` by `Codex`; PM refined and queued for engineering
- `2026-05-28T17:13:20Z`: `active` -> `qa` by `Codex`; Engineering handoff complete
- `2026-05-28T17:13:45Z`: `qa` -> `done` by `Codex`; QA passed
