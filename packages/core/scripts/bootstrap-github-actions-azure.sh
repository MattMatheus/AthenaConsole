#!/usr/bin/env bash

set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  scripts/bootstrap-github-actions-azure.sh \
    --repo <owner/repo> \
    [--resource-group <rg-name>] \
    [--acr-name <acr-name>] \
    [--aks-name <aks-name>] \
    [--subscription-id <subscription-id>] \
    [--tenant-id <tenant-id>] \
    [--app-id <existing-entra-app-client-id>] \
    [--app-name <entra-app-display-name>] \
    [--swa-name <static-web-app-name>] \
    [--control-plane-workload-client-id <client-id>] \
    [--terraform-dir <path-to-terraform-environment>] \
    [--control-plane-allowed-origins <csv-origins>] \
    [--console-login-password <password>]

Description:
  Creates or reuses an Entra app + service principal for GitHub OIDC, creates
  federated credentials for main branch and dev environment, assigns required
  Azure roles, and sets required GitHub Actions secrets/variables.

Prerequisites:
  - az CLI logged in with permission to create app registrations and role assignments
  - gh CLI logged in with admin access to the target repository
EOF
}

require_cmd() {
  local cmd="$1"
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "Missing required command: $cmd" >&2
    exit 1
  fi
}

require_cmd az
require_cmd gh

REPO=""
RESOURCE_GROUP=""
ACR_NAME=""
AKS_NAME=""
SUBSCRIPTION_ID=""
TENANT_ID=""
APP_ID=""
APP_NAME=""
SWA_NAME=""
CONTROL_PLANE_WORKLOAD_CLIENT_ID=""
TERRAFORM_DIR=""
CONTROL_PLANE_ALLOWED_ORIGINS=""
CONSOLE_LOGIN_PASSWORD=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --repo)
      REPO="$2"
      shift 2
      ;;
    --resource-group)
      RESOURCE_GROUP="$2"
      shift 2
      ;;
    --acr-name)
      ACR_NAME="$2"
      shift 2
      ;;
    --aks-name)
      AKS_NAME="$2"
      shift 2
      ;;
    --subscription-id)
      SUBSCRIPTION_ID="$2"
      shift 2
      ;;
    --tenant-id)
      TENANT_ID="$2"
      shift 2
      ;;
    --app-id)
      APP_ID="$2"
      shift 2
      ;;
    --app-name)
      APP_NAME="$2"
      shift 2
      ;;
    --swa-name)
      SWA_NAME="$2"
      shift 2
      ;;
    --control-plane-workload-client-id)
      CONTROL_PLANE_WORKLOAD_CLIENT_ID="$2"
      shift 2
      ;;
    --terraform-dir)
      TERRAFORM_DIR="$2"
      shift 2
      ;;
    --control-plane-allowed-origins)
      CONTROL_PLANE_ALLOWED_ORIGINS="$2"
      shift 2
      ;;
    --console-login-password)
      CONSOLE_LOGIN_PASSWORD="$2"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage
      exit 1
      ;;
  esac
done

if [[ -z "$REPO" ]]; then
  echo "Missing required arguments." >&2
  usage
  exit 1
fi

if [[ "$REPO" != */* ]]; then
  echo "--repo must be in owner/repo format." >&2
  exit 1
fi

tf_output_raw() {
  local output_name="$1"
  if [[ -z "$TERRAFORM_DIR" ]]; then
    return 1
  fi
  terraform -chdir="$TERRAFORM_DIR" output -raw "$output_name" 2>/dev/null || return 1
}

if [[ -n "$TERRAFORM_DIR" ]]; then
  require_cmd terraform
  if [[ -z "$RESOURCE_GROUP" ]]; then
    RESOURCE_GROUP="$(tf_output_raw resource_group_name || true)"
  fi
  if [[ -z "$ACR_NAME" ]]; then
    ACR_NAME="$(tf_output_raw acr_name || true)"
  fi
  if [[ -z "$AKS_NAME" ]]; then
    AKS_NAME="$(tf_output_raw aks_name || true)"
  fi
  if [[ -z "$CONTROL_PLANE_WORKLOAD_CLIENT_ID" ]]; then
    CONTROL_PLANE_WORKLOAD_CLIENT_ID="$(tf_output_raw control_plane_workload_identity_client_id || true)"
  fi
fi

if [[ -z "$RESOURCE_GROUP" || -z "$ACR_NAME" || -z "$AKS_NAME" ]]; then
  echo "resource-group/acr-name/aks-name are required (or provide --terraform-dir with matching outputs)." >&2
  exit 1
fi

if [[ -z "$SUBSCRIPTION_ID" ]]; then
  SUBSCRIPTION_ID="$(az account show --query id -o tsv)"
fi

if [[ -z "$TENANT_ID" ]]; then
  TENANT_ID="$(az account show --query tenantId -o tsv)"
fi

az account set --subscription "$SUBSCRIPTION_ID"

OWNER="${REPO%%/*}"
REPO_NAME="${REPO##*/}"

if [[ -z "$APP_NAME" ]]; then
  APP_NAME="gha-${OWNER}-${REPO_NAME}-dev"
fi

if [[ -z "$APP_ID" ]]; then
  echo "Using app registration display name: $APP_NAME"
  APP_ID="$(az ad app list --display-name "$APP_NAME" --query '[0].appId' -o tsv)"
  if [[ -z "$APP_ID" ]]; then
    APP_ID="$(az ad app create --display-name "$APP_NAME" --sign-in-audience AzureADMyOrg --query appId -o tsv)"
    echo "Created Entra app: $APP_ID"
  else
    echo "Reusing existing Entra app: $APP_ID"
  fi
else
  echo "Using provided app registration client ID: $APP_ID"
fi

APP_OBJECT_ID="$(az ad app show --id "$APP_ID" --query id -o tsv)"

if ! az ad sp show --id "$APP_ID" >/dev/null 2>&1; then
  az ad sp create --id "$APP_ID" >/dev/null
  echo "Created service principal for app."
else
  echo "Service principal already exists."
fi

SP_OBJECT_ID="$(az ad sp show --id "$APP_ID" --query id -o tsv)"

ensure_federated_credential() {
  local cred_name="$1"
  local subject="$2"
  if az ad app federated-credential show --id "$APP_OBJECT_ID" --federated-credential-id "$cred_name" >/dev/null 2>&1; then
    echo "Federated credential exists: $cred_name"
    return
  fi

  az ad app federated-credential create \
    --id "$APP_OBJECT_ID" \
    --parameters "{
      \"name\": \"${cred_name}\",
      \"issuer\": \"https://token.actions.githubusercontent.com\",
      \"subject\": \"${subject}\",
      \"audiences\": [\"api://AzureADTokenExchange\"]
    }" >/dev/null

  echo "Created federated credential: $cred_name"
}

ensure_federated_credential "github-main" "repo:${REPO}:ref:refs/heads/main"
ensure_federated_credential "github-dev-environment" "repo:${REPO}:environment:dev"

ACR_ID="$(az acr show --resource-group "$RESOURCE_GROUP" --name "$ACR_NAME" --query id -o tsv)"
ACR_LOGIN_SERVER="$(az acr show --resource-group "$RESOURCE_GROUP" --name "$ACR_NAME" --query loginServer -o tsv)"
AKS_ID="$(az aks show --resource-group "$RESOURCE_GROUP" --name "$AKS_NAME" --query id -o tsv)"
RG_ID="$(az group show --name "$RESOURCE_GROUP" --query id -o tsv)"

ensure_role_assignment() {
  local role_name="$1"
  local scope="$2"
  if az role assignment list \
      --assignee-object-id "$SP_OBJECT_ID" \
      --scope "$scope" \
      --query "[?roleDefinitionName=='${role_name}'] | length(@)" \
      -o tsv | grep -q '^1$'; then
    echo "Role already assigned: ${role_name} on ${scope}"
    return
  fi

  az role assignment create \
    --assignee-object-id "$SP_OBJECT_ID" \
    --assignee-principal-type ServicePrincipal \
    --role "$role_name" \
    --scope "$scope" >/dev/null
  echo "Assigned role: ${role_name}"
}

ensure_role_assignment "AcrPush" "$ACR_ID"
ensure_role_assignment "Azure Kubernetes Service Cluster User Role" "$AKS_ID"
ensure_role_assignment "Reader" "$RG_ID"

echo "Writing GitHub Actions secrets and variables to $REPO"

gh secret set AZURE_CLIENT_ID --repo "$REPO" --body "$APP_ID"
gh secret set AZURE_TENANT_ID --repo "$REPO" --body "$TENANT_ID"
gh secret set AZURE_SUBSCRIPTION_ID --repo "$REPO" --body "$SUBSCRIPTION_ID"

gh variable set AZURE_ACR_NAME --repo "$REPO" --body "$ACR_NAME"
gh variable set AZURE_ACR_LOGIN_SERVER --repo "$REPO" --body "$ACR_LOGIN_SERVER"
gh variable set AZURE_RESOURCE_GROUP --repo "$REPO" --body "$RESOURCE_GROUP"
gh variable set AZURE_AKS_NAME --repo "$REPO" --body "$AKS_NAME"

if [[ -n "$CONTROL_PLANE_WORKLOAD_CLIENT_ID" ]]; then
  gh variable set AZURE_CONTROL_PLANE_WORKLOAD_CLIENT_ID --repo "$REPO" --body "$CONTROL_PLANE_WORKLOAD_CLIENT_ID"
else
  echo "Skipping AZURE_CONTROL_PLANE_WORKLOAD_CLIENT_ID (not provided)."
fi

if [[ -n "$CONTROL_PLANE_ALLOWED_ORIGINS" ]]; then
  gh variable set CONTROL_PLANE_ALLOWED_ORIGINS --repo "$REPO" --body "$CONTROL_PLANE_ALLOWED_ORIGINS"
fi

if [[ -n "$CONSOLE_LOGIN_PASSWORD" ]]; then
  gh variable set CONSOLE_LOGIN_PASSWORD --repo "$REPO" --body "$CONSOLE_LOGIN_PASSWORD"
fi

if [[ -n "$SWA_NAME" ]]; then
  SWA_TOKEN="$(az staticwebapp secrets list --name "$SWA_NAME" --resource-group "$RESOURCE_GROUP" --query properties.apiKey -o tsv)"
  if [[ -n "$SWA_TOKEN" ]]; then
    gh secret set AZURE_STATIC_WEB_APPS_API_TOKEN_DEV --repo "$REPO" --body "$SWA_TOKEN"
    echo "Set AZURE_STATIC_WEB_APPS_API_TOKEN_DEV from Static Web App token."
  else
    echo "Could not resolve Static Web App token for $SWA_NAME."
  fi
else
  echo "Skipping AZURE_STATIC_WEB_APPS_API_TOKEN_DEV (no --swa-name provided)."
fi

echo "Bootstrap complete."
echo "Run a manual deploy from GitHub Actions (workflow_dispatch) to verify OIDC and RBAC."
