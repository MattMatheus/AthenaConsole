# Plan 019: Reconcile stale epic 2026.42 status

> **Executor instructions**: Follow this plan step by step. Run every verification
> command and confirm the expected result before moving on. If anything in "STOP
> conditions" occurs, stop and report — do not improvise. When done, update the
> status row for this plan in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 182e9ba..HEAD -- docs/product/epics/active/2026.42.00-epic-product-intuition-and-start-work-flow.md docs/product/direction/current-direction.md`

## Why this matters

`docs/product/epics/active/2026.42.00-epic-product-intuition-and-start-work-flow.md`
is marked **"Active refinement"**, but all five of its engineering stories are in
`flywheel/backlog/engineering/done/` and the implementations exist in the console
(StartWork flow, capability-led work creation, guided preflight, advanced-surface
containment, intent-led docs). A doc that says "in flight" for work that has shipped
is worse than missing — it misdirects anyone (human or agent) deciding what to build
next. This plan reconciles the status with reality.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW (docs only)
- **Depends on**: none
- **Category**: docs
- **Planned at**: commit `182e9ba`, 2026-06-13

## Current state

- `docs/product/epics/active/2026.42.00-epic-product-intuition-and-start-work-flow.md`
  — its `## Status` section reads `Active refinement.`
- The five stories are in `flywheel/backlog/engineering/done/`:
  `STORY-20260603-start-work-entry-point.md`,
  `STORY-20260603-capability-led-work-creation.md`,
  `STORY-20260603-guided-work-preflight.md`,
  `STORY-20260603-advanced-surface-containment.md`,
  `STORY-20260603-intent-led-docs-alignment.md`.
- `docs/product/direction/current-direction.md` references the epic at the active
  path (around line 297): `docs/product/epics/active/2026.42.00-...`.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Find all references to the epic | `grep -rn "2026.42.00-epic-product-intuition-and-start-work-flow" docs` | the set of referencing files |
| Doc-link check | `npm run check:docs` | exit 0 |

## Scope

**In scope**:
- `docs/product/epics/active/2026.42.00-epic-product-intuition-and-start-work-flow.md` (status; or move to `completed/`)
- Any doc that links the epic path (found via grep) — update links if the file is moved
- `docs/product/direction/current-direction.md` (update the epic's listed status/location if needed)

**Out of scope** (do NOT touch):
- The flywheel backlog files (the stories are already in `done/`).
- Any code.
- Epic 2026.43 — it remains intentionally deferred; do not change its status.

## Git workflow

- Branch: `advisor/019-reconcile-epic-2026-42-status`
- One commit; message e.g. `docs: reconcile epic 2026.42 status with shipped state`.
- Do NOT push or open a PR unless instructed.

## Steps

### Step 1: Find every reference

```
grep -rn "2026.42.00-epic-product-intuition-and-start-work-flow" docs
```

Record the files that link the epic (at minimum `current-direction.md`).

### Step 2: Choose and apply the reconciliation

Pick the option that matches the repo's epic convention (the completed-epics directory
was retired in the 2026 docs consolidation — completed arc summaries now live in
`docs/product/roadmap/flight-path.md`):

- **Option A (preferred if all work is truly done): mark as complete.** Update the
  file's `## Status` to `Complete.` (matching the convention used when the epic was
  active), and update EVERY reference found in Step 1 to the current location.
- **Option B (if genuine refinement remains): keep active, fix the status.** Replace
  `Active refinement.` with an accurate status that states the five engineering
  stories have shipped and names what refinement actually remains. Only use this if
  you can point to concrete unfinished work; otherwise use Option A.

If unsure which, default to Option A (all five stories are in `done/` and the
features exist).

### Step 3: Verify links

**Verify**: `npm run check:docs` → exit 0 (no broken links after any move/relink).

## Test plan

- Verification is `npm run check:docs` passing and a manual read confirming the
  status now matches reality.

## Done criteria

ALL must hold:

- [ ] The epic's status no longer says "Active refinement" while its work is shipped (moved to `completed/` with `Complete.`, or an accurate active status per Option B)
- [ ] All references found in Step 1 resolve to the correct path
- [ ] `npm run check:docs` exits 0
- [ ] No code or flywheel files modified (`git status` shows only docs)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report if:

- `grep` reveals references in unexpected places (e.g. code or flywheel metadata) that a move would break in non-obvious ways.
- There is genuine, documented remaining refinement that makes "Complete" wrong — then use Option B and report what remains.

## Maintenance notes

- Keep epic status in sync with the flywheel lane state going forward; when all of an
  epic's stories reach `done/`, move the epic to `completed/`.
- Reviewer should confirm `current-direction.md` reflects the corrected location/status.
