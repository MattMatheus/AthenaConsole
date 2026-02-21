export type FleetSummary = {
  total: number;
  running: number;
  pending: number;
  succeeded: number;
  failed: number;
  uptime?: number;
  errorRate?: number;
  cpuUsage?: number;
  memoryUsage?: number;
  operationalSummary?: {
    totalActiveRuns: number;
    totalActiveSessions: number;
    aggregateResourceUsage: {
      cpuUsage: number;
      memoryUsage: number;
    };
    recentFailureRejectionCount: number;
  };
  costSummary?: {
    month: string;
    windowStart: string;
    windowEnd: string;
    totalEstimatedSpendUsd: number;
    personaBreakdown: Array<{
      personaName: string;
      estimatedSpendUsd: number;
      inputTokens: number;
      outputTokens: number;
      totalTokens: number;
    }>;
    providerBreakdown: Array<{
      provider: string;
      estimatedSpendUsd: number;
      inputTokens: number;
      outputTokens: number;
      totalTokens: number;
    }>;
    tokenMix: {
      inputTokens: number;
      outputTokens: number;
      totalTokens: number;
      inputRatio: number;
      outputRatio: number;
    };
  };
};

export type EventStatus = "success" | "warning" | "error";

export type FleetEvent = {
  id: string;
  timestamp: string;
  message: string;
  status: EventStatus;
};

export type ProviderCostSettings = {
  schemaVersion: 1;
  updatedAt: string;
  providers: Array<{
    provider: string;
    inputCostPer1kTokensUsd: number;
    outputCostPer1kTokensUsd: number;
    updatedAt: string;
  }>;
};
