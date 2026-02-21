import type { FleetSummary } from "../../src/control-plane/api-contracts.js";

export interface MockMetricsProviderCapabilities {
  supportsPodStatus: boolean;
  supportsCpuMemMetrics: boolean;
}

export interface MockMetricsProviderOptions {
  summary?: Omit<FleetSummary, "capabilities">;
  capabilities?: Partial<MockMetricsProviderCapabilities>;
}

export class MockMetricsProvider {
  private summary: Omit<FleetSummary, "capabilities">;
  private capabilities: MockMetricsProviderCapabilities;

  constructor(options: MockMetricsProviderOptions = {}) {
    this.summary = options.summary ?? createBaselineFleetSummary();
    this.capabilities = {
      supportsPodStatus: options.capabilities?.supportsPodStatus ?? false,
      supportsCpuMemMetrics: options.capabilities?.supportsCpuMemMetrics ?? false
    };
  }

  setSummary(summary: Omit<FleetSummary, "capabilities">): void {
    this.summary = summary;
  }

  setCapabilities(capabilities: Partial<MockMetricsProviderCapabilities>): void {
    this.capabilities = {
      ...this.capabilities,
      ...capabilities
    };
  }

  async getMetrics(): Promise<Omit<FleetSummary, "capabilities">> {
    return { ...this.summary };
  }

  async getCapabilities(): Promise<MockMetricsProviderCapabilities> {
    return { ...this.capabilities };
  }
}

export function createBaselineFleetSummary(
  overrides: Partial<Omit<FleetSummary, "capabilities">> = {}
): Omit<FleetSummary, "capabilities"> {
  return {
    total: 0,
    running: 0,
    pending: 0,
    succeeded: 0,
    failed: 0,
    ...overrides
  };
}

export function createResourceFleetSummary(
  counters: Omit<FleetSummary, "cpuUsage" | "memoryUsage" | "capabilities">,
  resources: { cpuUsage: number; memoryUsage: number }
): Omit<FleetSummary, "capabilities"> {
  return {
    ...counters,
    cpuUsage: resources.cpuUsage,
    memoryUsage: resources.memoryUsage
  };
}
