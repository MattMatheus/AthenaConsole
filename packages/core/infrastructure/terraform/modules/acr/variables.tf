variable "name" {
  description = "Azure Container Registry name (globally unique, lowercase alphanumeric)."
  type        = string
}

variable "location" {
  description = "Azure region for the registry."
  type        = string
}

variable "resource_group_name" {
  description = "Resource group where the registry will be created."
  type        = string
}

variable "sku" {
  description = "ACR SKU tier."
  type        = string
  default     = "Basic"
}

variable "admin_enabled" {
  description = "Enable admin user on ACR. Keep false for least-privilege by default."
  type        = bool
  default     = false
}

variable "tags" {
  description = "Tags applied to the registry."
  type        = map(string)
  default     = {}
}
