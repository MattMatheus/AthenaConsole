import { describe, expect, it } from "vitest";
import { ApiClientError } from "./apiClient";
import { FleetApiService, FleetApiServiceError } from "./FleetApiService";

describe("FleetApiService", () => {
  it("returns a contract-typed fleet summary with safe defaults", async () => {
    const service = new FleetApiService({
      async get<TResponse>() {
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

    const summary = await service.getFleetSummary();
    expect(summary.total).toBe(12);
    expect(summary.capabilities.supportsPodStatus).toBe(true);
    expect(summary.capabilities.supportsCpuMemMetrics).toBe(false);
    expect(summary.operationalSummary?.aggregateResourceUsage.cpuUsage).toBe(37.5);
  });

  it("wraps ApiClientError with a user-safe service error", async () => {
    const service = new FleetApiService({
      async get<TResponse>(): Promise<TResponse> {
        throw new ApiClientError("backend unavailable", { status: 503, code: "PROVIDER_ERROR" });
      }
    });

    await expect(service.getFleetSummary()).rejects.toThrow(FleetApiServiceError);
    await expect(service.getFleetSummary()).rejects.toThrow("Unable to fetch fleet summary (503)");
  });

  it("wraps unknown failures gracefully", async () => {
    const service = new FleetApiService({
      async get<TResponse>(): Promise<TResponse> {
        throw new Error("timeout");
      }
    });

    await expect(service.getFleetSummary()).rejects.toThrow(FleetApiServiceError);
    await expect(service.getFleetSummary()).rejects.toThrow("Unable to fetch fleet summary: timeout");
  });
});
