import { AthenaError } from "../runtime/errors.js";
import type { AthenaConfig } from "../shared/config.js";
import { createAzureManagementTokenProvider } from "../providers/azure-auth.js";
import type { FleetExternalCostProvider } from "./services/fleet.js";

const DEFAULT_AZURE_BILLING_API_VERSION = "2023-03-01";

export class AzureBillingFleetCostProvider implements FleetExternalCostProvider {
  readonly provider = "azure-billing";
  private readonly fetchImpl: typeof fetch;
  private readonly tokenProvider: (() => Promise<string>) | undefined;
  private readonly apiVersion: string;
  private readonly scopeResourceId: string | undefined;

  constructor(
    private readonly config: AthenaConfig,
    options: {
      fetchImpl?: typeof fetch;
      tokenProvider?: () => Promise<string>;
    } = {}
  ) {
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.tokenProvider = options.tokenProvider ?? createAzureManagementTokenProvider(config);
    this.apiVersion = config.azure?.billing?.apiVersion ?? DEFAULT_AZURE_BILLING_API_VERSION;
    this.scopeResourceId = resolveAzureBillingScope(config);
  }

  isEnabled(): boolean {
    return Boolean(this.config.azure?.billing?.enabled && this.scopeResourceId && this.tokenProvider);
  }

  async getMonthlyCostUsd(request: { month: string; windowStart: string; windowEnd: string }): Promise<number | undefined> {
    if (!this.isEnabled() || !this.scopeResourceId || !this.tokenProvider) {
      return undefined;
    }
    const token = await this.tokenProvider();
    const endpoint = `https://management.azure.com${this.scopeResourceId}/providers/Microsoft.CostManagement/query?api-version=${encodeURIComponent(this.apiVersion)}`;
    const response = await this.fetchImpl(endpoint, {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        type: "ActualCost",
        timeframe: "Custom",
        timePeriod: {
          from: request.windowStart,
          to: request.windowEnd
        },
        dataset: {
          granularity: "None",
          aggregation: {
            totalCost: {
              name: "PreTaxCost",
              function: "Sum"
            }
          }
        }
      })
    });

    if (!response.ok) {
      const body = await response.text();
      throw new AthenaError(
        "PROVIDER_ERROR",
        `azure billing query failed (${response.status})${body ? `: ${body}` : ""}`,
        response.status >= 500
      );
    }

    const parsed = (await response.json()) as {
      properties?: {
        rows?: unknown[][];
      };
    };
    const rows = Array.isArray(parsed.properties?.rows) ? parsed.properties.rows : [];
    let total = 0;
    for (const row of rows) {
      if (!Array.isArray(row) || row.length === 0) {
        continue;
      }
      const value = row[0];
      const parsedValue =
        typeof value === "number"
          ? value
          : typeof value === "string"
            ? Number.parseFloat(value)
            : Number.NaN;
      if (Number.isFinite(parsedValue)) {
        total += parsedValue;
      }
    }
    return Math.max(0, Math.round(total * 1_000_000) / 1_000_000);
  }
}

function resolveAzureBillingScope(config: AthenaConfig): string | undefined {
  const explicitScope = normalizeScope(config.azure?.billing?.scopeResourceId);
  if (explicitScope) {
    return explicitScope;
  }
  const subscriptionId = normalizeToken(config.azure?.billing?.subscriptionId);
  if (!subscriptionId) {
    return undefined;
  }
  const resourceGroup = normalizeToken(config.azure?.billing?.resourceGroupName);
  if (resourceGroup) {
    return `/subscriptions/${subscriptionId}/resourceGroups/${resourceGroup}`;
  }
  return `/subscriptions/${subscriptionId}`;
}

function normalizeScope(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

function normalizeToken(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}
