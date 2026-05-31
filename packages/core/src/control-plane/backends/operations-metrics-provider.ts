import type { OperationsSummary } from "../../shared/contracts.js";

export type OperationsMetricsProviderKind = "local" | "k8s";

export interface IOperationsMetricsProvider {
  readonly source: OperationsMetricsProviderKind;
  getCapabilities(): Promise<{
    supportsPodStatus: boolean;
    supportsCpuMemMetrics: boolean;
  }>;
  getMetrics(): Promise<OperationsMetricsSnapshot>;
}

export type OperationsMetricsSnapshot = Omit<OperationsSummary, "capabilities">;

export function computeOperationsHealthMetrics(summary: Pick<OperationsSummary, "total" | "failed">): Pick<OperationsSummary, "uptime" | "errorRate"> {
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
