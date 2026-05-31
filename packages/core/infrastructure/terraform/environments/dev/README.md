# Terraform Dev Environment (Azure)

This legacy Azure development environment provisions an older Team Orchestrator cloud scaffold:

- AKS (`Standard_B2s` system pool)
- ACR (Basic)
- Azure Cache for Redis (Basic C0)
- Azure Static Web App (Free)
- Application Insights (sampling + daily cap guardrails)
- Static Web App custom-domain binding (`athena.teamorchestrator.com`)
- VNet + subnets + Redis private endpoint/private DNS wiring for AKS-to-Redis connectivity
- AKS workload identity federation baseline:
  - OIDC issuer enabled on AKS
  - Workload identity enabled on AKS
  - User-assigned managed identity + federated credential for `system:serviceaccount:athena:athena-control-plane`

## Authentication Assumptions

- Azure CLI is installed and authenticated (`az login`).
- The selected subscription allows creating Resource Groups, networking resources, AKS, ACR, Redis, and Static Web Apps.
- If multiple subscriptions are available, set `subscription_id` in `terraform.tfvars`.

## Cost and Quota Guardrails

- AKS node size defaults to `Standard_B2s` with node count `1`.
- ACR defaults to `Basic`.
- Redis defaults to `Basic C0`.
- Static Web App defaults to `Free` tier.
- East US (`eastus`) is the default region for pricing and Azure OpenAI alignment.
- A resource-group monthly budget is provisioned with alert thresholds at **50%**, **75%**, and **90%** of `monthly_budget_amount_usd`.
- New subscriptions can fail AKS creation due to vCPU quota limits. If this occurs, request quota increase or reduce competing regional usage.
- Some subscriptions enforce AKS VM SKU allow-lists. Override `aks_node_vm_size` with an allowed size when required.

## Usage

```bash
cd infrastructure/terraform/environments/dev
cp terraform.tfvars.example terraform.tfvars
terraform init
terraform plan
```

If `terraform plan` fails with authentication or subscription constraints, resolve Azure access/quota first, then rerun.

## Custom Domain (Cloudflare)

- Static Web App custom-domain validation defaults to `cname-delegation`.
- Configure Cloudflare DNS (DNS-only during validation):
  - `CNAME athena -> <static_web_app_default_hostname>`
- After Azure confirms domain ownership, managed SSL certificate issuance/binding is handled by Static Web Apps.

## Observability Outputs

- `application_insights_connection_string` should be stored as a repository secret for deployment:
  - suggested secret name: `ATHENA_APPINSIGHTS_CONNECTION_STRING_DEV`
- Workbook and dashboard outputs are emitted for quick operator access:
  - `application_insights_workbook_id`
  - `application_insights_dashboard_id`
- Budget output:
  - `resource_group_budget_id`

## Workload Identity Notes

- Optional role assignment inputs are available for least-privilege runtime access:
  - `openai_account_resource_id` with role `Cognitive Services OpenAI User`
  - `key_vault_resource_id` with role `Key Vault Secrets User`
  - `cost_management_scope_resource_id` with role `Cost Management Reader` (required for Azure Billing API-backed admin cost visualization)
- After apply, use output `control_plane_workload_identity_client_id` as the Kubernetes service account annotation:
  - `azure.workload.identity/client-id: <output-client-id>`
- Ensure control-plane pods run with:
  - `serviceAccountName: athena-control-plane`
  - pod label `azure.workload.identity/use: "true"`
