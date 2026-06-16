# Plan 031: Write the SDK Guide Part 1 — Agent Developer Kit (`@athena/pdk`)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Read first (the contract)**: `docs/conventions.md` (plan 028) — audience
> tags, voice. This guide is `<!-- AUDIENCE: Engineer/SDK -->`.
>
> **Drift check (run first)**:
> `git diff --stat 9acdfd6..HEAD -- packages/pdk/ packages/core/docs/user/07-pdk-guide.md packages/core/docs/user/10-copy-sample-agent.md docs/developer/product-dev-guides/capability-pack-authoring.md`
> If any in-scope source changed since this plan was written, compare the
> "Current state" excerpts against the live files; on a mismatch, STOP — an SDK
> guide that contradicts the actual exported API is worse than none.

## Status

- **Priority**: P1
- **Effort**: M-L
- **Risk**: MED (must exactly match the exported PDK API; consolidates 3 overlapping sources)
- **Depends on**: plan 028 (`docs/sdk/README.md` stub + conventions)
- **Category**: docs
- **Planned at**: commit `9acdfd6`, 2026-06-15

## Why this matters

Enterprise engineers extending the platform need a single authoritative guide for **building plugin-backed agents** with `@athena/pdk` (the Agent Developer Kit). Today this is split and partly duplicated across `packages/pdk/README.md`, `packages/core/docs/user/07-pdk-guide.md`, and `docs/developer/product-dev-guides/capability-pack-authoring.md`, with no single canonical entry. This plan writes the canonical SDK guide (`docs/sdk/agent-developer-kit.md`) directly from the **actual exported API**, consolidates the overlapping docs, and leaves the npm package README as a short pointer (npm convention). It pairs with plan 032 (HTTP API reference) under one `docs/sdk/` guide.

## Current state — the real exported API (build the guide from THIS)

`@athena/pdk` is a single module. Public surface from `packages/pdk/src/index.ts`:

```ts
// types
AgentHandler, AgentHandlerContext, AgentInputContract, AgentInputField,
AgentInputFieldType, AgentInputValidationIssue, AgentRunArtifact,
AgentRunOutputEnvelope, AgentRunVerificationFailure,
AgentRunVerificationStatus, AgentTaskRunEnvelope
// values
AgentSdkValidationError, createAgentArtifact, createAgentRunOutput,
parseAgentEnvelopeInputs, parseAgentInputs, parseAgentTaskRunEnvelope,
runAgentHandler, serializeAgentRunOutput
```

Key shapes/behaviors from `packages/pdk/src/agent.ts` (cite these precisely):

- `AgentInputFieldType` = `"string" | "markdown" | "number" | "integer" | "boolean" | "object" | "array" | "json" | "file" | "url" | "enum"` (`agent.ts:1-12`).
- `AgentInputField` has `type`, `required?`, `description?`, `label?`, `default?`, `schema?`, `enum?`, and a `ui` hint (`widget`, `placeholder`, `order`) (`agent.ts:14-27`).
- `AgentTaskRunEnvelope` = `{ task:{id,...}, agent:{id,...}, run:{id,...}, ... }` (`agent.ts:31-49`).
- `parseAgentTaskRunEnvelope(value)` throws `AgentSdkValidationError` unless `task.id`, `agent.id`, `run.id` are non-empty strings (`agent.ts:112-127`).
- `parseAgentInputs(contract, inputs)` applies defaults, enforces `required`, type-checks per `AgentInputFieldType`, and throws `AgentSdkValidationError` with `issues[]` on failure (`agent.ts:129-163`).
- `runAgentHandler(handler, { envelope, inputContract?, inputs? })` parses the envelope, resolves inputs (explicit `inputs` → contract parse → raw `task.inputs`), and invokes the handler with `{ envelope, inputs, task, agent, run }` (`agent.ts:209-222`).
- `createAgentRunOutput(output, { artifacts?, verificationStatus?, verificationFailures? })` and `createAgentArtifact(artifact)` (requires non-empty `storageUri`, defaults `label/kind/format`) (`agent.ts:172-203`).
- `serializeAgentRunOutput(envelope)` returns `JSON.stringify(envelope) + "\n"` (`agent.ts:205-207`) — the runtime reads a single JSON line on stdout.

**Package framing** — `packages/pdk/README.md` already opens well: *"`@athena/pdk` is the code-level Agent Developer Kit for Team Orchestrator plugin authors."* and describes the plugin-on-disk shape (`plugin.yaml`, `agents/*.agent.yaml`). Mine it, then reduce it to a pointer.

**Sources to consolidate**: `packages/core/docs/user/07-pdk-guide.md` ("Build Your First Agent"), `packages/core/docs/user/10-copy-sample-agent.md` ("Copy The Model Provider Smoke Agent"), `docs/developer/product-dev-guides/capability-pack-authoring.md`. Sample plugins to reference (do not move): `sample-plugins/first-run-demo/`, `sample-plugins/model-provider-smoke/`, `sample-plugins/repo-summary/`, `sample-plugins/code-review/`, `sample-plugins/generic-research/`, `sample-plugins/local-user-test/`.

**Build/verify commands for PDK** (real): `npm --workspace @athena/pdk run build`, `npm --workspace @athena/pdk run typecheck`, `npm --workspace @athena/pdk run test` (runs `tsc` then `node --test tests/*.test.mjs`).

**Manifest schema** lives at `packages/core/schemas/team-orchestrator/manifests/v1/` (read its `README.md` for the agent/plugin manifest shape the input contract mirrors).

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Drift check | `git diff --stat 9acdfd6..HEAD -- packages/pdk/` | empty or understood |
| Confirm exported API | `sed -n '1,40p' packages/pdk/src/index.ts` | matches the export list above |
| Build the SDK (verify examples compile against types) | `npm --workspace @athena/pdk run build` | exit 0 |
| PDK tests | `npm --workspace @athena/pdk run test` | all pass |
| Find inbound links before deleting | `grep -rn "07-pdk-guide\|10-copy-sample-agent" --include='*.md' .` | repoint each |
| Doc-link gate | `npm run check:docs` | "No broken links." |

## Scope

**In scope**:

- **Create** `docs/sdk/agent-developer-kit.md` — the canonical Agent Developer Kit guide (audience Engineer/SDK), structured: Overview → Plugin & agent layout on disk (`plugin.yaml`, `agents/*.agent.yaml`) → The run envelope → Declaring inputs (the `AgentInputContract` / `AgentInputField` types, all field types) → Writing a handler with `runAgentHandler` → Producing output & artifacts (`createAgentRunOutput`, `createAgentArtifact`, `serializeAgentRunOutput`) → Validation & errors (`AgentSdkValidationError`, `issues[]`) → Verification status → A complete worked example (mine `07-pdk-guide.md` + a sample plugin) → Capability packs (fold in `capability-pack-authoring.md`) → Build/test/package commands → Link to the HTTP API reference (plan 032) for triggering runs.
- **Update** `docs/sdk/README.md` (the 028 stub) — fill the "Agent Developer Kit (PDK)" part; keep the API-reference pointer for plan 032.
- **Reduce** `packages/pdk/README.md` to a short package README: 1–2 paragraphs + the "What It Provides" list + a prominent link to `../../docs/sdk/agent-developer-kit.md` as the canonical guide. (Keep a README — npm packages need one — but it stops being a second full guide.)
- **Delete** (consolidated): `packages/core/docs/user/07-pdk-guide.md`, `packages/core/docs/user/10-copy-sample-agent.md`. Fold `docs/developer/product-dev-guides/capability-pack-authoring.md` into the SDK guide, then either delete it or reduce it to a one-line redirect to `docs/sdk/agent-developer-kit.md#capability-packs` (prefer redirect to preserve any inbound contributor links; repoint where cheap).

**Out of scope**:

- `packages/core/docs/user/04-api-server.md`, `06-api-examples.md` and the HTTP API reference — **plan 032**.
- The user manual (plan 030), entry docs (029), `docs/conventions.md`/`docs/README.md` (028).
- Any change to `packages/pdk/src/*` **code** — the guide documents the API as-is. If the API seems wrong/awkward, note it in Maintenance, do not change it.
- Moving or editing sample plugins.

## Git workflow

- Branch: `advisor/031-sdk-guide-agent-developer-kit`
- Commit: (1) the SDK guide + sdk/README fill, (2) package README reduction + consolidation deletions/redirects.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Confirm the exported API and read sources

`sed -n '1,40p' packages/pdk/src/index.ts` and read `packages/pdk/src/agent.ts` — confirm the shapes in "Current state" still match (drift). Read the three consolidation sources and `packages/core/schemas/team-orchestrator/manifests/v1/README.md`.

**Verify**: the export list matches; you can name the three input-resolution precedence rules of `runAgentHandler`.

### Step 2: Write `docs/sdk/agent-developer-kit.md` from the real API

Every type/function reference must match `agent.ts`. Include at least:
- A minimal end-to-end example: a `plugin.yaml` + `research.agent.yaml` with an input contract, a handler using `runAgentHandler` + `createAgentRunOutput`, reading from `task.inputs`, emitting one artifact.
- A table of all `AgentInputFieldType` values and how each is validated (port from `validateInputValue`, `agent.ts:232-256`).
- The error model: when `AgentSdkValidationError` is thrown and the `issues[]` shape.

**Code blocks must be accurate enough to compile against the exported types.** Verify by building the package (Step 4) and, optionally, type-checking a copy of the example.

**Verify**: `grep -c "runAgentHandler\|createAgentRunOutput\|AgentInputContract" docs/sdk/agent-developer-kit.md` ≥ 3; no reference to a symbol absent from the export list.

### Step 3: Fill `docs/sdk/README.md` and reduce `packages/pdk/README.md`

Fill the PDK half of the SDK landing; keep the plan-032 API pointer. Reduce the package README to a pointer (retain install + the capability list; replace the long-form guide body with a link to the canonical guide).

**Verify**: `grep -q "docs/sdk/agent-developer-kit.md" packages/pdk/README.md` (relative path correct from `packages/pdk/`).

### Step 4: Consolidate and validate

Repoint inbound links to `07-pdk-guide.md` / `10-copy-sample-agent.md` / `capability-pack-authoring.md` to the new guide, then `git rm` (or redirect) per Scope. Build the package to sanity-check examples.

**Verify**:
- `npm --workspace @athena/pdk run build` → exit 0.
- `git add -A && npm run check:docs` → "No broken links."
- `test ! -e packages/core/docs/user/07-pdk-guide.md` → exit 0.

## Test plan

- `npm --workspace @athena/pdk run build` and `npm --workspace @athena/pdk run test` pass (the guide's API references are consistent with a compiling package).
- `npm run check:docs` passes with new files staged.
- The guide references only symbols in `packages/pdk/src/index.ts`'s export list (no invented APIs).
- `packages/pdk/README.md` links to the canonical guide; the two deleted user pages are gone and `04-api-server.md`/`06-api-examples.md` remain.

## Done criteria

ALL must hold:

- [ ] `docs/sdk/agent-developer-kit.md` exists (audience Engineer/SDK), documents the real `@athena/pdk` API with a compiling worked example, and folds in capability-pack authoring.
- [ ] Every API symbol referenced appears in `packages/pdk/src/index.ts` exports (no invented surface).
- [ ] `docs/sdk/README.md` PDK section filled; `packages/pdk/README.md` reduced to a pointer linking the canonical guide.
- [ ] `packages/core/docs/user/07-pdk-guide.md` and `10-copy-sample-agent.md` deleted; `capability-pack-authoring.md` folded then deleted-or-redirected; inbound links repointed.
- [ ] `04-api-server.md` and `06-api-examples.md` untouched (plan 032).
- [ ] `npm --workspace @athena/pdk run build` exits 0; `npm run check:docs` → "No broken links." (staged).
- [ ] `git status` shows only in-scope files; no `packages/pdk/src/*` code changed.
- [ ] `plans/README.md` status row updated.

## STOP conditions

Stop and report back (do not improvise) if:

- `packages/pdk/src/index.ts`/`agent.ts` no longer match the "Current state" excerpts (the API drifted — document the real API, and report the delta).
- A consolidation source documents PDK behavior that contradicts the code (e.g. a field or function that no longer exists) — document the code, flag the contradiction; do not propagate stale docs.
- The worked example will not build against the exported types — fix the example to match the API; if the API itself blocks a reasonable example, STOP and report (do not edit `src/`).
- Deleting `capability-pack-authoring.md` would orphan inbound contributor links you cannot cheaply repoint — redirect instead.

## Maintenance notes

- This guide is tightly coupled to `packages/pdk/src/agent.ts`. A reviewer should diff any future `agent.ts` change against this guide; consider a follow-up to generate the type table from the source.
- The package is named `@athena/pdk` while the product concept is "Agent Developer Kit" — the guide uses the product name in prose and the package name in code/install lines, per `docs/conventions.md`.
- Plan 032 owns the HTTP side; this guide links to it for "how a built agent gets triggered as a run." Keep that one cross-link accurate.
