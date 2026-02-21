# Next Agent Seed Prompt

You are beginning the next development cycle in ProjectAthena.

## Read First

1. `internal-docs/developer/00-onboarding.md`
2. `internal-docs/backlog/active/README.md`
3. `internal-docs/archive/handoff.md`
4. `TODO.md`

## Current Context

Milestone 5 story `2026.05.05` is complete with first-pass Azure Application Insights observability integration.

Key Recent Deliverables:
- Added optional Node.js Application Insights runtime integration:
  - `src/observability/application-insights.ts`
  - request/dependency telemetry support with W3C correlation headers
  - custom events for API requests, AI latency, and Redis lock acquisition timing
- Added custom-dimension wiring for filtering with `runId`, `personaId`, and `tenantId` where available.
- Added App Insights config/env support in `src/shared/config.ts` and `.env.example`:
  - `ATHENA_APPINSIGHTS_ENABLED`
  - `ATHENA_APPINSIGHTS_CONNECTION_STRING`
  - `ATHENA_APPINSIGHTS_SAMPLING_PERCENTAGE`
  - `ATHENA_APPINSIGHTS_CLOUD_ROLE_NAME`
  - `ATHENA_APPINSIGHTS_TRACK_DEPENDENCIES`
- Added Terraform observability resources:
  - module `infrastructure/terraform/modules/application-insights/`
  - dev wiring in `infrastructure/terraform/environments/dev/`
  - workbook queries for request/failure, AI latency p95, Redis lock timing
  - portal dashboard scaffold for operator entry point
- Updated deploy workflow:
  - control-plane deployment sets App Insights env vars when secret `ATHENA_APPINSIGHTS_CONNECTION_STRING_DEV` is present.

Cloud/domain context:
- DNS ownership confirmed.
- DNS provider: Cloudflare.
- UI domain target: `athena.teamorchestrator.com`.
- API ingress host target: `api.athena.teamorchestrator.com`.

Validation notes:
- `terraform fmt -recursive infrastructure/terraform` passed.
- `terraform -chdir=infrastructure/terraform/environments/dev init -input=false` passed.
- `terraform -chdir=infrastructure/terraform/environments/dev validate` passed.
- Workflow YAML parse checks passed.
- `./node_modules/.bin/vitest run tests/config.test.ts tests/providers.openai.test.ts tests/observability.application-insights.test.ts` passed.
- `./node_modules/.bin/tsc -b packages/console/tsconfig.json` passed.
- `./node_modules/.bin/tsc -p tsconfig.json` remains blocked by pre-existing `src/shared/config.ts` `allowedOrigins` exact-optional typing mismatch.

## Task: `2026.05.06` Cost Governance and Quotas

Implement cost governance and quota controls for startup-credit protection.

Reference: `internal-docs/backlog/active/2026.05.06-cost-governance-and-quotas.md`

Target outcomes:
- Add Azure Budget + threshold alerts (50%, 75%, 90%) for resource group spend.
- Apply Kubernetes `ResourceQuota` and `LimitRange` controls for execution namespaces.
- Add cleanup policy/automation for orphaned K8s Jobs and aged PVCs.
- Add cost-visualization hooks in Athena admin surfaces using Azure billing APIs (or documented scaffolding if API access is blocked).

## Constraints

- Keep changes incremental and reviewable; preserve existing runtime/API behavior.
- Prefer additive infrastructure changes and reusable module layout.
- Maintain least-privilege access and startup-credit cost guardrails.

## Schema Workflow Reminder

If shared DTOs or API component contracts are touched:

1. `npm run generate:schemas`
2. `npm run check:schemas`

## Validation Required Before Handoff

1. Validate Terraform/Kubernetes/cost-policy configuration syntax and references.
2. Execute impacted build/test commands locally (or document blockers clearly).
3. Verify local development behavior remains functional after quota/cost changes.

## Mandatory Handoff Operation (Every Work Cycle)

Before ending the cycle, always perform all of the following:

1. Update `internal-docs/archive/handoff.md` with a new top snapshot for the completed slice.
2. Move completed story files from `internal-docs/backlog/active/` to `internal-docs/backlog/completed/`.
3. Update `internal-docs/backlog/active/README.md` to reflect the next active story ordering.
4. Refresh `internal-docs/prompts/active/next-agent-seed-prompt.md` to point at the next story and include current context.
