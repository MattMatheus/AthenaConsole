# Plan 030: Build the comprehensive Enterprise & Multiplayer User Manual (consolidate the two user-doc trees)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Read first (the contract)**: `docs/conventions.md` (plan 028) — audience
> tags, enterprise-first positioning, voice, and the **preview-banner standard**
> you will reuse verbatim. This plan assumes that file exists.
>
> **Drift check (run first)**:
> `git diff --stat 9acdfd6..HEAD -- docs/user-guide/ packages/core/docs/user/ packages/core/docs/getting-started/ packages/core/src/api/routes/`
> If any in-scope source changed since this plan was written, compare the
> "Current state" excerpts against the live files; on a material mismatch, STOP.

## Status

- **Priority**: P1
- **Effort**: L
- **Risk**: MED (consolidates and deletes a parallel doc tree; must not over-claim unbuilt multiplayer)
- **Depends on**: plan 028 (IA stubs + conventions). Soft-after plan 029 (shared positioning) but can run in parallel.
- **Category**: docs
- **Planned at**: commit `9acdfd6`, 2026-06-15

## Why this matters

There is **no single user manual**. User docs are split across two trees that overlap and disagree: a 22KB monolith at `docs/user-guide/README.md` (now a stub after plan 028) and a numbered set under `packages/core/docs/user/` (`00-quickstart` … `10-copy-sample-agent`). Neither covers the **enterprise/multiplayer** story the product is now pushing — workspaces, members, roles/RBAC, multi-user deployment, cost governance — and what little exists would, if written naively, **over-claim isolation that the code does not enforce**. This plan produces one coherent, multi-page **Enterprise & Multiplayer User Manual** under `docs/user-guide/`, mined from both old trees, written enterprise-first, with preview banners on every unbuilt-isolation surface, and then **deletes the superseded user pages** so there is exactly one manual.

## Current state

**Old monolith** `docs/user-guide/README.md` — reduced to an index stub by plan 028; the **original 22KB content remains in git at `9acdfd6`** and is the primary source to mine. Its section set (from the pre-stub version) was: Who This Is For · What It Does · Operator Surfaces · Start With An Outcome · Product Model Reference (Plugins/Agents/Tasks/Missions/Workflow Templates/Runs/Events/Artifacts/Providers/Repositories/Safety Controls) · Start Locally · Run The First-Run Demo · Use The Console · Run The Product Smoke · Move From Demo To Real Repo Work · Configure A Model Provider · Create A Plugin-Backed Agent · Understand Agent Manifests · Inspect Results · Troubleshooting · Glossary · Where To Go Next. **Mine this** — it is accurate for single-operator flows.

To recover the original for mining: `git show 9acdfd6:docs/user-guide/README.md`.

**Parallel set** `packages/core/docs/user/`:
`00-quickstart.md`, `01-introduction.md`, `02-installation.md`, `03-basic-usage.md`, `05-advanced-usage.md`, `08-console-ui.md`, `09-symbolic-navigation.md` are **user-manual material** (mine + relocate here). NOTE: `04-api-server.md`, `06-api-examples.md`, `07-pdk-guide.md`, **and `10-copy-sample-agent.md`** are **SDK/agent-authoring material owned by plans 031/032 — do NOT consume or delete them in this plan.**

**The multiplayer reality (drives every preview banner)** — confirm with these greps:
- `grep -n "x-athena-scope-workspaces" packages/core/src/api/middleware/auth.ts` → scope is read from a request header (client-asserted; not a tenancy boundary).
- `grep -rn "workspace_members" packages/core/src` → **no matches** (no membership model).
- Workspace CRUD + Admin RBAC **is** built: `packages/core/src/control-plane/services/workspaces.ts` (`LocalWorkspaceService`) and `AuthorizedWorkspaceService` in `packages/core/src/control-plane/services/authorization.ts`, exposed at `GET/POST /api/v1/workspaces`, `GET/PUT/DELETE /api/v1/workspaces/:id`.
So: **workspace management is real; cross-workspace isolation is not.** Story map: epic `docs/product/epics/active/2026.44.00-epic-workspace-lifecycle-and-scoped-rbac.md` — `.01` done (CRUD), `.02`–`.04` (membership, server-derived scope, FKs) unbuilt. Cost governance enforcement: epic `2026.45` — `costBudgetDailyUsd` is parsed/stored but **never enforced** (`packages/core/src/shared/contracts/policy.ts:70`); banner it.

**Deployment modes that exist** (for the install/deploy page) — from repo root: `docker-compose.local.yml`, `docker-compose.server.yml`, `docker-compose.prod.yml`, `dev.sh`; trusted-server install guide `docs/developer/product-dev-guides/local-server-deployment.md`; proxy auth `docs/developer/product-dev-guides/trusted-proxy-auth.md`. These are real; cite them.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Drift check | `git diff --stat 9acdfd6..HEAD -- docs/user-guide/ packages/core/docs/user/` | empty or understood |
| Recover old manual | `git show 9acdfd6:docs/user-guide/README.md` | prints the 22KB source to mine |
| Verify multiplayer reality | `grep -rn "workspace_members" packages/core/src` | no matches (banner premise holds) |
| Find inbound links before deleting | `grep -rn "core/docs/user/<file>" --include='*.md' .` | repoint every linker |
| Doc-link gate | `npm run check:docs` | "No broken links." |

## Scope

**In scope** (create the manual pages; delete only the user-manual source files you consolidated):

- **Create** under `docs/user-guide/`:
  - `README.md` — manual landing/index (replaces the 028 stub) with the page list + audience + one preview banner pointer.
  - `01-overview.md` — what the product is (enterprise-first), the work model (plugins, agents, capabilities, tasks, missions, workflow templates, runs, events, artifacts, memory, approvals).
  - `02-install-and-deploy.md` — deployment modes: local evaluation (`dev.sh`/`docker-compose.local.yml`) → trusted server (`docker-compose.server.yml`, link `local-server-deployment.md`, `trusted-proxy-auth.md`) → notes toward multi-user. **Preview banner** on the multi-user note.
  - `03-workspaces-and-multiplayer.md` — workspaces, members, roles, multi-user model. **Preview banner at the top** (isolation not enforced). Document what IS real (workspace CRUD + Admin RBAC, the `/api/v1/workspaces` surface) separately from the **target** (membership, server-derived scope, confinement) which is banner-flagged.
  - `04-roles-and-rbac.md` — the RBAC model and roles (derive from `packages/core/src/control-plane/services/authorization.ts` — `requiredRoles`, e.g. `Admin`; enumerate the roles actually present). Banner per-workspace-scoped RBAC where it is target-not-enforced.
  - `05-running-work.md` — tasks, missions, workflow templates, runs, schedules; the Start-With-An-Outcome flow; first-run demo + smoke (mine the old monolith).
  - `06-providers-memory-repos.md` — model providers & secrets setup, durable memory, repository connection (mine monolith "Configure A Model Provider", "Move From Demo To Real Repo Work").
  - `07-cost-governance.md` — budgets/usage/quotas concepts. **Preview banner**: `costBudgetDailyUsd` is configurable but **not enforced** today (epic 2026.45).
  - `08-operations-and-admin.md` — health/readiness, events, artifacts, evidence, approvals/limits, backup/restore (link `backup-restore-smoke.md`), workflow-queue recovery.
  - `09-troubleshooting.md` — mine the monolith's Troubleshooting section (API won't start, console can't reach API, readiness degraded, agent missing, provider blocked, workflow template missing, run fails, artifact preview fails).
  - `10-glossary.md` — mine the monolith Glossary; align terms to `docs/conventions.md` voice.
- **Delete** (consolidated into the above; repoint inbound links first):
  - `packages/core/docs/user/00-quickstart.md`, `01-introduction.md`, `02-installation.md`, `03-basic-usage.md`, `05-advanced-usage.md`, `08-console-ui.md`, `09-symbolic-navigation.md`
  - `packages/core/docs/getting-started/README.md` (superseded by `02-install-and-deploy.md`)
  - `packages/core/docs/README.md` **only if** it solely indexes the deleted user pages; if it also indexes `04/06/07` (SDK pages owned by 031/032), **leave it** and let plan 032 finish it — STOP-check this.

**Out of scope** (do NOT touch):

- `packages/core/docs/user/04-api-server.md`, `06-api-examples.md`, `07-pdk-guide.md`, `packages/pdk/README.md` — owned by plans 031/032.
- Entry/narrative docs (plan 029), ADRs/dev-guides (plan 033), `docs/conventions.md`/`docs/README.md` (plan 028).
- Any code file. Do not change product behavior; the manual describes what exists.
- **Do not** describe multi-user isolation, cross-workspace confinement, server-derived scope, membership enforcement, or per-user budget enforcement as working today. Banner them.

## Git workflow

- Branch: `advisor/030-enterprise-multiplayer-user-manual`
- Commit page-by-page; a final commit for the consolidation deletions + link repoints.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Read conventions + recover sources

Read `docs/conventions.md`. Recover the old manual: `git show 9acdfd6:docs/user-guide/README.md > /tmp/old-manual.md` (read it). Read the `packages/core/docs/user/*` user pages in scope. Run the three "multiplayer reality" greps and confirm the banner premise (no `workspace_members`; header-based scope).

**Verify**: you can list which old sections map to which new page, and confirm `grep -rn "workspace_members" packages/core/src` returns nothing.

### Step 2: Write the manual landing + overview (`README.md`, `01-overview.md`)

Enterprise-first. The landing lists the 10 pages with one-line descriptions and links; carries `<!-- AUDIENCE: Operator -->` (with an Admin/Enterprise note). `01-overview.md` describes the work model in the product vocabulary.

**Verify**: `npm run check:docs` after `git add docs/user-guide` → links resolve.

### Step 3: Write the enterprise/multiplayer pages (02, 03, 04, 07)

These are the pages that must be honest about maturity. For **each**, place the preview banner from `docs/conventions.md` at the top of any section describing unenforced isolation/enforcement, and keep a clearly separated "Available today" subsection for what IS built (workspace CRUD, Admin RBAC, the `/api/v1/workspaces` endpoints, configurable budgets). Cross-link the SDK guide's API reference (`../sdk/api/README.md`) for the endpoint details rather than duplicating them.

**Verify**: `grep -l "Preview — not yet enforced" docs/user-guide/03-workspaces-and-multiplayer.md docs/user-guide/07-cost-governance.md` lists both files.

### Step 4: Write the work / operations pages (05, 06, 08, 09, 10)

Mine the old monolith heavily (these flows are real and validated). Keep the first-run demo and product smoke instructions; update paths/links to the new IA. The troubleshooting and glossary pages port the monolith's content, re-voiced.

**Verify**: `npm run check:docs` passes (stage first).

### Step 5: Consolidate — delete the superseded user pages

For each delete-set path: `grep -rn "<path or filename>" --include='*.md' .` and repoint inbound **tracked** links to the new manual pages. Then `git rm` the file. Handle the `packages/core/docs/README.md` STOP-check (Step delete-set): if it indexes SDK pages 04/06/07, leave it.

**Verify**:
- `test ! -e packages/core/docs/user/00-quickstart.md` (and the rest of the delete set) → exit 0.
- `packages/core/docs/user/04-api-server.md`, `06-api-examples.md`, `07-pdk-guide.md` still exist (owned by 031/032).
- `git add -A && npm run check:docs` → "No broken links."

### Step 6: Final gate

**Verify**: `npm run check:docs` → "No broken links."; `git status` shows only in-scope paths; the SDK-owned files are untouched.

## Test plan

- `npm run check:docs` passes with all new pages staged.
- `docs/user-guide/` contains the 10 pages + landing; each has an `AUDIENCE` tag.
- `03-workspaces-and-multiplayer.md` and `07-cost-governance.md` each contain the preview-banner string.
- `grep -rn "workspace_members\|server-derived" docs/user-guide/` shows these described only under banners / as "target", never as shipped.
- The consolidated `packages/core/docs/user/{00,01,02,03,05,08,09,10}` files are gone; `04/06/07` remain.
- No remaining tracked link points at a deleted page.

## Done criteria

ALL must hold:

- [ ] `docs/user-guide/` has `README.md` + `01`–`10` pages, enterprise-first, each audience-tagged.
- [ ] Every unenforced-isolation / unenforced-budget section carries the `docs/conventions.md` preview banner; an "Available today" subsection separates what is built.
- [ ] `packages/core/docs/user/{00,01,02,03,05,08,09,10}.md` and `packages/core/docs/getting-started/README.md` are deleted (`git rm`); `04/06/07` are untouched.
- [ ] No tracked `.md` links to a deleted user page (links repointed to `docs/user-guide/*`).
- [ ] `npm run check:docs` → "No broken links." with changes staged.
- [ ] `git status` shows only in-scope files; no code changed.
- [ ] `plans/README.md` status row updated.

## STOP conditions

Stop and report back (do not improvise) if:

- `docs/conventions.md` is missing (plan 028 has not run).
- `grep -rn "workspace_members" packages/core/src` **returns matches** — membership may now be implemented; the banner premise is wrong for that surface. Re-check which 2026.44 stories are built before writing, and report.
- `packages/core/docs/README.md` indexes SDK pages 04/06/07 and you cannot delete the user-page index without orphaning them — leave it and report (plan 032 finishes it).
- A page would require duplicating the HTTP API reference to be useful — instead link to `docs/sdk/api/README.md` (created by plan 032); if neither it nor its stub exists, link to `docs/sdk/README.md` or STOP.

## Maintenance notes

- When epic 2026.44 stories .02–.04 land, remove the preview banners on pages 02/03/04 (grep `"Preview — not yet enforced"` under `docs/user-guide/`). When 2026.45 enforcement lands, update page 07 similarly.
- The manual deliberately links to (not duplicates) the API reference (plan 032) and SDK guide (plan 031); a reviewer should check the cross-links resolve and nothing is duplicated.
- Original monolith content lives in git at `9acdfd6`; if a section was dropped rather than ported, note it in the PR so the owner can decide.
