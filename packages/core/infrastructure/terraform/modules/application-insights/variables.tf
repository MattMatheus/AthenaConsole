variable "name" {
  description = "Application Insights component name."
  type        = string
}

variable "location" {
  description = "Azure region for Application Insights."
  type        = string
}

variable "resource_group_name" {
  description = "Resource group where Application Insights is created."
  type        = string
}

variable "application_type" {
  description = "Application type."
  type        = string
  default     = "web"
}

variable "retention_in_days" {
  description = "Telemetry retention in days."
  type        = number
  default     = 30
}

variable "sampling_percentage" {
  description = "Client-side sampling percentage."
  type        = number
  default     = 20
}

variable "daily_data_cap_in_gb" {
  description = "Daily ingestion cap to control spend."
  type        = number
  default     = 1
}

variable "tags" {
  description = "Tags applied to Application Insights."
  type        = map(string)
  default     = {}
}
