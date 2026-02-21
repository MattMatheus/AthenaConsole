output "resource_group_name" {
  description = "Environment resource group name."
  value       = azurerm_resource_group.this.name
}

output "aks_name" {
  description = "AKS cluster name."
  value       = module.aks.name
}

output "acr_name" {
  description = "Azure Container Registry name."
  value       = module.acr.name
}

output "redis_hostname" {
  description = "Redis private hostname."
  value       = module.redis.hostname
}

output "static_web_app_default_hostname" {
  description = "Static Web App default hostname."
  value       = module.static_web_app.default_host_name
}

output "static_web_app_custom_domain" {
  description = "Configured Static Web App custom domain."
  value       = module.static_web_app.custom_domain
}

output "static_web_app_custom_domain_validation_token" {
  description = "Static Web App custom-domain validation token (when required by validation mode)."
  value       = module.static_web_app.custom_domain_validation_token
  sensitive   = true
}

output "application_insights_name" {
  description = "Application Insights component name."
  value       = module.application_insights.name
}

output "application_insights_connection_string" {
  description = "Application Insights connection string for runtime configuration."
  value       = module.application_insights.connection_string
  sensitive   = true
}

output "application_insights_workbook_id" {
  description = "Observability workbook resource ID."
  value       = azurerm_application_insights_workbook.control_plane.id
}

output "application_insights_dashboard_id" {
  description = "Portal dashboard resource ID."
  value       = azurerm_portal_dashboard.control_plane.id
}

output "aks_oidc_issuer_url" {
  description = "AKS OIDC issuer URL for workload identity federation."
  value       = module.aks.oidc_issuer_url
}

output "control_plane_workload_identity_client_id" {
  description = "Client ID for the control-plane user-assigned managed identity."
  value       = azurerm_user_assigned_identity.control_plane_workload.client_id
}

output "control_plane_workload_identity_principal_id" {
  description = "Principal ID for the control-plane user-assigned managed identity."
  value       = azurerm_user_assigned_identity.control_plane_workload.principal_id
}

output "resource_group_budget_id" {
  description = "Resource group monthly budget guardrail resource ID."
  value       = azurerm_consumption_budget_resource_group.startup_credit_guardrail.id
}
