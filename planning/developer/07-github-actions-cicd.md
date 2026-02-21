<!-- AUDIENCE: Internal/Technical -->

# GitHub Actions CI/CD (Milestone 5)

This document defines the repository-level CI/CD baseline for Azure deployment of ProjectAthena control-plane and console components.

## Workflows

- `.github/workflows/deploy-control-plane.yml`
  - Validates schema/typecheck/tests/build.
  - Builds control-plane container image.
  - On `main` pushes, deploys image to AKS and runs a smoke test against `/api/v1/admin/health`.
- `.github/workflows/deploy-console.yml`
  - Validates console typecheck/build.
  - On `main` pushes, deploys console to Azure Static Web Apps.

## Workspace Isolation Guardrail

- Do not run parallel, non-isolated CI jobs against the same workspace artifacts.
- Jobs that write build/test outputs must use one of these patterns:
  - Separate runner workspace per job.
  - Distinct artifact/output directories per job and per matrix cell.
  - Serialized execution (`concurrency`) when outputs are shared.
- This guardrail is mandatory for deterministic test runs (including runtime fallback tests) and to prevent cross-job file mutation.

## Required Repository Secrets

- `AZURE_CLIENT_ID`
  - Federated identity app registration client ID for GitHub OIDC login.
- `AZURE_TENANT_ID`
  - Microsoft Entra tenant ID.
- `AZURE_SUBSCRIPTION_ID`
  - Azure subscription that hosts Milestone 5 resources.
- `AZURE_STATIC_WEB_APPS_API_TOKEN_DEV`
  - Deployment token for the dev Static Web App.
- `ATHENA_APPINSIGHTS_CONNECTION_STRING_DEV`
  - Application Insights connection string used by control-plane runtime in dev.

## Required Repository Variables

- `AZURE_ACR_NAME`
  - ACR name (for example: `athenadevdev02`).
- `AZURE_ACR_LOGIN_SERVER`
  - ACR login server (for example: `athenadevdev02.azurecr.io`).
- `AZURE_RESOURCE_GROUP`
  - Resource group name for dev deployment targets.
- `AZURE_AKS_NAME`
  - AKS cluster name for dev deployment targets.
- `AZURE_CONTROL_PLANE_WORKLOAD_CLIENT_ID`
  - Client ID for the user-assigned managed identity federated to service account `athena-control-plane`.
- `CONTROL_PLANE_ALLOWED_ORIGINS`
  - Comma-separated CORS origins for control-plane deployment (defaults to `https://athena.teamorchestrator.com` when unset).
- `CONSOLE_LOGIN_PASSWORD`
  - Build-time password value injected as `VITE_CONSOLE_PASSWORD` for the client-side console gate.

## Branch Protection Baseline

Protect `main` with:

- Require pull request before merge.
- Require status checks to pass:
  - `Validate And Build`
  - `Validate Console Build`
- Require branch up to date before merge.
- Restrict direct pushes and force pushes.
- Require signed commits if organization policy mandates it.

## Azure Authentication Assumptions

- CI uses GitHub OIDC (`azure/login@v2`) with a federated credential scoped to this repository.
- Federated identity should be granted least-privilege role assignments:
  - `AcrPush` on target ACR.
  - `Azure Kubernetes Service Cluster User Role` on target AKS.
  - `Reader` on target resource group.
- Static Web Apps deployment uses deployment token secret (short-lived rotation policy recommended).

## Bootstrap Setup (CLI-First)

Use the bootstrap script to avoid portal copy/paste and wire GitHub + Azure from CLI:

```bash
scripts/bootstrap-github-actions-azure.sh \
  --repo <owner/repo> \
  --terraform-dir infrastructure/terraform/environments/dev \
  --app-id <existing-entra-app-client-id> \
  --swa-name <static-web-app-name>
```

Notes:
- `--terraform-dir` auto-loads `resource_group_name`, `acr_name`, `aks_name`, and `control_plane_workload_identity_client_id` from Terraform outputs.
- If `--app-id` is omitted, script creates/reuses an app registration by display name and configures federated credentials automatically.
- Script writes required GitHub secrets/variables (`gh secret set`, `gh variable set`) directly to the repository.

## Subscription Limits and Cost Guardrails

- Assumes subscription can run at least one-node AKS cluster and allows ACR push throughput for CI frequency.
- Keep AKS node count at baseline (`1`) and low-cost SKU defaults (`Standard_B2s`, ACR Basic, Redis Basic C0, SWA Free) unless explicitly changed.
- Keep workflow triggers path-scoped to avoid unnecessary runs and GitHub Actions minute burn.
- Keep deployment serialized via workflow `concurrency` to avoid overlapping rollouts and extra image churn.

## Deployment Skeleton Notes

- Kubernetes manifests in `infrastructure/kubernetes/control-plane/` are intentionally minimal and additive.
- Workflow bootstraps `ingress-nginx` and applies `infrastructure/kubernetes/control-plane/ingress.yaml` for API exposure.
- Workflow also bootstraps cert-manager (`v1.18.2`) and applies:
  - `infrastructure/kubernetes/control-plane/clusterissuer-letsencrypt-prod.yaml`
  - `infrastructure/kubernetes/control-plane/certificate.yaml`
- TLS readiness check is best-effort during deploy to avoid blocking first rollout while external DNS propagates.
- Current smoke check remains in-cluster Service-based for deterministic validation.
- `ATHENA_AUTH_ENABLED=false` remains set for bootstrap compatibility.
- Workload identity hardening is now scaffolded:
  - Service account `athena-control-plane` is annotated with `azure.workload.identity/client-id`.
  - Deployment pod template includes `azure.workload.identity/use: "true"` and `serviceAccountName: athena-control-plane`.
  - Workflow sets `AZURE_CLIENT_ID` on deployment from `AZURE_CONTROL_PLANE_WORKLOAD_CLIENT_ID`.
- Workflow sets `ATHENA_ALLOWED_ORIGINS` during deployment from `CONTROL_PLANE_ALLOWED_ORIGINS` (or default custom-domain origin).
- When `ATHENA_APPINSIGHTS_CONNECTION_STRING_DEV` is set, workflow enables:
  - `ATHENA_APPINSIGHTS_ENABLED=true`
  - `ATHENA_APPINSIGHTS_CONNECTION_STRING=<secret>`

## DNS/TLS Requirement For API Host

- `api.athena.teamorchestrator.com` must resolve to the AKS ingress external endpoint for Let's Encrypt HTTP-01 challenges to validate.
- During initial domain bring-up, keep Cloudflare record as `DNS only` until certificate issuance is confirmed.
