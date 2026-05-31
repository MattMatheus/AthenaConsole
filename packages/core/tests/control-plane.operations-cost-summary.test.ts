import { describe, expect, it } from "vitest";
import { LocalOperationsService } from "../src/control-plane/services/operations.js";
import type { IOperationsMetricsProvider } from "../src/control-plane/backends/operations-metrics-provider.js";
import type { EventService, RunService } from "../src/control-plane/interfaces.js";
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
    scheduleRunTimeoutMs: 45_000
  };
}

describe("LocalOperationsService external billing", () => {
  it("uses external billing total when provider is configured", async () => {
    const metricsProvider: IOperationsMetricsProvider = {
      source: "local",
      async getCapabilities() {
        return { supportsPodStatus: false, supportsCpuMemMetrics: false };
      },
      async getMetrics() {
        return {
          total: 1,
          running: 0,
          pending: 0,
          succeeded: 1,
          failed: 0
        };
      }
    };
    const runService: RunService = {
      async run() {
        throw new Error("not implemented");
      },
      async cancel() {
        throw new Error("not implemented");
      },
      async cancelByRunId() {
        throw new Error("not implemented");
      },
      async listActiveRuns() {
        return {
          items: [],
          nextCursor: undefined
        };
      },
      async listCancellationRequests() {
        return {
          items: [],
          nextCursor: undefined
        };
      }
    };
    const eventService: EventService = {
      async list() {
        return {
          events: [],
          nextCursor: undefined
        };
      },
      async emit() {
        return undefined;
      }
    };
    const operationsService = new LocalOperationsService(createConfig(), metricsProvider, runService, eventService, {
      provider: "azure-billing",
      async getMonthlyCostUsd() {
        return 42.5;
      }
    });

    const summary = await operationsService.getSummary();
    expect(summary.costSummary?.totalEstimatedSpendUsd).toBe(42.5);
    expect(summary.costSummary?.agentBreakdown).toEqual([]);
    expect(summary.costSummary?.providerBreakdown).toEqual([
      {
        provider: "azure-billing",
        estimatedSpendUsd: 42.5,
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0
      }
    ]);
  });
});
