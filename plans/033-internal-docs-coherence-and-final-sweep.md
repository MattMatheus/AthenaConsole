# Plan 033: Reconcile internal/architecture docs and run the repo-wide coherence sweep

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Read first (the contract)**: `docs/conventions.md` (plan 028).
>
> **Drift check (run first)**:
> `git diff --stat 9acdfd6..HEAD -- docs/product/architecture/ docs/developer/ docs/product/research/ docs/product/pilot/ docs/product/release/`
> If material changes landed, reconcile against the live files; on a mismatch, STOP.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW-MED (touches many small docs; mostly status/link reconciliation, no content invention)
- **Depends on**: plans 028, 029, 030, 031, 032 (run this **last** — it closes cross-links after the content plans land)
- **Category**: docs
- **Planned at**: commit `9acdfd6`, 2026-06-15

## Why this matters

After the entry docs (029), manual (030), and SDK guide (031/032) land and plan 028 removes the dead docs, the **internal** layer — ADR statuses, dev guides, research/pilot/release notes, and the index files — still reflects the old structure and the pre-promotion ADR statuses. This plan makes the whole tree internally consistent: it reconciles ADR statuses to current reality, consolidates/redirects the developer guides that the SDK guide now supersedes, sweeps stray docs, fixes the `2026.32` collision fallout, and runs the **repo-wide** `check:docs` to prove zero broken links across everything. It is the coherence backstop for the push.

## Current state

**ADR statuses to reconcile** (`docs/product/architecture/decisions/`):
- `0028-workspace-lifecycle-and-scoped-rbac.md` — status `Proposed.`; it has since been **promoted to active epic 2026.44** and **story 2026.44.01 is implemented**. Update its status to reflect promotion (e.g. `Accepted — implementation tracked in epic 2026.44`), per how the other Accepted ADRs are phrased. Confirm phrasing by reading an already-Accepted ADR (e.g. `0027-enterprise-multi-user-direction.md`).
- `0029-cost-governance-budgets-and-alerts.md` — status `Proposed.`; promoted to epic **2026.45**. Update similarly (note: enforcement still pending — keep that honest).
- `0030-agent-certification-and-eval-runner.md` — confirm it is referenced from `decisions/README.md` and `current-direction.md` (plan 029 added the latter).
- `decisions/README.md` — ensure the index lists 0027–0030 with correct one-line statuses and no links to deleted files.

**Developer guides** (`docs/developer/product-dev-guides/`, 18 files) — index `README.md`. After plan 031, `capability-pack-authoring.md` is folded into the SDK guide (deleted-or-redirected). Other guides overlap with the new docs and should be reconciled:
- `00-onboarding.md`, `01-architecture.md`, `02-setup.md`, `03-contributing.md`, `04-extending.md`, `05-standards.md`, `06-cli-reference.md` — contributor-facing; keep, but fix any links to moved/deleted files and any "local-first" lead framing per `docs/conventions.md`.
- `local-server-deployment.md`, `trusted-proxy-auth.md`, `deployment-automation.md`, `fresh-server-real-work-walkthrough.md`, `local-command-env-allowlist.md`, `backup-restore-smoke.md`, `workflow-queue-recovery.md`, `chroma-semantic-memory-adapter.md`, `cycle-checklist.md` — operational; keep. The user manual (plan 030) links several; ensure those targets still exist and the guides don't duplicate the manual (cross-link instead).

**Stray / oddly-placed docs**:
- `packages/core/bdr/Incorporate Kyverno and Agent Sandbox.md` — a stray note with a space in the filename, outside any doc tree. Decide: relocate to `docs/product/research/` with a clean kebab-case name, or delete if obsolete. **Read it first** to judge; do not delete blindly.
- `packages/core/features/release.md` — confirm whether it duplicates `docs/product/release/`; reconcile or leave with a note.
- `apps/console/README.md` — handled by plan 029; verify it's consistent here.

**Research / pilot / release**:
- `docs/product/research/` (active: `2026-06-02-athenamemory-adapter-evaluation.md`; `complete/` set) — research records; keep as history but ensure `research/README.md` and `research/complete/README.md` don't link deleted files.
- `docs/product/pilot/` (`athena-agent-workbench-pilot.md`, `competitive-demo-smoke-checklist.md`) — read; if superseded by the new manual, redirect/delete; if still used for go-to-market, keep with an audience tag.
- `docs/product/release/` (`2026.1.md`, `README.md`) — keep as release history; ensure links resolve.

**Collision fallout**: the two `2026.32.00` completed-epic files were deleted by plan 028. Verify nothing still links to either, and that `docs/product/roadmap/` / `epics/README.md` don't reference them.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Drift check | `git diff --stat 9acdfd6..HEAD -- docs/product/architecture/decisions/` | empty or understood |
| Find dangling refs to deleted epics | `grep -rn "epics/completed/" --include='*.md' .` | `0` matches |
| Find stale framing in guides | `grep -rni "local-first" docs/developer/` | only deployment-mode mentions |
| ADR status check | `grep -n "Status" docs/product/architecture/decisions/0028-*.md docs/product/architecture/decisions/0029-*.md` | promoted phrasing |
| Repo-wide doc-link gate | `npm run check:docs` | "No broken links." |
| Stray-file references | `grep -rn "Incorporate Kyverno" --include='*.md' .` | know who links it before moving |

## Scope

**In scope**:

- `docs/product/architecture/decisions/0028-*.md`, `0029-*.md`, `decisions/README.md` (status reconciliation only — do **not** rewrite ADR decision content; ADRs are append-only).
- `docs/developer/product-dev-guides/README.md` + the individual guides listed above (link fixes + framing alignment + `capability-pack-authoring.md` redirect cleanup left by plan 031).
- `docs/product/research/README.md`, `docs/product/research/complete/README.md` (link integrity).
- `docs/product/pilot/*`, `docs/product/release/*` (audience tags + link integrity; redirect/delete pilot docs only if clearly superseded, after reading).
- `packages/core/bdr/Incorporate Kyverno and Agent Sandbox.md` (relocate-and-rename or delete after reading).
- `packages/core/features/release.md` (reconcile or annotate).
- Any tracked `.md` with a link broken by plans 028–032 (final repo-wide repoint).

**Out of scope**:

- ADR **decision content** (only the Status line/phrasing and index entries change). Do not rewrite the rationale of any ADR.
- The content owned by 028–032 (map, conventions, manual, SDK guide, entry docs) — only fix links *into* them if broken.
- Any code file. Active epics' content (`2026.43`–`2026.47`) — leave as-is (they are current planning).
- Deleting research records or ADRs (decision #3: ADRs kept; research kept as history).

## Git workflow

- Branch: `advisor/033-internal-docs-coherence-and-final-sweep`
- Commit in clusters: (1) ADR statuses + index, (2) dev-guide reconciliation, (3) stray-doc + research/pilot/release, (4) final repo-wide link sweep.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Reconcile ADR statuses

Read `0027-...md` to copy its Accepted-status phrasing. Update `0028` and `0029` status lines to reflect promotion to epics 2026.44/2026.45 (keep cost-governance enforcement honestly "pending"). Confirm `0030` is indexed. Update `decisions/README.md` so 0027–0030 statuses are correct and no link is dead.

**Verify**: `grep -n "Status" docs/product/architecture/decisions/0028-*.md` shows promoted phrasing, not `Proposed.`; `npm run check:docs` passes (staged).

### Step 2: Reconcile the developer guides

Fix links in `product-dev-guides/README.md` and the individual guides that point to moved/deleted files (capability-pack-authoring redirect from plan 031, any `epics/completed/*`, any `packages/core/docs/user/*` now relocated). Align any "local-first" lead framing per `docs/conventions.md` (deployment-mode, not identity). Ensure operational guides cross-link the manual rather than duplicating it.

**Verify**: `grep -rn "epics/completed/\|packages/core/docs/user/" docs/developer/` → `0`; `npm run check:docs` passes.

### Step 3: Sweep stray and adjacent docs

Read `packages/core/bdr/Incorporate Kyverno and Agent Sandbox.md`; relocate to `docs/product/research/<kebab-name>.md` (preferred) or delete if obsolete — repoint any inbound link. Reconcile `packages/core/features/release.md` vs `docs/product/release/`. Verify research/pilot/release index files have no dead links; add audience tags where missing.

**Verify**: `test ! -e "packages/core/bdr/Incorporate Kyverno and Agent Sandbox.md"` (moved or deleted) → exit 0; the relocated file (if any) is staged and link-valid.

### Step 4: Final repo-wide coherence sweep

From repo root, run the gate and resolve any remaining broken link anywhere in the tree (the cumulative effect of plans 028–032). Confirm no dangling references to deleted content.

**Verify**:
- `grep -rn "epics/completed/" --include='*.md' .` → `0`.
- `grep -rn "enterprise-doc-cleanup" --include='*.md' .` → `0`.
- `git add -A && npm run check:docs` → "No broken links."

## Test plan

- `npm run check:docs` passes **repo-wide** with all changes staged.
- `grep -rn "epics/completed/\|enterprise-doc-cleanup\|2026.32.00-epic"` across `*.md` → no matches.
- ADRs 0028/0029 statuses reflect promotion; `decisions/README.md` lists 0027–0030 correctly.
- No dev guide leads with "local-first" as product identity.
- The stray Kyverno note is relocated/renamed (or deleted) with no dangling link.

## Done criteria

ALL must hold:

- [ ] ADR 0028/0029 status lines reflect promotion to epics 2026.44/2026.45 (not `Proposed.`); cost-governance enforcement still described as pending; `decisions/README.md` indexes 0027–0030 with no dead links.
- [ ] Developer guides contain no links to deleted/moved targets and no "local-first" identity lead framing; `capability-pack-authoring` redirect (from plan 031) is consistent.
- [ ] The stray `packages/core/bdr/Incorporate Kyverno and Agent Sandbox.md` is relocated+renamed under `docs/` or deleted, with inbound links repointed.
- [ ] `grep -rn "epics/completed/\|enterprise-doc-cleanup\|2026.32.00-epic" --include='*.md' .` → no matches.
- [ ] `npm run check:docs` → "No broken links." **repo-wide** with changes staged.
- [ ] `git status` shows only in-scope docs changed; no code, no ADR-content rewrites, no active-epic edits.
- [ ] `plans/README.md` status row updated.

## STOP conditions

Stop and report back (do not improvise) if:

- An ADR's current status contradicts the promotion premise (e.g. 0028 is already `Superseded`) — report and align to reality, don't force "Accepted".
- `npm run check:docs` reports broken links rooted in a file owned by plans 028–032 that has **not** landed yet — those plans must complete first (this plan depends on them). Report which plan is missing.
- The stray Kyverno note contains current, load-bearing decisions (not obsolete) — relocate, do not delete; report what it contained.
- Reconciling a dev guide would require rewriting substantial product content (beyond link/framing fixes) — that is a content plan's job; report it as a follow-up rather than expanding scope here.

## Maintenance notes

- This plan is the coherence backstop; a reviewer should run `npm run check:docs` on the merged result and skim `decisions/README.md` for status accuracy.
- ADRs remain append-only — only statuses/index entries were touched. Future ADR promotions should update both the ADR status and `decisions/README.md` in the same change.
- Completed-epic history now lives only in git; if the team wants a shipped-history digest, add one prose `docs/product/roadmap/history.md` (noted in plan 028's maintenance) rather than restoring files.
- Several operational guides remain under `docs/developer/`; a future pass could fold the deployment guides into the manual's "install & deploy" page if duplication grows.
