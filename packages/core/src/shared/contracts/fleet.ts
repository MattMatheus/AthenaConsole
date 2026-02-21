export interface FleetOperationalSummary {
  totalActiveRuns: number;
  totalActiveSessions: number;
  aggregateResourceUsage: {
    cpuUsage: number;
    memoryUsage: number;
  };
  recentFailureRejectionCount: number;
}

export interface FleetCostByPersona {
  personaName: string;
  estimatedSpendUsd: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

export interface FleetCostByProvider {
  provider: string;
  estimatedSpendUsd: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

export interface FleetTokenMix {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  inputRatio: number;
  outputRatio: number;
}

export interface FleetCostSummary {
  month: string;
  windowStart: string;
  windowEnd: string;
  totalEstimatedSpendUsd: number;
  personaBreakdown: FleetCostByPersona[];
  providerBreakdown: FleetCostByProvider[];
  tokenMix: FleetTokenMix;
}

export interface ProviderTokenPricing {
  provider: string;
  inputCostPer1kTokensUsd: number;
  outputCostPer1kTokensUsd: number;
  updatedAt: string;
}

export interface ProviderCostSettings {
  schemaVersion: 1;
  updatedAt: string;
  providers: ProviderTokenPricing[];
}

export interface FleetSummary {
  total: number;
  running: number;
  pending: number;
  succeeded: number;
  failed: number;
  uptime?: number;
  errorRate?: number;
  capabilities: {
    supportsPodStatus: boolean;
    supportsCpuMemMetrics: boolean;
  };
  cpuUsage?: number;
  memoryUsage?: number;
  operationalSummary?: FleetOperationalSummary;
  costSummary?: FleetCostSummary;
}
