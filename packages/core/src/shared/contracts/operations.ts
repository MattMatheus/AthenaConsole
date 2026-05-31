export interface OperationsOperationalSummary {
  totalActiveRuns: number;
  totalActiveSessions: number;
  aggregateResourceUsage: {
    cpuUsage: number;
    memoryUsage: number;
  };
  recentFailureRejectionCount: number;
}

export interface OperationsCostByAgent {
  agentName: string;
  estimatedSpendUsd: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

export interface OperationsCostByProvider {
  provider: string;
  estimatedSpendUsd: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

export interface OperationsTokenMix {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  inputRatio: number;
  outputRatio: number;
}

export interface OperationsCostSummary {
  month: string;
  windowStart: string;
  windowEnd: string;
  totalEstimatedSpendUsd: number;
  agentBreakdown: OperationsCostByAgent[];
  providerBreakdown: OperationsCostByProvider[];
  tokenMix: OperationsTokenMix;
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

export interface OperationsSummary {
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
  operationalSummary?: OperationsOperationalSummary;
  costSummary?: OperationsCostSummary;
}
