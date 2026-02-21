output "id" {
  description = "Application Insights resource ID."
  value       = azurerm_application_insights.this.id
}

output "name" {
  description = "Application Insights component name."
  value       = azurerm_application_insights.this.name
}

output "app_id" {
  description = "Application Insights app ID."
  value       = azurerm_application_insights.this.app_id
}

output "connection_string" {
  description = "Application Insights connection string."
  value       = azurerm_application_insights.this.connection_string
  sensitive   = true
}

output "instrumentation_key" {
  description = "Instrumentation key."
  value       = azurerm_application_insights.this.instrumentation_key
  sensitive   = true
}
