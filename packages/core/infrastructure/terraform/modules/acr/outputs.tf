output "id" {
  description = "The resource ID of the Azure Container Registry."
  value       = azurerm_container_registry.this.id
}

output "name" {
  description = "The name of the Azure Container Registry."
  value       = azurerm_container_registry.this.name
}

output "login_server" {
  description = "The login server URL of the Azure Container Registry."
  value       = azurerm_container_registry.this.login_server
}
