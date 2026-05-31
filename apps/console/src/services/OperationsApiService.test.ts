import { describe, expect, it } from "vitest";
import { ApiClientError } from "./apiClient";
import { OperationsApiService, OperationsApiServiceError } from "./OperationsApiService";

describe("OperationsApiService", () => {
  it("returns a contract-typed operations summary with safe defaults", async () => {
    const paths: string[] = [];
    const service = new OperationsApiService({
      async get<TResponse>(path: string) {
        paths.push(path);
        return {
          total: "12",
          running: 3,
          pending: 2,
          succeeded: 6,
          failed: 1,
          capabilities: { supportsPodStatus: true, supportsCpuMemMetrics: false },
          operationalSummary: {
            totalActiveRuns: "9",
            totalActiveSessions: 4,
            aggregateResourceUsage: { cpuUsage: "37.5", memoryUsage: 44.2 },
            recentFailureRejectionCount: "2"
          }
        } as TResponse;
      }
    });

    const summary = await service.getOperationsSummary();
    expect(paths).toEqual(["/operations/summary"]);
    expect(summary.total).toBe(12);
    expect(summary.capabilities.supportsPodStatus).toBe(true);
    expect(summary.capabilities.supportsCpuMemMetrics).toBe(false);
    expect(summary.operationalSummary?.aggregateResourceUsage.cpuUsage).toBe(37.5);
  });

  it("wraps ApiClientError with a user-safe service error", async () => {
    const service = new OperationsApiService({
      async get<TResponse>(): Promise<TResponse> {
        throw new ApiClientError("backend unavailable", { status: 503, code: "PROVIDER_ERROR" });
      }
    });

    await expect(service.getOperationsSummary()).rejects.toThrow(OperationsApiServiceError);
    await expect(service.getOperationsSummary()).rejects.toThrow("Unable to fetch operations summary (503)");
  });

  it("wraps unknown failures gracefully", async () => {
    const service = new OperationsApiService({
      async get<TResponse>(): Promise<TResponse> {
        throw new Error("timeout");
      }
    });

    await expect(service.getOperationsSummary()).rejects.toThrow(OperationsApiServiceError);
    await expect(service.getOperationsSummary()).rejects.toThrow("Unable to fetch operations summary: timeout");
  });
});
