output "id" {
  description = "The AKS cluster resource ID."
  value       = azurerm_kubernetes_cluster.this.id
}

output "name" {
  description = "The AKS cluster name."
  value       = azurerm_kubernetes_cluster.this.name
}

output "kubelet_object_id" {
  description = "Kubelet identity object ID for role assignments (for example, AcrPull)."
  value       = azurerm_kubernetes_cluster.this.kubelet_identity[0].object_id
}

output "principal_id" {
  description = "System-assigned identity principal ID for AKS control plane."
  value       = azurerm_kubernetes_cluster.this.identity[0].principal_id
}

output "oidc_issuer_url" {
  description = "OIDC issuer URL used for workload identity federation."
  value       = azurerm_kubernetes_cluster.this.oidc_issuer_url
}
