import { describe, expect, it, vi } from "vitest";
import { AzureBillingOperationsCostProvider } from "../src/control-plane/azure-billing-cost-provider.js";
import type { AthenaConfig } from "../src/shared/config.js";

function createConfig(): AthenaConfig {
  return {
    workspaceRoot: process.cwd(),
    stateDir: ".athena",
    executionProviderDefault: "docker",
    lockProviderDefault: "local",
    defaultProvider: "foundry",
    defaultModel: "gpt-4o-mini",
    providerFallbackOrder: ["openai"],
    localProviderCommand: "/bin/echo",
    localProviderArgs: [],
    httpProviderUrl: undefined,
    httpProviderApiKey: undefined,
    httpProviderTimeoutMs: 20_000,
    runtimeRunTimeoutMs: 30_000,
    scheduleRunTimeoutMs: 45_000,
    azure: {
      enabled: true,
      openaiUseEntraId: false,
      openaiAudience: "https://cognitiveservices.azure.com/.default",
      billing: {
        enabled: true,
        audience: "https://management.azure.com/.default",
        scopeResourceId: "/subscriptions/sub-123/resourceGroups/rg-athena-dev",
        apiVersion: "2023-03-01"
      }
    }
  };
}

describe("AzureBillingOperationsCostProvider", () => {
  it("returns undefined when billing integration is disabled", async () => {
    const config = createConfig();
    if (config.azure?.billing) {
      config.azure.billing.enabled = false;
    }
    const provider = new AzureBillingOperationsCostProvider(config, {
      tokenProvider: async () => "token"
    });
    expect(provider.isEnabled()).toBe(false);
    await expect(
      provider.getMonthlyCostUsd({
        month: "2026-02",
        windowStart: "2026-02-01T00:00:00.000Z",
        windowEnd: "2026-03-01T00:00:00.000Z"
      })
    ).resolves.toBeUndefined();
  });

  it("queries Azure Cost Management and parses total month spend", async () => {
    const fetchMock = vi.fn(async (_input: string | URL | Request, _init?: RequestInit) => {
      return {
        ok: true,
        json: async () => ({
          properties: {
            rows: [[123.456789, "USD"]]
          }
        })
      };
    });
    const provider = new AzureBillingOperationsCostProvider(createConfig(), {
      fetchImpl: fetchMock as unknown as typeof fetch,
      tokenProvider: async () => "token-123"
    });

    const result = await provider.getMonthlyCostUsd({
      month: "2026-02",
      windowStart: "2026-02-01T00:00:00.000Z",
      windowEnd: "2026-03-01T00:00:00.000Z"
    });

    expect(result).toBe(123.456789);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const firstCall = fetchMock.mock.calls[0];
    expect(firstCall).toBeDefined();
    const url = String(firstCall?.[0] ?? "");
    const request = firstCall?.[1] as RequestInit | undefined;
    expect(url).toContain("/subscriptions/sub-123/resourceGroups/rg-athena-dev/providers/Microsoft.CostManagement/query");
    expect(request).toMatchObject({
      method: "POST",
      headers: {
        authorization: "Bearer token-123",
        "content-type": "application/json"
      }
    });
  });
});
