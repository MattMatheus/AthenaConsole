resource "azurerm_application_insights" "this" {
  name                 = var.name
  location             = var.location
  resource_group_name  = var.resource_group_name
  application_type     = var.application_type
  retention_in_days    = var.retention_in_days
  sampling_percentage  = var.sampling_percentage
  daily_data_cap_in_gb = var.daily_data_cap_in_gb
  tags                 = var.tags

  # Azure can auto-attach a managed Log Analytics workspace to existing components.
  # Ignore workspace_id drift to avoid in-place update failures on established resources.
  lifecycle {
    ignore_changes = [workspace_id]
  }
}
