variable "name" {
  description = "Azure Cache for Redis instance name."
  type        = string
}

variable "location" {
  description = "Azure region for Redis."
  type        = string
}

variable "resource_group_name" {
  description = "Resource group where Redis is created."
  type        = string
}

variable "sku_name" {
  description = "Redis SKU (Basic|Standard|Premium)."
  type        = string
  default     = "Basic"
}

variable "family" {
  description = "Redis family (C for Basic/Standard, P for Premium)."
  type        = string
  default     = "C"
}

variable "capacity" {
  description = "Redis capacity tier index. 0 corresponds to C0/P0."
  type        = number
  default     = 0
}

variable "redis_version" {
  description = "Redis major version."
  type        = number
  default     = 6
}

variable "public_network_access_enabled" {
  description = "Whether Redis public endpoint is enabled."
  type        = bool
  default     = false
}

variable "tags" {
  description = "Tags applied to Redis resources."
  type        = map(string)
  default     = {}
}
