import { ApiClientError, apiClient } from "./apiClient";

type RecordValue = Record<string, unknown>;

export type OperationsCostByAgent = {
  agentName: string;
  estimatedSpendUsd: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
};

export type OperationsCostSummary = {
  month: string;
  windowStart: string;
  windowEnd: string;
  totalEstimatedSpendUsd: number;
  agentBreakdown: OperationsCostByAgent[];
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

export type OperationsSummary = {
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
  operationalSummary?: {
    totalActiveRuns: number;
    totalActiveSessions: number;
    aggregateResourceUsage: {
      cpuUsage: number;
      memoryUsage: number;
    };
    recentFailureRejectionCount: number;
  };
  costSummary?: OperationsCostSummary;
};

export interface OperationsApiClient {
  get<TResponse>(path: string): Promise<TResponse>;
}

export class OperationsApiServiceError extends Error {
  readonly cause: unknown;

  constructor(message: string, cause: unknown) {
    super(message);
    this.name = "OperationsApiServiceError";
    this.cause = cause;
  }
}

function isRecord(value: unknown): value is RecordValue {
  return typeof value === "object" && value !== null;
}

function toNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return fallback;
}

function toOperationsSummary(payload: unknown): OperationsSummary {
  const record = isRecord(payload) ? payload : {};
  const costSummaryRecord = isRecord(record.costSummary) ? record.costSummary : undefined;
  const tokenMixRecord = costSummaryRecord && isRecord(costSummaryRecord.tokenMix) ? costSummaryRecord.tokenMix : undefined;
  const agentBreakdownSource =
    costSummaryRecord && Array.isArray(costSummaryRecord.agentBreakdown)
      ? costSummaryRecord.agentBreakdown
      : [];
  const agentBreakdown = agentBreakdownSource.filter(isRecord).map((row) => ({
    agentName:
      typeof row.agentName === "string"
        ? row.agentName
        : typeof row.agentName === "string"
          ? row.agentName
          : "unattributed",
    estimatedSpendUsd: toNumber(row.estimatedSpendUsd),
    inputTokens: toNumber(row.inputTokens),
    outputTokens: toNumber(row.outputTokens),
    totalTokens: toNumber(row.totalTokens)
  }));

  return {
    total: toNumber(record.total),
    running: toNumber(record.running),
    pending: toNumber(record.pending),
    succeeded: toNumber(record.succeeded),
    failed: toNumber(record.failed),
    capabilities: isRecord(record.capabilities)
      ? {
          supportsPodStatus: Boolean(record.capabilities.supportsPodStatus),
          supportsCpuMemMetrics: Boolean(record.capabilities.supportsCpuMemMetrics)
        }
      : {
          supportsPodStatus: false,
          supportsCpuMemMetrics: false
        },
    ...(typeof record.cpuUsage === "number" ? { cpuUsage: record.cpuUsage } : {}),
    ...(typeof record.memoryUsage === "number" ? { memoryUsage: record.memoryUsage } : {}),
    ...(isRecord(record.operationalSummary)
      ? {
          operationalSummary: {
            totalActiveRuns: toNumber(record.operationalSummary.totalActiveRuns),
            totalActiveSessions: toNumber(record.operationalSummary.totalActiveSessions),
            aggregateResourceUsage: isRecord(record.operationalSummary.aggregateResourceUsage)
              ? {
                  cpuUsage: toNumber(record.operationalSummary.aggregateResourceUsage.cpuUsage),
                  memoryUsage: toNumber(record.operationalSummary.aggregateResourceUsage.memoryUsage)
                }
              : {
                  cpuUsage: 0,
                  memoryUsage: 0
                },
            recentFailureRejectionCount: toNumber(record.operationalSummary.recentFailureRejectionCount)
          }
        }
      : {}),
    ...(costSummaryRecord
      ? {
          costSummary: {
            month:
              typeof costSummaryRecord.month === "string"
                ? costSummaryRecord.month
                : new Date().toISOString().slice(0, 7),
            windowStart:
              typeof costSummaryRecord.windowStart === "string"
                ? costSummaryRecord.windowStart
                : new Date().toISOString(),
            windowEnd:
              typeof costSummaryRecord.windowEnd === "string"
                ? costSummaryRecord.windowEnd
                : new Date().toISOString(),
            totalEstimatedSpendUsd: toNumber(costSummaryRecord.totalEstimatedSpendUsd),
            agentBreakdown,
            providerBreakdown: Array.isArray(costSummaryRecord.providerBreakdown)
              ? costSummaryRecord.providerBreakdown
                  .filter(isRecord)
                  .map((row) => ({
                    provider: typeof row.provider === "string" ? row.provider : "unknown",
                    estimatedSpendUsd: toNumber(row.estimatedSpendUsd),
                    inputTokens: toNumber(row.inputTokens),
                    outputTokens: toNumber(row.outputTokens),
                    totalTokens: toNumber(row.totalTokens)
                  }))
              : [],
            tokenMix: {
              inputTokens: toNumber(tokenMixRecord?.inputTokens),
              outputTokens: toNumber(tokenMixRecord?.outputTokens),
              totalTokens: toNumber(tokenMixRecord?.totalTokens),
              inputRatio: toNumber(tokenMixRecord?.inputRatio),
              outputRatio: toNumber(tokenMixRecord?.outputRatio)
            }
          }
        }
      : {})
  };
}

export class OperationsApiService {
  constructor(private readonly client: OperationsApiClient = apiClient) {}

  async getOperationsSummary(): Promise<OperationsSummary> {
    try {
      const payload = await this.client.get<unknown>("/operations/summary");
      return toOperationsSummary(payload);
    } catch (error) {
      if (error instanceof ApiClientError) {
        throw new OperationsApiServiceError(`Unable to fetch operations summary (${error.status}): ${error.message}`, error);
      }
      if (error instanceof Error) {
        throw new OperationsApiServiceError(`Unable to fetch operations summary: ${error.message}`, error);
      }
      throw new OperationsApiServiceError("Unable to fetch operations summary due to an unknown error.", error);
    }
  }
}

export const operationsApiService = new OperationsApiService();
