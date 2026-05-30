<!-- AUDIENCE: Internal/Technical -->

# Repository Cleanup Audit

Date: 2026-05-30

Scope: Team Orchestrator repository cleanup inventory after the 2026 product realignment and real-work enablement arc.

Review frame: classify repo areas as canonical, historical, generated/local, stale-but-useful, deprecated, or unknown before deleting or promoting files.

## Executive Summary

The repository is workable, but it is carrying visible history from several product eras. Most of that history is already safe because it is archived, but the current user-facing documentation and package surfaces still mix Team Orchestrator with older Project Athena, fleet, persona, and marketing-site concepts.

Recommended cleanup order:

1. Keep source/runtime code stable and avoid package renames for now.
2. Refresh or retire current-facing docs that still describe Project Athena and fleet/persona-first workflows.
3. Remove the stale `apps/marketing/` site from the public repo surface.
4. Harden `packages/pdk/` into the Agent Developer Kit before adding new scaffold commands.
5. Add lightweight local cleanup guidance for ignored artifacts such as `.athena/`, `.turbo/`, `dist/`, `coverage/`, and `.DS_Store`.

Decision update: after reviewing the audit, the operator chose to remove `apps/marketing/` because the stale site projected an outdated and disorganized public surface. Historical marketing records remain under `docs/product/archive/`.

## Inventory Method

Commands used:

```bash
git ls-files
git ls-files | awk -F/ '{print $1}' | sort | uniq -c | sort -nr
git status --ignored --short
rg "ProjectAthena|Project Athena|Athena Console|Athena Prime|Athena's|Foundry-first|persona-kit|Fleet|fleet" --glob '!node_modules/**' --glob '!dist/**' --glob '!coverage/**' --glob '!docs/product/archive/**' --glob '!package-lock.json' --glob '!apps/*/package-lock.json'
```

Top-level tracked file counts from `git ls-files`:

| Area | Count | Classification | Recommendation |
| --- | ---: | --- | --- |
| `packages/` | 416 | Canonical source with some legacy naming | Keep; refresh docs and public naming gradually |
| `docs/` | 349 | Mixed canonical product docs, archives, history, and older user docs | Keep; reorganize current docs and label archive/history clearly |
| `flywheel/` | 275 | Canonical workflow harness | Keep |
| `apps/` | 225 | Canonical console/API plus stale marketing app at audit time | Keep console/API; remove stale marketing app |
| `sample-plugins/` | 18 | Canonical examples | Keep and continue using as docs/test fixtures |
| `specialists/` | 12 | Stale or internal persona assets | Defer; classify before delete |
| `planning/README.md` | 1 | Historical pointer | Keep short-term; align workspace onboarding later |

## Canonical Areas

| Path | Current Role | Action |
| --- | --- | --- |
| `README.md` | Main repo entry for Team Orchestrator | Keep; continue using as public-facing root |
| `GETTING_STARTED.md` | Current local/server operator path | Keep; update only through docs IA work |
| `AGENTS.md` | Current agent onboarding | Keep; later remove references to deleted planning paths if workspace-level guidance is updated |
| `apps/api/` | API package entry point | Keep |
| `apps/console/` | Primary operator console | Keep; continue removing public ProjectAthena labels |
| `packages/core/` | Core orchestration/control-plane package | Keep; internal `Athena*` names can remain until a package/API migration plan exists |
| `packages/pdk/` | Existing developer kit primitives | Keep; harden into Agent Developer Kit |
| `sample-plugins/` | Current plugin/agent examples | Keep; treat as supported fixtures |
| `flywheel/` | Active workflow harness | Keep |
| `docs/product/direction/`, `docs/product/architecture/decisions/`, `docs/product/roadmap/` | Canonical product context | Keep |

## Historical Or Archive Areas

| Path | Current Role | Action |
| --- | --- | --- |
| `docs/product/archive/` | Archived pre-reset and product-direction snapshots | Keep; do not use as active roadmap |
| `docs/product/history/completed-stories/` | Completed story history | Keep; consider generated/indexed summaries later |
| `docs/product/research/complete/` | Completed research | Keep unless docs IA moves research under a clearer internal section |
| `docs/product/strategy/` | Strategy notes and brainstorms | Keep for now; label as internal/non-canonical where needed |
| `planning/README.md` | Pointer away from old planning workflow | Keep until workspace-level onboarding no longer references old `planning/` paths |

No deletion is recommended for archived product records in this pass. They are noisy in search, but they are already under `archive/` or `history/` and explain why the product changed.

## Stale Or Conflicting Current-Facing Areas

These are the areas most likely to confuse a new user because they are not under `archive/` and still appear current.

| Path | Evidence | Recommendation |
| --- | --- | --- |
| `packages/core/docs/user/01-introduction.md` | Introduces "Project Athena" as a CLI-first runtime | Refresh or replace in docs IA story |
| `packages/core/docs/user/02-installation.md` | Describes Project Athena and fleet metrics configuration | Refresh or replace |
| `packages/core/docs/user/03-basic-usage.md` | Focuses on CLI/persona run flow | Refresh around console/tasks/agents or archive |
| `packages/core/docs/user/04-api-server.md` | Uses Project Athena and Policy/Fleet/Event framing | Refresh around current API groups |
| `packages/core/docs/user/08-console-ui.md` | Describes Athena Console as fleet/session/policy UI | Replace with current Team Orchestrator console guide |
| `packages/core/docs/getting-started/README.md` | Says "ProjectAthena is a CLI-first agent runtime" | Refresh or archive |
| `apps/console/package.json` | Description says "ProjectAthena web console" | Quick cleanup: change to Team Orchestrator |
| `apps/console/index.html` | Page title says "ProjectAthena Console" | Quick cleanup: change to Team Orchestrator |
| `apps/console/src/pages/ResourcesPage.tsx` | Placeholder says "Athena Console" | Quick cleanup in console polish follow-up |
| `docs/developer/product-dev-guides/01-architecture.md` | Opens with "Project Athena is API-first" | Refresh in docs IA story |
| `packages/core/.env.example` | Header says "ProjectAthena example configuration" | Quick cleanup |

## Marketing App

| Path | Classification | Recommendation |
| --- | --- | --- |
| `apps/marketing/` | Removed stale public website prototype | Removed from the active repo surface; preserve history in `docs/product/archive/` |

Evidence at audit time:

- `apps/marketing/TODO.md` is still present.
- Several marketing docs under `apps/marketing/src/content/docs/docs/reference/` describe "Project Athena".
- Scripts still include names such as `sync-projectathena-docs.mjs`.
- Blog content appears product/strategy-oriented and may still be useful, but it predates the current operator workflow.

Decision: remove `apps/marketing/` from the active repo surface. Future product-site work should start fresh once the documentation information architecture and public messaging are mature.

## Agent Developer Kit And Specialist Assets

| Path | Classification | Recommendation |
| --- | --- | --- |
| `packages/pdk/` | Canonical seed of Agent Developer Kit | Keep; harden docs/examples/tests |
| `specialists/athena-prime/` | Stale or internal persona asset | Defer; classify as internal, archive, or migrate to plugin-backed agent |
| `specialists/code-review/` | Stale or internal persona asset | Defer; classify as internal, archive, or migrate to plugin-backed agent |
| `packages/core/src/personas/` | Legacy/persona runtime code path | Defer; architecture approval required before removal |
| `packages/pdk/src/test-harness.ts` | Still references Athena/persona language | Keep code; refresh public framing during ADK hardening |

The PDK already exposes useful agent helpers, but its README still spends significant space on persona/specialist concepts. The next ADK story should lead with manifest-backed agent authoring and move persona material to advanced/internal compatibility notes.

## Generated And Local Artifacts

Ignored files currently visible in the working tree include:

- `.athena/`
- `.env`
- `.turbo/`
- `node_modules/`
- package `dist/` directories
- package `coverage/`
- `*.tsbuildinfo`
- `.DS_Store`

These are mostly already covered by `.gitignore` and `.dockerignore`, so they are not tracked repo debt. The useful cleanup is documentation or a local helper command, not a source change.

Recommended quick cleanup:

- Add a short "local cleanup" note to contributor docs.
- Optionally add a non-destructive `npm run clean:local` or `./dev.sh clean` later that removes ignored build/cache artifacts but does not touch `.env` or `.athena/` unless explicitly requested.

## Package Lock Files

Tracked lock files:

- `package-lock.json`
- `apps/console/package-lock.json`
- `apps/marketing/package-lock.json` at audit time; removed with the stale marketing app
- `packages/core/package-lock.json`

Recommendation: defer. Multiple lock files may be intentional from earlier package-level workflows, but this should be reviewed during repo hygiene, not changed blindly.

## Quick Cleanup Candidates

Safe candidates for small follow-up stories:

1. Update `apps/console/package.json` description and `apps/console/index.html` title to Team Orchestrator.
2. Update `packages/core/.env.example` header.
3. Add a docs note that ignored local artifacts are safe to remove except `.env` and `.athena/` when preserving local state.
4. Add audience/status labels to `packages/core/docs/user/` pages or move them behind a legacy-docs note.
5. Rename public-facing "Athena Console" links in current docs to "Team Orchestrator Console" where they are not referring to historical package names.

## Deferred Or Approval-Required Cleanup

These need architecture or product approval:

1. Removing `packages/core/src/personas/` or changing persona API behavior.
2. Removing or archiving `specialists/`.
3. Removing `apps/marketing/`. Decision made and implemented after operator review.
4. Renaming packages from `@athena/*` to Team Orchestrator names.
5. Removing `/api/v1/fleet/*` APIs or fleet service contracts.
6. Consolidating package lock files.

## Recommended Next Stories

1. Documentation Information Architecture: decide canonical docs tree and refresh current-facing user docs.
2. Agent Developer Kit Hardening: lead with plugin-backed agents and executable examples.
3. Agent Scaffold Command: generate unique plugin/agent IDs from a template.
4. Product Readiness Smoke Suite: make startup/catalog/provider/task/artifact verification repeatable.
5. Future Product Site: start from current product docs and messaging instead of reviving the removed marketing app.

## Bottom Line

The repo does not need a dramatic purge. It needs a firm line between current product surfaces and historical context. The highest-value cleanup is to make the user-facing docs, console metadata, and ADK package tell the same story: Team Orchestrator is a local-first, manifest-backed agent orchestration workbench centered on plugins, tasks, runs, artifacts, and safe operator control.
