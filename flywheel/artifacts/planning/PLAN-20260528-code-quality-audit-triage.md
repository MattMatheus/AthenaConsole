<!-- AUDIENCE: Internal/Product -->

# Planning Note: Code Quality Audit Triage

Date: 2026-05-28

Source: `docs/product/audits/2026-05-28-code-quality-audit.md`

## Goal

Convert the code quality audit findings into Flywheel intake work before starting another feature slice.

## Scope Boundary

- In scope: triage, sequencing, and intake artifacts for security, orchestration-state, recovery, state ownership, repository scalability, documentation sync, and service decomposition findings.
- Out of scope: production code changes, dependency changes, migrations, or auth implementation during planning.

## Constraints

- Planning stage output must land in engineering or architecture intake.
- Architecture decisions must not be hidden in engineering stories.
- Security posture work should precede additional feature expansion.
- Existing audit document is treated as source material and left unchanged.

## Assumptions

- The production-like Docker stack is not safe to recommend until server-side API auth posture is explicit.
- The workflow DAG state, mission/task runs, and legacy file workflow paths need a canonical ownership decision before broad feature expansion.
- Existing `npm audit` findings outside the recent `glob@10.5.0` fix remain separate follow-up work unless tied to these audit stories.

## Triage

1. `BUG-20260528-production-compose-auth-posture`
   - Priority: P0
   - Finding: CR-1
   - Why first: unauthenticated externally bound control APIs are the highest operational risk.

2. `ARCH-20260528-canonical-orchestration-state-model`
   - Finding: H-1 and H-3
   - Why second: the workflow DAG, mission/task, schedule, run, and file-state split needs a canonical model before more orchestration features.

3. `STORY-20260528-stale-run-recovery`
   - Finding: H-2
   - Why next: stale `running` task/mission records will damage operator trust and scheduling behavior after process death.

4. `STORY-20260528-app-state-list-query-bounds`
   - Finding: M-1
   - Why next: table-wide list/filter behavior will become a console scaling cliff.

5. `BUG-20260528-product-direction-backlog-sync`
   - Finding: M-2
   - Why next: PM flow needs product direction and backlog summaries to stop pointing at moved or completed work.

6. `ARCH-20260528-service-decomposition-plan`
   - Finding: M-3
   - Why later: large-file decomposition should be planned after the security and state-model risks are bounded.

## Risks

- Auth posture changes can break local development if modes are not explicitly documented and tested.
- Canonical orchestration-state decisions may invalidate or reorder planned workflow UI work.
- Run recovery semantics need product language for failed vs resumable vs retryable.
- Repository query changes can subtly affect existing list ordering and filtering behavior.

## Success Signals

- Audit findings are visible in Flywheel intake with priorities and stage ownership.
- The next recommended stage is explicit.
- The root backlog and lane READMEs reflect the newly created intake queue.

## Next-Stage Recommendation

Start with PM refinement for `BUG-20260528-production-compose-auth-posture`, then engineering implementation. In parallel or immediately after, run architecture on `ARCH-20260528-canonical-orchestration-state-model` so later workflow and recovery work has a single state model to target.
