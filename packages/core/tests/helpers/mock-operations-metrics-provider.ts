import type { OperationsSummary } from "../../src/control-plane/api-contracts.js";

export interface MockMetricsProviderCapabilities {
  supportsPodStatus: boolean;
  supportsCpuMemMetrics: boolean;
}

export interface MockMetricsProviderOptions {
  summary?: Omit<OperationsSummary, "capabilities">;
  capabilities?: Partial<MockMetricsProviderCapabilities>;
}

export class MockMetricsProvider {
  private summary: Omit<OperationsSummary, "capabilities">;
  private capabilities: MockMetricsProviderCapabilities;

  constructor(options: MockMetricsProviderOptions = {}) {
    this.summary = options.summary ?? createBaselineOperationsSummary();
    this.capabilities = {
      supportsPodStatus: options.capabilities?.supportsPodStatus ?? false,
      supportsCpuMemMetrics: options.capabilities?.supportsCpuMemMetrics ?? false
    };
  }

  setSummary(summary: Omit<OperationsSummary, "capabilities">): void {
    this.summary = summary;
  }

  setCapabilities(capabilities: Partial<MockMetricsProviderCapabilities>): void {
    this.capabilities = {
      ...this.capabilities,
      ...capabilities
    };
  }

  async getMetrics(): Promise<Omit<OperationsSummary, "capabilities">> {
    return { ...this.summary };
  }

  async getCapabilities(): Promise<MockMetricsProviderCapabilities> {
    return { ...this.capabilities };
  }
}

export function createBaselineOperationsSummary(
  overrides: Partial<Omit<OperationsSummary, "capabilities">> = {}
): Omit<OperationsSummary, "capabilities"> {
  return {
    total: 0,
    running: 0,
    pending: 0,
    succeeded: 0,
    failed: 0,
    ...overrides
  };
}

export function createResourceOperationsSummary(
  counters: Omit<OperationsSummary, "cpuUsage" | "memoryUsage" | "capabilities">,
  resources: { cpuUsage: number; memoryUsage: number }
): Omit<OperationsSummary, "capabilities"> {
  return {
    ...counters,
    cpuUsage: resources.cpuUsage,
    memoryUsage: resources.memoryUsage
  };
}
