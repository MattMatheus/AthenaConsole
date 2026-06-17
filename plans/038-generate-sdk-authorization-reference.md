# Plan 038: Generate or check SDK authorization reference from route metadata

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the next
> step. If anything in the "STOP conditions" section occurs, stop and report;
> do not improvise. When done, update the status row for this plan in
> `plans/README.md` unless a reviewer dispatched you and told you they maintain
> the index.
>
> **Drift check (run first)**:
> `git diff --stat c082a64..HEAD -- docs/sdk/api packages/core/src/control-plane/api-contracts.ts packages/core/src/api/routes packages/core/src/control-plane/services.ts packages/core/src/control-plane/services/authorization.ts scripts/check-doc-links.mjs package.json`
>
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code and docs. If an SDK API
> authorization checker already exists and is wired into `npm run check:docs`,
> stop and report that this plan is stale.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: LOW
- **Depends on**: plans/037-reconcile-enterprise-preview-docs.md
- **Category**: docs/dx
- **Planned at**: commit `c082a64`, 2026-06-17

## Why this matters

The HTTP API reference contains hand-written `Required role` lines that drifted
from the code after authorization wrappers were added. That creates two bad
failure modes: humans may overestimate exposure, while future agents may plan
security work that has already landed. The fix should not be another one-time
doc sweep only; add a cheap drift guard so route/authorization claims stay
aligned.

## Current state

Relevant files:

- `docs/sdk/api/*.md` contains the hand-written HTTP API reference.
- `packages/core/src/control-plane/services.ts` wires authorized service wrappers.
- `packages/core/src/control-plane/services/authorization.ts` defines
  `Authorized*Service` wrappers and operation requirements.
- `packages/core/src/control-plane/api-contracts.ts` lists API routes.
- `scripts/check-doc-links.mjs` is the existing doc-checking script called by
  `npm run check:docs`.

Examples of stale reference text:

```md
<!-- docs/sdk/api/missions.md:13-18 -->
### `GET /api/v1/missions`

List missions.

**Required role**: no role check enforced in the current build (no
`AuthorizedMissionWorkbenchService` in authorization.ts)
```

```md
<!-- docs/sdk/api/workflows-and-templates.md:13-18 -->
### `GET /api/v1/workflow-templates`

List available workflow templates.

**Required role**: no role check enforced in the current build (no
`AuthorizedWorkflowTemplateCatalogService`)
```

```md
<!-- docs/sdk/api/run-templates-harness-directives.md:19-24 -->
### `GET /api/v1/run-templates`

List run templates.

**Required role**: no role check enforced in the current build (no
`AuthorizedRunTemplateService`)
```

The code now wires these wrappers:

```ts
// packages/core/src/control-plane/services.ts:309-314
harnessProfileService: new AuthorizedHarnessProfileService(harnessProfileService, authorizer),
runTemplateService: new AuthorizedRunTemplateService(new LocalRunTemplateService(stateStore, runService), authorizer),
workflowDagExecutorService: new AuthorizedWorkflowDagExecutorService(workflowDagExecutorService, authorizer),
workflowTemplateCatalogService: new AuthorizedWorkflowTemplateCatalogService(workflowTemplateCatalogService, authorizer),
```

```ts
// packages/core/src/control-plane/services.ts:341-345
agentCatalogService: new AuthorizedAgentCatalogService(agentCatalogService, authorizer),
missionWorkbenchService: new AuthorizedMissionWorkbenchService(
  new LocalMissionWorkbenchService(options.config),
  authorizer,
  taskWorkbenchService
),
```

Wrapper classes exist in `authorization.ts`:

```text
AuthorizedHarnessProfileService
AuthorizedRunTemplateService
AuthorizedWorkflowDagExecutorService
AuthorizedWorkflowTemplateCatalogService
AuthorizedMissionWorkbenchService
```

Repo conventions:

- Keep route handlers transport-thin; authorization belongs in service wrappers.
- Docs must start with the audience tag from `docs/conventions.md`.
- `npm run check:docs` validates tracked Markdown links.

## Commands you will need

| Purpose | Command | Expected on success |
| --- | --- | --- |
| Find stale no-auth claims | `rg -n "no role check|no authorizer|no Authorized|not enforced in the current build" docs/sdk/api` | no stale role claims remain except explicitly public health routes if intentionally worded |
| Docs check | `npm run check:docs` | exits 0 |
| Core typecheck if adding TS/JS checker imports TS output | `npm --workspace @athena/core run typecheck` | exits 0 |
| SDK/API doc auth check | `npm run check:docs` or a new `npm run check:api-docs` | exits 0 and fails on stale `Required role` claims |
| Whitespace guard | `git diff --check` | exits 0 |

## Scope

**In scope**:

- `docs/sdk/api/*.md`
- `scripts/check-api-doc-auth.mjs` or similar new checker, if needed.
- `scripts/check-doc-links.mjs` only if extending the existing doc check is
  simpler than a new script.
- `package.json` to wire a new check script, if needed.
- `packages/core/src/control-plane/api-contracts.ts` only if adding non-runtime
  metadata needed by the checker and covered by tests.

**Out of scope**:

- Do not change authorization behavior in `packages/core/src/control-plane/services/authorization.ts`.
- Do not change route URLs or response shapes.
- Do not regenerate or rewrite the full API reference unless the operator asks.
- Do not add an OpenAPI generator as a new dependency for this plan.

## Git workflow

- Branch: `advisor/038-generate-sdk-authorization-reference`
- Commit message: `docs: guard API authorization reference`
- Do not push or open a PR unless the operator asks.

## Steps

### Step 1: Correct known stale role claims

Update all stale `Required role` lines in `docs/sdk/api/*.md` that claim missing
authorizers for mission, workflow-template, workflow-DAG execution,
run-template, harness-profile, and agent-catalog families.

Use the operation semantics in `authorization.ts` as the source of truth:

- List/read/status routes generally require `Viewer`, `Operator`, or `Admin`,
  unless intentionally public.
- Create/update/run/execute/cancel routes generally require `Operator` or
  `Admin`.
- Workspace administration requires `Admin`.
- Policy writes and identity/RBAC administration require `Admin`.

**Verify**: `rg -n "no role check enforced|no Authorized|no authorizer" docs/sdk/api` returns no matches for already-wrapped services.

### Step 2: Add a drift guard

Add a lightweight checker that fails when the SDK API docs contain known stale
phrases such as:

- `no role check enforced in the current build`
- `no Authorized`
- `no authorizer`
- `client-asserted only` for workspace scope after plan 037

Prefer a small Node script under `scripts/` with no new dependencies. Wire it
into `npm run check:docs` or add a root script and update `check:docs` to call
both link and API-doc checks.

**Verify**: Temporarily confirm the checker would fail on one stale phrase if
practical, then restore the file. Final `npm run check:docs` must exit 0.

### Step 3: Add source-of-truth guidance to SDK index

In `docs/sdk/api/README.md`, add a short maintainer note that role statements
must be updated with service wrapper changes and are checked by the script from
Step 2. Keep this as maintainer-facing text; do not turn the API guide into
internal implementation documentation.

**Verify**: `npm run check:docs` exits 0.

### Step 4: Run verification

Run the full doc and focused core checks.

**Verify**:

- `npm run check:docs` exits 0.
- `npm --workspace @athena/core run typecheck` exits 0 if source metadata was changed.
- `git diff --check` exits 0.

## Test plan

- New checker script should have deterministic behavior and no network access.
- If the checker is substantial, add a small fixture-free smoke test by invoking
  it from `npm run check:docs`.
- Existing doc link validation remains the broad regression check.

## Done criteria

- [x] SDK API docs no longer claim missing authorizers for services wrapped in
  `createLocalControlPlaneServices`.
- [x] A checked command fails on stale auth-reference phrases.
- [x] `npm run check:docs` exits 0.
- [x] `git diff --check` exits 0.
- [x] `plans/README.md` status row updated.

## STOP conditions

Stop and report back if:

- The live code lacks one of the authorizer wrappers cited in this plan.
- Correct role mapping cannot be inferred from `authorization.ts` without
  changing code behavior.
- The checker would require a full Markdown parser or new dependency.

## Maintenance notes

This plan intentionally starts with a phrase-based drift guard because it is
cheap and catches the current failure. A later improvement could add structured
route metadata and generate the full role table, but do not block this cleanup
on a generator migration.
