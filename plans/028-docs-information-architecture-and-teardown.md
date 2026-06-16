# Plan 028: Establish the enterprise/multiplayer docs IA, conventions, preview-banner standard, and execute the teardown manifest

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**:
> `git diff --stat 9acdfd6..HEAD -- docs/ README.md GETTING_STARTED.md AGENTS.md packages/core/docs/ packages/pdk/README.md`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts below against the live files before proceeding; on
> a material mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED (deletes files and moves the canonical doc map; other plans depend on the IA this establishes)
- **Depends on**: none — **this is the foundation plan; 029–033 depend on it**
- **Category**: docs
- **Planned at**: commit `9acdfd6`, 2026-06-15

## Why this matters

The product is pushing to **enterprise + multiplayer (team) operation** as its primary direction, but the docs still lead with "local-first, enterprise-capable" and — worse — are **fragmented across two parallel doc trees**: the canonical `docs/` tree *and* a second user/SDK set under `packages/core/docs/user/` (`00-quickstart` … `10-copy-sample-agent`). There are effectively **two user manuals** and **two SDK guides** (`packages/core/docs/user/07-pdk-guide.md` vs `packages/pdk/README.md`). A reader cannot tell which is current. This plan does **not** write the new content — it establishes the single information architecture, the writing conventions (including the **preview banner** every later plan reuses for unbuilt multiplayer features), the new canonical doc map, and it **executes the teardown** (deletes confirmed-dead docs) so the content plans (029–032) write into a clean, agreed skeleton. Everything downstream cites this file.

## Background facts the executor must know (inlined — do not assume)

**Decisions already made by the product owner (do not relitigate):**

1. **Positioning**: enterprise/multiplayer is the **primary** narrative; local-first is **one documented deployment mode**, not the headline.
2. **Multiplayer maturity**: multiplayer tenancy isolation is **designed but NOT enforced in code yet**. Docs document the **target architecture** with explicit **preview banners** on the unbuilt parts (see the banner standard in Step 2). Concretely: workspace scope is still **client-asserted** — `packages/core/src/api/middleware/auth.ts:81` parses `x-athena-scope-workspaces` from a request header; there is **no** `workspace_members` table; server-derived scope and referential-integrity FKs are unbuilt. These correspond to epic `docs/product/epics/active/2026.44.00-epic-workspace-lifecycle-and-scoped-rbac.md` stories **2026.44.02–.04** (story **2026.44.01**, workspace CRUD + Admin RBAC, **is** built and committed).
3. **Removal policy**: **hard-delete** genuinely stale *narrative* docs. **Keep ADRs** (`docs/product/architecture/decisions/0006…0030`) as canonical history. **Delete the 33 completed-epic files** under `docs/product/epics/completed/` (build-log noise; git retains them). Keep `active/` epics + roadmap.
4. **SDK guide scope**: covers **both** `@athena/pdk` (the Agent Developer Kit) **and** the HTTP control-plane API.

**The product, in current product vocabulary** (from `docs/product/direction/IDENTITY.md` — match this voice): "an agent work control plane … web-first … runnable, inspectable, governable, repeatable." Use operator/platform language: *tasks, missions, runs; agents and plugins; capabilities and workflow templates; workspaces, members, roles; budgets, usage, cost, quotas; events, artifacts, logs, evidence; approvals, limits, schedules.* Avoid lore terms (pilots, hangars, swarms). The product/company name is **Team Orchestrator**; `Athena`/`AthenaConsole`/`@athena/*` are implementation history — keep package/CLI/env names as-is but do not lead with them in prose.

## Current state

**Two doc trees exist today.**

Canonical tree `docs/` (114 markdown files total in repo). Doc map `docs/README.md:1-15` currently routes "New Local Operator" first:

```markdown
<!-- AUDIENCE: Public/Internal -->
# Team Orchestrator Documentation
...
## New Local Operator
1. [Team Orchestrator User Guide](user-guide/README.md)
2. [Getting Started](../GETTING_STARTED.md)
3. [Copy The Model Provider Smoke Agent](../packages/core/docs/user/10-copy-sample-agent.md)
```

Duplicate user/SDK tree `packages/core/docs/`:

```
packages/core/docs/README.md
packages/core/docs/getting-started/README.md
packages/core/docs/user/00-quickstart.md      08-console-ui.md
packages/core/docs/user/01-introduction.md    09-symbolic-navigation.md
packages/core/docs/user/02-installation.md     10-copy-sample-agent.md
packages/core/docs/user/03-basic-usage.md
packages/core/docs/user/04-api-server.md       06-api-examples.md
packages/core/docs/user/05-advanced-usage.md   07-pdk-guide.md
```

**Confirmed-dead narrative docs (already superseded):**
`docs/product/direction/archive/2026-06-enterprise-doc-cleanup/` (6 files: `Brainstorm.md`, `MARKETING_AND_LAUNCH.md`, `MISSION_CONTROL_UX.md`, `OPERATIONAL_WORKFLOW.md`, `MANIFEST_SAMPLES.md`, `README.md`) — these are pre-reset brainstorm/marketing notes, already moved to an `archive/` directory and not linked from any current path.

**Numbering collision** (two files claim `2026.32.00`):
- `docs/product/epics/completed/2026.32.00-epic-comprehensive-user-documentation.md`
- `docs/product/epics/completed/2026.32.00-epic-useful-feature-migration-and-legacy-removal.md`
(Both are in the completed-epics delete set per decision #3, so the collision resolves by deletion — but note it so it isn't "fixed" some other way.)

**The doc-link gate** — `scripts/check-doc-links.mjs` (run via `npm run check:docs`): checks `](target)` relative links in **all tracked `*.md` files repo-wide**, and only reads **tracked** files. Implication: (a) deleting a file fails the build if any *tracked* `.md` still links to it; (b) a brand-new untracked `.md`'s own links are not checked until it is `git add`ed. Therefore: **stage new/moved files before running `check:docs`**, and **repoint every inbound link before deleting a target**.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Drift check | `git diff --stat 9acdfd6..HEAD -- docs/ packages/core/docs/` | empty or understood |
| Find inbound links to a path | `grep -rn "<relative-or-filename>" --include='*.md' .` | shows every linker to repoint |
| Find code references to a doc path | `grep -rn "<path>" --include='*.ts' --include='*.tsx' --include='*.mjs' --include='*.json' packages apps scripts` | confirm no code points at it before deleting |
| Doc-link gate | `npm run check:docs` | `Checked relative markdown links in N files. No broken links.` |
| Stage moves/deletes | `git add -A docs packages/core/docs` | exit 0 |

## Scope

**In scope** (the only files you create, move, or delete):

- **Create**: `docs/conventions.md` (voice + audience tags + the preview-banner standard).
- **Rewrite**: `docs/README.md` (the canonical doc map → enterprise/multiplayer-primary, audience-routed, pointing at the new IA skeleton).
- **Rewrite**: `docs/product/README.md` and `docs/product/epics/README.md` (retention/layout sections, to reflect deletions and the new IA).
- **Create placeholder landing files** for the new IA so links resolve (each a one-line stub with a `> Drafted in plan NNN` note — see Step 4):
  - `docs/user-guide/README.md` is **rewritten to a manual index stub** (plan 030 fills the pages).
  - `docs/sdk/README.md` (stub; plan 031/032 fill it).
- **Delete** (the teardown — see the manifest in Step 5):
  - all 6 files under `docs/product/direction/archive/2026-06-enterprise-doc-cleanup/` (and the now-empty dir).
  - all 33 files under `docs/product/epics/completed/` (and the now-empty dir), per decision #3.
- **Repoint** any tracked `.md` link that pointed at a deleted file.

**Out of scope** (do NOT touch in this plan — later plans own them):

- The *content* of the user manual pages (plan 030), SDK guide (031/032), entry/narrative docs (029), or ADR/dev-guide reconciliation (033). This plan only creates **stubs + map + conventions** and executes deletions.
- `packages/core/docs/user/*` consolidation — **plan 030/031/032 move and then delete these**; leave them in place here so their inbound links don't break before the content plans run. (Do not delete them in 028.)
- Any `packages/`, `apps/`, or `src/` **code** file. No code changes.
- ADR files (`docs/product/architecture/decisions/*`) — kept; status reconciliation is plan 033.

## Git workflow

- Branch: `advisor/028-docs-information-architecture-and-teardown`
- Commit in logical units: (1) conventions + map + stubs, (2) teardown deletions + link repoints.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Confirm the two doc trees and the delete sets still match

Run:
- `ls docs/product/direction/archive/2026-06-enterprise-doc-cleanup/` → 6 files as listed in Current state.
- `ls docs/product/epics/completed/ | wc -l` → **33**.
- `ls packages/core/docs/user/` → the 11 numbered files.

**Verify**: counts match. If the completed-epics count is materially different or the enterprise-doc-cleanup dir is gone, STOP (the tree drifted; the manifest needs re-vetting).

### Step 2: Write `docs/conventions.md`

Create `docs/conventions.md` capturing the conventions every later plan must follow. Required content:

- **Audience tags**: every doc starts with an HTML comment tag. Allowed values:
  `<!-- AUDIENCE: Operator -->` (end users running work), `<!-- AUDIENCE: Admin/Enterprise -->` (deploy/govern), `<!-- AUDIENCE: Engineer/SDK -->` (integrators/agent authors), `<!-- AUDIENCE: Internal/Technical -->` (contributors/ADRs).
- **Positioning rule**: lead with enterprise/multiplayer team operation; present local/single-operator as a **deployment mode**, not the product identity. One worked example sentence to copy.
- **Voice**: the operator/platform vocabulary list from IDENTITY (inlined above). Name concrete controls (workspace membership, RBAC, audit, approval, budget, retention, policy); avoid lore terms.
- **The PREVIEW BANNER STANDARD** (load-bearing — 030 and 032 reuse it verbatim). Define this exact block as the standard for any capability that is designed but not enforced in the current build:

  ```markdown
  > ⚠️ **Preview — not yet enforced in the current build.**
  > This describes the **target** behavior. As of this build, workspace/multi-user
  > isolation is **not enforced**: workspace scope is client-asserted
  > (`x-athena-scope-workspaces` header), there is no membership model, and
  > cross-workspace reads are not blocked at the data layer. Tracking: epic
  > 2026.44 stories .02–.04. **Do not expose a shared/multi-user deployment to
  > untrusted users until these land.**
  ```

  Document the rule: *any* doc section describing multi-user isolation, per-workspace confinement, server-derived scope, per-user cost enforcement, or referential integrity across workspaces MUST carry this banner until the corresponding epic story is DONE.
- **Naming rule**: Team Orchestrator is the product; `Athena`/`@athena/*`/`AthenaConsole` are implementation history — fine to show in code/commands, never the lead abstraction in prose.
- **Link hygiene rule**: relative links only; run `npm run check:docs` before declaring done; stage new files first.

**Verify**: `test -f docs/conventions.md && grep -q "Preview — not yet enforced" docs/conventions.md` → exit 0.

### Step 3: Rewrite `docs/README.md` as the enterprise/multiplayer-primary doc map

Replace the current "New Local Operator first" routing with audience-routed sections **in this order**, each linking to the new IA targets (created as stubs in Step 4):

1. **Operators (run work)** → `user-guide/README.md`
2. **Admins / Enterprise (deploy & govern teams)** → `user-guide/README.md` (deployment + workspaces/RBAC/cost sections), `product/security/security-critical-gap-sweep-2026-06-13.md`, the enterprise ADR `product/architecture/decisions/0027-enterprise-multi-user-direction.md`
3. **Engineers / Integrators (SDK & API)** → `sdk/README.md`
4. **Contributors** → `developer/product-dev-guides/README.md`, `product/direction/current-direction.md`, `product/architecture/decisions/README.md`, `product/roadmap/flight-path.md`
5. **Historical context** → `product/architecture/decisions/` (ADRs, canonical history). **Remove** the now-deleted links to `epics/completed/` and `enterprise-doc-cleanup/`.

Keep a `<!-- AUDIENCE: Public/Internal -->` tag. Do **not** link to any file this plan deletes. Do **not** link to `packages/core/docs/user/*` (those are superseded; plans 030–032 relocate them) — instead link to the `docs/` IA targets.

**Verify**: `grep -c "epics/completed" docs/README.md` → `0`; `grep -c "enterprise-doc-cleanup" docs/README.md` → `0`.

### Step 4: Create the IA landing stubs

So later plans have stable link targets and `check:docs` passes now. Create (or rewrite) each as a short stub that states the audience + a `> Drafted by plan NNN` note and a minimal table of contents placeholder:

- `docs/user-guide/README.md` — **rewrite** the existing 22KB monolith down to a **manual index stub** with the planned page list (overview, install & deploy, workspaces & multiplayer, roles & RBAC, running work, providers/memory/repos, cost governance, operations & admin, troubleshooting, glossary) and a note: *"Pages drafted in plan 030."* Do not lose the old content irretrievably — plan 030 will mine it; it remains in git history at `9acdfd6`. (You are intentionally reducing it to a stub here; 030 rebuilds it as multiple pages.)
- `docs/sdk/README.md` — stub landing for the SDK & Integration Guide listing two parts: "Agent Developer Kit (PDK)" → `agent-developer-kit.md` (plan 031) and "HTTP Control-Plane API Reference" → `api/README.md` (plan 032). Mark both as *"Drafted in plans 031–032."*

> STOP-CHECK before reducing `docs/user-guide/README.md` to a stub: confirm plan 030 exists in `plans/` so the content is actually scheduled to be rebuilt. If `plans/030-*.md` is absent, STOP and report — do not strand the manual as a stub with no owner.

**Verify**: `npm run check:docs` after `git add -A docs` → "No broken links." (All map links resolve to real stubs/files.)

### Step 5: Execute the teardown (deletions) with link repointing

For **each** path in the delete set below: first `grep -rn "<filename>" --include='*.md' .` and `grep -rn "<path>" --include='*.ts' --include='*.tsx' --include='*.mjs' --include='*.json' packages apps scripts`. Repoint or remove any inbound **tracked** link; if **code** references the path, STOP and report (a doc deletion must not break code).

Delete set:
- `docs/product/direction/archive/2026-06-enterprise-doc-cleanup/` (all 6 files; remove the dir).
- `docs/product/epics/completed/` (all 33 files; remove the dir). Update `docs/product/epics/README.md` ("Recently Completed Epics" + layout) and `docs/product/README.md` (retention rules / layout block) to drop the `completed/` references. The `docs/product/roadmap/flight-path.md` "Completed Product Arcs" section may summarize history in prose — that is fine to keep; only remove **links** to deleted files.

Use `git rm` so the deletions are staged.

**Verify**:
- `test ! -d docs/product/epics/completed` → exit 0.
- `test ! -d docs/product/direction/archive/2026-06-enterprise-doc-cleanup` → exit 0.
- `git add -A && npm run check:docs` → "No broken links."

### Step 6: Final gate

**Verify**: from repo root, `npm run check:docs` → "No broken links." and `git status` shows only in-scope paths changed.

## Test plan

Docs have no unit tests; verification is link integrity + structural greps:

- `npm run check:docs` passes with new files staged.
- `docs/conventions.md` exists and contains the preview-banner standard string.
- `docs/README.md` contains no links to deleted paths (`epics/completed`, `enterprise-doc-cleanup`).
- The two delete-set directories no longer exist.
- `grep -rn "epics/completed/2026" --include='*.md' docs/` returns no matches (no dangling references).

## Done criteria

ALL must hold:

- [ ] `docs/conventions.md` exists with audience tags, positioning rule, voice, and the **preview-banner standard** (`grep -q "Preview — not yet enforced" docs/conventions.md`).
- [ ] `docs/README.md` is audience-routed enterprise-first and links to `user-guide/README.md` + `sdk/README.md`; contains zero links to `epics/completed` or `enterprise-doc-cleanup`.
- [ ] `docs/user-guide/README.md` is a manual-index stub referencing plan 030; `docs/sdk/README.md` is a stub referencing plans 031–032.
- [ ] `docs/product/epics/completed/` and `docs/product/direction/archive/2026-06-enterprise-doc-cleanup/` are deleted (`git rm`), and `docs/product/epics/README.md` + `docs/product/README.md` no longer reference `completed/`.
- [ ] No `packages/core/docs/user/*` file was deleted in this plan (those are owned by 030–032).
- [ ] No code (`*.ts/tsx/mjs/json`) references any deleted doc path.
- [ ] `npm run check:docs` → "No broken links." with all changes staged.
- [ ] `git status` shows only in-scope files changed.
- [ ] `plans/README.md` status row updated.

## STOP conditions

Stop and report back (do not improvise) if:

- The completed-epics directory does not contain ~33 files, or the enterprise-doc-cleanup archive is missing (the manifest drifted — re-vet before deleting).
- A **code** file references a doc path you are about to delete (deletion would break the build).
- Reducing `docs/user-guide/README.md` to a stub would strand it because `plans/030-*.md` does not exist.
- `npm run check:docs` reports broken links you cannot resolve by repointing within the in-scope file set (an out-of-scope file links to a deleted target and you'd have to edit it — report which file).

## Maintenance notes

- This file defines the **contract** for plans 029–033: the IA skeleton, `docs/conventions.md`, and the preview-banner standard. A reviewer should confirm later plans cite these rather than reinventing structure.
- The preview banner is intentionally tied to epic 2026.44 stories .02–.04. When those land (server-derived scope, membership, FKs), a follow-up plan must **remove** the banners — grep `"Preview — not yet enforced"` across `docs/` to find them all.
- Completed-epic history now lives only in git (`9acdfd6` and earlier). If the team later wants a lightweight shipped-history summary, add a single `docs/product/roadmap/history.md` prose digest rather than restoring 33 files.
- `check:docs` only reads **tracked** files — a reviewer pulling this branch should run it *after* staging to catch the new files' internal links.
