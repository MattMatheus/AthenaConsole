locals {
  # ACR names must be lowercase alphanumeric, 5-50 chars.
  acr_name = substr(replace(lower("${var.project_name}${var.environment}${var.name_suffix}"), "-", ""), 0, 50)

  base_name = "${var.project_name}-${var.environment}-${var.name_suffix}"

  common_tags = merge(
    {
      project     = var.project_name
      environment = var.environment
      managedBy   = "terraform"
      milestone   = "m5"
    },
    var.tags
  )

  workload_identity_subject = "system:serviceaccount:${var.workload_identity_namespace}:${var.workload_identity_service_account_name}"
  budget_alert_thresholds   = [50, 75, 90]
}

resource "azurerm_resource_group" "this" {
  name     = var.resource_group_name
  location = var.location
  tags     = local.common_tags
}

resource "azurerm_consumption_budget_resource_group" "startup_credit_guardrail" {
  name              = "budget-${local.base_name}"
  resource_group_id = azurerm_resource_group.this.id
  amount            = var.monthly_budget_amount_usd
  time_grain        = "Monthly"

  time_period {
    start_date = var.budget_start_date
    end_date   = var.budget_end_date
  }

  dynamic "notification" {
    for_each = local.budget_alert_thresholds
    content {
      enabled        = true
      operator       = "GreaterThan"
      threshold      = notification.value
      threshold_type = "Actual"
      contact_emails = var.budget_alert_contact_emails
      contact_roles  = ["Owner"]
    }
  }
}

resource "azurerm_virtual_network" "this" {
  name                = "vnet-${local.base_name}"
  location            = azurerm_resource_group.this.location
  resource_group_name = azurerm_resource_group.this.name
  address_space       = [var.vnet_cidr]
  tags                = local.common_tags
}

resource "azurerm_subnet" "aks" {
  name                 = "snet-aks"
  resource_group_name  = azurerm_resource_group.this.name
  virtual_network_name = azurerm_virtual_network.this.name
  address_prefixes     = [var.aks_subnet_cidr]
}

resource "azurerm_subnet" "private_endpoints" {
  name                 = "snet-private-endpoints"
  resource_group_name  = azurerm_resource_group.this.name
  virtual_network_name = azurerm_virtual_network.this.name
  address_prefixes     = [var.private_endpoints_subnet_cidr]

  private_endpoint_network_policies = "Disabled"
}

module "acr" {
  source = "../../modules/acr"

  name                = local.acr_name
  location            = azurerm_resource_group.this.location
  resource_group_name = azurerm_resource_group.this.name
  sku                 = "Basic"
  admin_enabled       = false
  tags                = local.common_tags
}

module "redis" {
  source = "../../modules/redis"

  name                          = "redis-${local.base_name}"
  location                      = azurerm_resource_group.this.location
  resource_group_name           = azurerm_resource_group.this.name
  sku_name                      = "Basic"
  family                        = "C"
  capacity                      = 0
  public_network_access_enabled = false
  tags                          = local.common_tags
}

module "application_insights" {
  source = "../../modules/application-insights"

  name                 = "appi-${local.base_name}"
  location             = azurerm_resource_group.this.location
  resource_group_name  = azurerm_resource_group.this.name
  retention_in_days    = var.application_insights_retention_in_days
  sampling_percentage  = var.application_insights_sampling_percentage
  daily_data_cap_in_gb = var.application_insights_daily_cap_gb
  tags                 = local.common_tags
}

resource "azurerm_private_dns_zone" "redis" {
  name                = "privatelink.redis.cache.windows.net"
  resource_group_name = azurerm_resource_group.this.name
  tags                = local.common_tags
}

resource "azurerm_private_dns_zone_virtual_network_link" "redis" {
  name                  = "pdnslink-${local.base_name}"
  resource_group_name   = azurerm_resource_group.this.name
  private_dns_zone_name = azurerm_private_dns_zone.redis.name
  virtual_network_id    = azurerm_virtual_network.this.id
  registration_enabled  = false
  tags                  = local.common_tags
}

resource "azurerm_private_endpoint" "redis" {
  name                = "pe-redis-${local.base_name}"
  location            = azurerm_resource_group.this.location
  resource_group_name = azurerm_resource_group.this.name
  subnet_id           = azurerm_subnet.private_endpoints.id
  tags                = local.common_tags

  private_service_connection {
    name                           = "psc-redis-${local.base_name}"
    private_connection_resource_id = module.redis.id
    subresource_names              = ["redisCache"]
    is_manual_connection           = false
  }

  private_dns_zone_group {
    name                 = "redis-dns-zone"
    private_dns_zone_ids = [azurerm_private_dns_zone.redis.id]
  }
}

module "aks" {
  source = "../../modules/aks"

  name                = "aks-${local.base_name}"
  location            = azurerm_resource_group.this.location
  resource_group_name = azurerm_resource_group.this.name
  dns_prefix          = "aks-${var.environment}-${var.name_suffix}"
  subnet_id           = azurerm_subnet.aks.id

  kubernetes_version = var.aks_kubernetes_version
  node_count         = var.aks_node_count
  node_vm_size       = var.aks_node_vm_size

  tags = local.common_tags
}

resource "azurerm_user_assigned_identity" "control_plane_workload" {
  name                = "id-athena-control-plane-${local.base_name}"
  location            = azurerm_resource_group.this.location
  resource_group_name = azurerm_resource_group.this.name
  tags                = local.common_tags
}

resource "azurerm_federated_identity_credential" "control_plane_workload" {
  name                = "fic-athena-control-plane-${var.environment}"
  resource_group_name = azurerm_resource_group.this.name
  parent_id           = azurerm_user_assigned_identity.control_plane_workload.id
  audience            = ["api://AzureADTokenExchange"]
  issuer              = module.aks.oidc_issuer_url
  subject             = local.workload_identity_subject
}

resource "azurerm_role_assignment" "aks_acr_pull" {
  scope                = module.acr.id
  role_definition_name = "AcrPull"
  principal_id         = module.aks.kubelet_object_id
}

resource "azurerm_role_assignment" "control_plane_openai_user" {
  count = var.openai_account_resource_id == null ? 0 : 1

  scope                = var.openai_account_resource_id
  role_definition_name = "Cognitive Services OpenAI User"
  principal_id         = azurerm_user_assigned_identity.control_plane_workload.principal_id
}

resource "azurerm_role_assignment" "control_plane_key_vault_secrets_user" {
  count = var.key_vault_resource_id == null ? 0 : 1

  scope                = var.key_vault_resource_id
  role_definition_name = "Key Vault Secrets User"
  principal_id         = azurerm_user_assigned_identity.control_plane_workload.principal_id
}

resource "azurerm_role_assignment" "control_plane_cost_management_reader" {
  count = var.cost_management_scope_resource_id == null ? 0 : 1

  scope                = var.cost_management_scope_resource_id
  role_definition_name = "Cost Management Reader"
  principal_id         = azurerm_user_assigned_identity.control_plane_workload.principal_id
}

module "static_web_app" {
  source = "../../modules/static-web-app"

  name                          = "swa-${local.base_name}"
  location                      = var.location
  resource_group_name           = azurerm_resource_group.this.name
  sku_tier                      = "Free"
  sku_size                      = "Free"
  custom_domain                 = var.static_web_app_custom_domain
  custom_domain_validation_type = var.static_web_app_custom_domain_validation_type
  tags                          = local.common_tags
}

resource "azurerm_application_insights_workbook" "control_plane" {
  name                = uuidv5("dns", "workbook-athena-${local.base_name}")
  location            = azurerm_resource_group.this.location
  resource_group_name = azurerm_resource_group.this.name
  display_name        = "Athena Control Plane Observability"
  source_id           = lower(module.application_insights.id)
  category            = "workbook"
  tags                = local.common_tags

  data_json = jsonencode({
    version = "Notebook/1.0"
    items = [
      {
        type = 1
        content = {
          json = "# Athena Observability\n\nThis workbook tracks API health, AI model latency p95, and Redis lock acquisition timing."
        }
      },
      {
        type = 3
        content = {
          version      = "KqlItem/1.0"
          queryType    = 0
          resourceType = "microsoft.insights/components"
          title        = "Request Volume and Failure Rate"
          query        = "requests | summarize requests=count(), failures=countif(success == false) by bin(timestamp, 5m) | order by timestamp desc"
        }
      },
      {
        type = 3
        content = {
          version      = "KqlItem/1.0"
          queryType    = 0
          resourceType = "microsoft.insights/components"
          title        = "AI Model Response Latency P95"
          query        = "customEvents | where name == 'athena.ai.model.response' | summarize p95_latency_ms=percentile(todouble(customMeasurements.latencyMs), 95) by bin(timestamp, 5m) | order by timestamp desc"
        }
      },
      {
        type = 3
        content = {
          version      = "KqlItem/1.0"
          queryType    = 0
          resourceType = "microsoft.insights/components"
          title        = "Redis Lock Acquisition Timing"
          query        = "customEvents | where name == 'athena.redis.lock.acquire' | summarize p95_latency_ms=percentile(todouble(customMeasurements.latencyMs), 95), acquisition_failures=countif(customDimensions.acquired == 'false') by bin(timestamp, 5m) | order by timestamp desc"
        }
      }
    ]
    isLocked = false
  })
}

resource "azurerm_portal_dashboard" "control_plane" {
  name                = "athena-observability-${var.environment}"
  location            = azurerm_resource_group.this.location
  resource_group_name = azurerm_resource_group.this.name
  tags                = local.common_tags

  dashboard_properties = jsonencode({
    lenses = {
      "0" = {
        order = 0
        parts = {
          "0" = {
            position = {
              x       = 0
              y       = 0
              rowSpan = 2
              colSpan = 12
            }
            metadata = {
              type = "Extension/HubsExtension/PartType/MarkdownPart"
              settings = {
                content = {
                  settings = {
                    content = "## Athena Control Plane Dashboard\n\nUse workbook **Athena Control Plane Observability** for request/failure, AI latency p95, and Redis lock timing charts.\n\nApplication Insights: `${module.application_insights.name}`"
                  }
                }
              }
            }
          }
        }
      }
    }
    metadata = {
      model = {
        timeRange = {
          value = {
            relative = {
              duration = 24
              timeUnit = 1
            }
          }
        }
      }
    }
  })
}
