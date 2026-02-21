output "id" {
  description = "The resource ID of Redis cache."
  value       = azurerm_redis_cache.this.id
}

output "name" {
  description = "The Redis cache name."
  value       = azurerm_redis_cache.this.name
}

output "hostname" {
  description = "Redis hostname."
  value       = azurerm_redis_cache.this.hostname
}

output "ssl_port" {
  description = "Redis TLS port."
  value       = azurerm_redis_cache.this.ssl_port
}
