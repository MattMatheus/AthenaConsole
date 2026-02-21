import type { FleetSummary } from "../../shared/contracts.js";

export type FleetMetricsProviderKind = "local" | "k8s";

export interface IFleetMetricsProvider {
  readonly source: FleetMetricsProviderKind;
  getCapabilities(): Promise<{
    supportsPodStatus: boolean;
    supportsCpuMemMetrics: boolean;
  }>;
  getMetrics(): Promise<FleetMetricsSnapshot>;
}

export type FleetMetricsSnapshot = Omit<FleetSummary, "capabilities">;

export function computeFleetHealthMetrics(summary: Pick<FleetSummary, "total" | "failed">): Pick<FleetSummary, "uptime" | "errorRate"> {
  const total = Math.max(0, Math.floor(summary.total));
  const failed = Math.max(0, Math.floor(summary.failed));
  if (total <= 0) {
    return {
      uptime: 0,
      errorRate: 0
    };
  }
  const boundedErrorRate = Math.max(0, Math.min(1, failed / total));
  return {
    uptime: roundTo4(1 - boundedErrorRate),
    errorRate: roundTo4(boundedErrorRate)
  };
}

function roundTo4(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}
