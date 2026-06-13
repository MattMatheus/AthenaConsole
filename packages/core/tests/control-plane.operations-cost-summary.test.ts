import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { openAppStateDatabase } from "../src/control-plane/app-state/index.js";
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

function createConfigForDir(workspaceRoot: string): AthenaConfig {
  return {
    ...createConfig(),
    workspaceRoot
  };
}

function createMetricsProvider(): IOperationsMetricsProvider {
  return {
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
}

function createRunService(): RunService {
  return {
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
}

describe("LocalOperationsService external billing", () => {
  it("summarizes durable usage ledger rows by provider, agent, model, user, workspace, and day", async () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-operations-ledger-"));
    try {
      const config = createConfigForDir(dir);
      const appState = openAppStateDatabase(config);
      try {
        appState.runs.create({
          id: "run-ledger-1",
          targetType: "task",
          targetId: "task-ledger-1",
          status: "completed"
        });
        appState.usageLedger.upsert({
          runId: "run-ledger-1",
          targetType: "task",
          targetId: "task-ledger-1",
          agentId: "agent.software-engineer",
          provider: "openai-compatible",
          model: "gpt-4.1-mini",
          userId: "operator@example.test",
          workspaceId: "workspace-a",
          inputTokens: 1000,
          outputTokens: 500,
          source: "run-output",
          recordedAt: "2026-06-13T10:00:00.000Z"
        });
      } finally {
        appState.close();
      }

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
      const operationsService = new LocalOperationsService(config, createMetricsProvider(), createRunService(), eventService);
      await operationsService.updateProviderCostSettings({
        providers: [
          {
            provider: "openai-compatible",
            inputCostPer1kTokensUsd: 0.01,
            outputCostPer1kTokensUsd: 0.02
          }
        ]
      });

      const summary = await operationsService.getSummary();
      expect(summary.costSummary?.totalEstimatedSpendUsd).toBe(0.02);
      expect(summary.costSummary?.agentBreakdown).toEqual([
        expect.objectContaining({ agentName: "agent.software-engineer", totalTokens: 1500 })
      ]);
      expect(summary.costSummary?.providerBreakdown).toEqual([
        expect.objectContaining({ provider: "openai-compatible", estimatedSpendUsd: 0.02 })
      ]);
      expect(summary.costSummary?.modelBreakdown).toEqual([
        expect.objectContaining({ provider: "openai-compatible", model: "gpt-4.1-mini", totalTokens: 1500 })
      ]);
      expect(summary.costSummary?.userBreakdown).toEqual([
        expect.objectContaining({ userId: "operator@example.test", totalTokens: 1500 })
      ]);
      expect(summary.costSummary?.workspaceBreakdown).toEqual([
        expect.objectContaining({ workspaceId: "workspace-a", totalTokens: 1500 })
      ]);
      expect(summary.costSummary?.dailyTrend).toEqual([
        expect.objectContaining({ date: "2026-06-13", estimatedSpendUsd: 0.02 })
      ]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("uses external billing total when provider is configured", async () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-operations-external-"));
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
    try {
      const operationsService = new LocalOperationsService(createConfigForDir(dir), createMetricsProvider(), createRunService(), eventService, {
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
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
