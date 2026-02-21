variable "subscription_id" {
  description = "Azure subscription ID targeted by this environment. If null, Azure CLI / environment context is used."
  type        = string
  default     = null
}

variable "project_name" {
  description = "Project identifier used for naming and tags."
  type        = string
  default     = "athena"
}

variable "environment" {
  description = "Environment name."
  type        = string
  default     = "dev"
}

variable "location" {
  description = "Azure region."
  type        = string
  default     = "eastus"
}

variable "name_suffix" {
  description = "Short unique suffix to satisfy global uniqueness constraints (for example, dev01)."
  type        = string
  default     = "dev01"
}

variable "resource_group_name" {
  description = "Resource group name for the environment."
  type        = string
  default     = "rg-athena-dev"
}

variable "vnet_cidr" {
  description = "CIDR range for the environment VNet."
  type        = string
  default     = "10.42.0.0/16"
}

variable "aks_subnet_cidr" {
  description = "Subnet CIDR for AKS nodes."
  type        = string
  default     = "10.42.1.0/24"
}

variable "private_endpoints_subnet_cidr" {
  description = "Subnet CIDR for private endpoints such as Redis."
  type        = string
  default     = "10.42.2.0/24"
}

variable "aks_kubernetes_version" {
  description = "Pinned AKS version. Null allows Azure to choose default supported version."
  type        = string
  default     = null
}

variable "aks_node_count" {
  description = "AKS system node pool size."
  type        = number
  default     = 1
}

variable "aks_node_vm_size" {
  description = "AKS node VM size; Standard_B2s aligns with Milestone 5 cost baseline."
  type        = string
  default     = "Standard_B2s"
}

variable "workload_identity_namespace" {
  description = "Kubernetes namespace for the control-plane service account."
  type        = string
  default     = "athena"
}

variable "workload_identity_service_account_name" {
  description = "Kubernetes service account name federated with Azure managed identity."
  type        = string
  default     = "athena-control-plane"
}

variable "openai_account_resource_id" {
  description = "Optional Azure OpenAI/Cognitive Services account resource ID for role assignment."
  type        = string
  default     = null
}

variable "key_vault_resource_id" {
  description = "Optional Key Vault resource ID for secret-read role assignment."
  type        = string
  default     = null
}

variable "cost_management_scope_resource_id" {
  description = "Optional scope where Cost Management Reader is granted to the control-plane managed identity."
  type        = string
  default     = null
}

variable "static_web_app_custom_domain" {
  description = "Optional custom domain to bind to the Static Web App."
  type        = string
  default     = "athena.teamorchestrator.com"
}

variable "static_web_app_custom_domain_validation_type" {
  description = "Validation mode for Static Web App custom domain."
  type        = string
  default     = "cname-delegation"
}

variable "application_insights_retention_in_days" {
  description = "Application Insights retention window."
  type        = number
  default     = 30
}

variable "application_insights_sampling_percentage" {
  description = "Application Insights sampling percentage."
  type        = number
  default     = 20
}

variable "application_insights_daily_cap_gb" {
  description = "Application Insights daily ingestion cap in GB to control credits burn."
  type        = number
  default     = 1
}

variable "monthly_budget_amount_usd" {
  description = "Monthly budget amount in USD for the environment resource group."
  type        = number
  default     = 250
}

variable "budget_start_date" {
  description = "Budget monitoring period start date (RFC3339)."
  type        = string
  default     = "2026-01-01T00:00:00Z"
}

variable "budget_end_date" {
  description = "Budget monitoring period end date (RFC3339)."
  type        = string
  default     = "2030-01-01T00:00:00Z"
}

variable "budget_alert_contact_emails" {
  description = "Optional email recipients for budget threshold notifications."
  type        = list(string)
  default     = []
}

variable "tags" {
  description = "Additional resource tags merged with baseline environment tags."
  type        = map(string)
  default     = {}
}
