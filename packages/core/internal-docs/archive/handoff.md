## Release 2026.05 Story Update (2026-02-21, Azure Application Insights Observability)

Implemented `2026.05.05-azure-application-insights-observability.md` with additive Application Insights runtime integration, request/dependency correlation support, custom dimensions for run/persona/tenant filtering, and Azure monitor workbook/dashboard infrastructure scaffolding.

### What Was Implemented

- Added Application Insights runtime integration in control-plane API/runtime paths:
  - `src/observability/application-insights.ts`
  - `src/api/server.ts`
  - `src/api/routes/run-routes.ts`
  - `src/api/routes/persona-routes.ts`
  - `src/control-plane/services/run-service.ts`
  - `src/control-plane/distributed-lock/redis.ts`
- Runtime behavior added:
  - Optional SDK initialization via config (`ATHENA_APPINSIGHTS_*`).
  - W3C correlation support via `traceparent`/`tracestate` headers.
  - Request-level custom event `athena.api.request` with dimensions including `runId`, `personaId`, `tenantId` when present.
  - AI model latency event `athena.ai.model.response` with latency measurement for P95 analysis.
  - Redis lock acquisition timing event `athena.redis.lock.acquire` with success/failure dimension.
- Added config/env support:
  - `src/shared/config.ts`
  - `.env.example`
  - New keys:
    - `ATHENA_APPINSIGHTS_ENABLED`
    - `ATHENA_APPINSIGHTS_CONNECTION_STRING`
    - `ATHENA_APPINSIGHTS_SAMPLING_PERCENTAGE`
    - `ATHENA_APPINSIGHTS_CLOUD_ROLE_NAME`
    - `ATHENA_APPINSIGHTS_TRACK_DEPENDENCIES`
- Added dependency:
  - `applicationinsights` in `package.json` and `package-lock.json`.
- Added Terraform observability infrastructure:
  - `infrastructure/terraform/modules/application-insights/{main,variables,outputs}.tf`
  - `infrastructure/terraform/environments/dev/{main,variables,outputs,terraform.tfvars.example,README}.tf`
  - Added `azurerm_application_insights` component with startup-credit guardrails (sampling + daily cap).
  - Added `azurerm_application_insights_workbook` with KQL panels for:
    - request volume/failure
    - AI model latency p95
    - Redis lock timing/failures
  - Added `azurerm_portal_dashboard` scaffold referencing the workbook.
- Updated deployment workflow/docs:
  - `.github/workflows/deploy-control-plane.yml`
  - `internal-docs/developer/07-github-actions-cicd.md`
  - Workflow now enables App Insights env vars when `ATHENA_APPINSIGHTS_CONNECTION_STRING_DEV` secret is present.
  - Control-plane deployment defaults include App Insights disabled with safe baseline values in `infrastructure/kubernetes/control-plane/deployment.yaml`.
- Added tests:
  - `tests/observability.application-insights.test.ts`
  - `tests/config.test.ts` updates for App Insights parsing/defaults.

### Validation Run

- Infra/workflow syntax:
  - `terraform fmt -recursive infrastructure/terraform` (pass)
  - `terraform -chdir=infrastructure/terraform/environments/dev init -input=false` (pass)
  - `terraform -chdir=infrastructure/terraform/environments/dev validate` (pass)
  - `ruby -e 'require "yaml"; Dir[".github/workflows/*.yml"].each { |f| YAML.load_file(f) }'` (pass)
- Impacted tests/build checks:
  - `./node_modules/.bin/vitest run tests/config.test.ts tests/providers.openai.test.ts tests/observability.application-insights.test.ts` (pass)
  - `./node_modules/.bin/tsc -b packages/console/tsconfig.json` (pass)
  - `./node_modules/.bin/tsc -p tsconfig.json` (fails; pre-existing exact-optional `allowedOrigins` typing mismatch in `src/shared/config.ts`)

### Notes for Next Agent

- Story `2026.05.05` has been moved to completed.
- Active backlog now starts at `2026.05.06-cost-governance-and-quotas.md`.
- To enable observability in cloud deployment:
  - Store Terraform output `application_insights_connection_string` into repo secret `ATHENA_APPINSIGHTS_CONNECTION_STRING_DEV`.
- Cloudflare context remains:
  - UI domain: `athena.teamorchestrator.com`
  - API domain: `api.athena.teamorchestrator.com`

## Release 2026.05 Story Update (2026-02-21, Custom Domain and Networking)

Implemented `2026.05.04-custom-domain-and-networking.md` with additive Static Web App custom-domain infrastructure, Cloudflare-oriented DNS guidance, ingress-controller bootstrap, API ingress routing, and production CORS origin hardening hooks.

### What Was Implemented

- Added Static Web App custom-domain support in Terraform:
  - `infrastructure/terraform/modules/static-web-app/{variables,main,outputs}.tf`
  - Added optional `azurerm_static_web_app_custom_domain` binding.
  - Added outputs for configured custom domain and validation token.
- Wired environment defaults for target domain:
  - `infrastructure/terraform/environments/dev/variables.tf`
  - `infrastructure/terraform/environments/dev/main.tf`
  - `infrastructure/terraform/environments/dev/outputs.tf`
  - Defaults now target `athena.teamorchestrator.com` using `cname-delegation`.
- Added Cloudflare-oriented DNS/operator docs:
  - `infrastructure/terraform/environments/dev/README.md`
  - `infrastructure/terraform/environments/dev/terraform.tfvars.example`
- Added AKS ingress resources for control plane:
  - `infrastructure/kubernetes/control-plane/ingress.yaml`
  - Host configured as `api.athena.teamorchestrator.com`.
- Added ingress-controller bootstrap guidance:
  - `infrastructure/kubernetes/ingress-nginx/README.md`
- Updated CI/CD deployment workflow:
  - `.github/workflows/deploy-control-plane.yml`
  - Bootstraps `ingress-nginx` in AKS.
  - Applies control-plane ingress manifest.
  - Sets `ATHENA_ALLOWED_ORIGINS` from repo var `CONTROL_PLANE_ALLOWED_ORIGINS` (fallback `https://athena.teamorchestrator.com`).
- Updated control-plane manifest default CORS origin:
  - `infrastructure/kubernetes/control-plane/deployment.yaml`
  - Default `ATHENA_ALLOWED_ORIGINS` changed from `*` to `https://athena.teamorchestrator.com`.
- Updated CI/CD operations documentation:
  - `internal-docs/developer/07-github-actions-cicd.md`
  - Added ingress/controller behavior and new `CONTROL_PLANE_ALLOWED_ORIGINS` variable documentation.

### Validation Run

- Infra and workflow syntax:
  - `terraform fmt -recursive infrastructure/terraform` (pass)
  - `terraform -chdir=infrastructure/terraform/environments/dev validate` (pass)
  - `ruby -e 'require "yaml"; Dir[".github/workflows/*.yml"].each { |f| YAML.load_file(f) }'` (pass)
- Impacted tests/build checks:
  - `./node_modules/.bin/vitest run tests/config.test.ts tests/providers.openai.test.ts` (pass)
  - `./node_modules/.bin/tsc -b packages/console/tsconfig.json` (pass)
  - `./node_modules/.bin/tsc -p tsconfig.json` (fails; pre-existing exact-optional `allowedOrigins` typing mismatch in `src/shared/config.ts`)

### Notes for Next Agent

- Story `2026.05.04` has been moved to completed.
- Active backlog now starts at `2026.05.05-azure-application-insights-observability.md`.
- Domain ownership is confirmed and DNS is hosted in Cloudflare.
- For rollout completion:
  - Ensure Cloudflare `CNAME athena -> <static_web_app_default_hostname>` is DNS-only until validation completes.
  - Ensure `api.athena.teamorchestrator.com` points to the ingress external endpoint.

## Release 2026.05 Story Update (2026-02-21, Azure Workload Identity Integration)

Implemented `2026.05.03-azure-workload-identity-integration.md` with additive Azure Workload Identity infrastructure, managed-identity Kubernetes mapping, and `DefaultAzureCredential`-based runtime auth paths for Azure OpenAI/Key Vault fallback.

### What Was Implemented

- Added Azure auth runtime wiring for OpenAI provider:
  - `src/providers/azure-auth.ts`
  - `src/providers/openai.ts`
  - `src/providers/index.ts`
  - Introduced auth precedence:
    - explicit `ATHENA_OPENAI_API_KEY`
    - optional Key Vault secret lookup via `DefaultAzureCredential`
    - optional Entra access token via `DefaultAzureCredential`
- Added config/env support for workload identity and Azure auth options:
  - `src/shared/config.ts`
  - `.env.example`
  - New toggles/inputs:
    - `ATHENA_AZURE_AUTH_ENABLED`
    - `ATHENA_AZURE_OPENAI_USE_ENTRA_ID`
    - `ATHENA_AZURE_OPENAI_AUDIENCE`
    - `ATHENA_AZURE_MANAGED_IDENTITY_CLIENT_ID`
    - `ATHENA_AZURE_KEY_VAULT_URL`
    - `ATHENA_AZURE_OPENAI_KEY_SECRET_NAME`
- Added infrastructure changes for workload identity federation:
  - `infrastructure/terraform/modules/aks/main.tf`
  - `infrastructure/terraform/modules/aks/outputs.tf`
  - `infrastructure/terraform/environments/dev/{variables,main,outputs,terraform.tfvars.example,README}.tf`
  - Enabled `oidc_issuer_enabled` and `workload_identity_enabled` on AKS.
  - Added user-assigned managed identity + federated identity credential mapped to `system:serviceaccount:athena:athena-control-plane`.
  - Added optional least-privilege role assignment inputs for OpenAI (`Cognitive Services OpenAI User`) and Key Vault (`Key Vault Secrets User`).
- Added Kubernetes workload identity scaffolding:
  - `infrastructure/kubernetes/control-plane/serviceaccount.yaml`
  - `infrastructure/kubernetes/control-plane/deployment.yaml`
  - Service account annotation placeholder for managed identity client ID.
  - Deployment pod label `azure.workload.identity/use: "true"` and `serviceAccountName: athena-control-plane`.
- Updated CI/CD workflow and docs for workload identity client-id propagation:
  - `.github/workflows/deploy-control-plane.yml`
  - `internal-docs/developer/07-github-actions-cicd.md`
  - Added required repo variable `AZURE_CONTROL_PLANE_WORKLOAD_CLIENT_ID`.
  - Workflow now annotates service account and sets `AZURE_CLIENT_ID` env on deployment.
- Added validation coverage:
  - `tests/config.test.ts`
  - `tests/providers.openai.test.ts`
- Added dependency:
  - `@azure/identity` in `package.json` and `package-lock.json`.

### Validation Run

- Terraform checks:
  - `terraform fmt -recursive infrastructure/terraform` (pass)
  - `terraform -chdir=infrastructure/terraform/environments/dev init -input=false` (pass)
  - `terraform -chdir=infrastructure/terraform/environments/dev validate` (pass)
- Runtime/config/provider checks:
  - `./node_modules/.bin/vitest run tests/config.test.ts tests/providers.openai.test.ts` (pass)
- Build/type checks:
  - `./node_modules/.bin/tsc -b packages/console/tsconfig.json` (pass)
  - `./node_modules/.bin/tsc -p tsconfig.json` (fails with pre-existing `src/shared/config.ts` exact-optional `allowedOrigins` mismatch; no new typecheck blocker introduced by this cycle)

### Notes for Next Agent

- Story `2026.05.03` has been moved to completed.
- Active backlog now starts at `2026.05.04-custom-domain-and-networking.md`.
- Before production rollout, ensure these values are set:
  - Terraform optional inputs (when available): `openai_account_resource_id`, `key_vault_resource_id`
  - GitHub repository variable: `AZURE_CONTROL_PLANE_WORKLOAD_CLIENT_ID`
  - Kubernetes service account annotation client ID matches Terraform output `control_plane_workload_identity_client_id`.

## Release 2026.05 Story Update (2026-02-21, GitHub Actions CI/CD Pipeline)

Implemented `2026.05.02-github-actions-cicd-pipeline.md` by adding secure-by-default GitHub Actions workflows for control-plane and console build/deploy automation against Milestone 5 Azure targets.

### What Was Implemented

- Added new workflow definitions:
  - `.github/workflows/deploy-control-plane.yml`
    - PR/main path-scoped triggers for backend-related changes.
    - Validation stages: schema check, core typecheck, tests, core build, Docker image build.
    - Main-branch deploy stage: OIDC Azure login, ACR push, AKS rollout, and in-cluster smoke test against `/api/v1/admin/health`.
  - `.github/workflows/deploy-console.yml`
    - PR/main path-scoped triggers for console-related changes.
    - Validation stages: console typecheck and build.
    - Main-branch deploy stage to Azure Static Web Apps.
- Added deployment skeleton artifacts:
  - `infrastructure/docker/control-plane.Dockerfile`
  - `infrastructure/kubernetes/control-plane/namespace.yaml`
  - `infrastructure/kubernetes/control-plane/deployment.yaml`
  - `infrastructure/kubernetes/control-plane/service.yaml`
- Added CI/CD operations documentation:
  - `internal-docs/developer/07-github-actions-cicd.md`
  - Documents required repository secrets/variables, branch protection baseline, Azure auth assumptions, and startup-credit cost guardrails.

### Validation Run

- Workflow syntax/action checks:
  - `ruby -e 'require "yaml"; Dir[".github/workflows/*.yml"].each { |f| YAML.load_file(f) }'` (pass)
  - `rg -n "^\s*uses:\s+" .github/workflows/*.yml` (pass; action references enumerated)
- Build/test checks (non-`npm` local equivalents due repo escalation rule for local `npm` commands):
  - `./node_modules/.bin/tsc -p tsconfig.json` (fails; pre-existing `src/shared/config.ts` exact-optional typing mismatch on `allowedOrigins`)
  - `./node_modules/.bin/tsc -b packages/console/tsconfig.json` (pass)
  - `./node_modules/.bin/vitest run tests/control-plane.api-contracts.test.ts` (pass)
  - `./node_modules/.bin/vite build` (run in `packages/console`) (pass)

### Notes for Next Agent

- Story `2026.05.02` has been moved to completed.
- Active backlog now starts at `2026.05.03-azure-workload-identity-integration.md`.
- CI deploy jobs assume these repo-level values are configured before first deploy:
  - Secrets: `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID`, `AZURE_STATIC_WEB_APPS_API_TOKEN_DEV`
  - Variables: `AZURE_ACR_NAME`, `AZURE_ACR_LOGIN_SERVER`, `AZURE_RESOURCE_GROUP`, `AZURE_AKS_NAME`
- Control-plane Kubernetes manifest is intentionally bootstrap/minimal and currently sets `ATHENA_AUTH_ENABLED=false`; hardening is expected in upcoming Milestone 5 identity/networking stories.

## Release 2026.05 Story Update (2026-02-21, Terraform Infrastructure Foundation)

Implemented `2026.05.01-terraform-infrastructure-foundation.md` by adding modular Azure Terraform foundations and a dev environment composition for Milestone 5 cloud rollout.

### What Was Implemented

- Added reusable Terraform modules in:
  - `infrastructure/terraform/modules/aks`
  - `infrastructure/terraform/modules/acr`
  - `infrastructure/terraform/modules/redis`
  - `infrastructure/terraform/modules/static-web-app`
- Added full dev environment composition in:
  - `infrastructure/terraform/environments/dev/providers.tf`
  - `infrastructure/terraform/environments/dev/variables.tf`
  - `infrastructure/terraform/environments/dev/main.tf`
  - `infrastructure/terraform/environments/dev/outputs.tf`
  - `infrastructure/terraform/environments/dev/terraform.tfvars.example`
  - `infrastructure/terraform/environments/dev/README.md`
- Provisioning layout now includes:
  - Resource Group + VNet.
  - AKS subnet and private-endpoints subnet.
  - AKS cluster configured on `Standard_B2s` default node pool.
  - ACR Basic tier, Redis Basic C0, and Static Web App Free tier.
  - Redis private endpoint plus private DNS zone/link (`privatelink.redis.cache.windows.net`) to support AKS-to-Redis private connectivity.
  - `AcrPull` role assignment for AKS kubelet identity to ACR.

### Validation Run

- Terraform quality checks:
  - `terraform fmt -recursive infrastructure/terraform` (pass)
  - `terraform -chdir=infrastructure/terraform/environments/dev init -input=false` (pass)
  - `terraform -chdir=infrastructure/terraform/environments/dev validate` (pass)
- Terraform plan:
  - `terraform -chdir=infrastructure/terraform/environments/dev plan -input=false -refresh=false`
  - Result: blocked by local Azure CLI authentication expiry (`AADSTS700082` refresh token inactive since 2025-08-26; failure surfaced on 2026-02-21).
  - Required local remediation before successful plan:
    - `az logout`
    - `az login --tenant \"cb027cc0-f24c-44fa-8fd5-c2159ccc5efb\" --scope \"https://graph.microsoft.com/.default\"`

### Notes for Next Agent

- Story `2026.05.01` has been moved to completed.
- Active backlog now starts at `2026.05.02-github-actions-cicd-pipeline.md`.
- Terraform baseline is intentionally cost-guarded for startup credits; keep default SKUs aligned unless explicitly changing capacity/cost posture.

## Release BUG-2026.001 Story Update (2026-02-21, Invalid Run Error Message Assertion Mismatch)

Implemented `BUG-2026.001-api-server-invalid-run-error-message-assertion-mismatch.md` by aligning the API server invalid-run assertion with the existing parser/service contract message.

### What Was Implemented

- Updated invalid-run API assertion in:
  - `tests/api.server.test.ts`
  - Changed assertion from brittle field-path substring (`runs.create.input`) to stable semantic wording (`requires either input or directiveId`), matching runtime/parser behavior.
- Completed backlog transition for Milestone 4 closure:
  - Moved `internal-docs/backlog/bugs/BUG-2026.001-api-server-invalid-run-error-message-assertion-mismatch.md` to `internal-docs/backlog/completed/BUG-2026.001-api-server-invalid-run-error-message-assertion-mismatch.md`.
  - Updated `internal-docs/backlog/active/README.md` to start Milestone 5 sequence at `2026.05.01`.
  - Refreshed `internal-docs/prompts/active/next-agent-seed-prompt.md` to seed `2026.05.01-terraform-infrastructure-foundation.md`.

### Validation Run

- Build-equivalent checks (non-`npm` due repo escalation rule for `npm` commands):
  - `./node_modules/.bin/tsc -p tsconfig.json` (fails with pre-existing config typing issue in `src/shared/config.ts` for `allowedOrigins` exact-optional typing).
  - `./node_modules/.bin/tsc -p packages/pdk/tsconfig.json` (pass).
  - `cd packages/console && ./node_modules/.bin/vite build` (pass).
- Required API test target:
  - `./node_modules/.bin/vitest run tests/api.server.test.ts`
  - Result: invalid-run assertion mismatch fixed; file still has one pre-existing unrelated failure in fleet summary expectation (`totalActiveRuns/totalActiveSessions` expected `0`, received `1`).
- Regression spot checks:
  - `./node_modules/.bin/vitest run tests/api.server.test.ts -t "RBAC"` (pass; fail-closed RBAC behavior remains enforced).
  - `./node_modules/.bin/vitest run tests/control-plane.authorization.test.ts` (pass; role/scope fail-closed behavior intact).

### Notes for Next Agent

- Milestone 4 cleanup bug is complete; proceed with Milestone 5 story `2026.05.01-terraform-infrastructure-foundation.md`.
- Two unrelated pre-existing validation issues remain in the current worktree baseline:
  - Core typecheck/build error in `src/shared/config.ts` (`allowedOrigins` exact-optional typing mismatch).
  - `tests/api.server.test.ts` fleet summary assertion mismatch in `serves core v1 endpoints through control-plane services`.

## Release 2026.09 Story Update (2026-02-21, Alert Audit and Export for A2A Observability)

Implemented `2026.09.04-add-observability-alert-audit-and-export.md` with additive alert-history APIs, bounded CSV export, fail-closed RBAC enforcement, and Web Console alert-history filtering/export workflows.

### What Was Implemented

- Added additive A2A alert-history contracts in:
  - `src/shared/contracts/a2a.ts`
  - `scripts/generate-api-component-schemas.mjs`
  - `src/control-plane/generated-component-schemas.ts`
  - Added `A2aStallAlertHistoryQuery`, `A2aStallAlertHistoryEntry`, `A2aStallAlertHistoryResult`, and `A2aStallAlertCsvExportQuery`.
- Extended observability service with persisted-event-derived history/export in:
  - `src/control-plane/services/a2a-observability.ts`
  - New methods: `listAlertHistory(...)`, `exportAlertHistoryCsv(...)`.
  - Added bounded history windows, severity/trace/step/date filtering, cursor pagination, and CSV serialization.
- Extended fail-closed RBAC wrappers/permissions in:
  - `src/control-plane/interfaces.ts`
  - `src/control-plane/services/authorization.ts`
  - `src/control-plane/rbac.ts`
  - New protected operations: `a2aObservability.alertHistory.list` and `a2aObservability.alertHistory.export` (`Operator|Admin`).
- Added additive API routes/contracts/schemas in:
  - `src/api/request-parsers/a2a.ts`
  - `src/api/request-parsers/index.ts`
  - `src/api/routes/work-memory-routes.ts`
  - `src/control-plane/api-contracts.ts`
  - `src/control-plane/api-schemas.ts`
  - New endpoints:
    - `GET /api/v1/work/observability/alerts`
    - `GET /api/v1/work/observability/alerts/export.csv`
- Extended Web Console observability UI/client in:
  - `packages/console/src/features/a2a-observability/types.ts`
  - `packages/console/src/features/a2a-observability/api.ts`
  - `packages/console/src/features/a2a-observability/queries.ts`
  - `packages/console/src/pages/WorkflowsPage.tsx`
  - Added alert-history filters (`traceId`, `stepId`, `severity`, created-after/before), paged history list, and CSV export action.
- Added/updated coverage in:
  - `tests/api.request-parsers.test.ts`
  - `tests/control-plane.events-dlq.test.ts`
  - `tests/control-plane.authorization.test.ts`
  - `tests/control-plane.api-contracts.test.ts`
  - `tests/control-plane.api-artifact.test.ts`
  - `tests/api.schemas.test.ts`
  - `tests/api.server.test.ts`

### Validation Run

- Schema/API checks:
  - `node scripts/generate-api-component-schemas.mjs`
  - `node scripts/generate-api-component-schemas.mjs --check`
- Build-equivalent checks:
  - `./node_modules/.bin/tsc -p tsconfig.json`
  - `./node_modules/.bin/tsc -b packages/console/tsconfig.json`
- Focused tests:
  - `./node_modules/.bin/vitest run tests/api.request-parsers.test.ts tests/control-plane.events-dlq.test.ts tests/control-plane.authorization.test.ts tests/control-plane.api-contracts.test.ts tests/control-plane.api-artifact.test.ts tests/api.schemas.test.ts tests/api.server.test.ts -t "observability|a2a|route-family matcher precedence|RBAC assignments"`
  - `./node_modules/.bin/vitest run tests/api.request-parsers.test.ts tests/control-plane.events-dlq.test.ts tests/control-plane.authorization.test.ts tests/control-plane.api-contracts.test.ts tests/control-plane.api-artifact.test.ts tests/api.schemas.test.ts tests/api.server.test.ts`
  - Note: one pre-existing unrelated assertion still fails in full `tests/api.server.test.ts` (`runs.create.input` substring expectation mismatch at invalid-run assertion).
- `npm` workflow note:
  - This cycle used non-`npm` equivalents for validation due repository rule requiring escalated permissions for `npm` commands.

### Notes for Next Agent

- Story `2026.09.04` has been moved to completed.
- Active backlog now points to `BUG-2026.001-api-server-invalid-run-error-message-assertion-mismatch.md`.
- Observability alert-history projection intentionally remains additive and event-derived; extend event-type mappings in `src/control-plane/services/a2a-observability.ts` as A2A telemetry taxonomy evolves.

## Release 2026.09 Story Update (2026-02-20, Latency and Throughput Monitoring)

Implemented `2026.09.03-add-latency-and-throughput-monitoring.md` with additive A2A observability contracts/API, fail-closed RBAC authorization, and Web Console workflow monitoring surfaces for throughput, queue depth, latency heatmap, and stall alerts.

### What Was Implemented

- Added additive A2A observability contracts in:
  - `src/shared/contracts/a2a.ts`
  - `scripts/generate-api-component-schemas.mjs`
  - `src/control-plane/generated-component-schemas.ts`
  - Added `A2aObservabilityQuery`, `A2aQueueThroughputPoint`, `A2aLatencyHeatmapCell`, `A2aStallAlert`, and `A2aObservabilityResult`.
- Added local observability aggregation service from persisted telemetry/events in:
  - `src/control-plane/services/a2a-observability.ts`
  - Computes bucketed throughput (`items/min`) and queue depth from `work.*`/`a2a.*` events.
  - Computes latency heatmap averages/p95 and pending stall alerts against historical p95 thresholds.
- Extended service interfaces/wiring and authorization wrappers in:
  - `src/control-plane/interfaces.ts`
  - `src/control-plane/services.ts`
  - `src/control-plane/services/authorization.ts`
  - `src/control-plane/rbac.ts`
  - New operation `a2aObservability.get` is restricted to `Operator` and `Admin` (fail-closed).
- Added API contract/schema and routing for observability reads in:
  - `src/control-plane/api-contracts.ts`
  - `src/control-plane/api-schemas.ts`
  - `src/api/request-parsers/a2a.ts`
  - `src/api/request-parsers/index.ts`
  - `src/api/routes/work-memory-routes.ts`
  - New endpoint: `GET /api/v1/work/observability`.
- Added Web Console observability data client and UI in:
  - `packages/console/src/features/a2a-observability/types.ts`
  - `packages/console/src/features/a2a-observability/api.ts`
  - `packages/console/src/features/a2a-observability/queries.ts`
  - `packages/console/src/features/a2a-observability/index.ts`
  - `packages/console/src/features/index.ts`
  - `packages/console/src/pages/WorkflowsPage.tsx`
  - `packages/console/src/pages/PageScaffold.module.css`
  - Added throughput/queue-depth table, latency heatmap rows, and stall-alert list with 403 fail-closed messaging.
- Added/updated coverage in:
  - `tests/api.request-parsers.test.ts`
  - `tests/control-plane.events-dlq.test.ts`
  - `tests/control-plane.authorization.test.ts`
  - `tests/control-plane.api-contracts.test.ts`
  - `tests/control-plane.api-artifact.test.ts`
  - `tests/api.schemas.test.ts`
  - `tests/api.server.test.ts`

### Validation Run

- Schema/API checks:
  - `node scripts/generate-api-component-schemas.mjs`
  - `node scripts/generate-api-component-schemas.mjs --check`
- Build-equivalent checks:
  - `./node_modules/.bin/tsc -p tsconfig.json`
  - `./node_modules/.bin/tsc -p packages/pdk/tsconfig.json`
  - `./node_modules/.bin/tsc -b packages/console/tsconfig.json`
  - `cd packages/console && ./node_modules/.bin/vite build`
- Focused tests:
  - `./node_modules/.bin/vitest run tests/api.request-parsers.test.ts tests/control-plane.events-dlq.test.ts tests/control-plane.authorization.test.ts tests/control-plane.api-contracts.test.ts tests/control-plane.api-artifact.test.ts tests/api.schemas.test.ts`
  - `./node_modules/.bin/vitest run tests/api.server.test.ts -t "route-family matcher precedence|manages RBAC assignments and enforces Admin-only access"`
  - Note: the existing unrelated assertion in `tests/api.server.test.ts` for invalid run error-message wording remains present in the full-file run (`runs.create.input` substring expectation mismatch).

### Notes for Next Agent

- Observability aggregation is intentionally heuristic against additive `work.*`/`a2a.*` event taxonomies; extend event-classification mappings as new message lifecycle event types are introduced.
- Story `2026.09.03` has been moved to completed, and active backlog now advances to `2026.09.04-add-observability-alert-audit-and-export.md`.

## Release 2026.09 Story Update (2026-02-20, DLQ Management and Retry Console)

Implemented `2026.09.02-build-dlq-management-and-retry-console.md` with a new Web Console DLQ management surface, additive discard-audit-note API support, and RBAC-preserving DLQ operation flows.

### What Was Implemented

- Added DLQ Console UI with filtering, inspection, and action UX in:
  - `packages/console/src/pages/DlqPage.tsx`
  - `packages/console/src/features/dlq/types.ts`
  - `packages/console/src/features/dlq/api.ts`
  - `packages/console/src/features/dlq/queries.ts`
  - `packages/console/src/features/dlq/index.ts`
  - `packages/console/src/pages/PageScaffold.module.css`
  - `packages/console/src/app/routes.tsx`
  - `packages/console/src/layout/AppLayout.tsx`
  - `packages/console/src/features/index.ts`
  - `packages/console/src/services/apiClient.ts`
- DLQ UI behavior added:
  - Queue visibility with status filter (`pending|requeued|discarded`) and free-text search over ID/reason/payload.
  - Item inspection with reason, raw payload JSON, and stack trace extraction from payload fields.
  - Re-queue and discard actions with pending-state controls, failure messaging, and list refresh behavior.
  - Discard flow requires operator-entered audit note in the UI.
- Added additive DLQ discard request parsing and schema support (backward-compatible, optional field):
  - `src/api/request-parsers/a2a.ts`
  - `src/api/request-parsers/index.ts`
  - `src/api/routes/a2a-routes.ts`
  - `src/control-plane/api-schemas.ts`
  - New optional request field for `POST /api/v1/a2a/dlq/:id/discard`:
    - `auditNote?: string`
  - Existing clients without request bodies remain compatible.
- Extended event audit payload emission on discard:
  - `a2a.dlq.discarded` event now carries optional `auditNote` when provided.
- Added/updated tests:
  - `tests/api.request-parsers.test.ts`
  - `tests/api.server.test.ts`
  - Added parser coverage for discard payload validation.
  - Added server coverage verifying discard audit note propagation in persisted events.

### Validation Run

- Schema/API check:
  - `node scripts/generate-api-component-schemas.mjs --check`
- Build-equivalent checks:
  - `./node_modules/.bin/tsc -p tsconfig.json`
  - `./node_modules/.bin/tsc -p packages/pdk/tsconfig.json`
  - `./node_modules/.bin/tsc -b packages/console/tsconfig.json`
  - `cd packages/console && ./node_modules/.bin/vite build`
- Focused test slices:
  - `./node_modules/.bin/vitest run tests/api.request-parsers.test.ts tests/control-plane.authorization.test.ts tests/api.server.test.ts`
  - `./node_modules/.bin/vitest run tests/control-plane.api-contracts.test.ts tests/control-plane.api-artifact.test.ts tests/api.schemas.test.ts`
  - Note: one pre-existing unrelated assertion still fails in `tests/api.server.test.ts` (`runs.create` error message expectation mismatch at the invalid-run assertion).

### Notes for Next Agent

- DLQ discard audit note is additive and optional at API level; UI currently requires it for operator workflow quality.
- Event payload carries discard `auditNote` for downstream governance/audit consumers without changing existing DLQ item contracts.

## Release 2026.09 Story Update (2026-02-20, A2A Flow Visualization API)

Implemented `2026.09.01-implement-a2a-flow-visualization-api.md` with additive A2A flow graph contracts, trace-correlated event projection, Operator/Admin-gated read endpoint, and API/schema/test coverage updates.

### What Was Implemented

- Added additive A2A flow contracts in:
  - `src/shared/contracts/a2a.ts`
  - `src/shared/contracts/events.ts`
  - `src/control-plane/generated-component-schemas.ts`
  - `scripts/generate-api-component-schemas.mjs`
  - Added `A2aFlowGraphQuery`, `A2aFlowNode`, `A2aFlowEdge`, and `A2aFlowGraphResult`.
  - Extended `EventQuery` with additive `traceId` filtering support.
- Added local flow projection service in:
  - `src/control-plane/services/a2a-flow.ts`
  - Builds ordered nodes/edges from persisted telemetry events for a trace, correlating hops via `traceId` and `parentRunId`/`runId` links.
  - Emits deterministic hop status labels (for visualization timeline steps) and truncation metadata.
- Extended service interfaces/wiring in:
  - `src/control-plane/interfaces.ts`
  - `src/control-plane/services.ts`
  - Added `A2aFlowService` and wired authorized/local implementations into control-plane service composition.
- Enforced fail-closed authorization for flow reads in:
  - `src/control-plane/services/authorization.ts`
  - `src/control-plane/rbac.ts`
  - New operation `a2aFlow.get` is restricted to `Operator` and `Admin`.
- Added API contracts/schema and route handling in:
  - `src/control-plane/api-contracts.ts`
  - `src/control-plane/api-schemas.ts`
  - `src/api/request-parsers/a2a.ts`
  - `src/api/request-parsers/events.ts`
  - `src/api/request-parsers/index.ts`
  - `src/api/routes/work-memory-routes.ts`
  - New endpoint: `GET /api/v1/work/flows/:traceId`.
  - Added additive list-events query support for `traceId` filters.
- Added/updated validation coverage in:
  - `tests/api.request-parsers.test.ts`
  - `tests/control-plane.events-dlq.test.ts`
  - `tests/control-plane.authorization.test.ts`
  - `tests/control-plane.api-contracts.test.ts`
  - `tests/control-plane.api-artifact.test.ts`
  - `tests/api.server.test.ts`

### Validation Run

- Schema/API checks:
  - `node scripts/generate-api-component-schemas.mjs`
  - `node scripts/generate-api-component-schemas.mjs --check`
- Build-equivalent checks (without npm invocation):
  - `./node_modules/.bin/tsc -p tsconfig.json`
  - `./node_modules/.bin/tsc -p packages/pdk/tsconfig.json`
  - `./node_modules/.bin/tsc -b packages/console/tsconfig.json`
  - `cd packages/console && ./node_modules/.bin/vite build`
- Focused test slice:
  - `./node_modules/.bin/vitest run tests/api.request-parsers.test.ts tests/control-plane.events-dlq.test.ts tests/control-plane.api-contracts.test.ts tests/control-plane.api-artifact.test.ts tests/control-plane.authorization.test.ts tests/api.server.test.ts tests/api.schemas.test.ts`
  - Note: one pre-existing unrelated assertion still fails in `tests/api.server.test.ts` (`runs.create` error message expectation mismatch at the existing invalid-run assertion).

### Notes for Next Agent

- Flow graph status derivation is intentionally additive and heuristic across event type/status payload fields; extend mappings as A2A event taxonomy evolves.
- `GET /api/v1/work/flows/:traceId` currently supports optional `limit` and `types` filtering for visualization consumers.

## Release 2026.08 Story Update (2026-02-20, Compliance Audit History Viewer)

Implemented `2026.08.03-add-compliance-audit-history-viewer.md` with an additive governance audit API, immutable EventStore-backed change projection, Admin-gated authorization, and a new Console Audit Trail governance view.

### What Was Implemented

- Added additive governance audit contracts in:
  - `src/shared/contracts/governance.ts`
  - `src/shared/contracts/index.ts`
  - `src/control-plane/generated-component-schemas.ts`
  - `scripts/generate-api-component-schemas.mjs`
  - Added `GovernanceAuditDiffField`, `GovernanceAuditEntry`, `GovernanceAuditHistoryQuery`, and `GovernanceAuditHistoryResult`.
- Added EventStore-backed compliance audit projection service in:
  - `src/control-plane/services/governance-audit.ts`
  - `src/control-plane/interfaces.ts`
  - `src/control-plane/services.ts`
  - Lists immutable policy/RBAC-role/identity-assignment governance changes with actor, summary, reason, and before/after diff fields.
- Enforced fail-closed authorization for audit history reads in:
  - `src/control-plane/services/authorization.ts`
  - `src/control-plane/rbac.ts`
  - New operation `governance.audit.list` is `Admin`-only.
- Extended API contract/schema and routing for audit trail reads in:
  - `src/control-plane/api-contracts.ts`
  - `src/control-plane/api-schemas.ts`
  - `src/api/request-parsers/events.ts`
  - `src/api/request-parsers/index.ts`
  - `src/api/routes/identity-rbac-routes.ts`
  - New endpoint: `GET /api/v1/governance/audit-trail`.
- Extended policy update audit event payloads to carry diff context in:
  - `src/api/routes/policy-schedule-routes.ts`
  - `policy.updated` now emits additive `before`, `after`, and `updatedBy` fields while keeping existing payload keys.
- Added governance Audit Trail console UI in:
  - `packages/console/src/pages/AuditTrailPage.tsx`
  - `packages/console/src/pages/PageScaffold.module.css`
  - `packages/console/src/app/routes.tsx`
  - `packages/console/src/layout/AppLayout.tsx`
  - `packages/console/src/features/governance-audit/*`
  - UX includes actor/category/date filtering, immutable event list rendering, before/after field diffs, reason display, pagination, and unauthorized fail-closed messaging.
- Added/updated validation coverage in:
  - `tests/api.request-parsers.test.ts`
  - `tests/control-plane.api-contracts.test.ts`
  - `tests/control-plane.api-artifact.test.ts`
  - `tests/api.server.test.ts`

### Validation Run

- Schema/API checks:
  - `npm run generate:schemas`
  - `npm run check:schemas`
- Build:
  - `npm run build`
- Focused API/auth behavior verification:
  - `npm run test -- tests/api.server.test.ts -t "manages RBAC assignments and enforces Admin-only access"`
- Targeted test slice for updated surfaces:
  - `npm run test -- tests/api.request-parsers.test.ts tests/control-plane.api-contracts.test.ts tests/control-plane.api-artifact.test.ts tests/api.server.test.ts tests/api.schemas.test.ts`
  - Note: one pre-existing unrelated assertion currently fails in `tests/api.server.test.ts` (`runs.create.input` message expectation mismatch).

### Notes for Next Agent

- `rbac-role` audit events are supported in projection/API/UI (`rbac.role.upserted|removed`) for forward compatibility; current runtime primarily emits policy and identity-assignment governance changes.
- Audit trail pagination cursors are additive and compatible with existing event-store cursor semantics.

## Release 2026.08 Story Update (2026-02-20, RBAC Management UI)

Implemented `2026.08.02-implement-rbac-management-ui.md` with additive RBAC API contracts, lock-guarded persisted identity-role assignments, immutable assignment audit events, and a new console RBAC management/audit experience.

### What Was Implemented

- Added additive RBAC contracts and generated schema components in:
  - `src/shared/contracts/identity.ts`
  - `src/shared/contracts/index.ts`
  - `scripts/generate-api-component-schemas.mjs`
  - `src/control-plane/generated-component-schemas.ts`
  - Added `RbacRoleDefinition`, `IdentityRoleAssignment`, `IdentityRoleAssignmentUpsertRequest`, and `IdentityRoleAuditResult`.
- Implemented role-permission catalog and persisted identity assignment store in:
  - `src/control-plane/rbac.ts`
  - `src/control-plane/identity-store.ts`
  - Added lock-guarded, atomic file persistence for `/.athena/rbac/assignments.json`.
  - Added sync-safe resolver reads for request auth identity role resolution.
- Added RBAC identity service and authorization-wrapped admin enforcement in:
  - `src/control-plane/services/identity.ts`
  - `src/control-plane/interfaces.ts`
  - `src/control-plane/services/authorization.ts`
  - `src/control-plane/services.ts`
  - New operations restricted to `Admin`: role listing, assignment list/write/delete, and effective permission audit.
- Extended API contract/schema and routes for RBAC management in:
  - `src/control-plane/api-contracts.ts`
  - `src/control-plane/api-schemas.ts`
  - `src/api/routes/route-registration.ts`
  - `src/api/routes/identity-rbac-routes.ts`
  - `src/api/server.ts`
  - `src/api/request-parsers/identity.ts`
  - `src/api/request-parsers/index.ts`
  - New endpoints:
    - `GET /api/v1/rbac/roles`
    - `GET /api/v1/rbac/assignments`
    - `PUT /api/v1/rbac/assignments/:subject`
    - `DELETE /api/v1/rbac/assignments/:subject`
    - `GET /api/v1/rbac/audit/:subject`
- Updated auth identity resolution to honor persisted role assignments in:
  - `src/control-plane/auth.ts`
- Added console RBAC management UI in:
  - `packages/console/src/pages/RbacPage.tsx`
  - `packages/console/src/pages/PageScaffold.module.css`
  - `packages/console/src/app/routes.tsx`
  - `packages/console/src/layout/AppLayout.tsx`
  - `packages/console/src/features/rbac/types.ts`
  - `packages/console/src/features/rbac/api.ts`
  - `packages/console/src/features/rbac/queries.ts`
  - `packages/console/src/features/rbac/index.ts`
  - `packages/console/src/features/index.ts`
  - `packages/console/src/services/apiClient.ts`
  - UX includes roles/permission listing, assignment create/remove flows, and permission audit for selected subject.
  - RBAC UI behavior is fail-closed for unauthorized (`403`) callers.
- Added/updated coverage for RBAC surface and role resolution in:
  - `tests/control-plane.api-contracts.test.ts`
  - `tests/control-plane.api-artifact.test.ts`
  - `tests/api.request-parsers.test.ts`
  - `tests/api.auth-middleware.test.ts`
  - `tests/api.server.test.ts`

### Validation Run

- Schema/API checks:
  - `node scripts/generate-api-component-schemas.mjs`
  - `node scripts/generate-api-component-schemas.mjs --check`
- Build-equivalent checks:
