variable "name" {
  description = "AKS cluster name."
  type        = string
}

variable "location" {
  description = "Azure region for AKS."
  type        = string
}

variable "resource_group_name" {
  description = "Resource group for AKS."
  type        = string
}

variable "dns_prefix" {
  description = "DNS prefix used by AKS managed resources."
  type        = string
}

variable "subnet_id" {
  description = "Subnet resource ID for AKS node pool networking."
  type        = string
}

variable "kubernetes_version" {
  description = "Pinned Kubernetes version for AKS."
  type        = string
  default     = null
}

variable "node_count" {
  description = "System node count."
  type        = number
  default     = 1
}

variable "node_vm_size" {
  description = "VM SKU for AKS system pool."
  type        = string
  default     = "Standard_B2s"
}

variable "max_pods" {
  description = "Maximum pods per node."
  type        = number
  default     = 30
}

variable "os_disk_size_gb" {
  description = "OS disk size in GiB for AKS nodes."
  type        = number
  default     = 64
}

variable "service_cidr" {
  description = "AKS Kubernetes service CIDR. Must not overlap VNet CIDR."
  type        = string
  default     = "10.43.0.0/16"
}

variable "dns_service_ip" {
  description = "AKS DNS service IP within service CIDR."
  type        = string
  default     = "10.43.0.10"
}

variable "tags" {
  description = "Tags applied to AKS resources."
  type        = map(string)
  default     = {}
}
