# Plan 029: Rewrite the entry/narrative docs to enterprise/multiplayer-primary positioning

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Read first (the contract)**: `docs/conventions.md` (created by plan 028).
> It defines the audience tags, the enterprise-first positioning rule, the
> required voice, and the **preview-banner standard**. This plan assumes those
> conventions; do not invent your own.
>
> **Drift check (run first)**:
> `git diff --stat 9acdfd6..HEAD -- README.md GETTING_STARTED.md AGENTS.md packages/core/AGENTS.md apps/console/README.md docs/product/direction/ docs/product/roadmap/`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts below against the live files; on a material
> mismatch, STOP.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: LOW (prose only; no code, no deletions)
- **Depends on**: plan 028 (IA + `docs/conventions.md` must exist)
- **Category**: docs
- **Planned at**: commit `9acdfd6`, 2026-06-15

## Why this matters

The "front door" docs still position the product as **local-first, enterprise-capable** — the inverse of the decided direction (**enterprise/multiplayer primary; local = one deployment mode**). A reader landing on `README.md`, `GETTING_STARTED.md`, or `docs/product/direction/current-direction.md` gets the old framing, which makes the whole doc set feel incoherent regardless of how good the manual and SDK guide are. This plan rewrites the narrative spine so every entry point leads with team/multiplayer enterprise operation, presents the single-operator/local path as a supported deployment mode, and is honest about what multiplayer is **not yet enforcing** (preview banners). No new features are described as shipped that aren't.

## Current state

**`README.md:1-7`** (lead paragraphs — the framing to flip):

```markdown
# Team Orchestrator
Team Orchestrator is a local-first, enterprise-capable control plane for running, inspecting, and governing agent work from a web console.
...
Team Orchestrator still starts locally: the default path uses manifest-backed agents, plugins, SQLite app state, workflow templates, runtime safety policies, and a console-first operator experience. Current direction extends that baseline toward enterprise operation with workspaces, RBAC, cost governance, distributed coordination, and Postgres-ready app-state boundaries.
```

**`README.md:147`** (closing line, same inversion): *"This project is local-first by default and enterprise-capable by design."*

**`docs/product/direction/current-direction.md:1-9`**:

```markdown
<!-- AUDIENCE: Internal/Technical -->
# Current Product Direction
Team Orchestrator is a local-first, enterprise-capable agent work control plane.
...
Current main now extends that baseline toward multi-user enterprise operation.
```

It also contains an **"Active Planning Boundary"** section (`current-direction.md:89-99`) that still names *"The live plan set is `plans/021-023`"* — stale (the live set is now 028–033 plus the active epics). And a list of canonical ADRs (`:33-58`) that should reflect 0028/0029 as **promoted** and add **0030**.

**`docs/product/direction/IDENTITY.md`** — already close to the target voice ("enterprise-capable", "workspaces, members, roles"), but its Positioning paragraph still says *"local-first by default and enterprise-capable by design."* Re-weight to enterprise-primary; keep the strong vocabulary/voice section as-is (plan 028's conventions are derived from it).

**`docs/product/roadmap/flight-path.md`** headings (current):
`## Current Baseline` → `## Completed Product Arcs` → `## Current Arc: Enterprise Readiness` (with `### 2026.44`–`### 2026.47`) → `## Deferred Arc: Knowledge Work Connectors` → `## Archive Rule`. The arc content is fine; the framing intro should lead enterprise/multiplayer.

**`AGENTS.md:1-7`** and **`packages/core/AGENTS.md`** — contributor/agent guides. `AGENTS.md:7`: *"a web-first, local-first and enterprise-capable agent work control plane."* Same flip; keep the Flywheel workflow instructions intact.

**`apps/console/README.md`** — app-level readme (verify current contents during Step 1; likely a short dev note).

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Drift check | `git diff --stat 9acdfd6..HEAD -- README.md docs/product/direction/` | empty or understood |
| Doc-link gate | `npm run check:docs` | "No broken links." |
| Find stale framing | `grep -rni "local-first by default" README.md docs/ AGENTS.md packages/core/AGENTS.md` | after rewrite: 0 leading-claim matches |
| Confirm no dead plan refs | `grep -rn "plans/021-023\|021-workspace-entity" docs/product/direction/` | after rewrite: 0 |

## Scope

**In scope** (rewrite these files; no deletions, no new files):

- `README.md`
- `GETTING_STARTED.md`
- `AGENTS.md`
- `packages/core/AGENTS.md`
- `apps/console/README.md`
- `docs/product/direction/current-direction.md`
- `docs/product/direction/IDENTITY.md`
- `docs/product/direction/PERFORMANCE_MODEL.md` (light pass — align framing only)
- `docs/product/roadmap/flight-path.md`
- `docs/product/roadmap/future-horizon.md`

**Out of scope** (do NOT touch):

- The user manual (`docs/user-guide/*` — plan 030), SDK guide (`docs/sdk/*`, `packages/core/docs/user/*`, `packages/pdk/README.md` — plans 031/032), ADRs (plan 033), dev guides (plan 033).
- Any code file. Any deletion (028 owns teardown).
- `docs/conventions.md`, `docs/README.md` (028 owns them — read, don't edit).
- Factual capability claims: **do not** describe multiplayer isolation, per-workspace confinement, server-derived scope, or per-user cost enforcement as shipped. Where you mention them, apply the preview banner from `docs/conventions.md`.

## Git workflow

- Branch: `advisor/029-rewrite-entry-and-narrative-docs`
- Commit per file or small cluster (e.g. one commit for root entry docs, one for `direction/`, one for `roadmap/`).
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Read the conventions and the current files

Read `docs/conventions.md` fully. Read each in-scope file fully before editing it. Confirm the framing strings in "Current state" still exist (drift check).

**Verify**: you can state, in one sentence, the positioning rule from `docs/conventions.md`.

### Step 2: Rewrite `README.md`

Lead with enterprise/multiplayer team operation: a control plane for **teams** to run, inspect, and govern agent work, with workspaces, members, roles, cost governance, audit, and server-ready persistence; **single-operator/local is one supported deployment mode** (great for development and evaluation). Keep all the concrete, true sections (What It Does, Repository Layout, Local Development commands, Architecture At A Glance). Update:
- The lead paragraphs and the closing line `:147` to enterprise-primary.
- "Quickstart" stays (local is a valid quickstart) but is framed as "evaluate locally, then deploy for your team," pointing to the manual's deploy + workspaces pages (`docs/user-guide/README.md`).
- The "Documentation" section: point to `docs/README.md`, `docs/user-guide/README.md`, `docs/sdk/README.md`.
- Add **one** preview-banner reference (or a one-line caveat linking to it) where multiplayer is mentioned, so the README does not over-claim isolation.

**Verify**: `grep -ni "local-first" README.md` shows local-first only as a *deployment mode* mention, never the lead sentence; `npm run check:docs` passes after staging.

### Step 3: Rewrite `GETTING_STARTED.md`

Reframe as: **enterprise/team getting-started with a local evaluation path first**. Keep the working local steps (they are real and validated), but structure as (1) evaluate locally in minutes, (2) move to a trusted-server/team deployment (link the manual's install/deploy + workspaces pages). Do not duplicate the manual — link to it. Apply a preview banner if you describe multi-user.

**Verify**: links resolve (`npm run check:docs`); no claim that multi-user isolation is enforced.

### Step 4: Rewrite the direction docs

- `current-direction.md`: lead enterprise/multiplayer; keep "Product Center", "Directional Posture", "Delivered Baseline", "Current Roadmap". **Fix the stale "Active Planning Boundary"** to reference the current plan set (point to `plans/README.md` rather than naming `021-023`). Update the "Canonical Decisions" ADR list to mark **0028/0029 as promoted to active epics** and **add 0030** (agent certification). Keep `<!-- AUDIENCE: Internal/Technical -->`.
- `IDENTITY.md`: re-weight the Positioning paragraph to enterprise-primary; keep Voice/Naming sections (they are the source of `docs/conventions.md`).
- `PERFORMANCE_MODEL.md`: light pass — align any local-first framing; leave the model content.

**Verify**: `grep -rn "plans/021-023" docs/product/direction/` → 0; `current-direction.md` mentions 0030.

### Step 5: Rewrite the roadmap docs

- `flight-path.md`: keep the arc structure; rewrite the intro/baseline framing to enterprise/multiplayer-primary. Ensure links in "Completed Product Arcs" do **not** point at deleted `epics/completed/*` files (plan 028 deleted them) — convert to prose or link to `active/` epics and ADRs only.
- `future-horizon.md`: align framing; keep horizon content.

**Verify**: `grep -rn "epics/completed/" docs/product/roadmap/` → 0; `npm run check:docs` passes.

### Step 6: Rewrite the contributor agent guides

- `AGENTS.md` and `packages/core/AGENTS.md`: flip the one-line product description to enterprise/multiplayer-primary. **Keep the Flywheel workflow instructions, "Start Here" lists, and stage commands exactly** — those are operational, not positioning. Only the product-identity sentence(s) change.
- `apps/console/README.md`: align framing to match (after reading it in Step 1).

**Verify**: `grep -rni "local-first and enterprise-capable\|local-first, enterprise-capable" README.md AGENTS.md packages/core/AGENTS.md docs/product/direction/` → 0 (no remaining inverted-framing lead lines). Flywheel instructions in `AGENTS.md` still present (`grep -q "flywheel" AGENTS.md`).

### Step 7: Final gate

**Verify**: `npm run check:docs` → "No broken links." (stage first); `git status` shows only in-scope files.

## Test plan

- `npm run check:docs` passes (stage changes first).
- `grep -rni "local-first by default"` across in-scope files returns only deployment-mode mentions, never lead sentences.
- No in-scope file links to a deleted `epics/completed/*` path.
- Every in-scope file retains its audience tag (`grep -L "AUDIENCE" <files>` is empty for the `docs/` ones that had tags).
- Any multiplayer-isolation mention carries (or links to) the preview banner.

## Done criteria

ALL must hold:

- [ ] `README.md`, `GETTING_STARTED.md`, both `AGENTS.md`, `apps/console/README.md`, and the `docs/product/direction/*` + `docs/product/roadmap/*` files lead with enterprise/multiplayer; local is presented as a deployment mode.
- [ ] No in-scope file claims multiplayer isolation / server-derived scope / per-user cost enforcement is enforced today; such mentions carry the preview banner from `docs/conventions.md`.
- [ ] `current-direction.md` no longer names `plans/021-023` as the live set and references ADR 0030.
- [ ] No in-scope file links to deleted `docs/product/epics/completed/*` paths.
- [ ] `AGENTS.md` Flywheel workflow instructions are unchanged.
- [ ] `npm run check:docs` → "No broken links." with changes staged.
- [ ] `git status` shows only in-scope files changed (no code, no deletions).
- [ ] `plans/README.md` status row updated.

## STOP conditions

Stop and report back (do not improvise) if:

- `docs/conventions.md` does not exist (plan 028 has not run — this plan depends on it).
- The framing excerpts in "Current state" no longer match the live files (drift).
- Rewriting requires linking to a manual/SDK page that plan 030/031/032 has not yet created and no stub exists — link to the stub `docs/user-guide/README.md` / `docs/sdk/README.md` instead, or STOP if even the stub is missing.
- You find a true, shipped multiplayer-isolation capability that contradicts the "not enforced" premise (then the preview-banner guidance is wrong — report it; do not silently claim or deny enforcement).

## Maintenance notes

- These are the highest-visibility docs; a reviewer should read the new lead paragraphs of `README.md` and `current-direction.md` against `docs/conventions.md`'s positioning rule.
- When epic 2026.44 stories .02–.04 land, the preview-banner caveats added here must be revisited (grep `"Preview — not yet enforced"`).
- The package/CLI/env names remain `Athena*`; this plan deliberately does not rename them — only the prose positioning changes. A future rename is a separate, code-touching effort.
