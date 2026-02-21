variable "name" {
  description = "Static Web App name."
  type        = string
}

variable "location" {
  description = "Azure region for Static Web App."
  type        = string
}

variable "resource_group_name" {
  description = "Resource group where Static Web App is created."
  type        = string
}

variable "sku_tier" {
  description = "SWA pricing tier."
  type        = string
  default     = "Free"
}

variable "sku_size" {
  description = "SWA size SKU."
  type        = string
  default     = "Free"
}

variable "tags" {
  description = "Tags applied to Static Web App."
  type        = map(string)
  default     = {}
}

variable "custom_domain" {
  description = "Optional custom domain to bind to Static Web App (for example, athena.teamorchestrator.com)."
  type        = string
  default     = null
}

variable "custom_domain_validation_type" {
  description = "Custom domain validation mode."
  type        = string
  default     = "cname-delegation"
}
