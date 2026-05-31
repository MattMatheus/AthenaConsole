<!-- AUDIENCE: Internal/Technical -->

# Code Retirement And Rename Audit

Date: 2026-05-30

Scope: tracked code, app routes, API routes, package surfaces, and source-adjacent operational files after the Team Orchestrator pivot.

Review frame: current product direction is manifest-backed plugin agents, tasks, missions, workflow-template DAG runs, SQLite app state, inspectable events/artifacts, safety controls, and a web-first operator console. Older Project Athena, fleet-governance, persona/specialist, A2A, and cloud-first surfaces should either become explicit compatibility layers, be renamed into current product language, or be retired.

## Executive Summary

The repo is not full of unreachable TypeScript, but it still carries several active-looking paths from older product eras.

Highest-confidence retirement candidates:

1. `target-clean` tracked gitlink with no `.gitmodules` mapping.
2. Tracked Terraform binary plan files under `packages/core/infrastructure/terraform/environments/dev/`.
3. Nested GitHub Actions workflows under `packages/core/.github/workflows/`.
4. Stale source-adjacent planning/status docs in `packages/core/TODO.md`, `packages/core/IMPLEMENT.MD`, and `packages/core/src/README.md`.
5. Unused console `features/a2a-observability/` client code.
6. Legacy persona/specialist docs and examples under `packages/core/docs/personas/` and old `packages/core/docs/user/*` pages.

Highest-value rename/deprecation candidates:

1. Rename visible `fleet` concepts to operator/runtime health, usage, or operations telemetry.
2. Rename visible `persona`/`specialist` concepts toward plugin-backed agents, while keeping a compatibility layer only where needed.
3. Replace the `MissionControlPage` direct specialist/directive workflow with task or mission creation paths.
4. Rename session-centric UI/API copy around transcripts/artifacts only where it is operator-visible; keep internal runtime session naming until a service migration exists.
5. Eventually rename `@athena/*`, `athena` CLI, and `Athena*` code types, but only through a planned package/API migration.

## Method

Commands used:

```bash
git status --short
git ls-files
git ls-files target-clean -s
git submodule status
git ls-files packages/core/infrastructure/terraform/environments/dev/tfplan packages/core/infrastructure/terraform/environments/dev/tfplan-eastus2 -s
file packages/core/infrastructure/terraform/environments/dev/tfplan packages/core/infrastructure/terraform/environments/dev/tfplan-eastus2
find packages/core/src apps/console/src packages/pdk/src apps/api/src -name '*.ts' -o -name '*.tsx'
rg "ProjectAthena|Project Athena|Athena Console|Athena Prime|persona|specialist|fleet|A2A|planning/backlog|planning/prompts"
rg "MissionControlPage|mission-control|specialists/run|personas/run|FleetDashboard|/fleet|SessionsPage|/sessions|workService|memoryService|/work/|/memory/"
```

I also ran a lightweight TypeScript import graph over production `.ts`/`.tsx` files. It found 334 production TypeScript files and 21 files not reachable from the app entrypoints through static imports. That result is useful for finding unused console feature code, but it undercounts public-package entrypoints and external-package surfaces such as `@athena/pdk`.

## Retire Now

| Path | Evidence | Recommendation |
| --- | --- | --- |
| `target-clean` | Tracked as mode `160000 commit cf1aa69...`, but `.gitmodules` is absent and `git submodule status` fails with no mapping. The directory is empty locally and is already ignored by `.gitignore`. | Remove the tracked gitlink with a focused cleanup commit. |
| `packages/core/infrastructure/terraform/environments/dev/tfplan` | Tracked binary Terraform plan; `file` reports zip archive data. Package `.gitignore` already ignores `*.tfplan`. | Delete from git history forward; keep generated plans local only. |
| `packages/core/infrastructure/terraform/environments/dev/tfplan-eastus2` | Same as above. | Delete from tracked repo. |
| `packages/core/.github/workflows/deploy-console.yml` | GitHub only runs workflows from root `.github/workflows`; this nested location reads like active automation but is inert in the current repo layout. | Archive as historical infra or move to root only if cloud deployment becomes current scope. |
| `packages/core/.github/workflows/deploy-control-plane.yml` | Same nested workflow issue; also reflects older Azure/AKS deployment posture. | Archive or move only with an explicit deployment story. |
| `packages/core/TODO.md` | Points to deleted `planning/backlog/*` and old foundation reset story IDs. | Replace with a short pointer to Flywheel/current direction or delete. |
| `packages/core/IMPLEMENT.MD` | Only says “Completed: Stage 0 through Stage 8” without current context. | Delete or archive under product history. |

## Retire Or Archive After Quick Confirmation

| Path | Evidence | Recommendation |
| --- | --- | --- |
| `apps/console/src/features/a2a-observability/` | Static graph found the folder unreachable from console entrypoints. Current UI uses `features/dlq/` for the contained legacy A2A DLQ page, not this observability client. | Delete the unused frontend feature unless an advanced observability page is reintroduced. |
| `packages/core/docs/personas/` | Describes persona definitions under `personas/`, `athena persona run`, and `.athena/persona-runs`, while current product direction centers plugin agents. | Archive under legacy docs or rewrite as a compatibility note. |
| Older `packages/core/docs/user/*` pages | Multiple pages still describe “Project Athena”, CLI-first use, fleet UI, personas, and A2A. | Archive stale pages after confirming `docs/user-guide/README.md` is the canonical user guide. |
| `specialists/athena-prime/` | References deleted `planning/` paths and old Athena identity. It is not plugin-backed and no longer matches Flywheel. | Archive or migrate into a real sample plugin-backed agent. Do not keep as active guidance. |
| `specialists/code-review/` | Older specialist manifest path remains useful as compatibility test data but not current product authoring shape. | Keep only as compatibility fixture or migrate to plugin agent. |

## Rename And Deprecate

### Fleet

`fleet` remains active in both console and API:

- `apps/console/src/features/fleet/`
- `apps/console/src/services/FleetApiService.ts`
- `packages/core/src/control-plane/services/fleet.ts`
- `packages/core/src/api/routes/fleet-events-routes.ts`
- `/api/v1/fleet/summary`
- `/api/v1/fleet/cost/settings`

The functionality is still useful: dashboard health, runtime capability, cost settings, and cost export. The name is the stale part. Recommended migration:

1. Introduce a current-name API family such as `/api/v1/operations/*`, `/api/v1/runtime-metrics/*`, or `/api/v1/operator-telemetry/*`.
2. Keep `/api/v1/fleet/*` as a deprecated alias for one release window.
3. Rename console files from `fleet` to `operations` or `runtime-health`.
4. Rename `personaBreakdown` to `agentBreakdown` in new contracts while reading old event payloads for compatibility.

### Persona And Specialist

Persona/specialist code is not dead yet. It backs:

- visible console route `/mission-control`,
- API routes `/api/v1/specialists/run` and `/api/v1/personas/run`,
- CLI commands `athena specialist ...` and `athena persona ...`,
- artifact compatibility directories `specialist-runs` and `persona-runs`,
- PDK compatibility exports such as `definePersona` and `defineSpecialist`.

The current product center is plugin-backed agents, so this should become an explicit compatibility layer:

1. Hide or remove `MissionControlPage` from primary navigation.
2. Prefer task/mission creation for new operator work.
3. Mark `/api/v1/personas/run` and `athena persona` as deprecated aliases.
4. Keep `/api/v1/specialists/run` only if it is needed for old checked-in specialist fixtures.
5. Move PDK persona helpers behind a `compat/persona` export in a future breaking change.
6. Migrate `specialists/code-review` to a sample plugin agent if code review remains a first-class example.

### Sessions, Work, And Memory

Sessions, transcripts, and artifacts are still relevant to inspectable run history. The older names become confusing mainly in user-facing navigation:

- `SessionsPage` is useful but could be renamed to `Run History`, `Transcripts`, or `Artifacts`.
- `/api/v1/sessions/*` can stay internal for now because runtime sessions are a real implementation concept.
- `work` and `memory` APIs are less central to the console and should be documented as advanced/runtime APIs, not primary operator workflows.

### Athena Package Names

`@athena/core`, `@athena/console`, `@athena/pdk`, the `athena` CLI, `AthenaConfig`, and `AthenaError` are implementation history. Do not rename them opportunistically. Package and CLI renames affect imports, docs, Docker env vars, scripts, tests, and external examples. Treat this as a separate migration.

## Public Surface Mismatches

Small, safe rename candidates:

| Path | Current issue | Recommendation |
| --- | --- | --- |
| `package.json` | Root package name is `athena-fleet`. | Rename to a neutral private workspace name such as `team-orchestrator-workspace`. |
| `apps/console/package.json` | Description says `ProjectAthena web console`. | Rename to `Team Orchestrator web console`. |
| `apps/console/index.html` | Browser title says `ProjectAthena Console`. | Rename to `Team Orchestrator Console`. |
| `packages/core/.env.example` | Header says `ProjectAthena example configuration`. | Rename to Team Orchestrator, keep `ATHENA_*` env vars for compatibility. |
| `packages/core/src/README.md` | Describes Project Athena and persona runtime. | Rewrite or delete; root docs already explain current architecture. |

## Keep

These areas align with the current product direction and should not be retired:

- `apps/api/`
- `apps/console/src/pages/TaskCreatePage.tsx`
- `apps/console/src/pages/MissionsPage.tsx`
- `apps/console/src/pages/WorkflowsPage.tsx`
- `apps/console/src/pages/WorkflowRunDetailPage.tsx`
- `apps/console/src/pages/AgentCatalogPage.tsx`
- `apps/console/src/pages/SchedulesPage.tsx`
- `apps/console/src/pages/SettingsPage.tsx`
- `packages/core/src/control-plane/app-state/`
- `packages/core/src/control-plane/manifests/`
- `packages/core/src/control-plane/plugins/`
- `packages/core/src/control-plane/services/task-workbench.ts`
- `packages/core/src/control-plane/services/mission-workbench.ts`
- `packages/core/src/control-plane/services/workflow-*`
- `packages/pdk/src/agent.ts`
- `sample-plugins/`
- `docs/user-guide/README.md`
- `docs/product/direction/current-direction.md`

## Suggested Follow-Up Stories

1. **Source Hygiene Cleanup**
   - Remove `target-clean`, tracked Terraform plan files, nested inactive workflows, and stale package status docs.

2. **Console Legacy Surface Retirement**
   - Remove `features/a2a-observability/`.
   - Hide or remove `MissionControlPage`.
   - Rename `Sessions` navigation if product wants run-history language.

3. **Operations Telemetry Rename**
   - Rename frontend `fleet` to operations/runtime health.
   - Add current-name API routes with old `/fleet` aliases.
   - Rename contract fields in a compatibility-aware way.

4. **Persona/Specialist Compatibility Plan**
   - Decide whether old specialist execution remains supported.
   - Deprecate `persona` alias and stale specialist docs.
   - Migrate useful specialists into plugin-backed sample agents.

5. **Docs And Public Metadata Sweep**
   - Update package descriptions, HTML title, `.env.example`, and source README.
   - Archive old `packages/core/docs/user` and `packages/core/docs/personas` pages or rewrite them against the current user guide.

## Bottom Line

The safest cleanup path is not a broad code purge. Retire inert files first, then make the old product concepts explicit compatibility surfaces. The main source code still works because legacy layers are wired into API/CLI/UI paths, but the names tell the wrong story: Team Orchestrator should present agents, tasks, missions, workflow runs, artifacts, readiness, and operations telemetry as the current model.
