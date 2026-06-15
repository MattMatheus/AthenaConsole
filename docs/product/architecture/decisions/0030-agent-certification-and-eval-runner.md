<!-- AUDIENCE: Internal/Technical -->

# ADR 0030: Agent Certification And Eval Runner

## Status

Accepted.

## Context

Team Orchestrator already has the read side of agent certification, but not the
product producer that can make certification true in a running instance.

The certification consumer exists in
`packages/core/src/control-plane/services/agent-catalog.ts:243`: first-party packs
that declare `maturity: "certified"` are certified only when
`findPassingCertificationRun` finds a completed passing eval run. The console
already models and parses certification details in
`apps/console/src/features/agent-catalog/types.ts:130` and
`apps/console/src/features/agent-catalog/api.ts:281`.

The eval data model and repository are also present:
`packages/core/src/shared/contracts/evals.ts` defines eval suites, runs, results,
and status unions, while
`packages/core/src/control-plane/app-state/domain-repositories/evals.ts:262`
through `:434` provides `createSuite`, `createRun`, `listRuns`, `updateRun`,
`createResult`, and `listResults`.

Golden fixtures are shipped at `bundled-plugins/software-team/evals/golden/`, and
the full loop already works inside
`packages/core/tests/control-plane.software-team-golden-evals.test.ts:34`: the
test creates a suite, records running eval runs, replays each fixture through the
deterministic `software-team-runner.mjs`, writes passing results, completes the
runs, and proves that the certification data can be queried back.

The gap is that no product code calls `appState.evals.createRun` or
`appState.evals.createResult`. In a live instance, `eval_runs` and `eval_results`
stay empty, so a first-party agent that declares certified maturity can never
reach `certified`; it is downgraded to blocked or preview. That is latent today
because bundled packs currently declare preview or experimental maturity, but it
becomes a trust-surface issue as first-party capability packs mature.

## Decision

Team Orchestrator should add an eval runner product surface that records
certification runs into the existing app-state eval tables.

For v1, certification is primarily an operator-facing trust surface. Operators
need to know whether an installed first-party pack has passed the shipped,
credential-free golden certification suite in this instance before they treat it
as certified. The same machinery should later support author/PDK and CI quality
gates, but v1 should prove the installed-pack trust path first because the
console already exposes certification state and the missing producer makes that
state inert.

### Eval Runner Service

Add an `EvalRunnerService` under `packages/core/src/control-plane/services/`.
Given a pack id or suite id, it should:

1. Resolve the pack and its eval suite metadata.
2. Load deterministic golden fixtures from the pack.
3. Replay each case through the pack's declared deterministic runner.
4. Compare output to the fixture's expected artifact.
5. Record `eval_runs` and `eval_results` through the existing eval repository.
6. Return the resulting `EvalRunRecord` set and result ids.

The service should promote the logic currently proven in
`control-plane.software-team-golden-evals.test.ts` into shared product code so
the test and product runner cannot drift into separate implementations.

### Trigger Model

V1 should support manual triggers through an admin/operator console action and a
CLI command. Manual triggering is the lowest-risk path because it avoids scheduler
coupling, avoids surprise shell-outs during pack install, and gives the operator
an explicit moment to inspect deterministic-runner safety. Automatic runs on pack
install or index refresh can follow once the runner is proven.

### API Surface

Add an `evals` route family to `ApiRouteFamily`.

Recommended endpoints:

| Endpoint | Purpose |
| --- | --- |
| `GET /evals/suites` | List available eval suites and fixture-bearing packs. |
| `POST /evals/runs` | Trigger a certification run for a suite or pack. |
| `GET /evals/runs` | List eval runs by suite, pack, agent, status, or time window. |
| `GET /evals/runs/:id` | Fetch one eval run and summary metadata. |
| `GET /evals/runs/:id/results` | Fetch per-case pass/fail results and artifact links. |

### Console Surface

Extend the existing agent-catalog certification block for v1 instead of creating
a separate top-level product area. The agent detail surface should show:

- last certification run status and timestamp;
- per-case pass/fail results;
- the suite and fixture pack used;
- expected and actual artifact links when present;
- an admin action to run certification manually.

Operations can later add fleet-level eval history, but the first operator
question is attached to the agent: "can I trust this installed agent?"

### Determinism Boundary

V1 certification covers only deterministic, credential-free golden runners like
`software-team-runner.mjs`. Provider-backed, networked, or non-deterministic evals
are out of scope for v1 because they make certification harder to reproduce and
harder to explain.

## Affected Surfaces

| File | Kind | Change |
| --- | --- | --- |
| `packages/core/src/shared/contracts/evals.ts` | contract | Reuse existing suite, run, result, and status contracts. |
| `packages/core/src/control-plane/app-state/domain-repositories/evals.ts:262` | repository | Reuse `createSuite`, `createRun`, `listRuns`, `updateRun`, `createResult`, and `listResults`. |
| `packages/core/tests/control-plane.software-team-golden-evals.test.ts:34` | test producer | Reuse the proven golden-fixture loop as the implementation model. |
| `packages/core/src/control-plane/services/agent-catalog.ts:243` | consumer | Reuse `evaluateAgentCertification`; no certification-read redesign. |
| `packages/core/src/control-plane/services/agent-catalog.ts:334` | consumer | Reuse `findPassingCertificationRun` as the data contract the runner must satisfy. |
| `packages/core/src/api/routes/route-registration.ts:6` | route | Add the new `evals` route family and register eval endpoints. |
| `apps/console/src/features/agent-catalog/types.ts:130` | console | Reuse the existing certification shape, including `evalRunId` and `evalResultIds`. |
| `apps/console/src/features/agent-catalog/api.ts:281` | console | Reuse `parseCertification` and extend display/actions around it. |
| `bundled-plugins/software-team/evals/golden/` | fixtures | Reuse the three bundled deterministic golden cases. |

Inventory check: source product code has no `appState.evals.createRun` or
`createResult` callers today; only tests create runs/results. Generated
`packages/core/dist` output mirrors that source/test split and is not a product
producer.

## Reused Machinery

This design reuses:

- the `evals` repository and existing `eval_*` app-state tables;
- `packages/core/src/shared/contracts/evals.ts`;
- bundled golden fixtures and deterministic pack runners;
- `evaluateAgentCertification` and `findPassingCertificationRun`;
- the console certification parser and agent-catalog display model.

## Consequences

An implementation epic should follow once this ADR is accepted; reserve 2026.47
for the eval-runner/API/console build. Until that work lands, certification
remains inert in live instances. First-party packs should not declare
`maturity: certified` before the runner exists, because they will display as
blocked or preview.

## Risks

- Promoting test logic into product code can create divergence if the test keeps
  a separate implementation; keep one shared runner path.
- Golden fixtures must remain deterministic and credential-free, or
  certification will stop being reproducible.
- Operator-triggered runners that shell out to pack code must respect the runtime
  and sandbox safety model from ADR 0013.
