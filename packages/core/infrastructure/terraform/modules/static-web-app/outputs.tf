output "id" {
  description = "The Static Web App resource ID."
  value       = azurerm_static_web_app.this.id
}

output "name" {
  description = "The Static Web App name."
  value       = azurerm_static_web_app.this.name
}

output "default_host_name" {
  description = "Default Static Web App hostname."
  value       = azurerm_static_web_app.this.default_host_name
}

output "custom_domain" {
  description = "Configured custom domain when provided."
  value       = var.custom_domain
}

output "custom_domain_validation_token" {
  description = "DNS TXT validation token for custom domain ownership proof."
  value       = try(azurerm_static_web_app_custom_domain.this[0].validation_token, null)
  sensitive   = true
}
