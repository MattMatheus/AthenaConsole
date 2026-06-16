# Plan 032: Write the SDK Guide Part 2 — HTTP Control-Plane API Reference

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Read first (the contract)**: `docs/conventions.md` (plan 028) — audience
> tags (`<!-- AUDIENCE: Engineer/SDK -->`), the **preview-banner standard**.
>
> **Drift check (run first)**:
> `git diff --stat 9acdfd6..HEAD -- packages/core/src/api/ packages/core/src/control-plane/services/authorization.ts packages/core/docs/user/04-api-server.md packages/core/docs/user/06-api-examples.md`
> If any in-scope source changed since this plan was written, re-derive the
> endpoint and RBAC tables from the live code; on a material mismatch, STOP.

## Status

- **Priority**: P1
- **Effort**: L
- **Risk**: MED (must match the real route table and RBAC; an inaccurate API reference misleads integrators)
- **Depends on**: plan 028 (`docs/sdk/README.md` stub + conventions). Pairs with plan 031.
- **Category**: docs
- **Planned at**: commit `9acdfd6`, 2026-06-15

## Why this matters

Enterprise engineers integrating with the control plane have **no HTTP API reference** — the surface is only discoverable by reading ~19 route files. The product exposes a large, stable `/api/v1` surface (workspaces, tasks, missions, runs, workflows, model providers, repositories, durable memory, identity/RBAC, schedules, operations/events, and more), with RBAC enforced in the service layer. This plan produces the authoritative reference under `docs/sdk/api/`, **derived from the route tables and the `Authorized*Service` authorizers**, with auth, RBAC roles, pagination, error shape, and request/response examples — and consolidates the two stale API docs. It completes the SDK guide started in plan 031.

## Current state — how to derive the surface (do NOT guess endpoints)

**Routes are declared as tables** of `{ method, path, handler }` in `packages/core/src/api/routes/*-routes.ts`. Example — `packages/core/src/api/routes/task-routes.ts:12-22`:

```ts
{ method: "GET",  path: "/api/v1/tasks/metadata", handler: handleGetTaskMetadataRoute },
{ method: "GET",  path: "/api/v1/tasks", handler: handleListTasksRoute },
{ method: "POST", path: "/api/v1/tasks", handler: handleCreateTaskRoute },
{ method: "GET",  path: "/api/v1/tasks/:id", handler: handleGetTaskRoute },
{ method: "PUT",  path: "/api/v1/tasks/:id", handler: handleUpdateTaskRoute },
{ method: "GET",  path: "/api/v1/tasks/:id/run-readiness", handler: handleGetTaskRunReadinessRoute },
{ method: "POST", path: "/api/v1/tasks/:id/run", handler: handleRunTaskRoute },
{ method: "GET",  path: "/api/v1/task-runs/:runId", handler: handleGetTaskRunRoute },
{ method: "GET",  path: "/api/v1/task-runs/:runId/evidence-bundle", handler: handleGetTaskRunEvidenceBundleRoute },
{ method: "GET",  path: "/api/v1/task-runs/:runId/artifacts/:artifactId", handler: handleGetTaskRunArtifactRoute },
{ method: "POST", path: "/api/v1/task-runs/:runId/cancel", handler: handleCancelTaskRunRoute }
```

**Route families** (from `packages/core/src/api/routes/route-registration.ts` `ApiRouteFamily`): `agent-catalog, repositories, model-providers, tasks, missions, core, runs, sessions, directives, harness-profiles, run-templates, workflows, workflow-templates, memory, durable-memory, work, failed-work, schedules, operations-events-policy, identity-rbac, workspaces`. The route files (with rough endpoint counts) are:

```
durable-memory-routes.ts(15) policy-schedule-routes.ts(14) run-routes.ts(13)
task-routes.ts(11) operations-events-routes.ts(11) mission-routes.ts(10)
identity-rbac-routes.ts(9) work-memory-routes.ts(8) repository-routes.ts(6)
model-provider-routes.ts(6) workspace-routes.ts(5) core-routes.ts(4)
workflow-routes.ts(3) run-template-routes.ts(3) failed-work-routes.ts(3)
agent-catalog-routes.ts(3) workflow-template-catalog-routes.ts(2)
harness-profile-routes.ts(2) directive-routes.ts(2)
```

`core-routes.ts` includes the health surface: `GET /api/v1/health`, `GET /api/v1/readiness`, `GET /api/v1/admin/health`, `GET /api/v1/capabilities`.

**RBAC is enforced in the service layer**, not the route table. The authorizers live in `packages/core/src/control-plane/services/authorization.ts` as `Authorized<Name>Service` classes that call `this.authorizer.assertAllowed({ operation, requiredRoles })`. Example — `AuthorizedWorkspaceService` requires `["Admin"]` for all workspace operations (`authorization.ts` `workspaces.list/get/create/update/delete`). **Derive each endpoint's required role from the matching authorizer**, not by guessing. Roles type: find with `grep -rn "AthenaRbacRole" packages/core/src/control-plane` (enumerate the actual role values).

**Auth model** — `packages/core/src/api/middleware/auth.ts`. Note for the reference: workspace scope is currently **client-asserted** via the `x-athena-scope-workspaces` header (`auth.ts:81`). The API reference MUST carry the **preview banner** wherever it documents workspace scoping/confinement, because that header is **not** a security boundary yet (epic 2026.44 stories .02–.04). Document the header as it behaves, with the banner.

**Pagination** — there is a cursor-pagination model (research `docs/product/research/complete/14.01-cursor-pagination-model.md`; confirm the live shape by grepping list handlers, e.g. `grep -rn "cursor\|nextCursor\|pageSize\|limit" packages/core/src/api/routes/`). Document the actual query params and response envelope, not the research proposal.

**Error shape** — find the canonical error type: `grep -rn "AthenaError\|errorResponse\|\"code\"" packages/core/src/api packages/core/src/shared | head`. Document the real JSON error body (e.g. `{ code, message, ... }`).

**Consolidation sources**: `packages/core/docs/user/04-api-server.md` (API server overview) and `packages/core/docs/user/06-api-examples.md` (curl/examples) — mine then delete.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Drift check | `git diff --stat 9acdfd6..HEAD -- packages/core/src/api/` | empty or understood |
| Enumerate ALL endpoints | `grep -rhnE 'method:\s*"(GET|POST|PUT|PATCH|DELETE)".*path:\s*"[^"]+"' packages/core/src/api/routes/` | the full route list (also check multi-line entries per file) |
| Per-file endpoint dump | `grep -nE 'method:|path:' packages/core/src/api/routes/<family>-routes.ts` | that family's endpoints |
| Derive RBAC | `grep -nE 'operation:|requiredRoles' packages/core/src/control-plane/services/authorization.ts` | operation→roles mapping |
| Role values | `grep -rn "AthenaRbacRole" packages/core/src/control-plane \| head` | the role enum/type |
| Run the API for live checks (optional) | `npm --workspace @athena/api run dev` then `curl -s localhost:<port>/api/v1/health` | a real response to copy |
| Doc-link gate | `npm run check:docs` | "No broken links." |

## Scope

**In scope** (create the reference; consolidate the two stale API docs):

- **Create** under `docs/sdk/api/`:
  - `README.md` — API reference landing: base URL/version (`/api/v1`), auth model + the workspace-scope **preview banner**, RBAC roles overview, pagination convention, error shape, and a table of contents linking the per-family pages.
  - One page per family (or a small number of grouped pages — your call, but **every** family above must be covered): e.g. `workspaces.md`, `tasks-and-runs.md`, `missions.md`, `workflows-and-templates.md`, `model-providers.md`, `repositories.md`, `durable-memory.md`, `identity-rbac.md`, `schedules-and-policy.md`, `operations-events.md`, `work-and-failed-work.md`, `agent-catalog.md`, `core-health.md`, `run-templates-harness-directives.md`. Each page lists endpoints as `METHOD path` with: purpose, required role (from the authorizer), path/query params, request body shape, response shape, and at least one `curl` example. Mine examples from `06-api-examples.md` where still accurate.
- **Update** `docs/sdk/README.md` — fill the "HTTP Control-Plane API Reference" half (plan 031 filled the PDK half); link `api/README.md`.
- **Delete** (consolidated): `packages/core/docs/user/04-api-server.md`, `packages/core/docs/user/06-api-examples.md`. If `packages/core/docs/README.md` still exists and now only indexes deleted pages, delete it; if it indexes live files, update it. Repoint inbound links first.

**Out of scope**:

- The PDK guide (plan 031), user manual (030), entry docs (029), conventions/map (028).
- Any code change. The reference documents the API as-is; if an endpoint looks wrong, note it in Maintenance — do not change `src/`.
- Documenting workspace **isolation/confinement** as enforced — it is not; banner it.
- Inventing endpoints, params, or roles not present in the code. If something is unclear, read the handler; if still unclear, mark it "see handler `<file>`" and note in STOP/Maintenance — do not fabricate.

## Git workflow

- Branch: `advisor/032-sdk-guide-http-api-reference`
- Commit: landing + a few family pages per commit; final commit for consolidation deletions + link repoints.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Derive the full endpoint + RBAC inventory

Enumerate every endpoint across all route files (some entries span lines — read each `*-routes.ts` file, do not rely on a single grep). Build an operation→required-role map from `authorization.ts`. Enumerate the actual `AthenaRbacRole` values. Determine the live pagination params and error JSON shape from the handlers (not the research doc).

**Verify**: you have a complete list whose family coverage matches the `ApiRouteFamily` union (21 families); you can state the role values and the error body shape with a `file:line`.

### Step 2: Write `docs/sdk/api/README.md` (the cross-cutting contract)

Base path `/api/v1`; auth model with the **preview banner** on workspace scoping; roles; pagination; standard error body; health endpoints. Link the family pages.

**Verify**: `grep -q "Preview — not yet enforced" docs/sdk/api/README.md` (workspace-scope section) → exit 0.

### Step 3: Write the per-family pages

For each family, document every endpoint with method, path, role, params, request/response, and a curl example. Pull request/response shapes from the request-parsers (`packages/core/src/api/request-parsers/`) and api-schemas (`packages/core/src/control-plane/api-schemas.ts`) where present. Put the workspace-scope banner on any endpoint that filters by `x-athena-scope-workspaces`.

**Verify**: every `ApiRouteFamily` value has a covering page/section: `for f in workspaces tasks missions runs workflows model-providers repositories durable-memory identity-rbac schedules operations-events agent-catalog; do grep -rilq "$f" docs/sdk/api/ || echo "MISSING $f"; done` prints nothing.

### Step 4: Fill the SDK landing and consolidate

Fill the API half of `docs/sdk/README.md`. Repoint inbound links to `04-api-server.md`/`06-api-examples.md`, then `git rm` them. Handle `packages/core/docs/README.md` per Scope.

**Verify**:
- `git add -A && npm run check:docs` → "No broken links."
- `test ! -e packages/core/docs/user/04-api-server.md && test ! -e packages/core/docs/user/06-api-examples.md` → exit 0.

### Step 5: Final gate

**Verify**: `npm run check:docs` → "No broken links."; `git status` shows only in-scope paths; no code changed.

## Test plan

- `npm run check:docs` passes with new files staged.
- Endpoint coverage check (Step 3 verify) prints nothing missing.
- Spot-check 5 documented endpoints against their route file (method + path match exactly).
- Spot-check 3 documented roles against `authorization.ts` (required roles match).
- The workspace-scope sections carry the preview banner.
- `04-api-server.md`/`06-api-examples.md` removed; PDK-owned files untouched.

## Done criteria

ALL must hold:

- [ ] `docs/sdk/api/README.md` + per-family pages cover all 21 `ApiRouteFamily` values; each endpoint shows method, path, required role, params, request/response, and a curl example.
- [ ] Endpoint methods/paths match the route tables (spot-check ≥5); roles match `authorization.ts` (spot-check ≥3).
- [ ] Workspace-scope documentation carries the preview banner (scope is client-asserted, not enforced).
- [ ] No fabricated endpoints/params/roles (every documented endpoint traces to a route file).
- [ ] `docs/sdk/README.md` API half filled and links `api/README.md`.
- [ ] `packages/core/docs/user/04-api-server.md` and `06-api-examples.md` deleted; inbound links repointed; `packages/core/docs/README.md` resolved.
- [ ] `npm run check:docs` → "No broken links." (staged); `git status` shows only in-scope files; no code changed.
- [ ] `plans/README.md` status row updated.

## STOP conditions

Stop and report back (do not improvise) if:

- The route tables or `authorization.ts` no longer match the "Current state" excerpts (re-derive from live code; report the delta).
- You cannot determine an endpoint's required role from an authorizer (some endpoints may be unauthenticated/local-only) — document it as "no role check (local/health)" with the `file:line`, do not guess a role.
- The live pagination/error shape contradicts the research doc — follow the **code**, never the research proposal.
- Documenting an endpoint would require reproducing a secret (e.g. an example with a real token) — use an obvious placeholder (`$TOKEN`), never a real value from `.env`/`server.env.example`.

## Maintenance notes

- This reference is derived from route tables + service authorizers; a reviewer should spot-check a sample against the code. Consider a follow-up to **generate** the endpoint table from `*-routes.ts` so it cannot drift.
- When epic 2026.44 stories .02–.04 land, the workspace-scope auth section changes from "client-asserted header (preview)" to "server-derived scope" — update the banner and the auth model then.
- `api-schemas.ts` already encodes request/response JSON schemas; a future improvement is to publish an OpenAPI doc from it and link it here.
- If the API server is run for live example capture, do not commit any real tokens; placeholders only.
