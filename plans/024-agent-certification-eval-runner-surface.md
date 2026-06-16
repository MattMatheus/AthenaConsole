# Plan 024: Design the agent-certification eval-runner product surface (ADR spike)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **This is a design + spike plan.** The deliverable is a design ADR plus a
> code-grounded inventory. You will NOT add an eval-runner service, an API
> route, a console surface, schemas, or any production code. The only files you
> create/modify are Markdown. You MAY run read-only `grep`/`ls` for the
> inventory.
>
> **Drift check (run first)**:
> `git diff --stat 0bd2fc8..HEAD -- packages/core/src/control-plane/services/agent-catalog.ts packages/core/src/control-plane/app-state/domain-repositories/evals.ts packages/core/tests/control-plane.software-team-golden-evals.test.ts packages/core/src/api/routes/route-registration.ts apps/console/src/features/agent-catalog`
> If any of those changed since this plan was written, compare the "Current
> state" excerpts against live code before proceeding; on a mismatch, STOP.

## Status

- **Priority**: P1
- **Effort**: S (design only) — the implementation it scopes is M
- **Risk**: LOW (design only)
- **Depends on**: none (independent of the enterprise arc; plans 025/026/027)
- **Category**: direction
- **Planned at**: commit `0bd2fc8`, 2026-06-13

## Why this matters

The product already has a complete agent **certification** mechanism wired
end-to-end on the *read/display* side — but it can never be satisfied at runtime
because **nothing produces eval runs**. The trust ladder's top rung
(`certified`) is structurally unreachable.

Concretely, the full eval→certification loop already runs successfully **inside a
unit test**, against a throwaway temp database:
`packages/core/tests/control-plane.software-team-golden-evals.test.ts` loads the
bundled golden fixtures, replays them through the deterministic
`software-team-runner.mjs`, compares output to the expected artifact, and writes
`eval_suites` / `eval_runs` / `eval_results` rows via `appState.evals.*`. That is
exactly the data `evaluateAgentCertification` reads to certify an agent. But in a
**running product instance**, no code path ever calls `appState.evals.createRun`
/ `createResult`, so those tables are always empty, and any first-party agent that
declares `maturity: certified` is permanently downgraded to `blocked` / `preview`.

Today this is **latent, not biting**: all bundled packs declare
`preview`/`experimental` maturity, so no agent currently *requests* certification.
But as first-party capability packs mature (the documented direction —
`docs/product/roadmap/future-horizon.md` "useful out of the box, extensible by
example"), "which agents are trustworthy/certified" becomes a real operator
question, and the answer surface is already half-built and inert.

This plan designs the missing producer: a product **eval runner** that records
eval runs/results into app-state, plus the API and console wiring that turns the
existing certification display into a live trust surface. It makes a product call
(author/PDK-facing quality gate vs. operator-facing trust surface; what triggers a
run) and records it as an ADR. It does **not** build the runner.

## Current state

Read these to confirm — do NOT modify any of them in this plan:

- **The certification consumer (read side, already built)** —
  `packages/core/src/control-plane/services/agent-catalog.ts:243-304`,
  `evaluateAgentCertification(...)`. It is `required` only for a first-party
  plugin whose pack declares `maturity: "certified"`
  (`agent-catalog.ts:250-252`). It returns `status: "certified"` **only** when
  `findPassingCertificationRun(appState, agent)` (`agent-catalog.ts:268`, defined
  ~`:337`) finds a passing eval run; otherwise it returns `status: "blocked"`,
  `effectiveMaturity: "preview"` (`:291-303`). `resolveAgentLifecycleStatus`
  (`:306`) then downgrades a `certified`-lifecycle agent to `approved` unless
  certification actually passed.

- **The eval repository (write methods exist, no product caller)** —
  `packages/core/src/control-plane/app-state/domain-repositories/evals.ts`:
  `createSuite` (`:262`), `createRun` (`:317`), `createResult` (`:233` insert /
  used ~`:72` in the test), `updateRun` (`:381`), plus `listRuns`/`listResults`.
  The ONLY caller of `createRun`/`createResult` is the test below — confirm with:
  `grep -rn "\.evals\.\(createRun\|createResult\|createSuite\)" packages/core/src`
  (expect: no `src/` hits — only the test under `packages/core/tests/` calls them).

- **The working loop, trapped in a test** —
  `packages/core/tests/control-plane.software-team-golden-evals.test.ts`
  (whole file). It does, per golden case:
  `appState.evals.createSuite(...)` → `createRun({... status: "running"})` →
  `runSoftwareTeamFixture` (spawns `bundled-plugins/software-team/scripts/software-team-runner.mjs <mode>` and compares `summary`/`markdown` to `expected`) →
  `createResult({status: "passed", score: 1, expectedArtifactUri, actualArtifactUri, ...})` →
  `updateRun({status: "completed"})`. This is the producer logic that needs to be
  promoted into a product service.

- **The eval contracts** —
  `packages/core/src/shared/contracts/evals.ts` (whole file): `EvalSuiteRecord`,
  `EvalRunRecord`, `EvalResultRecord`, and the status unions
  (`EvalRunStatus = "queued" | "running" | "completed" | "failed" | "cancelled"`,
  etc.). The data model is complete.

- **The golden fixtures (already shipped)** —
  `bundled-plugins/software-team/evals/golden/*.json` (3 files:
  `pr-diff-review.json`, `repo-summary.json`, `test-failure-triage.json`). Each
  has `id`, `mode`, `agentId`, `agentVersion`, `promptTemplateHash`, `inputs`,
  and `expected.{summary,markdown}`.

- **The console display (read side, already built)** —
  `apps/console/src/features/agent-catalog/types.ts:130-137`:
  ```ts
  certification: {
    status: "certified" | "blocked" | "not-required";
    // ...
    evalRunId?: string;
    evalResultIds: string[];
  };
  ```
  and `apps/console/src/features/agent-catalog/api.ts` (`parseCertification`,
  `:260`). The console already parses and can render certification — it just never
  shows `certified` because the backend never produces a passing run.

- **No eval API route** — `packages/core/src/api/routes/` has no `eval` route
  file, and `route-registration.ts`'s `ApiRouteFamily` union has no `"evals"`
  member. Confirm: `grep -rin "eval" packages/core/src/api/` returns only
  unrelated SSE-`durable-memory` matches.

- **Maturity is declared per pack** — `bundled-plugins/*/plugin.yaml` line 9
  (`maturity: ...`). Today: `software-team` = `preview`, `github`/`jira`/
  `connector-platform` = `experimental`. None declare `certified`, which is why
  the gap is currently latent.

ADR conventions: see any file in
`docs/product/architecture/decisions/` (e.g.
`0027-enterprise-multi-user-direction.md`) for structure. ADRs open with
`<!-- AUDIENCE: Internal/Technical -->`, then `# ADR NNNN: Title`, `## Status`,
`## Context`, `## Decision`, `## Consequences`. **The next free ADR number is
0030** (0028 and 0029 already exist as `Proposed`).

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Drift check | `git diff --stat 0bd2fc8..HEAD -- packages/core/src/control-plane/services/agent-catalog.ts` | empty or understood |
| Confirm no product producer | `grep -rn "\.evals\.\(createRun\|createResult\)" packages/core/src` | no `src/` matches (only tests call these) |
| Confirm no eval route | `grep -rin "eval" packages/core/src/api/` | only durable-memory SSE matches, no eval route |
| List golden fixtures | `ls bundled-plugins/software-team/evals/golden/` | the 3 `.json` files |
| Doc-link check | `npm run check:docs` | exit 0 |

## Scope

**In scope** (the only files you create or modify):

- `docs/product/architecture/decisions/0030-agent-certification-and-eval-runner.md` (create)
- `docs/product/architecture/decisions/README.md` (add ONE index bullet, `- Proposed`)
- `plans/README.md` (status row)

**Out of scope** (do NOT touch):

- `agent-catalog.ts`, `evals.ts`, the golden test, any route file, any console
  file, `migrations.ts`, any `plugin.yaml` — **no code, no schema, no fixtures.**
  This is design only; the runner/API/console build is a follow-up epic.
- The bundled golden fixtures and `software-team-runner.mjs` — reference them;
  do not change them.
- The certification *evaluation* logic in `agent-catalog.ts` — the read side is
  correct as-is; this ADR designs the missing producer, not a redesign of the
  consumer.

## Git workflow

- Branch: `advisor/024-agent-certification-eval-runner-design`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Produce the certification-surface inventory

Run and capture (these become the ADR's "Affected Surfaces" section):

1. `grep -rn "\.evals\.\(createSuite\|createRun\|createResult\|updateRun\|listRuns\|listResults\)" packages/core`
   → shows the only producer today is the test; the repository methods that a
   runner service would call.
2. `grep -n "evaluateAgentCertification\|findPassingCertificationRun" packages/core/src/control-plane/services/agent-catalog.ts`
   → the consumer entry points the runner must satisfy.
3. `grep -rn "certification" apps/console/src/features/agent-catalog/`
   → the console parse/display points already present.
4. `ls bundled-plugins/*/evals/golden/ 2>/dev/null` and note which packs ship
   golden fixtures (today: only `software-team`).

**Verify**: you have a concrete list (file:line) of producer methods, consumer
entry points, console display points, and fixture-bearing packs.

### Step 2: Write the design ADR

Create
`docs/product/architecture/decisions/0030-agent-certification-and-eval-runner.md`
with structure matching existing ADRs. Required sections:

- `<!-- AUDIENCE: Internal/Technical -->` then
  `# ADR 0030: Agent Certification And Eval Runner`.
- `## Status` → `Proposed.`
- `## Context` — State precisely: the certification consumer
  (`agent-catalog.ts:243-304`) and console display
  (`agent-catalog/types.ts:130`) exist; the eval data model
  (`contracts/evals.ts`) and repository write methods
  (`domain-repositories/evals.ts`) exist; golden fixtures
  (`bundled-plugins/software-team/evals/golden/`) exist; the full loop already
  works in `control-plane.software-team-golden-evals.test.ts`. State the gap:
  **no product code calls `appState.evals.createRun/createResult`**, so
  `eval_runs`/`eval_results` are always empty in a live instance and certification
  can never reach `certified`. Note it is latent today (all packs `preview`/
  `experimental`) but on the path as packs mature.
- `## Decision` — Design these explicitly:
  1. **Product question — who is this for?** Decide and state: is certification
     an **author/PDK-facing quality gate** (run during pack authoring/publish), an
     **operator-facing trust surface** (operator triggers/views certification of
     installed packs), or both. Recommend a primary audience for v1 and justify.
  2. **Eval runner service.** Define a service (suggest
     `EvalRunnerService` under `control-plane/services/`) that, given a
     suite/pack, loads its golden fixtures, replays each through the agent's
     declared deterministic runner, compares to `expected`, and records
     `eval_runs`/`eval_results` via the existing repository — i.e. the test logic
     promoted into product code. Specify its inputs (suite id or pack id) and
     outputs (an `EvalRunRecord` set). Do NOT write the code; specify the shape.
  3. **Trigger model.** Choose the v1 trigger(s): manual (operator/admin clicks
     "run certification" / a CLI command), on pack install/index, or CI-only.
     Recommend one as v1 and explain why (suggest manual + CLI first: lowest risk,
     no scheduler coupling).
  4. **API surface.** Name the new route family (e.g. `"evals"`) to add to
     `ApiRouteFamily` in `route-registration.ts`, and the endpoints (e.g.
     `POST /evals/runs` to trigger, `GET /evals/suites`, `GET /evals/runs`,
     `GET /evals/runs/:id/results`). Endpoint list only — no handler code.
  5. **Console surface.** Decide whether certification gets its own surface or
     extends the existing agent-catalog certification block; specify what an
     operator sees (suite list, last run status, per-case pass/fail, links to
     expected/actual artifacts — the console already models `evalRunId` /
     `evalResultIds`).
  6. **Determinism boundary.** State that v1 certification covers only
     **deterministic, credential-free** golden runners (like
     `software-team-runner.mjs`); non-deterministic/provider-backed evals are a
     later concern and out of v1 scope. This keeps certification reproducible.
- `## Affected Surfaces` — Paste the Step 1 inventory as a table: file, kind
  (contract / repository / consumer / route / console / fixtures), and what
  changes (new vs. reused).
- `## Reused Machinery` — Explicitly list what this reuses rather than reinvents:
  the `evals` repository + `eval_*` tables, `contracts/evals.ts`, the golden
  fixtures + deterministic runners, the existing `evaluateAgentCertification`
  consumer, and the console certification parser/display.
- `## Consequences` — State that an implementation epic (suggest reserving
  `2026.47`) follows once accepted; that until then certification stays inert; and
  that first-party packs should not declare `maturity: certified` until the runner
  exists (otherwise they show `blocked`).
- `## Risks` — Call out: promoting test logic risks divergence between the
  certification test and the product runner (keep one shared implementation);
  golden fixtures must stay deterministic; an operator-triggered runner that
  shells out to pack runners must respect the existing runtime/sandbox safety
  model (reference ADR 0013 safety model).

### Step 3: Index and validate

Add ONE bullet to `docs/product/architecture/decisions/README.md` after the ADR
0029 line, matching the exact shape of the surrounding bullets (copy the ADR 0029
line and edit it): a markdown link whose text is "ADR 0030: Agent Certification
And Eval Runner", whose target is the filename
`0030-agent-certification-and-eval-runner.md` (relative to the decisions index),
followed by ` - Proposed`.

**Verify**: `npm run check:docs` → exit 0.

## Test plan

No code tests (design plan). Verification:

- The ADR names a v1 audience, an eval-runner service shape, a trigger model, a
  concrete API route family + endpoint list, a console surface decision, and the
  determinism boundary — each grounded in a `file:line` from Step 1.
- `npm run check:docs` passes.

## Done criteria

ALL must hold:

- [ ] `docs/product/architecture/decisions/0030-agent-certification-and-eval-runner.md` exists, Status `Proposed.`, with `## Decision`, `## Affected Surfaces`, `## Reused Machinery`, `## Consequences`.
- [ ] The `## Decision` section answers the audience question, defines an eval-runner service that records via `appState.evals.*`, picks a v1 trigger, lists a new API route family + endpoints, and decides the console surface — and references `agent-catalog.ts:243-304` and the golden test by name.
- [ ] `grep -c "0030" docs/product/architecture/decisions/README.md` ≥ 1.
- [ ] `git diff --name-only` shows ONLY the three in-scope files (no `packages/`, no `apps/`, no `bundled-plugins/`).
- [ ] `npm run check:docs` exits 0.
- [ ] `plans/README.md` status row updated.

## STOP conditions

Stop and report back if:

- The drift check shows an eval-runner service, an eval API route, or a console
  eval surface was already added since `0bd2fc8` (the producer may already
  exist — re-scope to what remains, or mark this plan redundant).
- `grep -rn "\.evals\.\(createRun\|createResult\)" packages/core/src` returns a
  hit under `src/` (a product producer now exists) — report it; the core premise
  of this plan is then false.
- `evaluateAgentCertification` no longer exists or no longer reads eval runs —
  the consumer was redesigned; report before designing a producer for it.
- You feel you must write the runner service, an API route, or console code to
  make the design concrete — that is implementation, which is out of scope;
  describe it in the ADR instead.

## Maintenance notes

- The single most important design constraint: the product eval runner and the
  certification test (`control-plane.software-team-golden-evals.test.ts`) should
  share ONE comparison/recording implementation, or they will drift and a green
  test will stop meaning a green product. The implementer should refactor the
  test to call the new service, not duplicate it.
- A reviewer should confirm the ADR keeps v1 scoped to deterministic,
  credential-free golden runners — provider-backed/non-deterministic evals change
  the reproducibility and cost story and must not be smuggled into v1.
- Deferred out of this plan: the `EvalRunnerService`, the `evals` API route, the
  console certification surface, and any change to pack `maturity` declarations.
  These belong to the follow-up implementation epic (suggested `2026.47`).
- This plan is independent of the enterprise arc (plans 025/026/027) and can be
  designed and implemented in any order relative to them.
</content>
</invoke>
